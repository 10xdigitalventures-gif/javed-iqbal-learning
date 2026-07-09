"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken, API_URL } from "@/lib/api";
import {
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

type LogRow = {
  id: string;
  action: string;
  meta: string | null;
  ip: string | null;
  createdAt: string;
  userId: string | null;
  user?: { id: string; name: string; email: string; role: string } | null;
};

// Pretty-print the JSON meta blob (best effort) into a short one-liner.
function formatMeta(meta: string | null): string {
  if (!meta) return "";
  try {
    const obj = JSON.parse(meta);
    return Object.entries(obj)
      .filter(([k]) => k !== "at")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" \u00b7 ");
  } catch {
    return meta;
  }
}

export default function AdminAudit() {
  const [data, setData] = useState<Paged<LogRow> | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  function query() {
    return buildQuery({
      q: debouncedQ,
      action,
      from,
      to,
      page,
      pageSize,
    });
  }

  async function load() {
    try {
      setError(null);
      setData(await api<Paged<LogRow>>(`/activity/admin/all${query()}`));
    } catch (e: any) {
      setError(e?.message || "Could not load the audit log.");
    }
  }

  useEffect(() => {
    api<string[]>("/activity/admin/actions")
      .then((a) => setActions(a || []))
      .catch(() => setActions([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, action, from, to, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, action, from, to]);

  async function downloadCsv() {
    const token = getToken();
    const res = await fetch(`${API_URL}/activity/admin/export${query()}`, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = data?.rows ?? null;

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Global activity tracking across every user on the platform."
        action={
          <Button variant="outline" onClick={downloadCsv}>
            Export CSV
          </Button>
        }
      />
      <ErrorText message={error} />

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Search action"
            placeholder="e.g. login, purchase"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

      {!rows ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {l.user ? (
                        <Link
                          href={`/admin/clients/${l.user.id}`}
                          className="text-brand hover:underline"
                        >
                          {l.user.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">System</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {l.action}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {formatMeta(l.meta)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {l.ip || "\u2014"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      No activity found for these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {data ? (
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
            />
          ) : null}
        </Card>
      )}
    </div>
  );
}
