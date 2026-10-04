import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAccessConversation } from "@/lib/services/conversations";
import { date, money } from "@/lib/format";
import { claimConversation, closeConversation, escalateToSupport, routeToCompany } from "@/app/actions/conversations";
import { Badge } from "@/components/badge";
import { ChatWindow } from "@/components/chat-window";

/** Staff view of a handed-off conversation (company staff and support/admin). */
export default async function InboxConversationPage(props: PageProps<"/inbox/[id]">) {
  const user = await requireUser(["COMPANY_OWNER", "COMPANY_EMPLOYEE", "SUPPORT", "ADMIN"]);
  const { id } = await props.params;
  const convo = await db.conversation.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      assignedTo: { select: { name: true } },
      company: { select: { name: true } },
      bookings: { include: { package: { select: { title: true } } } },
    },
  });
  if (!convo || !canAccessConversation(user, convo)) notFound();
  const isSupport = user.role === "SUPPORT" || user.role === "ADMIN";
  const companies = isSupport ? await db.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const open = convo.status !== "CLOSED";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="h1">{convo.customer.name}</h1>
          <Badge value={convo.status} />
        </div>
        {convo.status === "AI_ACTIVE" && (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">The AI assistant is still handling this chat. Replying here won&apos;t stop it.</p>
        )}
        <ChatWindow conversationId={convo.id} viewer="staff" initialStatus={convo.status} />
      </div>

      <aside className="space-y-4">
        <div className="card space-y-1 text-sm">
          <h2 className="mb-2 font-medium">Customer</h2>
          <p>{convo.customer.email}</p>
          {convo.customer.phone && <p>{convo.customer.phone}</p>}
          {convo.company && <p className="text-gray-500">Company: {convo.company.name}</p>}
          <p className="text-gray-500">Assigned: {convo.assignedTo?.name ?? "nobody"}</p>
          {convo.handoffReason && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-gray-700">{convo.handoffReason}</p>}
        </div>

        {convo.bookings.length > 0 && (
          <div className="card space-y-2 text-sm">
            <h2 className="font-medium">Bookings</h2>
            {convo.bookings.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono">{b.reference}</p>
                  <p className="text-gray-500">
                    {b.package.title} · {b.travelers} pax · {date(b.travelDate)} · {money(b.totalPrice, b.currency)}
                  </p>
                </div>
                <Badge value={b.status} />
              </div>
            ))}
            {!isSupport && <Link href="/company/bookings" className="text-brand-700 underline">Manage bookings</Link>}
          </div>
        )}

        {open && (
          <div className="card space-y-3">
            <h2 className="font-medium">Actions</h2>
            {convo.assignedToId !== user.id && (
              <form action={claimConversation}>
                <input type="hidden" name="conversationId" value={convo.id} />
                <button className="btn w-full">Assign to me</button>
              </form>
            )}
            {!isSupport && (
              <form action={escalateToSupport} className="space-y-2">
                <input type="hidden" name="conversationId" value={convo.id} />
                <input name="reason" placeholder="Reason for escalating" className="input" required />
                <button className="btn w-full">Escalate to platform support</button>
              </form>
            )}
            {isSupport && companies.length > 0 && (
              <form action={routeToCompany} className="space-y-2">
                <input type="hidden" name="conversationId" value={convo.id} />
                <select name="companyId" className="input" defaultValue={convo.companyId ?? ""} required>
                  <option value="" disabled>Choose a company…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input name="reason" placeholder="Note for the company" className="input" />
                <button className="btn w-full">Route to company</button>
              </form>
            )}
            <form action={closeConversation}>
              <input type="hidden" name="conversationId" value={convo.id} />
              <button className="btn-danger w-full">Close conversation</button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}
