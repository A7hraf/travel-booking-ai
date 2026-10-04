import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { PackageForm } from "@/components/package-form";

export default async function EditPackagePage(props: PageProps<"/company/packages/[id]">) {
  const user = await requireCompanyUser();
  const { id } = await props.params;
  const pkg = await db.travelPackage.findFirst({ where: { id, companyId: user.companyId } });
  if (!pkg) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h1">Edit: {pkg.title}</h1>
      <div className="card"><PackageForm pkg={pkg} /></div>
    </div>
  );
}
