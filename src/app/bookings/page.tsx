import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { Badge } from "@/components/badge";

export default async function MyBookingsPage() {
  const user = await requireUser(["CUSTOMER"]);
  const bookings = await db.booking.findMany({
    where: { customerId: user.id },
    include: { package: { select: { title: true } }, company: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="h1">My bookings</h1>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Package</th>
              <th>Travel date</th>
              <th>Travelers</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="font-mono">{b.reference}</td>
                <td>
                  {b.package.title}
                  <div className="text-xs text-gray-500">{b.company.name}</div>
                </td>
                <td>{date(b.travelDate)}</td>
                <td>{b.travelers}</td>
                <td>{money(b.totalPrice, b.currency)}</td>
                <td>
                  <Badge value={b.status} />
                </td>
                <td>{b.conversationId && <Link href={`/chat/${b.conversationId}`} className="text-brand-700 underline">Chat</Link>}</td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="text-gray-500">No bookings yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
