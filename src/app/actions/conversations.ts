"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addSystemMessage, canAccessConversation, handOffToCompany, handOffToSupport } from "@/lib/services/conversations";

const GREETING =
  "Hi! I'm your travel assistant. Tell me where you'd like to go (or what kind of trip you have in mind), when, and how many people are travelling, and I'll find packages that fit.";

/** Starts an AI chat. From a package page, the customer's first message is pre-filled with that package. */
export async function startConversation(formData: FormData) {
  const user = await requireUser(["CUSTOMER"]);
  const convo = await db.conversation.create({
    data: { customerId: user.id, messages: { create: { senderType: "AI", content: GREETING } } },
  });
  const packageTitle = formData.get("packageTitle");
  const draft = typeof packageTitle === "string" && packageTitle ? `I'm interested in the "${packageTitle}" package.` : "";
  redirect(`/chat/${convo.id}${draft ? `?draft=${encodeURIComponent(draft)}` : ""}`);
}

async function loadForStaff(conversationId: string) {
  const user = await requireUser(["COMPANY_OWNER", "COMPANY_EMPLOYEE", "SUPPORT", "ADMIN"]);
  const convo = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!convo || !canAccessConversation(user, convo)) throw new Error("Not allowed");
  return { user, convo };
}

export async function claimConversation(formData: FormData) {
  const { user, convo } = await loadForStaff(String(formData.get("conversationId")));
  await db.conversation.update({ where: { id: convo.id }, data: { assignedToId: user.id } });
  await addSystemMessage(convo.id, `${user.name} joined the conversation.`);
  revalidatePath(`/inbox/${convo.id}`);
}

export async function closeConversation(formData: FormData) {
  const { user, convo } = await loadForStaff(String(formData.get("conversationId")));
  await db.conversation.update({ where: { id: convo.id }, data: { status: "CLOSED" } });
  await addSystemMessage(convo.id, `Conversation closed by ${user.name}.`);
  revalidatePath(`/inbox/${convo.id}`);
}

/** Company staff escalate to platform support (e.g. payment dispute). */
export async function escalateToSupport(formData: FormData) {
  const { user, convo } = await loadForStaff(String(formData.get("conversationId")));
  await handOffToSupport(convo.id, `Escalated by ${user.name}: ${String(formData.get("reason") || "no reason given")}`);
  redirect(user.role === "SUPPORT" || user.role === "ADMIN" ? `/inbox/${convo.id}` : "/company/conversations");
}

/** Support routes a conversation to a specific company. */
export async function routeToCompany(formData: FormData) {
  const { user, convo } = await loadForStaff(String(formData.get("conversationId")));
  if (user.role !== "SUPPORT" && user.role !== "ADMIN") throw new Error("Not allowed");
  const companyId = String(formData.get("companyId"));
  await handOffToCompany(convo.id, companyId, `Routed by support (${user.name}): ${String(formData.get("reason") || "")}`);
  revalidatePath(`/inbox/${convo.id}`);
}

/** Customer skips the AI and asks for a person (also the way out if the AI is unavailable). */
export async function requestHuman(formData: FormData) {
  const user = await requireUser(["CUSTOMER"]);
  const convo = await db.conversation.findFirst({
    where: { id: String(formData.get("conversationId")), customerId: user.id, status: "AI_ACTIVE" },
  });
  if (!convo) return;
  if (convo.companyId) {
    await handOffToCompany(convo.id, convo.companyId, "Customer asked to talk to a person.");
  } else {
    await handOffToSupport(convo.id, "Customer asked to talk to a person.");
  }
  revalidatePath(`/chat/${convo.id}`);
}
