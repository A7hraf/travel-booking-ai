import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { changeBookingStatus } from "@/app/actions/bookings";
import { Badge } from "@/components/badge";

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

export default async function CompanyBookingsPage() {
  const user = await requireCompanyUser();
  const bookings = await db.booking.findMany({
    where: { companyId: user.companyId },
    include: { package: { select: { title: true } }, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="h1">Bookings</h1>
      <div className="card overflow-x-auto p-0">
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
                <td className="space-x-1 whitespace-nowrap">
                  {(NEXT[b.status] ?? []).map((n) => (
                    <form key={n.status} action={changeBookingStatus} className="inline">
                      <input type="hidden" name="bookingId" value={b.id} />
                      <input type="hidden" name="status" value={n.status} />
                      <button className={n.cls}>{n.label}</button>
                    </form>
                  ))}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={8} className="text-gray-500">No bookings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
