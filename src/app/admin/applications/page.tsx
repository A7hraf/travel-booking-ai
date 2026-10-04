import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApplicationTable } from "@/components/application-table";

export default async function AdminApplicationsPage() {
  await requireUser(["ADMIN"]);
  const include = { applicant: { select: { name: true, email: true } } };
  const [validated, others] = await Promise.all([
    db.companyApplication.findMany({ where: { status: "VALIDATED" }, include, orderBy: { validatedAt: "asc" } }),
    db.companyApplication.findMany({ where: { status: { not: "VALIDATED" } }, include, orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="h1">Company approvals</h1>
      <p className="text-sm text-gray-600">Applications validated by support, waiting for your final decision.</p>
      <ApplicationTable apps={validated} basePath="/admin/applications" empty="Nothing waiting for approval." />
      <h2 className="text-lg font-semibold">All other applications</h2>
      <ApplicationTable apps={others} basePath="/admin/applications" empty="None." />
    </div>
  );
}
