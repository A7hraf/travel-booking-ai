import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { updateCompanyProfile } from "@/app/actions/team";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export default async function CompanyDashboard() {
  const user = await requireCompanyUser();
  const [company, activePackages, openChats, pendingBookings] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: user.companyId } }),
    db.travelPackage.count({ where: { companyId: user.companyId, status: "ACTIVE" } }),
    db.conversation.count({ where: { companyId: user.companyId, status: "HANDED_TO_COMPANY" } }),
    db.booking.count({ where: { companyId: user.companyId, status: "PENDING_CONFIRMATION" } }),
  ]);
  const isOwner = user.role === "COMPANY_OWNER";

  return (
    <div className="space-y-6">
      <h1 className="h1">{company.name}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/company/packages" className="card hover:border-brand-600">
          <p className="text-sm text-gray-500">Active packages</p>
          <p className="text-3xl font-semibold">{activePackages}</p>
        </Link>
        <Link href="/company/conversations" className="card hover:border-brand-600">
          <p className="text-sm text-gray-500">Customer chats waiting</p>
          <p className="text-3xl font-semibold">{openChats}</p>
        </Link>
        <Link href="/company/bookings" className="card hover:border-brand-600">
          <p className="text-sm text-gray-500">Bookings to confirm</p>
          <p className="text-3xl font-semibold">{pendingBookings}</p>
        </Link>
      </div>

      {isOwner && (
        <div className="card">
          <h2 className="mb-4 font-medium">Company profile</h2>
          <ActionForm action={updateCompanyProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" defaultValue={company.name} />
              <Field label="Website" name="website" type="url" required={false} defaultValue={company.website} />
              <Field label="Contact email" name="contactEmail" type="email" defaultValue={company.contactEmail} />
              <Field label="Contact phone" name="contactPhone" defaultValue={company.contactPhone} />
              <Field label="City" name="city" defaultValue={company.city} />
              <Field label="Country" name="country" defaultValue={company.country} />
            </div>
            <Field label="Description" name="description" textarea defaultValue={company.description} />
            <p className="text-xs text-gray-500">Platform commission: {(Number(company.commissionRate) * 100).toFixed(1)}% (set by the platform)</p>
            <SubmitButton>Save profile</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
