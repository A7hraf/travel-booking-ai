import { markBookingPaid } from "@/app/actions/bookings";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./form";

export function PaymentForm({ bookingId }: { bookingId: string }) {
  return (
    <details className="w-full">
      <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">Record payment</summary>
      <ActionForm action={markBookingPaid} className="mt-2 space-y-2 rounded-lg border border-gray-200 p-3">
        <input type="hidden" name="bookingId" value={bookingId} />
        <select name="method" className="input" defaultValue="CASH">
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CARD_IN_PERSON">Card (in person)</option>
          <option value="OTHER">Other</option>
        </select>
        <input name="reference" placeholder="Receipt / transfer reference (optional)" className="input" />
        <SubmitButton>Mark as paid</SubmitButton>
      </ActionForm>
    </details>
  );
}
