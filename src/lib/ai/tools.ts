import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { BookingError, createBooking } from "../services/bookings";
import { handOffToCompany, handOffToSupport } from "../services/conversations";

export type ToolContext = { customerId: string; conversationId: string };

/** Set once a handoff tool runs, so the caller knows the AI no longer owns the chat. */
export type ToolOutcome = { content: string; isError?: boolean; handedOff?: boolean };

const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;
const nullableInteger = { type: ["integer", "null"] } as const;

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_packages",
    description:
      "Search the marketplace's active travel packages. Use this before recommending anything; never invent packages or prices. All filters are optional (pass null to skip). Returns up to 10 matches.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        text: { ...nullableString, description: "Free-text match against destination, country, title, description" },
        country: nullableString,
        max_price_per_person: nullableNumber,
        min_days: nullableInteger,
        max_days: nullableInteger,
        travel_date: { ...nullableString, description: "YYYY-MM-DD; only packages available on this date" },
        travelers: { ...nullableInteger, description: "Only packages with this many seats left" },
      },
      required: ["text", "country", "max_price_per_person", "min_days", "max_days", "travel_date", "travelers"],
      additionalProperties: false,
    },
  },
  {
    name: "get_package_details",
    description: "Full details of one package: itinerary description, inclusions/exclusions, availability window, seats left, company.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { package_id: { type: "string" } },
      required: ["package_id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_booking",
    description:
      "Create a booking request once the customer has explicitly confirmed the package, number of travelers, travel date, contact name and phone. This reserves the seats and hands the conversation to the travel company's staff, who confirm the booking and arrange payment. Only call after showing the customer a summary with the total price and getting a clear yes.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        package_id: { type: "string" },
        travelers: { type: "integer" },
        travel_date: { type: "string", description: "YYYY-MM-DD" },
        contact_name: { type: "string" },
        contact_phone: { type: "string" },
        notes: { ...nullableString, description: "Special requests (diet, accessibility, room preferences)" },
      },
      required: ["package_id", "travelers", "travel_date", "contact_name", "contact_phone", "notes"],
      additionalProperties: false,
    },
  },
  {
    name: "handoff_to_company",
    description:
      "Transfer the conversation to a human at the travel company that owns a package. Use when the customer needs something only the company can answer or change (custom itinerary, group discount, a question about an existing booking with them, a complaint about their service).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        package_id: { type: "string", description: "A package owned by the company to transfer to" },
        reason: { type: "string", description: "Short summary for the employee: what the customer wants and what was already discussed" },
      },
      required: ["package_id", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "handoff_to_support",
    description:
      "Transfer the conversation to the platform's support team. Use for account or app problems, payment/refund disputes, safety concerns, when no company is involved, or when the customer asks for a human and no specific company applies.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
];

const searchInput = z.object({
  text: z.string().nullable(),
  country: z.string().nullable(),
  max_price_per_person: z.number().nullable(),
  min_days: z.number().int().nullable(),
  max_days: z.number().int().nullable(),
  travel_date: z.string().nullable(),
  travelers: z.number().int().nullable(),
});
const packageIdInput = z.object({ package_id: z.string().min(1) });
const bookingInput = z.object({
  package_id: z.string().min(1),
  travelers: z.number().int().min(1),
  travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contact_name: z.string().min(1),
  contact_phone: z.string().min(5),
  notes: z.string().nullable(),
});
const companyHandoffInput = z.object({ package_id: z.string().min(1), reason: z.string().min(1) });
const supportHandoffInput = z.object({ reason: z.string().min(1) });

const activePackage = { status: "ACTIVE" as const, company: { active: true } };

function summarize(p: {
  id: string;
  title: string;
  destination: string;
  country: string;
  durationDays: number;
  pricePerPerson: { toString(): string };
  currency: string;
  availableFrom: Date;
  availableTo: Date;
  seatsTotal: number;
  seatsBooked: number;
  company: { name: string };
}) {
  return {
    package_id: p.id,
    title: p.title,
    destination: `${p.destination}, ${p.country}`,
    duration_days: p.durationDays,
    price_per_person: `${p.pricePerPerson.toString()} ${p.currency}`,
    available: `${p.availableFrom.toISOString().slice(0, 10)} to ${p.availableTo.toISOString().slice(0, 10)}`,
    seats_left: p.seatsTotal - p.seatsBooked,
    company: p.company.name,
  };
}

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  switch (name) {
    case "search_packages": {
      const input = searchInput.parse(rawInput);
      const date = input.travel_date ? new Date(input.travel_date) : null;
      const packages = await db.travelPackage.findMany({
        where: {
          ...activePackage,
          ...(input.text && {
            OR: ["destination", "country", "title", "description"].map((f) => ({
              [f]: { contains: input.text!, mode: "insensitive" as const },
            })),
          }),
          ...(input.country && { country: { contains: input.country, mode: "insensitive" } }),
          ...(input.max_price_per_person != null && { pricePerPerson: { lte: input.max_price_per_person } }),
          durationDays: {
            ...(input.min_days != null && { gte: input.min_days }),
            ...(input.max_days != null && { lte: input.max_days }),
          },
          ...(date && !isNaN(date.getTime()) && { availableFrom: { lte: date }, availableTo: { gte: date } }),
        },
        include: { company: { select: { name: true } } },
        orderBy: { pricePerPerson: "asc" },
        take: 25,
      });
      const matches = packages
        .filter((p) => input.travelers == null || p.seatsTotal - p.seatsBooked >= input.travelers)
        .slice(0, 10)
        .map(summarize);
      return { content: JSON.stringify(matches.length ? matches : { result: "No matching packages." }) };
    }

    case "get_package_details": {
      const { package_id } = packageIdInput.parse(rawInput);
      const p = await db.travelPackage.findFirst({
        where: { id: package_id, ...activePackage },
        include: { company: { select: { name: true, city: true, country: true } } },
      });
      if (!p) return { content: "Package not found or no longer available.", isError: true };
      return {
        content: JSON.stringify({
          ...summarize(p),
          description: p.description,
          inclusions: p.inclusions,
          exclusions: p.exclusions,
          max_group_size: p.maxGroupSize,
          company_location: `${p.company.city}, ${p.company.country}`,
        }),
      };
    }

    case "create_booking": {
      const input = bookingInput.parse(rawInput);
      try {
        const booking = await createBooking({
          customerId: ctx.customerId,
          conversationId: ctx.conversationId,
          packageId: input.package_id,
          travelers: input.travelers,
          travelDate: new Date(`${input.travel_date}T00:00:00Z`),
          contactName: input.contact_name,
          contactPhone: input.contact_phone,
          notes: input.notes,
        });
        await handOffToCompany(
          ctx.conversationId,
          booking.companyId,
          `New booking ${booking.reference} awaiting confirmation: ${booking.travelers} traveler(s) on ${input.travel_date} for "${booking.package.title}".`,
        );
        return {
          handedOff: true,
          content: JSON.stringify({
            booking_reference: booking.reference,
            status: "PENDING_CONFIRMATION",
            total_price: `${booking.totalPrice.toString()} ${booking.currency}`,
            company: booking.company.name,
            next_step: "The conversation is now with the company's staff, who will confirm the booking and arrange payment in this chat.",
          }),
        };
      } catch (e) {
        if (e instanceof BookingError) return { content: e.message, isError: true };
        throw e;
      }
    }

    case "handoff_to_company": {
      const input = companyHandoffInput.parse(rawInput);
      const p = await db.travelPackage.findUnique({ where: { id: input.package_id }, select: { companyId: true } });
      if (!p) return { content: "Unknown package_id; cannot identify the company.", isError: true };
      await handOffToCompany(ctx.conversationId, p.companyId, input.reason);
      return { handedOff: true, content: "Transferred. Tell the customer a company representative will reply in this chat." };
    }

    case "handoff_to_support": {
      const input = supportHandoffInput.parse(rawInput);
      await handOffToSupport(ctx.conversationId, input.reason);
      return { handedOff: true, content: "Transferred. Tell the customer the support team will reply in this chat." };
    }

    default:
      return { content: `Unknown tool: ${name}`, isError: true };
  }
}
