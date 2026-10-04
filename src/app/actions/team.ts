"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireCompanyUser } from "@/lib/auth";
import type { FormState } from "./types";

const employeeSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Temporary password must be at least 8 characters").optional().or(z.literal("")),
});

/**
 * Owner adds an employee. An existing customer account (with no company) is
 * attached by email; otherwise a new account is created with a temporary password.
 */
export async function addEmployee(_: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireCompanyUser(true);
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "CUSTOMER" || existing.companyId) return { error: "That account can't be added as an employee." };
    await db.user.update({ where: { id: existing.id }, data: { role: "COMPANY_EMPLOYEE", companyId: owner.companyId } });
  } else {
    if (!password) return { error: "Set a temporary password for the new account." };
    await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: "COMPANY_EMPLOYEE", companyId: owner.companyId },
    });
  }
  revalidatePath("/company/team");
  return { success: `${email} added to your team.` };
}

/** Removing an employee turns them back into a plain customer account. */
export async function removeEmployee(formData: FormData) {
  const owner = await requireCompanyUser(true);
  const userId = String(formData.get("userId"));
  await db.user.updateMany({
    where: { id: userId, companyId: owner.companyId, role: "COMPANY_EMPLOYEE" },
    data: { role: "CUSTOMER", companyId: null },
  });
  await db.conversation.updateMany({ where: { assignedToId: userId }, data: { assignedToId: null } });
  revalidatePath("/company/team");
}

const profileSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(20),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().min(5),
  city: z.string().trim().min(2),
  country: z.string().trim().min(2),
  website: z.string().trim().url().optional().or(z.literal("")),
});

export async function updateCompanyProfile(_: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireCompanyUser(true);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  await db.company.update({ where: { id: owner.companyId }, data: { ...parsed.data, website: parsed.data.website || null } });
  revalidatePath("/company");
  return { success: "Company profile saved." };
}
