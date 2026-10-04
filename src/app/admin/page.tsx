import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function AdminHome() {
  await requireUser(["ADMIN"]);
  const [toApprove, users, companies, bookings, supportQueue] = await Promise.all([
    db.companyApplication.count({ where: { status: "VALIDATED" } }),
    db.user.count(),
    db.company.count({ where: { active: true } }),
    db.booking.count(),
    db.conversation.count({ where: { status: "HANDED_TO_SUPPORT" } }),
  ]);
  const cards = [
    { href: "/admin/applications", label: "Applications awaiting approval", value: toApprove },
    { href: "/admin/users", label: "Accounts", value: users },
    { href: "/admin/companies", label: "Active companies", value: companies },
    { href: "/support", label: "Support queue", value: supportQueue },
    { href: "/admin", label: "Bookings (all time)", value: bookings },
  ];
  return (
    <div className="space-y-6">
      <h1 className="h1">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card hover:border-brand-600">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-3xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
