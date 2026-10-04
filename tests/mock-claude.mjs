// A tiny stand-in for the Claude Messages API used by the e2e tests, so they
// run without an API key and give deterministic answers. It drives the same
// tools the real assistant uses:
//   "...human..."                     -> handoff_to_support
//   "...book the <name> one on DATE"   -> create_booking (package found in earlier search results)
//   "...slow..."                       -> plain reply after 2s (used to test the one-turn-at-a-time lock)
//   anything else                      -> search_packages, then a list of results
import http from "node:http";

const PORT = Number(process.env.MOCK_CLAUDE_PORT ?? 4010);
let n = 0;
const message = (content, stop_reason) => ({
  id: `msg_mock_${++n}`,
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
});
const toolUse = (name, input) => message([{ type: "tool_use", id: `toolu_${n}`, name, input }], "tool_use");
const text = (t) => message([{ type: "text", text: t }], "end_turn");

function searchResults(messages) {
  return messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b) => b.type === "tool_result")
    .flatMap((b) => {
      try {
        const v = JSON.parse(typeof b.content === "string" ? b.content : "");
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    });
}

async function respond(body) {
  const last = body.messages.at(-1);
  if (typeof last.content === "string") {
    const t = last.content;
    if (/slow/i.test(t)) {
      await new Promise((r) => setTimeout(r, 2000));
      return text("Sorry for the wait! How can I help?");
    }
    if (/human/i.test(t)) return toolUse("handoff_to_support", { reason: "Customer asked for a human" });
    const m = t.match(/book the (.+?) one on (\d{4}-\d{2}-\d{2})/i);
    if (m) {
      const pkg = searchResults(body.messages).find((p) => p.title.toLowerCase().includes(m[1].toLowerCase()));
      if (!pkg) return text("Which package would you like?");
      return toolUse("create_booking", {
        package_id: pkg.package_id,
        travelers: 2,
        travel_date: m[2],
        contact_name: "Carla Customer",
        contact_phone: "+1 555 0100",
        notes: null,
      });
    }
    return toolUse("search_packages", {
      text: null, country: null, max_price_per_person: null, min_days: null, max_days: null, travel_date: null, travelers: 2,
    });
  }

  const result = last.content.find((b) => b.type === "tool_result");
  const call = body.messages.at(-2).content.find((b) => b.type === "tool_use");
  if (result.is_error) return text(`Sorry, that didn't work: ${result.content}`);
  if (call.name === "search_packages") {
    const list = JSON.parse(result.content);
    if (!Array.isArray(list)) return text("I couldn't find a matching package.");
    return text(`Here are some options:\n${list.map((p) => `- ${p.title}: ${p.price_per_person} per person`).join("\n")}\nWhich one would you like?`);
  }
  if (call.name === "create_booking") {
    const o = JSON.parse(result.content);
    return text(`Your booking request ${o.booking_reference} is in! Total ${o.total_price}. ${o.company}'s team will confirm it here.`);
  }
  return text("I've passed you to our support team. Someone will reply here shortly.");
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      try {
        const out = await respond(JSON.parse(raw));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: String(e) } }));
      }
    });
  })
  .listen(PORT, () => console.log(`mock Claude API on :${PORT}`));
