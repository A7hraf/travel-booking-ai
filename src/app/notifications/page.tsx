import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { markAllRead, openNotification } from "@/app/actions/notifications";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notes = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = notes.some((n) => !n.readAt);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Notifications</h1>
        {unread && (
          <form action={markAllRead}>
            <button className="btn">Mark all as read</button>
          </form>
        )}
      </div>
      {notes.length === 0 ? (
        <div className="card text-sm text-gray-500">You&apos;re all caught up.</div>
      ) : (
        <div className="card divide-y divide-gray-100 p-0">
          {notes.map((n) => (
            <form key={n.id} action={openNotification}>
              <input type="hidden" name="id" value={n.id} />
              <button className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-gray-50">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand-600"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.readAt ? "text-gray-700" : "font-medium"}`}>{n.title}</span>
                  {n.body && <span className="block truncate text-sm text-gray-500">{n.body}</span>}
                  <span className="block text-xs text-gray-400">{dateTime(n.createdAt)}</span>
                </span>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
