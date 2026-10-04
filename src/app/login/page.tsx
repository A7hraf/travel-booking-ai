import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-6">Log in</h1>
      <div className="card">
        <ActionForm action={login}>
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field label="Password" name="password" type="password" autoComplete="current-password" />
          <SubmitButton className="btn-primary w-full">Log in</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-sm text-gray-600">
        Forgot your password? Company employees: ask your company owner. Everyone else: contact support{process.env.SUPPORT_EMAIL ? ` at ${process.env.SUPPORT_EMAIL}` : ""} to reset it.
      </p>
      <p className="mt-2 text-center text-sm text-gray-600">
        New here? <Link href="/register" className="text-brand-700 underline">Create an account</Link>
      </p>
    </div>
  );
}
