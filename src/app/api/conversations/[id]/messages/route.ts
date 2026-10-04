import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessConversation } from "@/lib/services/conversations";
import { notifyCompanyStaff, notifyRoles, notifyUsers } from "@/lib/services/notifications";
import { runAssistantTurn } from "@/lib/ai/assistant";
import { rateLimit } from "@/lib/rate-limit";

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

  if (!rateLimit(`chat:${user.id}`, 30, 5 * 60_000).ok) {
    return NextResponse.json({ error: "You're sending messages too quickly. Please wait a moment." }, { status: 429 });
  }

  const isCustomer = convo.customerId === user.id;
  const aiTurn = isCustomer && convo.status === "AI_ACTIVE";
  if (aiTurn) {
    // One AI turn at a time per conversation; the lock expires on its own if a turn crashes.
    const now = new Date();
    const locked = await db.conversation.updateMany({
      where: { id, OR: [{ aiBusyUntil: null }, { aiBusyUntil: { lt: now } }] },
      data: { aiBusyUntil: new Date(now.getTime() + 3 * 60_000) },
    });
    if (locked.count === 0) {
      return NextResponse.json({ error: "The assistant is still replying to your last message." }, { status: 409 });
    }
  }

  await db.chatMessage.create({
    data: { conversationId: id, senderType: isCustomer ? "CUSTOMER" : "STAFF", senderId: user.id, content: parsed.data.content },
  });
  if (isCustomer && convo.title === "New trip") {
    await db.conversation.update({ where: { id }, data: { title: parsed.data.content.slice(0, 60) } });
  } else {
    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  // Let the humans on the other side know there's a new message.
  const preview = parsed.data.content.slice(0, 140);
  if (!isCustomer) {
    await notifyUsers([convo.customerId], { title: `New message from ${user.name}`, body: preview, link: `/chat/${id}` });
  } else if (convo.status !== "AI_ACTIVE") {
    const note = { title: `New message from ${user.name}`, body: preview, link: `/inbox/${id}` };
    if (convo.assignedToId) await notifyUsers([convo.assignedToId], note);
    else if (convo.status === "HANDED_TO_COMPANY" && convo.companyId) await notifyCompanyStaff(convo.companyId, note);
    else if (convo.status === "HANDED_TO_SUPPORT") await notifyRoles(["SUPPORT"], note);
  }

  // The AI only answers while it still owns the conversation.
  if (aiTurn) {
    try {
      await runAssistantTurn(id, parsed.data.content);
    } finally {
      await db.conversation.update({ where: { id }, data: { aiBusyUntil: null } });
    }
  }
  return NextResponse.json({ ok: true });
}
