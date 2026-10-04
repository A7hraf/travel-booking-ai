import type { TravelPackage } from "@prisma/client";
import { savePackage } from "@/app/actions/packages";
import { ActionForm } from "./action-form";
import { Field, SubmitButton } from "./form";

const day = (d?: Date) => (d ? d.toISOString().slice(0, 10) : "");

export function PackageForm({ pkg }: { pkg?: TravelPackage }) {
  return (
    <ActionForm action={savePackage}>
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title" defaultValue={pkg?.title} />
        <label className="block">
          <span className="label">Status</span>
          <select name="status" defaultValue={pkg?.status ?? "DRAFT"} className="input">
            <option value="DRAFT">Draft (hidden)</option>
            <option value="ACTIVE">Active (bookable)</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <Field label="Destination (city / region)" name="destination" defaultValue={pkg?.destination} />
        <Field label="Country" name="country" defaultValue={pkg?.country} />
        <Field label="Duration (days)" name="durationDays" type="number" min={1} defaultValue={pkg?.durationDays} />
        <Field label="Currency" name="currency" maxLength={3} defaultValue={pkg?.currency ?? "USD"} />
        <Field label="Price per person" name="pricePerPerson" type="number" step="0.01" min={0} defaultValue={pkg?.pricePerPerson.toString()} />
        <Field
          label="Cost per person"
          name="costPerPerson"
          type="number"
          step="0.01"
          min={0}
          defaultValue={pkg?.costPerPerson.toString()}
          hint="Your own cost (hotels, transport…). Used for profit; never shown to customers."
        />
        <Field label="Available from" name="availableFrom" type="date" defaultValue={day(pkg?.availableFrom)} />
        <Field label="Available to" name="availableTo" type="date" defaultValue={day(pkg?.availableTo)} />
        <Field label="Total seats" name="seatsTotal" type="number" min={1} defaultValue={pkg?.seatsTotal} />
        <Field label="Max group size per booking" name="maxGroupSize" type="number" min={1} defaultValue={pkg?.maxGroupSize ?? 10} />
      </div>
      <Field label="Description / itinerary" name="description" textarea defaultValue={pkg?.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Included (one per line)" name="inclusions" textarea required={false} defaultValue={pkg?.inclusions.join("\n")} />
        <Field label="Not included (one per line)" name="exclusions" textarea required={false} defaultValue={pkg?.exclusions.join("\n")} />
      </div>
      <label className="block">
        <span className="label">{pkg ? "Add photos" : "Photos"}</span>
        <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" className="block text-sm" />
        <span className="mt-1 block text-xs text-gray-500">Up to 6 photos, JPEG/PNG/WebP, 5MB each. The first photo is the cover.</span>
      </label>
      <SubmitButton>{pkg ? "Save changes" : "Create package"}</SubmitButton>
    </ActionForm>
  );
}
