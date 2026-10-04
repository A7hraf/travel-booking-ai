"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/types";
import { FormMessage } from "./form";

/** Wraps a server action that returns FormState so any server-rendered form can show errors. */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      <FormMessage state={state} />
      {children}
    </form>
  );
}
