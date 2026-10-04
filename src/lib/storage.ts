import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
export const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_IMAGES_PER_PACKAGE = 6;

function root() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
}

/** Stores a file outside /public; returns the path relative to UPLOAD_DIR. */
export async function saveUpload(folder: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const relative = path.join(folder.replace(/[^a-zA-Z0-9_-]/g, ""), `${randomUUID()}-${safeName}`);
  const full = path.join(root(), relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return relative;
}

export async function readUpload(relative: string) {
  const full = path.resolve(root(), relative);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid path");
  return readFile(full);
}

export async function deleteUpload(relative: string) {
  const full = path.resolve(root(), relative);
  if (!full.startsWith(root() + path.sep)) return;
  await rm(full, { force: true });
}
