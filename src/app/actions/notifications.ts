"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

/** Marks one notification read and follows its link. */
export async function openNotification(formData: FormData) {
  const user = await requireUser();
  const note = await db.notification.findFirst({ where: { id: String(formData.get("id")), userId: user.id } });
  if (!note) redirect("/notifications");
  await db.notification.update({ where: { id: note.id }, data: { readAt: note.readAt ?? new Date() } });
  redirect(note.link && note.link.startsWith("/") ? note.link : "/notifications");
}
