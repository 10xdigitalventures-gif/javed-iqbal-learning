"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Select } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { User } from "@/lib/types";

// Must mirror backend src/common/scopes.ts
const SCOPES: { key: string; label: string; hint: string }[] = [
  {
    key: "support:view",
    label: "View tickets",
    hint: "See all support tickets",
  },
  { key: "support:reply", label: "Reply", hint: "Answer users on a ticket" },
  { key: "support:assign", label: "Assign", hint: "Assign tickets to staff" },
  {
    key: "support:status",
    label: "Change status",
    hint: "Open / resolve / close",
  },
  {
    key: "support:delete",
    label: "Delete tickets",
    hint: "Destructive \u2014 off by default",
  },
];
const DEFAULT_AGENT_SCOPES = [
  "support:view",
  "support:reply",
  "support:assign",
  "support:status",
];

export default function AdminTeam() {
  const [staff, setStaff] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // new agent form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(DEFAULT_AGENT_SCOPES);

  async function load() {
    try {
      const [admins, supports] = await Promise.all([
        api<User[]>("/users?role=ADMIN"),
        api<User[]>("/users?role=SUPPORT"),
      ]);
      setStaff([...(admins || []), ...(supports || [])]);
    } catch (e: any) {
      setError(e?.message || "Could not load the team.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  function toggle(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((s) => s !== key) : [...list, key];
  }

  async function createAgent() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Enter a name, email and a password of at least 6 characters.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await api("/users", {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          password,
          role: "SUPPORT",
          scopes: newScopes,
        },
      });
      setName("");
      setEmail("");
      setPassword("");
      setNewScopes(DEFAULT_AGENT_SCOPES);
      load();
    } catch (e: any) {
      setError(e?.message || "Could not create the support agent.");
    } finally {
      setBusy(false);
    }
  }

  async function saveScopes(u: User, scopes: string[]) {
    try {
      setBusy(true);
      await api("/users/" + u.id, { method: "PATCH", body: { scopes } });
      load();
    } catch (e: any) {
      setError(e?.message || "Could not update permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(u: User, role: string) {
    try {
      setBusy(true);
      await api("/users/" + u.id, { method: "PATCH", body: { role } });
      load();
    } catch (e: any) {
      setError(e?.message || "Could not change the role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Team & roles"
        subtitle="Manage admin-portal staff. Support agents share the admin portal but only have the scopes you grant them."
      />
      {error ? <ErrorText message={error} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Add support agent
          </h2>
          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Temporary password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">Permissions</p>
            {SCOPES.map((s) => (
              <label
                key={s.key}
                className="flex items-start gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={newScopes.includes(s.key)}
                  onChange={() => setNewScopes(toggle(newScopes, s.key))}
                />
                <span>
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs text-slate-400">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <Button onClick={createAgent} disabled={busy}>
            Create agent
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Admin-portal staff
          </h2>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500">No staff yet.</p>
          ) : (
            staff.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  <Badge color={u.role === "ADMIN" ? "green" : "blue"}>
                    {u.role === "ADMIN" ? "Admin" : "Support"}
                  </Badge>
                </div>

                {u.role === "ADMIN" ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Full access to every scope.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SCOPES.map((s) => {
                      const on = (u.scopes || []).includes(s.key);
                      return (
                        <button
                          key={s.key}
                          disabled={busy}
                          onClick={() =>
                            saveScopes(
                              u,
                              on
                                ? (u.scopes || []).filter((x) => x !== s.key)
                                : [...(u.scopes || []), s.key],
                            )
                          }
                          className={
                            "rounded-lg border px-2 py-1 text-xs transition " +
                            (on
                              ? "border-brand bg-brand text-white"
                              : "border-slate-200 text-slate-500 hover:bg-slate-50")
                          }
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Role</span>
                  <Select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    disabled={busy}
                  >
                    <option value="SUPPORT">Support agent</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
