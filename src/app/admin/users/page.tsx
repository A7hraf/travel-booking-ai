import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createAccount, setUserActive } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { dateTime } from "@/lib/format";

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const admin = await requireUser(["ADMIN"]);
  const { role } = await props.searchParams;
  const roleFilter = typeof role === "string" && role ? role : undefined;
  const [users, companies] = await Promise.all([
    db.user.findMany({
      where: roleFilter ? { role: roleFilter as never } : {},
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="h1">Accounts</h1>
      <div className="card max-w-2xl">
        <h2 className="mb-4 font-medium">Create an account</h2>
        <ActionForm action={createAccount}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" />
            <Field label="Email" name="email" type="email" />
            <Field label="Initial password" name="password" type="password" minLength={8} />
            <label className="block">
              <span className="label">Role</span>
              <select name="role" className="input" defaultValue="SUPPORT">
                <option value="SUPPORT">Support</option>
                <option value="ADMIN">Admin</option>
                <option value="COMPANY_OWNER">Company owner</option>
                <option value="COMPANY_EMPLOYEE">Company employee</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Company (for company roles)</span>
              <select name="companyId" className="input" defaultValue="">
                <option value="">—</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
          <SubmitButton>Create account</SubmitButton>
        </ActionForm>
      </div>

      <form className="flex gap-2">
        <select name="role" defaultValue={roleFilter ?? ""} className="input w-56">
          <option value="">All roles</option>
          {["CUSTOMER", "COMPANY_OWNER", "COMPANY_EMPLOYEE", "SUPPORT", "ADMIN"].map((r) => (
            <option key={r} value={r}>{r.replace("_", " ").toLowerCase()}</option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Company</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td className="lowercase">{u.role.replace("_", " ")}</td>
                <td>{u.company?.name ?? "—"}</td>
                <td className="whitespace-nowrap">{dateTime(u.createdAt)}</td>
                <td>
                  {u.id !== admin.id && (
                    <form action={setUserActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={String(!u.active)} />
                      <button className="btn">{u.active ? "Deactivate" : "Reactivate"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
