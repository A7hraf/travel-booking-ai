import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";

/** Package photos are public marketing images. */
export async function GET(_: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const image = await db.packageImage.findUnique({ where: { id } });
  if (!image) return new Response("Not found", { status: 404 });
  const bytes = await readUpload(image.storagePath).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": image.mimeType,
      // Image ids never get new content, so they can be cached for a long time.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
