import Link from "next/link";
import type { Conversation, User } from "@prisma/client";
import { dateTime } from "@/lib/format";
import { Badge } from "./badge";

type Row = Conversation & { customer: Pick<User, "name">; assignedTo: Pick<User, "name"> | null; company?: { name: string } | null };

export function ConversationList({ conversations, empty }: { conversations: Row[]; empty: string }) {
  if (conversations.length === 0) return <div className="card text-sm text-gray-500">{empty}</div>;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Reason</th>
            <th>Assigned</th>
            <th>Updated</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/inbox/${c.id}`} className="font-medium text-brand-700 underline">{c.customer.name}</Link>
                <div className="text-xs text-gray-500">{c.title}</div>
              </td>
              <td className="max-w-md text-gray-600">
                {c.handoffReason}
                {c.company && <div className="text-xs text-gray-500">Company: {c.company.name}</div>}
              </td>
              <td>{c.assignedTo?.name ?? <span className="text-gray-400">unassigned</span>}</td>
              <td className="whitespace-nowrap">{dateTime(c.updatedAt)}</td>
              <td><Badge value={c.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
