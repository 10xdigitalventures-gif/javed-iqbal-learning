"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Spinner,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { User } from "@/lib/types";

export default function AdminClients() {
  const [list, setList] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function load() {
    try {
      setList(await api<User[]>("/users?role=CLIENT"));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/users", {
        method: "POST",
        body: { ...form, role: "CLIENT" },
      });
      setShow(false);
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggle(u: User) {
    await api(`/users/${u.id}/${u.isActive ? "deactivate" : "activate"}`, {
      method: "PATCH",
    });
    load();
  }

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage client accounts"
        action={<Button onClick={() => setShow((s) => !s)}>Add client</Button>}
      />
      <ErrorText message={error} />
      {show ? (
        <Card className="mb-4">
          <form onSubmit={create} className="grid grid-cols-3 gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <div className="col-span-3">
              <Button type="submit">Create client</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="space-y-2">
        {list.map((u) => (
          <Card key={u.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-sm text-slate-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge color={u.isActive ? "green" : "red"}>
                  {u.isActive ? "Active" : "Inactive"}
                </Badge>
                <Button variant="outline" onClick={() => toggle(u)}>
                  {u.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
