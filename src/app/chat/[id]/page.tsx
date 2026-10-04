import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/badge";
import { ChatWindow } from "@/components/chat-window";
import { requestHuman } from "@/app/actions/conversations";

const STATUS_HELP: Record<string, string> = {
  AI_ACTIVE: "You're chatting with the AI travel assistant.",
  HANDED_TO_COMPANY: "A member of the travel company's team will reply here.",
  HANDED_TO_SUPPORT: "Our support team will reply here.",
  CLOSED: "This conversation is closed.",
};

export default async function ChatPage(props: PageProps<"/chat/[id]">) {
  const user = await requireUser(["CUSTOMER"]);
  const { id } = await props.params;
  const { draft } = await props.searchParams;
  const convo = await db.conversation.findFirst({
    where: { id, customerId: user.id },
    include: { company: { select: { name: true } } },
  });
  if (!convo) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="h1">{convo.title}</h1>
          <p className="text-sm text-gray-500">{STATUS_HELP[convo.status]}</p>
        </div>
        <Badge value={convo.status} />
      </div>
      {convo.status === "AI_ACTIVE" && (
        <form action={requestHuman} className="flex justify-end">
          <input type="hidden" name="conversationId" value={convo.id} />
          <button className="text-sm text-brand-700 underline">Talk to a person instead</button>
        </form>
      )}
      <ChatWindow
        conversationId={convo.id}
        viewer="customer"
        initialStatus={convo.status}
        initialDraft={typeof draft === "string" ? draft : ""}
      />
    </div>
  );
}
