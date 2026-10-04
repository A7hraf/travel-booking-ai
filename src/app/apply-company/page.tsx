import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { submitApplication } from "@/app/actions/applications";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { Badge } from "@/components/badge";

const DOCS = [
  { kind: "business_license", label: "Business / tourism license" },
  { kind: "tax_certificate", label: "Tax registration certificate" },
  { kind: "owner_id", label: "Owner's ID or passport" },
];

export default async function ApplyCompanyPage() {
  const user = await requireUser();
  if (user.role === "COMPANY_OWNER" || user.role === "COMPANY_EMPLOYEE") redirect("/company");
  if (user.role !== "CUSTOMER") redirect("/");

  const application = await db.companyApplication.findFirst({
    where: { applicantId: user.id },
    orderBy: { createdAt: "desc" },
    include: { documents: true },
  });
  const canEdit = !application || application.status === "NEEDS_CHANGES" || application.status === "REJECTED";
  // After a rejection the user may start a fresh application.
  const prefill = application?.status === "NEEDS_CHANGES" ? application : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="h1">List your travel company</h1>
        <p className="mt-1 text-sm text-gray-600">
          Submit your company details and documents. Our support team validates them, then an administrator approves your company
          profile. Once approved, your account becomes the company owner account.
        </p>
      </div>

      {application && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Your application: {application.companyName}</h2>
            <Badge value={application.status} />
          </div>
          <p className="text-sm text-gray-500">Submitted {dateTime(application.createdAt)}</p>
          {application.status === "SUBMITTED" && <p className="text-sm">Waiting for the support team to validate your documents.</p>}
          {application.status === "VALIDATED" && <p className="text-sm">Documents validated. Waiting for final approval by an administrator.</p>}
          {application.validationNotes && (
            <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">Support: {application.validationNotes}</p>
          )}
          {application.decisionNotes && <p className="rounded-lg bg-gray-50 p-3 text-sm">Admin: {application.decisionNotes}</p>}
        </div>
      )}

      {canEdit && (
        <div className="card">
          <ActionForm action={submitApplication}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company (brand) name" name="companyName" defaultValue={prefill?.companyName} />
              <Field label="Legal name" name="legalName" defaultValue={prefill?.legalName} />
              <Field label="Registration number" name="registrationNumber" defaultValue={prefill?.registrationNumber} />
              <Field label="Tax ID" name="taxId" defaultValue={prefill?.taxId} />
              <Field label="Country" name="country" defaultValue={prefill?.country} />
              <Field label="City" name="city" defaultValue={prefill?.city} />
              <Field label="Contact email" name="contactEmail" type="email" defaultValue={prefill?.contactEmail ?? user.email} />
              <Field label="Contact phone" name="contactPhone" defaultValue={prefill?.contactPhone ?? user.phone} />
            </div>
            <Field label="Address" name="address" defaultValue={prefill?.address} />
            <Field label="Website" name="website" type="url" required={false} defaultValue={prefill?.website} />
            <Field label="About the company" name="description" textarea defaultValue={prefill?.description} />
            <fieldset className="space-y-3">
              <legend className="label">Documents (PDF, PNG or JPEG, max 5MB each)</legend>
              {DOCS.map((d) => {
                const existing = prefill?.documents.find((doc) => doc.kind === d.kind);
                return (
                  <label key={d.kind} className="block text-sm">
                    <span className="text-gray-700">{d.label}</span>
                    {existing && <span className="ml-2 text-xs text-gray-500">(uploaded: {existing.fileName} — choose a file to replace)</span>}
                    <input type="file" name={d.kind} accept="application/pdf,image/png,image/jpeg" required={!existing} className="mt-1 block text-sm" />
                  </label>
                );
              })}
            </fieldset>
            <SubmitButton>{prefill ? "Resubmit application" : "Submit application"}</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
