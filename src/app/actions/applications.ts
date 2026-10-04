"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/storage";
import type { FormState } from "./types";

const DOCUMENT_KINDS = ["business_license", "tax_certificate", "owner_id"] as const;

const applicationSchema = z.object({
  companyName: z.string().trim().min(2),
  legalName: z.string().trim().min(2),
  registrationNumber: z.string().trim().min(2),
  taxId: z.string().trim().min(2),
  country: z.string().trim().min(2),
  city: z.string().trim().min(2),
  address: z.string().trim().min(5),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().min(5),
  website: z.string().trim().url().optional().or(z.literal("")),
  description: z.string().trim().min(20, "Describe your company in at least 20 characters"),
});

/**
 * A customer applies for a company profile. Creates a new application, or
 * updates the existing one when support sent it back with NEEDS_CHANGES.
 */
export async function submitApplication(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(["CUSTOMER"]);
  const fields = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = applicationSchema.safeParse(fields);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join(".")}: ${issue.message}` };
  }

  const existing = await db.companyApplication.findFirst({
    where: { applicantId: user.id, status: { in: ["SUBMITTED", "VALIDATED", "NEEDS_CHANGES"] } },
    include: { documents: true },
  });
  if (existing && existing.status !== "NEEDS_CHANGES") return { error: "You already have an application under review." };

  const files: { kind: string; file: File }[] = [];
  for (const kind of DOCUMENT_KINDS) {
    const file = formData.get(kind);
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) return { error: `${kind}: file is larger than 5MB` };
      if (!ALLOWED_MIME.has(file.type)) return { error: `${kind}: only PDF, PNG or JPEG files are accepted` };
      files.push({ kind, file });
    }
  }
  const haveKinds = new Set([...(existing?.documents.map((d) => d.kind) ?? []), ...files.map((f) => f.kind)]);
  const missing = DOCUMENT_KINDS.filter((k) => !haveKinds.has(k));
  if (missing.length) return { error: `Missing required documents: ${missing.join(", ")}` };

  const data = { ...parsed.data, website: parsed.data.website || null };
  const application = existing
    ? await db.companyApplication.update({ where: { id: existing.id }, data: { ...data, status: "SUBMITTED" } })
    : await db.companyApplication.create({ data: { ...data, applicantId: user.id } });

  for (const { kind, file } of files) {
    const storagePath = await saveUpload(application.id, file);
    // A re-uploaded kind replaces the previous document of that kind.
    await db.applicationDocument.deleteMany({ where: { applicationId: application.id, kind } });
    await db.applicationDocument.create({
      data: { applicationId: application.id, kind, fileName: file.name, mimeType: file.type, sizeBytes: file.size, storagePath },
    });
  }

  revalidatePath("/apply-company");
  redirect("/apply-company");
}

const reviewSchema = z.object({
  applicationId: z.string(),
  decision: z.enum(["validate", "needs_changes", "reject"]),
  notes: z.string().trim().optional(),
});

/** Step 1: support checks the documents and either validates (forwarding to admin), asks for changes, or rejects. */
export async function supportReview(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(["SUPPORT", "ADMIN"]);
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request" };
  const { applicationId, decision, notes } = parsed.data;
  if (decision !== "validate" && !notes) return { error: "Please explain what the applicant needs to fix." };

  const updated = await db.companyApplication.updateMany({
    where: { id: applicationId, status: "SUBMITTED" },
    data: {
      status: decision === "validate" ? "VALIDATED" : decision === "needs_changes" ? "NEEDS_CHANGES" : "REJECTED",
      validatorId: user.id,
      validatedAt: new Date(),
      validationNotes: notes || null,
    },
  });
  if (updated.count === 0) return { error: "This application is no longer awaiting validation." };
  revalidatePath("/support/applications");
  redirect("/support/applications");
}

const decisionSchema = z.object({
  applicationId: z.string(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().optional(),
  commissionPercent: z.coerce.number().min(0).max(50).default(10),
});

/** Step 2: admin approves a validated application, which creates the company and makes the applicant its owner. */
export async function adminDecide(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request" };
  const { applicationId, decision, notes, commissionPercent } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const app = await tx.companyApplication.findUnique({ where: { id: applicationId }, include: { applicant: true } });
      if (!app || app.status !== "VALIDATED") throw new Error("This application has not been validated by support yet.");

      if (decision === "reject") {
        await tx.companyApplication.update({
          where: { id: app.id },
          data: { status: "REJECTED", approverId: admin.id, decidedAt: new Date(), decisionNotes: notes || null },
        });
        return;
      }

      if (app.applicant.role !== "CUSTOMER") throw new Error("Applicant already has a non-customer role.");
      let slug = slugify(app.companyName) || "company";
      if (await tx.company.findUnique({ where: { slug } })) slug = `${slug}-${app.id.slice(-6)}`;

      const company = await tx.company.create({
        data: {
          name: app.companyName,
          slug,
          description: app.description,
          contactEmail: app.contactEmail,
          contactPhone: app.contactPhone,
          city: app.city,
          country: app.country,
          website: app.website,
          commissionRate: commissionPercent / 100,
          applicationId: app.id,
        },
      });
      await tx.user.update({ where: { id: app.applicantId }, data: { role: "COMPANY_OWNER", companyId: company.id } });
      await tx.companyApplication.update({
        where: { id: app.id },
        data: { status: "APPROVED", approverId: admin.id, decidedAt: new Date(), decisionNotes: notes || null },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
  revalidatePath("/admin/applications");
  redirect("/admin/applications");
}
