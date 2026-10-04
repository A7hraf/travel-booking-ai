"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/types";

export function SubmitButton({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.success) return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>;
  return null;
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
  textarea = false,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  textarea?: boolean;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue ?? ""} required={required} rows={4} className="input" />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} className="input" {...rest} />
      )}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
