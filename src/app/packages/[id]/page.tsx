import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { startConversation } from "@/app/actions/conversations";

export default async function PackagePage(props: PageProps<"/packages/[id]">) {
  const { id } = await props.params;
  const [pkg, user] = await Promise.all([
    db.travelPackage.findFirst({ where: { id, status: "ACTIVE", company: { active: true } }, include: { company: true, images: { orderBy: { position: "asc" } } } }),
    getCurrentUser(),
  ]);
  if (!pkg) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {pkg.images.length > 0 && (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {pkg.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={`/api/images/${img.id}`}
                alt={`${pkg.title} photo ${i + 1}`}
                className="aspect-[4/3] w-[85%] shrink-0 snap-start rounded-xl object-cover sm:w-[70%]"
              />
            ))}
          </div>
        )}
        <p className="text-sm uppercase tracking-wide text-gray-500">
          {pkg.destination}, {pkg.country}
        </p>
        <h1 className="h1">{pkg.title}</h1>
        <p className="whitespace-pre-wrap text-gray-700">{pkg.description}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card">
            <h2 className="mb-2 font-medium">Included</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {pkg.inclusions.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h2 className="mb-2 font-medium">Not included</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {pkg.exclusions.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <aside className="card h-fit space-y-3">
        <p className="text-2xl font-semibold">
          {money(pkg.pricePerPerson, pkg.currency)} <span className="text-sm font-normal text-gray-500">/ person</span>
        </p>
        <dl className="space-y-1 text-sm text-gray-600">
          <div>{pkg.durationDays} days</div>
          <div>
            Available {date(pkg.availableFrom)} – {date(pkg.availableTo)}
          </div>
          <div>{pkg.seatsTotal - pkg.seatsBooked} seats left · groups up to {pkg.maxGroupSize}</div>
          <div>Operated by {pkg.company.name}</div>
        </dl>
        {user?.role === "CUSTOMER" ? (
          <form action={startConversation}>
            <input type="hidden" name="packageTitle" value={pkg.title} />
            <button className="btn-primary w-full">Book with the AI assistant</button>
          </form>
        ) : !user ? (
          <Link href="/register" className="btn-primary w-full">
            Sign up to book
          </Link>
        ) : null}
      </aside>
    </div>
  );
}
