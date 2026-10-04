import "server-only";
import type { Conversation, User } from "@prisma/client";
import { db } from "../db";
import { notifyCompanyStaff, notifyRoles } from "./notifications";

export async function addSystemMessage(conversationId: string, content: string) {
  return db.chatMessage.create({ data: { conversationId, senderType: "SYSTEM", content } });
}

export async function handOffToCompany(conversationId: string, companyId: string, reason: string) {
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: "HANDED_TO_COMPANY", companyId, handoffReason: reason, handedOffAt: new Date(), assignedToId: null },
  });
  const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
  await addSystemMessage(conversationId, `Conversation transferred to ${company?.name ?? "the travel company"}. A team member will reply here.`);
  await notifyCompanyStaff(companyId, { title: "New customer conversation", body: reason, link: `/inbox/${conversationId}` });
}

export async function handOffToSupport(conversationId: string, reason: string) {
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: "HANDED_TO_SUPPORT", handoffReason: reason, handedOffAt: new Date(), assignedToId: null },
  });
  await addSystemMessage(conversationId, "Conversation transferred to the support team. Someone will reply here shortly.");
  await notifyRoles(["SUPPORT"], { title: "Conversation needs support", body: reason, link: `/inbox/${conversationId}` });
}

/** Who may read/write a conversation: its customer, staff of the company it was handed to, or support/admin. */
export function canAccessConversation(user: User, convo: Pick<Conversation, "customerId" | "companyId" | "status">) {
  if (convo.customerId === user.id) return true;
  if (user.role === "SUPPORT" || user.role === "ADMIN") return true;
  if ((user.role === "COMPANY_OWNER" || user.role === "COMPANY_EMPLOYEE") && user.companyId) {
    return convo.companyId === user.companyId && (convo.status === "HANDED_TO_COMPANY" || convo.status === "CLOSED");
  }
  return false;
}
