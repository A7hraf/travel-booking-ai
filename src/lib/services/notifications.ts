import "server-only";
import type { Role } from "@prisma/client";
import { db } from "../db";

type Note = { title: string; body: string; link?: string };

export async function notifyUsers(userIds: string[], note: Note) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...note })) });
}

export async function notifyCompanyStaff(companyId: string, note: Note) {
  const staff = await db.user.findMany({ where: { companyId, active: true }, select: { id: true } });
  await notifyUsers(staff.map((u) => u.id), note);
}

export async function notifyRoles(roles: Role[], note: Note) {
  const users = await db.user.findMany({ where: { role: { in: roles }, active: true }, select: { id: true } });
  await notifyUsers(users.map((u) => u.id), note);
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}
