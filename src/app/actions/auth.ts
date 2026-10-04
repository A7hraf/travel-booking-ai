"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, homePathFor, verifyPassword } from "@/lib/auth";
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
