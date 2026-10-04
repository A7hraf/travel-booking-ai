import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessConversation } from "@/lib/services/conversations";
import { runAssistantTurn } from "@/lib/ai/assistant";

// An AI turn with several tool calls can take a while.
export const maxDuration = 120;

async function load(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const convo = await db.conversation.findUnique({ where: { id } });
  if (!convo || !canAccessConversation(user, convo)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user, convo };
}

export async function GET(request: Request, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  const { id } = await ctx.params;
  const loaded = await load(id);
  if ("error" in loaded) return loaded.error;
  const after = new URL(request.url).searchParams.get("after");
  const messages = await db.chatMessage.findMany({
    where: { conversationId: id, ...(after && { createdAt: { gt: new Date(after) } }) },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true } } },
  });
  return NextResponse.json({ status: loaded.convo.status, messages });
}

const bodySchema = z.object({ content: z.string().trim().min(1).max(4000) });

export async function POST(request: Request, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  const { id } = await ctx.params;
  const loaded = await load(id);
  if ("error" in loaded) return loaded.error;
  const { user, convo } = loaded;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 });
  if (convo.status === "CLOSED") return NextResponse.json({ error: "This conversation is closed" }, { status: 409 });

  const isCustomer = convo.customerId === user.id;
  await db.chatMessage.create({
    data: { conversationId: id, senderType: isCustomer ? "CUSTOMER" : "STAFF", senderId: user.id, content: parsed.data.content },
  });
  if (isCustomer && convo.title === "New trip") {
    await db.conversation.update({ where: { id }, data: { title: parsed.data.content.slice(0, 60) } });
  } else {
    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  // The AI only answers while it still owns the conversation.
  if (isCustomer && convo.status === "AI_ACTIVE") {
    await runAssistantTurn(id, parsed.data.content);
  }
  return NextResponse.json({ ok: true });
}
