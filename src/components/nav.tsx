import Link from "next/link";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
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
  // Company staff have their own "Packages" page; don't show the public one twice.
  const links = user
    ? [...(user.role === "CUSTOMER" || user.role === "SUPPORT" || user.role === "ADMIN" ? PUBLIC_LINKS : []), ...LINKS[user.role]]
    : PUBLIC_LINKS;

  const account = user ? (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-gray-500">
        {user.name} · <span className="lowercase">{user.role.replace("_", " ")}</span>
      </span>
      <button className="btn">Log out</button>
    </form>
  ) : (
    <div className="flex gap-2">
      <Link href="/login" className="btn">Log in</Link>
      <Link href="/register" className="btn-primary">Sign up</Link>
    </div>
  );

  return (
    <header className="border-b border-gray-200 bg-white">
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
        <div className="hidden md:block">{account}</div>

        {/* Phone */}
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
