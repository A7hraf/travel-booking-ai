import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { adminDecide } from "@/app/actions/applications";
import { ActionForm } from "@/components/action-form";
import { ApplicationDetails } from "@/components/application-details";

export default async function AdminApplicationPage(props: PageProps<"/admin/applications/[id]">) {
  await requireUser(["ADMIN"]);
  const { id } = await props.params;
  const app = await db.companyApplication.findUnique({
    where: { id },
    include: { applicant: { select: { name: true, email: true } }, documents: true, validator: { select: { name: true } } },
  });
  if (!app) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h1">Approve company</h1>
      <ApplicationDetails app={app} />
      {app.status === "VALIDATED" ? (
        <div className="card">
          <ActionForm action={adminDecide}>
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="block max-w-xs">
              <span className="label">Platform commission (%)</span>
              <input name="commissionPercent" type="number" step="0.1" min={0} max={50} defaultValue={10} className="input" />
            </label>
            <label className="block">
              <span className="label">Notes for the applicant (optional)</span>
              <textarea name="notes" rows={3} className="input" />
            </label>
            <div className="flex gap-2">
              <button name="decision" value="approve" className="btn-primary">Approve &amp; create company</button>
              <button name="decision" value="reject" className="btn-danger">Reject</button>
            </div>
          </ActionForm>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Only applications validated by support can be approved.</p>
      )}
    </div>
  );
}
