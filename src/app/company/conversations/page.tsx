import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { ConversationList } from "@/components/conversation-list";

export default async function CompanyConversationsPage() {
  const user = await requireCompanyUser();
  const include = { customer: { select: { name: true } }, assignedTo: { select: { name: true } } };
  const [open, closed] = await Promise.all([
    db.conversation.findMany({ where: { companyId: user.companyId, status: "HANDED_TO_COMPANY" }, include, orderBy: { updatedAt: "desc" } }),
    db.conversation.findMany({ where: { companyId: user.companyId, status: "CLOSED" }, include, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="h1">Customer conversations</h1>
      <p className="text-sm text-gray-600">Chats the AI assistant handed to your team: new bookings to confirm and questions only you can answer.</p>
      <ConversationList conversations={open} empty="Nothing waiting for your team." />
      <h2 className="text-lg font-semibold">Recently closed</h2>
      <ConversationList conversations={closed} empty="No closed conversations yet." />
    </div>
  );
}
