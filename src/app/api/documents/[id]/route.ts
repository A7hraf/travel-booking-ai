import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

/** Application documents are private: only the applicant, support and admins can download them. */
export async function GET(_: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const doc = await db.applicationDocument.findUnique({ where: { id }, include: { application: true } });
  const allowed = doc && (doc.application.applicantId === user.id || user.role === "SUPPORT" || user.role === "ADMIN");
  if (!allowed) return new Response("Not found", { status: 404 });
  const bytes = await readUpload(doc.storagePath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
