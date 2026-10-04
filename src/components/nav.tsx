import Link from "next/link";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/services/notifications";
import { logout } from "@/app/actions/auth";
import { MobileMenu } from "./mobile-menu";

const LINKS: Record<Role, { href: string; label: string }[]> = {
  CUSTOMER: [
    { href: "/chat", label: "My chats" },
    { href: "/bookings", label: "My bookings" },
    { href: "/apply-company", label: "List your company" },
  ],
  COMPANY_OWNER: [
    { href: "/company", label: "Dashboard" },
    { href: "/company/packages", label: "Packages" },
    { href: "/company/conversations", label: "Conversations" },
    { href: "/company/bookings", label: "Bookings" },
    { href: "/company/profit", label: "Profit" },
    { href: "/company/team", label: "Team" },
  ],
  COMPANY_EMPLOYEE: [
    { href: "/company", label: "Dashboard" },
    { href: "/company/packages", label: "Packages" },
    { href: "/company/conversations", label: "Conversations" },
    { href: "/company/bookings", label: "Bookings" },
  ],
  SUPPORT: [
    { href: "/support", label: "Support inbox" },
    { href: "/support/applications", label: "Company applications" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/applications", label: "Approvals" },
    { href: "/admin/users", label: "Accounts" },
    { href: "/admin/companies", label: "Companies" },
    { href: "/support", label: "Support inbox" },
  ],
};

const PUBLIC_LINKS = [{ href: "/packages", label: "Packages" }];

export async function Nav() {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  const bell = user && (
    <Link href="/notifications" className="relative btn px-2.5" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs leading-5 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
  // Company staff have their own "Packages" page; don't show the public one twice.
  const links = user
    ? [...(user.role === "CUSTOMER" || user.role === "SUPPORT" || user.role === "ADMIN" ? PUBLIC_LINKS : []), ...LINKS[user.role]]
    : PUBLIC_LINKS;

  const account = user ? (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <Link href="/account" className="text-gray-500 hover:text-gray-900">
        {user.name} · <span className="lowercase">{user.role.replace("_", " ")}</span>
      </Link>
      <button className="btn">Log out</button>
    </form>
  ) : (
    <div className="flex gap-2">
      <Link href="/login" className="btn">Log in</Link>
      <Link href="/register" className="btn-primary">Sign up</Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          TripDeal
        </Link>

        {/* Desktop */}
        <nav className="hidden flex-1 flex-wrap gap-4 text-sm text-gray-600 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-gray-900">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {bell}
          {account}
        </div>

        {/* Phone */}
        <div className="ml-auto md:hidden">{bell}</div>
        <MobileMenu>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              {l.label}
            </Link>
          ))}
          <div className="border-t border-gray-100 pt-3">{account}</div>
        </MobileMenu>
      </div>
    </header>
  );
}
