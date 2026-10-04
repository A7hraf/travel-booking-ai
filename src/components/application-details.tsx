import type { ApplicationDocument, CompanyApplication, User } from "@prisma/client";
import { dateTime } from "@/lib/format";
import { Badge } from "./badge";

type App = CompanyApplication & {
  applicant: Pick<User, "name" | "email">;
  documents: ApplicationDocument[];
  validator?: Pick<User, "name"> | null;
};

export function ApplicationDetails({ app }: { app: App }) {
  const rows: [string, string | null][] = [
    ["Legal name", app.legalName],
    ["Registration number", app.registrationNumber],
    ["Tax ID", app.taxId],
    ["Address", `${app.address}, ${app.city}, ${app.country}`],
    ["Contact", `${app.contactEmail} · ${app.contactPhone}`],
    ["Website", app.website],
    ["Applicant", `${app.applicant.name} (${app.applicant.email})`],
    ["Submitted", dateTime(app.createdAt)],
  ];
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{app.companyName}</h2>
        <Badge value={app.status} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-gray-500">{k}</dt>
            <dd>{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-sm text-gray-500">About</p>
        <p className="whitespace-pre-wrap text-sm">{app.description}</p>
      </div>
      <div>
        <p className="mb-1 text-sm text-gray-500">Documents</p>
        <ul className="space-y-1 text-sm">
          {app.documents.map((d) => (
            <li key={d.id}>
              <a href={`/api/documents/${d.id}`} target="_blank" className="text-brand-700 underline">
                {d.kind.replaceAll("_", " ")}: {d.fileName}
              </a>{" "}
              <span className="text-xs text-gray-500">({Math.round(d.sizeBytes / 1024)} KB)</span>
            </li>
          ))}
        </ul>
      </div>
      {app.validationNotes && <p className="rounded-lg bg-gray-50 p-3 text-sm">Support notes: {app.validationNotes}</p>}
      {app.validator && app.validatedAt && (
        <p className="text-xs text-gray-500">Reviewed by {app.validator.name} on {dateTime(app.validatedAt)}</p>
      )}
    </div>
  );
}
