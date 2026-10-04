import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { Badge } from "@/components/badge";

export default async function CompanyPackagesPage() {
  const user = await requireCompanyUser();
  const packages = await db.travelPackage.findMany({ where: { companyId: user.companyId }, orderBy: { updatedAt: "desc" } });
  const isOwner = user.role === "COMPANY_OWNER";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Packages</h1>
        <Link href="/company/packages/new" className="btn-primary">New package</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Destination</th>
              <th>Price / person</th>
              {isOwner && <th>Margin / person</th>}
              <th>Availability</th>
              <th>Seats</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/company/packages/${p.id}`} className="font-medium text-brand-700 underline">{p.title}</Link>
                </td>
                <td>{p.destination}, {p.country}</td>
                <td>{money(p.pricePerPerson, p.currency)}</td>
                {isOwner && <td>{money(p.pricePerPerson.sub(p.costPerPerson), p.currency)}</td>}
                <td>{date(p.availableFrom)} – {date(p.availableTo)}</td>
                <td>{p.seatsBooked} / {p.seatsTotal}</td>
                <td><Badge value={p.status} /></td>
              </tr>
            ))}
            {packages.length === 0 && (
              <tr><td colSpan={7} className="text-gray-500">No packages yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
