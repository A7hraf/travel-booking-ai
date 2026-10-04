"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyUser, requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { BookingError, recordPayment, setBookingStatus } from "@/lib/services/bookings";
import { addSystemMessage } from "@/lib/services/conversations";
import { notifyCompanyStaff, notifyUsers } from "@/lib/services/notifications";
import type { FormState } from "./types";

const STATUS_TEXT = { CONFIRMED: "confirmed", CANCELLED: "cancelled", COMPLETED: "completed" } as const;

function revalidateBooking(conversationId: string | null) {
  revalidatePath("/company/bookings");
  revalidatePath("/bookings");
  if (conversationId) revalidatePath(`/inbox/${conversationId}`);
}

export async function changeBookingStatus(formData: FormData) {
  const user = await requireCompanyUser();
  const bookingId = String(formData.get("bookingId"));
  const status = z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]).parse(formData.get("status"));
  try {
    const booking = await setBookingStatus(bookingId, user.companyId, status);
    const text = `Booking ${booking.reference} is now ${STATUS_TEXT[status]}.`;
    if (booking.conversationId) await addSystemMessage(booking.conversationId, text);
    await notifyUsers([booking.customerId], { title: `Booking ${STATUS_TEXT[status]}`, body: text, link: "/bookings" });
    revalidateBooking(booking.conversationId);
  } catch (e) {
    if (!(e instanceof BookingError)) throw e;
  }
}

const paymentSchema = z.object({
  bookingId: z.string(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD_IN_PERSON", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
});

/** Staff record a payment received outside the app (cash, bank transfer...). */
export async function markBookingPaid(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCompanyUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose how the customer paid." };
  try {
    const booking = await recordPayment(parsed.data.bookingId, user.companyId, user.id, parsed.data);
    const text = `Payment of ${money(booking.totalPrice, booking.currency)} received for booking ${booking.reference}. Thank you!`;
    if (booking.conversationId) await addSystemMessage(booking.conversationId, text);
    await notifyUsers([booking.customerId], { title: "Payment received", body: text, link: "/bookings" });
    revalidateBooking(booking.conversationId);
    return { success: "Payment recorded." };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
}

/** Customers may cancel their own booking while it is still waiting for confirmation. */
export async function cancelMyBooking(formData: FormData) {
  const user = await requireUser(["CUSTOMER"]);
  const booking = await db.booking.findFirst({
    where: { id: String(formData.get("bookingId")), customerId: user.id, status: "PENDING_CONFIRMATION" },
  });
  if (!booking) return;
  await setBookingStatus(booking.id, booking.companyId, "CANCELLED");
  const text = `Booking ${booking.reference} was cancelled by the customer.`;
  if (booking.conversationId) await addSystemMessage(booking.conversationId, text);
  await notifyCompanyStaff(booking.companyId, { title: "Booking cancelled", body: text, link: "/company/bookings" });
  revalidateBooking(booking.conversationId);
}
