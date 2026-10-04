import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { deletePackageImage } from "@/app/actions/packages";
import { PackageForm } from "@/components/package-form";

export default async function EditPackagePage(props: PageProps<"/company/packages/[id]">) {
  const user = await requireCompanyUser();
  const { id } = await props.params;
  const pkg = await db.travelPackage.findFirst({
    where: { id, companyId: user.companyId },
    include: { images: { orderBy: { position: "asc" } } },
  });
  if (!pkg) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h1">Edit: {pkg.title}</h1>
      {pkg.images.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-medium">Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pkg.images.map((img, i) => (
              <div key={img.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${img.id}`} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
                <form action={deletePackageImage} className="flex items-center justify-between text-xs text-gray-500">
                  <span>{i === 0 ? "Cover" : `Photo ${i + 1}`}</span>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-red-600 underline">Remove</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card"><PackageForm pkg={pkg} /></div>
    </div>
  );
}
