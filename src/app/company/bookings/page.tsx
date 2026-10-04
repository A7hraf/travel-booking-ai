import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { changeBookingStatus } from "@/app/actions/bookings";
import { Badge } from "@/components/badge";
import { PaymentForm } from "@/components/payment-form";

const NEXT: Record<string, { status: string; label: string; cls: string }[]> = {
  PENDING_CONFIRMATION: [
    { status: "CONFIRMED", label: "Confirm", cls: "btn-primary" },
    { status: "CANCELLED", label: "Cancel", cls: "btn" },
  ],
  CONFIRMED: [
    { status: "COMPLETED", label: "Mark completed", cls: "btn" },
    { status: "CANCELLED", label: "Cancel", cls: "btn" },
  ],
};

type Row = Awaited<ReturnType<typeof load>>[number];

async function load(companyId: string, filter?: string) {
  return db.booking.findMany({
    where: {
      companyId,
      ...(filter === "unpaid" && { paymentStatus: "UNPAID", status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] } }),
      ...(filter === "pending" && { status: "PENDING_CONFIRMATION" }),
    },
    include: { package: { select: { title: true } }, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

function Actions({ b }: { b: Row }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(NEXT[b.status] ?? []).map((n) => (
        <form key={n.status} action={changeBookingStatus}>
          <input type="hidden" name="bookingId" value={b.id} />
          <input type="hidden" name="status" value={n.status} />
          <button className={n.cls}>{n.label}</button>
        </form>
      ))}
      {b.paymentStatus === "UNPAID" && b.status !== "CANCELLED" && <PaymentForm bookingId={b.id} />}
    </div>
  );
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "To confirm" },
  { key: "unpaid", label: "Unpaid" },
];

export default async function CompanyBookingsPage(props: PageProps<"/company/bookings">) {
  const user = await requireCompanyUser();
  const { filter } = await props.searchParams;
  const active = typeof filter === "string" ? filter : "";
  const bookings = await load(user.companyId, active);

  return (
    <div className="space-y-6">
      <h1 className="h1">Bookings</h1>
      <nav className="flex gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key ? `/company/bookings?filter=${f.key}` : "/company/bookings"} className={active === f.key ? "btn-primary" : "btn"}>
            {f.label}
          </Link>
        ))}
      </nav>

      {/* Phone: one card per booking */}
      <div className="space-y-3 md:hidden">
        {bookings.map((b) => (
          <div key={b.id} className="card space-y-2 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{b.package.title}</p>
                <p className="font-mono text-xs text-gray-500">{b.reference}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge value={b.status} />
                <Badge value={b.paymentStatus} />
              </div>
            </div>
            <p>
              {b.contactName} · {b.contactPhone}
            </p>
            <p className="text-gray-600">
              {date(b.travelDate)} · {b.travelers} traveler{b.travelers > 1 ? "s" : ""} · {money(b.totalPrice, b.currency)}
            </p>
            {b.notes && <p className="text-xs text-gray-500">Note: {b.notes}</p>}
            <Actions b={b} />
            {b.conversationId && (
              <Link href={`/inbox/${b.conversationId}`} className="inline-block text-brand-700 underline">
                Open chat
              </Link>
            )}
          </div>
        ))}
        {bookings.length === 0 && <div className="card text-sm text-gray-500">No bookings here.</div>}
      </div>

      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Package</th>
              <th>Date</th>
              <th>Pax</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="font-mono">
                  {b.reference}
                  {b.conversationId && (
                    <Link href={`/inbox/${b.conversationId}`} className="block text-xs text-brand-700 underline">chat</Link>
                  )}
                </td>
                <td>
                  {b.contactName}
                  <div className="text-xs text-gray-500">{b.contactPhone} · {b.customer.email}</div>
                  {b.notes && <div className="text-xs text-gray-500">Note: {b.notes}</div>}
                </td>
                <td>{b.package.title}</td>
                <td className="whitespace-nowrap">{date(b.travelDate)}</td>
                <td>{b.travelers}</td>
                <td>{money(b.totalPrice, b.currency)}</td>
                <td><Badge value={b.status} /></td>
                <td>
                  <Badge value={b.paymentStatus} />
                  {b.paymentMethod && <div className="text-xs text-gray-500 lowercase">{b.paymentMethod.replaceAll("_", " ")}{b.paymentRef && ` · ${b.paymentRef}`}</div>}
                </td>
                <td className="min-w-56"><Actions b={b} /></td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={9} className="text-gray-500">No bookings here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
