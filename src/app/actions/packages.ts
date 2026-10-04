"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
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

  if (typeof id === "string" && id) {
    const existing = await db.travelPackage.findFirst({ where: { id, companyId: user.companyId } });
    if (!existing) return { error: "Package not found" };
    if (data.seatsTotal < existing.seatsBooked) return { error: `Already ${existing.seatsBooked} seats booked; total can't be lower.` };
    await db.travelPackage.update({ where: { id }, data });
  } else {
    await db.travelPackage.create({ data: { ...data, companyId: user.companyId } });
  }
  revalidatePath("/company/packages");
  redirect("/company/packages");
}
