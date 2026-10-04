import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { startConversation } from "@/app/actions/conversations";
import { Badge } from "@/components/badge";

export default async function ChatListPage() {
  const user = await requireUser(["CUSTOMER"]);
  const conversations = await db.conversation.findMany({
    where: { customerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { company: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">My chats</h1>
        <form action={startConversation}>
          <button className="btn-primary">New trip chat</button>
        </form>
      </div>
      {conversations.length === 0 ? (
        <div className="card text-sm text-gray-600">No chats yet. Start one and tell the assistant where you&apos;d like to go.</div>
      ) : (
        <div className="card divide-y divide-gray-100 p-0">
          {conversations.map((c) => (
            <Link key={c.id} href={`/chat/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {dateTime(c.updatedAt)}
                  {c.company && ` · ${c.company.name}`}
                </p>
              </div>
              <Badge value={c.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
