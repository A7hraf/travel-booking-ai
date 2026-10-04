import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { companyProfitSummary } from "@/lib/services/bookings";

/** Owner-only: revenue, costs, platform commission and net profit from confirmed and completed bookings. */
export default async function ProfitPage() {
  const user = await requireCompanyUser(true);
  const [{ rows, byPackage }, packages] = await Promise.all([
    companyProfitSummary(user.companyId),
    db.travelPackage.findMany({ where: { companyId: user.companyId }, select: { id: true, title: true } }),
  ]);
  const titles = new Map(packages.map((p) => [p.id, p.title]));
  const earned = rows.filter((r) => r.status === "CONFIRMED" || r.status === "COMPLETED");
  const pending = rows.filter((r) => r.status === "PENDING_CONFIRMATION");

  const currencies = [...new Set(earned.map((r) => r.currency))];
  const totals = currencies.map((currency) => {
    const sum = (k: "totalPrice" | "totalCost" | "platformFee") =>
      earned.filter((r) => r.currency === currency).reduce((acc, r) => acc + Number(r._sum[k] ?? 0), 0);
    const revenue = sum("totalPrice");
    const cost = sum("totalCost");
    const fee = sum("platformFee");
    return { currency, revenue, cost, fee, profit: revenue - cost - fee };
  });

  return (
    <div className="space-y-6">
      <h1 className="h1">Profit</h1>
      <p className="text-sm text-gray-600">
        Based on confirmed and completed bookings. Profit = revenue − your package costs − platform commission.
      </p>
      {totals.length === 0 && <div className="card text-sm text-gray-500">No confirmed bookings yet.</div>}
      {totals.map((t) => (
        <div key={t.currency} className="grid gap-4 sm:grid-cols-4">
          {[
            ["Revenue", t.revenue],
            ["Costs", t.cost],
            ["Platform commission", t.fee],
            ["Net profit", t.profit],
          ].map(([label, value]) => (
            <div key={label as string} className="card">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`text-2xl font-semibold ${label === "Net profit" ? "text-green-700" : ""}`}>{money(value as number, t.currency)}</p>
            </div>
          ))}
        </div>
      ))}
      {pending.length > 0 && (
        <p className="text-sm text-gray-600">
          Pending confirmation:{" "}
          {pending.map((p) => `${p._count} booking(s) worth ${money(Number(p._sum.totalPrice ?? 0), p.currency)}`).join(", ")}
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Bookings</th>
              <th>Travelers</th>
              <th>Revenue</th>
              <th>Costs</th>
              <th>Commission</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {byPackage.map((r) => {
              const revenue = Number(r._sum.totalPrice ?? 0);
              const cost = Number(r._sum.totalCost ?? 0);
              const fee = Number(r._sum.platformFee ?? 0);
              return (
                <tr key={`${r.packageId}-${r.currency}`}>
                  <td>{titles.get(r.packageId)}</td>
                  <td>{r._count}</td>
                  <td>{r._sum.travelers}</td>
                  <td>{money(revenue, r.currency)}</td>
                  <td>{money(cost, r.currency)}</td>
                  <td>{money(fee, r.currency)}</td>
                  <td className="font-medium">{money(revenue - cost - fee, r.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
