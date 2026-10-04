import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "../db";
import { handOffToSupport } from "../services/conversations";
import { TOOL_DEFINITIONS, runTool } from "./tools";

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

// Created lazily so a missing API key fails the chat turn, not module import.
let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

const SYSTEM_PROMPT = `You are the booking assistant for a travel marketplace where independent travel companies publish trip packages. You chat with a customer until they either book a package or need a human.

How to help:
- Find out what they want (destination or type of trip, dates, number of travelers, budget) without interrogating them; ask for what's missing, a question or two at a time.
- Only recommend packages returned by search_packages / get_package_details. Never invent packages, prices, availability or policies. If nothing fits, say so and suggest relaxing a filter.
- Quote prices exactly as the tools return them, and show the total (price per person x travelers) before booking.
- Before calling create_booking you need: package, travel date inside the availability window, number of travelers, contact name and phone. Show a short summary with the total and ask the customer to confirm; call create_booking only after a clear yes.
- Payment and final confirmation are handled by the travel company's staff after the booking request is created; don't collect card details.

When to hand off (the chat then belongs to a human, so tell the customer what happens next in one short message):
- handoff_to_company: requests only the company can handle (custom itineraries, discounts, changes or questions about an existing booking with them, complaints about their service).
- handoff_to_support: account or app problems, payment or refund disputes, safety concerns, anything not tied to one company, or the customer asks for a human and no company applies.

Keep replies short, friendly and in the customer's language. Use plain text with simple lists; no tables.`;

type HistoryMessage = Anthropic.Beta.BetaMessageParam;

export type AssistantResult = { reply: string | null; handedOff: boolean };

/**
 * Runs one customer turn through Claude with tool use. The raw API history is
 * stored on the conversation and only ever appended to, so thinking blocks are
 * replayed unchanged on the next turn.
 */
export async function runAssistantTurn(conversationId: string, customerText: string): Promise<AssistantResult> {
  const convo = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  const history = z.array(z.any()).parse(convo.aiHistory) as HistoryMessage[];
  history.push({ role: "user", content: customerText });

  const ctx = { customerId: convo.customerId, conversationId };
  let handedOff = false;
  let reply: string | null = null;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOL_DEFINITIONS,
        messages: history,
        output_config: { effort: "medium" },
        // If a safety classifier declines, the API retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      history.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") {
        await handOffToSupport(conversationId, "The assistant could not continue this conversation (model refusal).");
        handedOff = true;
        reply = "Sorry, I can't help with that here. I've passed your conversation to our support team.";
        break;
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (response.stop_reason === "pause_turn") continue;
      if (response.stop_reason !== "tool_use") {
        reply = text || null;
        break;
      }

      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const outcome = await runTool(block.name, block.input, ctx);
          if (outcome.handedOff) handedOff = true;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: outcome.content, is_error: outcome.isError });
        } catch (e) {
          const message = e instanceof z.ZodError ? `Invalid input: ${e.message}` : "Tool failed unexpectedly.";
          if (!(e instanceof z.ZodError)) console.error(`tool ${block.name} failed`, e);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: message, is_error: true });
        }
      }
      // All results for one assistant turn go back in a single user message.
      history.push({ role: "user", content: toolResults });
    }
  } catch (e) {
    // API outage, rate limit, missing credentials...: keep the chat usable and
    // save the valid part of the transcript below.
    console.error("assistant turn failed", e);
    reply = "I'm having trouble right now. Please try again in a moment, or ask for a human and I'll connect you.";
  }

  // The stored transcript must end on a complete assistant turn (no pending
  // tool_use). If we stopped mid-loop (API error / round limit), truncate back
  // to the last complete turn so it stays a valid prefix for the next request.
  while (history.length && !isCompleteAssistantTurn(history[history.length - 1])) history.pop();
  if (!reply && !handedOff) {
    reply = "Sorry, I couldn't finish that. Could you rephrase, or ask for a human and I'll connect you?";
  }

  await db.$transaction(async (tx) => {
    await tx.conversation.update({
      where: { id: conversationId },
      data: { aiHistory: history as unknown as object[] },
    });
    if (reply) await tx.chatMessage.create({ data: { conversationId, senderType: "AI", content: reply } });
  });

  return { reply, handedOff };
}

function isCompleteAssistantTurn(m: HistoryMessage) {
  if (m.role !== "assistant") return false;
  return typeof m.content === "string" || !m.content.some((b) => b.type === "tool_use");
}
