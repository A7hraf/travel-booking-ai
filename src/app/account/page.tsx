import { requireUser } from "@/lib/auth";
import { changePassword, updateProfile } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="h1">My account</h1>
      <div className="card">
        <h2 className="mb-4 font-medium">Profile</h2>
        <ActionForm action={updateProfile}>
          <p className="text-sm text-gray-500">{user.email}</p>
          <Field label="Name" name="name" defaultValue={user.name} />
          <Field label="Phone" name="phone" type="tel" required={false} defaultValue={user.phone} />
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </div>
      <div className="card">
        <h2 className="mb-4 font-medium">Change password</h2>
        <ActionForm action={changePassword}>
          <Field label="Current password" name="current" type="password" autoComplete="current-password" />
          <Field label="New password" name="next" type="password" minLength={8} autoComplete="new-password" />
          <Field label="Repeat new password" name="confirm" type="password" minLength={8} autoComplete="new-password" />
          <SubmitButton>Change password</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
