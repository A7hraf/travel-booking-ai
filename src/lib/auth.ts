import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";

const COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, re-read from the DB on every request so role changes and deactivation apply immediately. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

export const COMPANY_ROLES: Role[] = ["COMPANY_OWNER", "COMPANY_EMPLOYEE"];
export const STAFF_ROLES: Role[] = ["SUPPORT", "ADMIN"];

/** Company staff with a company attached; returns the narrowed user. */
export async function requireCompanyUser(ownerOnly = false) {
  const user = await requireUser(ownerOnly ? ["COMPANY_OWNER"] : COMPANY_ROLES);
  if (!user.companyId) redirect("/");
  return user as User & { companyId: string };
}

export function homePathFor(role: Role) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "SUPPORT":
      return "/support";
    case "COMPANY_OWNER":
    case "COMPANY_EMPLOYEE":
      return "/company";
    default:
      return "/chat";
  }
}
