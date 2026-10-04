import { requireCompanyUser } from "@/lib/auth";
import { PackageForm } from "@/components/package-form";

export default async function NewPackagePage() {
  await requireCompanyUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h1">New package</h1>
      <div className="card"><PackageForm /></div>
    </div>
  );
}
