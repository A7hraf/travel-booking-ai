"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { IMAGE_MIME, MAX_IMAGES_PER_PACKAGE, MAX_UPLOAD_BYTES, deleteUpload, saveUpload } from "@/lib/storage";
import type { FormState } from "./types";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

const packageSchema = z
  .object({
    title: z.string().trim().min(3),
    destination: z.string().trim().min(2),
    country: z.string().trim().min(2),
    description: z.string().trim().min(20),
    durationDays: z.coerce.number().int().min(1).max(90),
    pricePerPerson: z.coerce.number().positive(),
    costPerPerson: z.coerce.number().min(0),
    currency: z.string().trim().length(3).toUpperCase(),
    inclusions: z.string().default(""),
    exclusions: z.string().default(""),
    availableFrom: z.coerce.date(),
    availableTo: z.coerce.date(),
    seatsTotal: z.coerce.number().int().min(1),
    maxGroupSize: z.coerce.number().int().min(1),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  })
  .refine((v) => v.availableTo >= v.availableFrom, { message: "Available-to must be after available-from", path: ["availableTo"] });

/** Owners and employees both manage packages; only owners see profit figures. */
export async function savePackage(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCompanyUser();
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join(".")}: ${issue.message}` };
  }
  const { inclusions, exclusions, ...rest } = parsed.data;
  const data = { ...rest, inclusions: lines(inclusions), exclusions: lines(exclusions) };
  const id = formData.get("id");

  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  for (const img of images) {
    if (!IMAGE_MIME.has(img.type)) return { error: `${img.name}: photos must be JPEG, PNG or WebP` };
    if (img.size > MAX_UPLOAD_BYTES) return { error: `${img.name}: photos must be under 5MB` };
  }

  let packageId: string;
  if (typeof id === "string" && id) {
    const existing = await db.travelPackage.findFirst({ where: { id, companyId: user.companyId }, include: { _count: { select: { images: true } } } });
    if (!existing) return { error: "Package not found" };
    if (data.seatsTotal < existing.seatsBooked) return { error: `Already ${existing.seatsBooked} seats booked; total can't be lower.` };
    if (existing._count.images + images.length > MAX_IMAGES_PER_PACKAGE) {
      return { error: `A package can have at most ${MAX_IMAGES_PER_PACKAGE} photos. Remove some first.` };
    }
    await db.travelPackage.update({ where: { id }, data });
    packageId = id;
  } else {
    if (images.length > MAX_IMAGES_PER_PACKAGE) return { error: `A package can have at most ${MAX_IMAGES_PER_PACKAGE} photos.` };
    packageId = (await db.travelPackage.create({ data: { ...data, companyId: user.companyId } })).id;
  }

  const last = await db.packageImage.findFirst({ where: { packageId }, orderBy: { position: "desc" } });
  let position = (last?.position ?? -1) + 1;
  for (const img of images) {
    const storagePath = await saveUpload(`packages-${packageId}`, img);
    await db.packageImage.create({ data: { packageId, storagePath, mimeType: img.type, position: position++ } });
  }

  revalidatePath("/company/packages");
  revalidatePath(`/packages/${packageId}`);
  redirect("/company/packages");
}

export async function deletePackageImage(formData: FormData) {
  const user = await requireCompanyUser();
  const image = await db.packageImage.findFirst({
    where: { id: String(formData.get("imageId")), package: { companyId: user.companyId } },
  });
  if (!image) return;
  await db.packageImage.delete({ where: { id: image.id } });
  await deleteUpload(image.storagePath);
  revalidatePath(`/company/packages/${image.packageId}`);
  revalidatePath(`/packages/${image.packageId}`);
}
