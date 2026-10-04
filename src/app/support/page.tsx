import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ConversationList } from "@/components/conversation-list";

export default async function SupportInboxPage() {
  await requireUser(["SUPPORT", "ADMIN"]);
  const include = { customer: { select: { name: true } }, assignedTo: { select: { name: true } }, company: { select: { name: true } } };
  const [open, pendingApps] = await Promise.all([
    db.conversation.findMany({ where: { status: "HANDED_TO_SUPPORT" }, include, orderBy: { handedOffAt: "asc" } }),
    db.companyApplication.count({ where: { status: "SUBMITTED" } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Support inbox</h1>
        <Link href="/support/applications" className="btn">{pendingApps} application(s) to validate</Link>
      </div>
      <ConversationList conversations={open} empty="No conversations waiting for support." />
    </div>
  );
}
