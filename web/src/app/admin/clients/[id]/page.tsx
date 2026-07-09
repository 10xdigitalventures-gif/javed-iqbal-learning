"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Badge, Card, ErrorText, Spinner } from "@/components/ui";
import { Pager, type Paged } from "@/components/list-controls";
import { PageHeader } from "@/components/shell";
import type { User } from "@/lib/types";

type LogRow = {
  id: string;
  action: string;
  meta: string | null;
  ip: string | null;
  createdAt: string;
};

type Analytics = {
  ownedBooks: number;
  paidOrders: number;
  readingProgress: { book: { title: string }; percentComplete: number }[];
};

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

export default function ContactDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [contact, setContact] = useState<User | null>(null);
  const [stats, setStats] = useState<Analytics | null>(null);
  const [logs, setLogs] = useState<Paged<LogRow> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    if (!id) return;
    api<User>(`/users/${id}`)
      .then(setContact)
      .catch((e) => setError(e?.message || "Could not load the contact."));
    api<Analytics>(`/activity/analytics/user/${id}`)
      .then(setStats)
      .catch(() => setStats(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api<Paged<LogRow>>(
      `/activity/admin/user/${id}/logs?page=${page}&pageSize=${pageSize}`,
    )
      .then(setLogs)
      .catch(() => setLogs(null));
  }, [id, page]);

  const rows = logs?.rows ?? null;

  return (
    <div>
      <PageHeader
        title={contact ? contact.name : "Contact"}
        subtitle="Contact profile and full activity tracking"
        action={
          <Link
            href="/admin/clients"
            className="text-sm text-brand hover:underline"
          >
            \u2190 Back to clients
          </Link>
        }
      />
      <ErrorText message={error} />

      {!contact ? (
        <Spinner />
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {contact.name}
                </p>
                <p className="text-sm text-slate-500">{contact.email}</p>
                {contact.phone ? (
                  <p className="text-sm text-slate-500">{contact.phone}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <Badge color="blue">{contact.role}</Badge>
                  <Badge color={contact.isActive ? "green" : "red"}>
                    {contact.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.ownedBooks ?? "\u2013"}
                  </p>
                  <p className="text-xs text-slate-500">Owned books</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.paidOrders ?? "\u2013"}
                  </p>
                  <p className="text-xs text-slate-500">Paid orders</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {logs?.total ?? "\u2013"}
                  </p>
                  <p className="text-xs text-slate-500">Logged events</p>
                </div>
              </div>
            </div>
          </Card>

          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Activity log
          </h2>
          {!rows ? (
            <Spinner />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="px-3 py-2 font-medium">Time</th>
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
                          colSpan={4}
                          className="px-3 py-6 text-center text-slate-400"
                        >
                          No activity recorded yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {logs ? (
                <Pager
                  page={logs.page}
                  pageSize={logs.pageSize}
                  total={logs.total}
                  onPage={setPage}
                />
              ) : null}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
