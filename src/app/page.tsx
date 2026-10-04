import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { startConversation } from "@/app/actions/conversations";
import { PackageCard } from "@/components/package-card";

export default async function Home() {
  const [user, packages] = await Promise.all([
    getCurrentUser(),
    db.travelPackage.findMany({
      where: { status: "ACTIVE", company: { active: true } },
      include: { company: { select: { name: true } }, images: { select: { id: true }, orderBy: { position: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 px-8 py-14 text-white">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">Tell us where you want to go. Our AI finds the package and books it.</h1>
        <p className="mt-4 max-w-xl text-brand-100">
          Chat with the travel assistant about dates, budget and group size. It compares packages from verified travel companies and
          hands you to the company&apos;s team to confirm the booking.
        </p>
        <div className="mt-8 flex gap-3">
          {user?.role === "CUSTOMER" ? (
            <form action={startConversation}>
              <button className="btn border-white bg-white text-brand-700">Start planning a trip</button>
            </form>
          ) : !user ? (
            <Link href="/register" className="btn border-white bg-white text-brand-700">
              Start planning a trip
            </Link>
          ) : null}
          <Link href="/packages" className="btn border-white/40 bg-transparent text-white hover:bg-white/10">
            Browse packages
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Latest packages</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-gray-500">No packages published yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
