// Runs on every deploy. Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
// if the database has no admin yet; does nothing otherwise.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

try {
  const admins = await db.user.count({ where: { role: "ADMIN" } });
  if (admins > 0) {
    console.log("bootstrap-admin: admin already exists, skipping");
  } else if (!email || !password || password.length < 12) {
    console.warn("bootstrap-admin: no admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) and redeploy.");
  } else {
    await db.user.upsert({
      where: { email },
      update: { role: "ADMIN", companyId: null, active: true, passwordHash: await bcrypt.hash(password, 12) },
      create: { email, name: "Administrator", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`bootstrap-admin: created admin ${email}. You can remove ADMIN_PASSWORD from the environment now.`);
  }
} finally {
  await db.$disconnect();
}
