import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { bookingReference } from "../format";

export class BookingError extends Error {}

export type NewBooking = {
  customerId: string;
  packageId: string;
  conversationId?: string;
  travelers: number;
  travelDate: Date;
  contactName: string;
  contactPhone: string;
  notes?: string | null;
};

/**
 * Creates a PENDING_CONFIRMATION booking and reserves seats atomically.
 * Prices are snapshotted so later package edits don't change past bookings.
 */
export async function createBooking(input: NewBooking) {
  return db.$transaction(async (tx) => {
    const pkg = await tx.travelPackage.findUnique({
      where: { id: input.packageId },
      include: { company: true },
    });
    if (!pkg || pkg.status !== "ACTIVE" || !pkg.company.active) {
      throw new BookingError("This package is not available for booking.");
    }
    if (input.travelers < 1 || input.travelers > pkg.maxGroupSize) {
      throw new BookingError(`Group size must be between 1 and ${pkg.maxGroupSize}.`);
    }
    if (input.travelDate < pkg.availableFrom || input.travelDate > pkg.availableTo) {
      throw new BookingError(
        `Travel date must be between ${pkg.availableFrom.toISOString().slice(0, 10)} and ${pkg.availableTo
          .toISOString()
          .slice(0, 10)}.`,
      );
    }
    if (input.travelDate < new Date()) throw new BookingError("Travel date must be in the future.");

    // Conditional update so two concurrent bookings can't oversell the last seats.
    const reserved = await tx.travelPackage.updateMany({
      where: { id: pkg.id, seatsBooked: { lte: pkg.seatsTotal - input.travelers } },
      data: { seatsBooked: { increment: input.travelers } },
    });
    if (reserved.count === 0) {
      throw new BookingError(`Only ${pkg.seatsTotal - pkg.seatsBooked} seats are left on this package.`);
    }

    const totalPrice = pkg.pricePerPerson.mul(input.travelers);
    const totalCost = pkg.costPerPerson.mul(input.travelers);
    const platformFee = totalPrice.mul(pkg.company.commissionRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return tx.booking.create({
      data: {
        reference: bookingReference(),
        customerId: input.customerId,
        packageId: pkg.id,
        companyId: pkg.companyId,
        conversationId: input.conversationId,
        travelers: input.travelers,
        travelDate: input.travelDate,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        notes: input.notes ?? null,
        currency: pkg.currency,
        totalPrice,
        totalCost,
        platformFee,
      },
      include: { package: true, company: true },
    });
  });
}

export async function setBookingStatus(bookingId: string, companyId: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, companyId } });
    if (!booking) throw new BookingError("Booking not found.");
    const allowed: Record<string, string[]> = {
      PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["COMPLETED", "CANCELLED"],
    };
    if (!allowed[booking.status]?.includes(status)) {
      throw new BookingError(`Cannot change a ${booking.status} booking to ${status}.`);
    }
    if (status === "CANCELLED") {
      await tx.travelPackage.update({
        where: { id: booking.packageId },
        data: { seatsBooked: { decrement: booking.travelers } },
      });
    }
    return tx.booking.update({
      where: { id: booking.id },
      // A cancelled paid booking is owed back to the customer; staff settle the refund outside the app.
      data: { status, ...(status === "CANCELLED" && booking.paymentStatus === "PAID" && { paymentStatus: "REFUNDED" }) },
    });
  });
}

export async function recordPayment(
  bookingId: string,
  companyId: string,
  staffId: string,
  input: { method: "CASH" | "BANK_TRANSFER" | "CARD_IN_PERSON" | "OTHER"; reference?: string | null },
) {
  const booking = await db.booking.findFirst({ where: { id: bookingId, companyId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status === "CANCELLED") throw new BookingError("Cancelled bookings can't be marked as paid.");
  if (booking.paymentStatus === "PAID") throw new BookingError("This booking is already paid.");
  return db.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: "PAID", paymentMethod: input.method, paymentRef: input.reference || null, paidAt: new Date(), paidById: staffId },
  });
}

/** Company profit = revenue - cost - platform commission, over confirmed/completed bookings. */
export async function companyProfitSummary(companyId: string) {
  const rows = await db.booking.groupBy({
    by: ["status", "currency"],
    where: { companyId },
    _sum: { totalPrice: true, totalCost: true, platformFee: true },
    _count: true,
  });
  const byPackage = await db.booking.groupBy({
    by: ["packageId", "currency"],
    where: { companyId, status: { in: ["CONFIRMED", "COMPLETED"] } },
    _sum: { totalPrice: true, totalCost: true, platformFee: true, travelers: true },
    _count: true,
  });
  const outstanding = await db.booking.groupBy({
    by: ["currency"],
    where: { companyId, status: { in: ["CONFIRMED", "COMPLETED"] }, paymentStatus: "UNPAID" },
    _sum: { totalPrice: true },
    _count: true,
  });
  return { rows, byPackage, outstanding };
}
