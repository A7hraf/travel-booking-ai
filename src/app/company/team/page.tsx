import { db } from "@/lib/db";
import { requireCompanyUser } from "@/lib/auth";
import { addEmployee, removeEmployee, resetEmployeePassword } from "@/app/actions/team";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export default async function TeamPage() {
  const owner = await requireCompanyUser(true);
  const staff = await db.user.findMany({ where: { companyId: owner.companyId }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="h1">Team</h1>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td className="lowercase">{u.role.replace("COMPANY_", "")}</td>
                <td>
                  {u.role === "COMPANY_EMPLOYEE" && (
                    <div className="flex flex-wrap items-start gap-2">
                      <details>
                        <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">Reset password</summary>
                        <ActionForm action={resetEmployeePassword} className="mt-2 w-56 space-y-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <input name="password" type="text" minLength={8} required placeholder="Temporary password" className="input" />
                          <SubmitButton>Set password</SubmitButton>
                        </ActionForm>
                      </details>
                      <form action={removeEmployee}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="btn">Remove</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card max-w-xl">
        <h2 className="mb-1 font-medium">Add an employee</h2>
        <p className="mb-4 text-sm text-gray-600">
          Employees can manage packages, answer customer chats and confirm bookings. They can&apos;t see profit or manage the team. If the email
          already has a customer account it&apos;s attached to your company; otherwise a new account is created with the temporary password.
        </p>
        <ActionForm action={addEmployee}>
          <Field label="Name" name="name" />
          <Field label="Email" name="email" type="email" />
          <Field label="Temporary password" name="password" type="password" required={false} hint="Only needed for new accounts (min 8 characters)." />
          <SubmitButton>Add employee</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
