import React, { useEffect, useState } from "react";
import { authFetch, useAuth } from "@/lib/auth/auth-context";

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "TEACHER" | "ADMIN" | "RESEARCHER";
  createdAt: string;
}

const ASSIGNABLE_ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;

/** Lets an administrator see accounts and change who is a teacher or an admin. */
export function UserRoleManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load accounts");
      setUsers(json.data || []);
    } catch (err: unknown) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not load accounts" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (target: ManagedUser, role: string) => {
    if (role === target.role) return;
    if (!window.confirm(`Change the role of ${target.name} (${target.email}) to ${role}?`)) return;
    setMessage(null);
    const res = await authFetch(`/api/admin/users/${target.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage({ ok: false, text: json.error || "Could not change the role" });
      return;
    }
    setMessage({ ok: true, text: `${target.name} is now ${role}.` });
    await load();
  };

  const q = search.trim().toLowerCase();
  const shown = users.filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));

  return (
    <section aria-labelledby="user-roles-heading" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-8">
      <h2 id="user-roles-heading" className="text-base font-bold text-slate-900">
        Accounts and roles
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">
        New sign-ups are always students. Promote a registered account to teacher here. You cannot change your own role.
      </p>

      <label htmlFor="user-search" className="sr-only">
        Search accounts
      </label>
      <input
        id="user-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email"
        className="w-full sm:w-80 px-3 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] mb-3"
      />

      {message && (
        <p role="alert" className={`text-xs mb-3 ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading accounts...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-900">{u.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{u.email}</td>
                  <td className="py-2">
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      disabled={u.id === user?.id || u.role === "RESEARCHER"}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 min-h-[36px] bg-white"
                    >
                      {u.role === "RESEARCHER" && <option value="RESEARCHER">RESEARCHER</option>}
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-500">
                    No accounts match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
