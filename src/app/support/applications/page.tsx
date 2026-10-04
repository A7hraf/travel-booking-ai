import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApplicationTable } from "@/components/application-table";

export default async function SupportApplicationsPage() {
  await requireUser(["SUPPORT", "ADMIN"]);
  const include = { applicant: { select: { name: true, email: true } } };
  const [toValidate, recent] = await Promise.all([
    db.companyApplication.findMany({ where: { status: "SUBMITTED" }, include, orderBy: { updatedAt: "asc" } }),
    db.companyApplication.findMany({ where: { status: { not: "SUBMITTED" } }, include, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="h1">Company applications</h1>
      <p className="text-sm text-gray-600">Check each application&apos;s details and documents. Validated applications go to an administrator for final approval.</p>
      <ApplicationTable apps={toValidate} basePath="/support/applications" empty="Nothing to validate." />
      <h2 className="text-lg font-semibold">Recently reviewed</h2>
      <ApplicationTable apps={recent} basePath="/support/applications" empty="None yet." />
    </div>
  );
}
