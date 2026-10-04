import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { cancelMyBooking } from "@/app/actions/bookings";
import { Badge } from "@/components/badge";

export default async function MyBookingsPage() {
  const user = await requireUser(["CUSTOMER"]);
  const bookings = await db.booking.findMany({
    where: { customerId: user.id },
    include: { package: { select: { title: true, id: true } }, company: { select: { name: true, contactPhone: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="h1">My bookings</h1>
      {bookings.length === 0 && (
        <div className="card text-sm text-gray-600">
          No bookings yet. <Link href="/chat" className="text-brand-700 underline">Start a chat</Link> to plan a trip.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {bookings.map((b) => (
          <div key={b.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/packages/${b.package.id}`} className="font-medium hover:underline">{b.package.title}</Link>
                <p className="text-sm text-gray-500">{b.company.name}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge value={b.status} />
                <Badge value={b.paymentStatus} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-gray-500">Reference</dt><dd className="font-mono">{b.reference}</dd></div>
              <div><dt className="text-gray-500">Travel date</dt><dd>{date(b.travelDate)}</dd></div>
              <div><dt className="text-gray-500">Travelers</dt><dd>{b.travelers}</dd></div>
              <div><dt className="text-gray-500">Total</dt><dd className="font-medium">{money(b.totalPrice, b.currency)}</dd></div>
            </dl>
            {b.status === "PENDING_CONFIRMATION" && (
              <p className="text-sm text-gray-600">The company will confirm your booking and tell you how to pay in the chat.</p>
            )}
            {b.status === "CONFIRMED" && b.paymentStatus === "UNPAID" && (
              <p className="text-sm text-gray-600">Confirmed. Pay {b.company.name} as agreed in the chat (company phone: {b.company.contactPhone}).</p>
            )}
            {b.paymentStatus === "REFUNDED" && <p className="text-sm text-gray-600">This booking was cancelled after payment; the company will refund you.</p>}
            <div className="flex flex-wrap gap-2">
              {b.conversationId && <Link href={`/chat/${b.conversationId}`} className="btn">Open chat</Link>}
              {b.status === "PENDING_CONFIRMATION" && (
                <form action={cancelMyBooking}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <button className="btn">Cancel booking</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
