"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyUser } from "@/lib/auth";
import { BookingError, setBookingStatus } from "@/lib/services/bookings";
import { addSystemMessage } from "@/lib/services/conversations";
import { db } from "@/lib/db";

export async function changeBookingStatus(formData: FormData) {
  const user = await requireCompanyUser();
  const bookingId = String(formData.get("bookingId"));
  const status = z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]).parse(formData.get("status"));
  try {
    const booking = await setBookingStatus(bookingId, user.companyId, status);
    if (booking.conversationId) {
      await addSystemMessage(booking.conversationId, `Booking ${booking.reference} is now ${status.toLowerCase()}.`);
    }
  } catch (e) {
    if (!(e instanceof BookingError)) throw e;
  }
  revalidatePath("/company/bookings");
  const convo = await db.booking.findUnique({ where: { id: bookingId }, select: { conversationId: true } });
  if (convo?.conversationId) revalidatePath(`/inbox/${convo.conversationId}`);
}
