"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderType: "CUSTOMER" | "AI" | "STAFF" | "SYSTEM";
  content: string;
  createdAt: string;
  sender: { name: string } | null;
};

const POLL_MS = 3000;

/**
 * Shared chat UI for customers and staff. Polls for new messages so staff
 * replies (and AI replies) appear without a refresh.
 */
export function ChatWindow({
  conversationId,
  viewer,
  initialStatus,
  initialDraft = "",
}: {
  conversationId: string;
  viewer: "customer" | "staff";
  initialStatus: string;
  initialDraft?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState(initialDraft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Re-render the server parts of the page (status badge, booking panel) after a handoff or close.
  useEffect(() => {
    if (status !== initialStatus) router.refresh();
  }, [status, initialStatus, router]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data.status);
    setMessages((prev) => (prev.length === data.messages.length ? prev : data.messages));
  }, [conversationId]);

  useEffect(() => {
    // Initial load plus polling; the fetch result is applied asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, senderType: viewer === "customer" ? "CUSTOMER" : "STAFF", content, createdAt: new Date().toISOString(), sender: null },
    ]);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Failed to send");
    } finally {
      setSending(false);
      await refresh();
    }
  }

  const mine = (m: Message) => (viewer === "customer" ? m.senderType === "CUSTOMER" : m.senderType === "STAFF");
  const closed = status === "CLOSED";
  const aiTyping = sending && viewer === "customer" && status === "AI_ACTIVE";

  return (
    <div className="card flex h-[70vh] flex-col p-0">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) =>
          m.senderType === "SYSTEM" ? (
            <p key={m.id} className="text-center text-xs text-gray-500">
              {m.content}
            </p>
          ) : (
            <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  mine(m) ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className={`mb-0.5 text-xs ${mine(m) ? "text-brand-100" : "text-gray-500"}`}>
                  {m.senderType === "AI" ? "Travel assistant" : m.senderType === "CUSTOMER" ? (viewer === "customer" ? "You" : m.sender?.name ?? "Customer") : m.sender?.name ?? "Staff"}
                </div>
                {m.content}
              </div>
            </div>
          ),
        )}
        {aiTyping && <p className="text-sm text-gray-400">Assistant is typing…</p>}
        <div ref={bottom} />
      </div>
      {error && <p className="px-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-gray-200 p-3">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={closed ? "This conversation is closed" : "Type a message…"}
          disabled={closed || sending}
          maxLength={4000}
        />
        <button className="btn-primary" disabled={closed || sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
