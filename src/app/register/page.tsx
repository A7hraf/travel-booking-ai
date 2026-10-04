import Link from "next/link";
import { register } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-2">Create your account</h1>
      <p className="mb-6 text-sm text-gray-600">
        Sign up to plan and book trips. Travel companies: create an account first, then apply for a company profile.
      </p>
      <div className="card">
        <ActionForm action={register}>
          <Field label="Full name" name="name" autoComplete="name" />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field label="Phone" name="phone" type="tel" required={false} autoComplete="tel" />
          <Field label="Password" name="password" type="password" minLength={8} autoComplete="new-password" />
          <SubmitButton className="btn-primary w-full">Sign up</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account? <Link href="/login" className="text-brand-700 underline">Log in</Link>
      </p>
    </div>
  );
}
