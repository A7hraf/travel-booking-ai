import type { Prisma } from "@prisma/client";

type Money = Prisma.Decimal | number | string;

export function money(amount: Money, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

export function date(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function dateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function bookingReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "TB-";
  for (let i = 0; i < 8; i++) ref += alphabet[Math.floor(Math.random() * alphabet.length)];
  return ref;
}
