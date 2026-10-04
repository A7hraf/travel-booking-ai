import Link from "next/link";
import type { Company, TravelPackage } from "@prisma/client";
import { money } from "@/lib/format";

export function PackageCard({ pkg }: { pkg: TravelPackage & { company: Pick<Company, "name"> } }) {
  const seatsLeft = pkg.seatsTotal - pkg.seatsBooked;
  return (
    <Link href={`/packages/${pkg.id}`} className="card block transition hover:border-brand-600">
      <p className="text-xs uppercase tracking-wide text-gray-500">
        {pkg.destination}, {pkg.country}
      </p>
      <h3 className="mt-1 font-semibold">{pkg.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{pkg.description}</p>
      <div className="mt-4 flex items-end justify-between text-sm">
        <span className="text-gray-500">
          {pkg.durationDays} days · {pkg.company.name}
        </span>
        <span className="text-right">
          <span className="block text-base font-semibold">{money(pkg.pricePerPerson, pkg.currency)}</span>
          <span className="text-xs text-gray-500">per person · {seatsLeft} seats left</span>
        </span>
      </div>
    </Link>
  );
}
