import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { supportReview } from "@/app/actions/applications";
import { ActionForm } from "@/components/action-form";
import { ApplicationDetails } from "@/components/application-details";

export default async function SupportApplicationPage(props: PageProps<"/support/applications/[id]">) {
  await requireUser(["SUPPORT", "ADMIN"]);
  const { id } = await props.params;
  const app = await db.companyApplication.findUnique({
    where: { id },
    include: { applicant: { select: { name: true, email: true } }, documents: true, validator: { select: { name: true } } },
  });
  if (!app) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h1">Validate application</h1>
      <ApplicationDetails app={app} />
      {app.status === "SUBMITTED" && (
        <div className="card">
          <ActionForm action={supportReview}>
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="block">
              <span className="label">Notes (required when asking for changes or rejecting; shown to the applicant)</span>
              <textarea name="notes" rows={3} className="input" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button name="decision" value="validate" className="btn-primary">Validate &amp; send to admin</button>
              <button name="decision" value="needs_changes" className="btn">Request changes</button>
              <button name="decision" value="reject" className="btn-danger">Reject</button>
            </div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
