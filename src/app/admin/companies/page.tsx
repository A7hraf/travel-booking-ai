import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { updateCompanyAdmin } from "@/app/actions/admin";

export default async function AdminCompaniesPage() {
  await requireUser(["ADMIN"]);
  const companies = await db.company.findMany({
    include: { _count: { select: { packages: true, bookings: true, staff: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="h1">Companies</h1>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Location</th>
              <th>Packages</th>
              <th>Bookings</th>
              <th>Staff</th>
              <th>Commission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>{c.name}<div className="text-xs text-gray-500">{c.contactEmail}</div></td>
                <td>{c.city}, {c.country}</td>
                <td>{c._count.packages}</td>
                <td>{c._count.bookings}</td>
                <td>{c._count.staff}</td>
                <td>
                  <form action={updateCompanyAdmin} className="flex gap-1">
                    <input type="hidden" name="companyId" value={c.id} />
                    <input name="commissionPercent" type="number" step="0.1" min={0} max={50} defaultValue={(Number(c.commissionRate) * 100).toFixed(1)} className="input w-20" />
                    <button className="btn">Save</button>
                  </form>
                </td>
                <td>
                  <form action={updateCompanyAdmin}>
                    <input type="hidden" name="companyId" value={c.id} />
                    <input type="hidden" name="active" value={String(!c.active)} />
                    <button className="btn">{c.active ? "Suspend" : "Reactivate"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
