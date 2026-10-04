import Link from "next/link";
import type { CompanyApplication, User } from "@prisma/client";
import { dateTime } from "@/lib/format";
import { Badge } from "./badge";

export function ApplicationTable({
  apps,
  basePath,
  empty,
}: {
  apps: (CompanyApplication & { applicant: Pick<User, "name" | "email"> })[];
  basePath: string;
  empty: string;
}) {
  if (apps.length === 0) return <div className="card text-sm text-gray-500">{empty}</div>;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Applicant</th>
            <th>Location</th>
            <th>Updated</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`${basePath}/${a.id}`} className="font-medium text-brand-700 underline">{a.companyName}</Link>
              </td>
              <td>{a.applicant.name}<div className="text-xs text-gray-500">{a.applicant.email}</div></td>
              <td>{a.city}, {a.country}</td>
              <td className="whitespace-nowrap">{dateTime(a.updatedAt)}</td>
              <td><Badge value={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
