"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { Community } from "@/lib/types";

export default function AdminCommunities() {
  const [list, setList] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    isPaid: "false",
    price: 0,
    currency: "PKR",
  });

  async function load() {
    try {
      setList(await api<Community[]>("/communities/all"));
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
      await api("/communities", {
        method: "POST",
        body: {
          name: form.name,
          description: form.description,
          isPaid: form.isPaid === "true",
          price: Number(form.price),
          currency: form.currency,
        },
      });
      setShow(false);
      setForm({
        name: "",
        description: "",
        isPaid: "false",
        price: 0,
        currency: "PKR",
      });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    await api(`/communities/${id}`, { method: "DELETE" });
    load();
  }

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Communities"
        subtitle="Create free or paid community groups"
        action={
          <Button onClick={() => setShow((s) => !s)}>Add community</Button>
        }
      />
      <ErrorText message={error} />
      {show ? (
        <Card className="mb-4">
          <form onSubmit={create} className="grid grid-cols-2 gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Select
              label="Access"
              value={form.isPaid}
              onChange={(e) => setForm({ ...form, isPaid: e.target.value })}
            >
              <option value="false">Free</option>
              <option value="true">Paid</option>
            </Select>
            <Input
              label="Price (if paid)"
              type="number"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <div className="col-span-2">
              <Button type="submit">Create community</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-500">{c.description}</p>
              </div>
              <Badge color={c.isPaid ? "amber" : "green"}>
                {c.isPaid ? `${c.currency} ${c.price}` : "Free"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {c._count?.members ?? 0} members · {c._count?.posts ?? 0} posts
            </p>
            {c.isActive ? (
              <Button
                variant="danger"
                className="mt-3"
                onClick={() => remove(c.id)}
              >
                Deactivate
              </Button>
            ) : (
              <Badge color="red">Inactive</Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
