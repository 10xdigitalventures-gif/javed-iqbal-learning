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
} from "@/components/ui";
import {
  Pager,
  buildQuery,
  useDebounced,
  type Paged,
} from "@/components/list-controls";
import { PageHeader } from "@/components/shell";
import type { User } from "@/lib/types";

export default function AdminClients() {
  const [data, setData] = useState<Paged<User> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  // Search / filter / sort / pagination state.
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function setDeviceLimit(u: User, n: number) {
    try {
      await api(`/users/${u.id}`, {
        method: "PATCH",
        body: { maxDevices: n },
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not update device limit");
    }
  }

  async function load() {
    try {
      const query = buildQuery({
        role: "CLIENT",
        q: debouncedQ,
        status,
        sort,
        order,
        page,
        pageSize,
      });
      setData(await api<Paged<User>>(`/users/paged${query}`));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, sort, order, page]);

  // Reset to first page whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, sort, order]);

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

  const list = data?.rows ?? null;

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

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Search"
            placeholder="Name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt">Date joined</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
          </Select>
          <Select
            label="Order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </Card>

      {!list ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-2">
            {list.map((u) => (
              <Card key={u.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Devices</span>
                      <Select
                        value={String(u.maxDevices ?? 2)}
                        onChange={(e) =>
                          setDeviceLimit(u, Number(e.target.value))
                        }
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </Select>
                    </div>
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
            {list.length === 0 ? (
              <Card>
                <p className="py-6 text-center text-slate-400">
                  No clients match your filters
                </p>
              </Card>
            ) : null}
          </div>
          {data ? (
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
