const COLORS: Record<string, string> = {
  AI_ACTIVE: "bg-brand-50 text-brand-700",
  HANDED_TO_COMPANY: "bg-amber-50 text-amber-700",
  HANDED_TO_SUPPORT: "bg-purple-50 text-purple-700",
  CLOSED: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  NEEDS_CHANGES: "bg-orange-50 text-orange-700",
  VALIDATED: "bg-brand-50 text-brand-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
  PENDING_CONFIRMATION: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  COMPLETED: "bg-gray-100 text-gray-700",
  UNPAID: "bg-orange-50 text-orange-700",
  PAID: "bg-green-50 text-green-700",
  REFUNDED: "bg-purple-50 text-purple-700",
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[value] ?? "bg-gray-100"}`}>
      {value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
