import { db } from "@/lib/db";
import { PackageCard } from "@/components/package-card";

export default async function PackagesPage(props: PageProps<"/packages">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const packages = await db.travelPackage.findMany({
    where: {
      status: "ACTIVE",
      company: { active: true },
      ...(query && {
        OR: [
          { destination: { contains: query, mode: "insensitive" } },
          { country: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
        ],
      }),
    },
    include: { company: { select: { name: true } } },
    orderBy: { pricePerPerson: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h1">Travel packages</h1>
        <form className="flex gap-2">
          <input name="q" defaultValue={query} placeholder="Destination or country" className="input w-64" />
          <button className="btn">Search</button>
        </form>
      </div>
      {packages.length === 0 ? (
        <p className="text-sm text-gray-500">No packages match.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <PackageCard key={p.id} pkg={p} />
          ))}
        </div>
      )}
    </div>
  );
}
