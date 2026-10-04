"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, hashPassword, homePathFor, requireUser, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./types";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Public sign-up always creates a CUSTOMER. Other roles come from approval flows or an admin. */
export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`register:${ip}`, 10, 60 * 60_000).ok) return { error: "Too many sign-ups from this network. Try again later." };
  const { name, email, phone, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists" };
  const user = await db.user.create({
    data: { name, email, phone: phone || null, passwordHash: await hashPassword(password), role: "CUSTOMER" },
  });
  await createSession(user.id);
  redirect("/chat");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`login:${ip}`, 20, 15 * 60_000).ok && rateLimit(`login:${email}`, 8, 15 * 60_000).ok;
  if (!limited) return { error: "Too many login attempts. Please wait 15 minutes and try again." };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }
  await createSession(user.id);
  redirect(homePathFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  phone: z.string().trim().optional(),
});

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/account");
  return { success: "Profile saved." };
}

const passwordSchema = z
  .object({
    current: z.string(),
    next: z.string().min(8, "New password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "New passwords don't match" });

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { error: "Current password is wrong" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  return { success: "Password changed." };
}
