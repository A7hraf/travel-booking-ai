"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import type { FormState } from "./types";

const accountSchema = z
  .object({
    name: z.string().trim().min(2),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    role: z.enum(["CUSTOMER", "COMPANY_OWNER", "COMPANY_EMPLOYEE", "SUPPORT", "ADMIN"]),
    companyId: z.string().optional(),
  })
  .refine((v) => !["COMPANY_OWNER", "COMPANY_EMPLOYEE"].includes(v.role) || !!v.companyId, {
    message: "Company accounts need a company",
  });

/** Admins create accounts of any role (the only way to get SUPPORT or ADMIN). */
export async function createAccount(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, role, companyId } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Email already in use" };
  const isCompanyRole = role === "COMPANY_OWNER" || role === "COMPANY_EMPLOYEE";
  await db.user.create({
    data: { name, email, role, passwordHash: await hashPassword(password), companyId: isCompanyRole ? companyId : null },
  });
  revalidatePath("/admin/users");
  return { success: `Created ${role.toLowerCase().replace("_", " ")} account for ${email}.` };
}

export async function setUserActive(formData: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return;
  await db.user.update({ where: { id: userId }, data: { active: formData.get("active") === "true" } });
  revalidatePath("/admin/users");
}

export async function updateCompanyAdmin(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("companyId"));
  const pct = formData.has("commissionPercent")
    ? z.coerce.number().min(0).max(50).safeParse(formData.get("commissionPercent"))
    : null;
  await db.company.update({
    where: { id },
    data: {
      ...(pct?.success && { commissionRate: pct.data / 100 }),
      ...(formData.has("active") && { active: formData.get("active") === "true" }),
    },
  });
  revalidatePath("/admin/companies");
}
