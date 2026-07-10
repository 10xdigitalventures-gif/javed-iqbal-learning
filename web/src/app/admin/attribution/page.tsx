"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Select, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

// ---- types ----
type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "VOID";

type CommissionTotals = {
  pending: number;
  approved: number;
  paid: number;
  void: number;
  total: number;
};

type ChannelRow = { channel: string; count: number; amount: number };

type AttributionSummary = {
  commissionTotals: CommissionTotals;
  byChannel: ChannelRow[];
};

type Commission = {
  id: string;
  amount: number;
  currency: string;
  status: CommissionStatus;
  createdAt: string;
  beneficiary?: { id: string; name: string; email: string };
  saleAttribution?: { channel: string; amount: number };
};

type CommissionsResult = {
  totals: CommissionTotals;
  commissions: Commission[];
};

// ---- helpers ----
function pkr(n: number) {
  return "PKR " + Math.round(n || 0).toLocaleString();
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_COLOR: Record<CommissionStatus, string> = {
  PENDING: "amber",
  APPROVED: "blue",
  PAID: "green",
  VOID: "slate",
};

const STATUS_LABEL: Record<CommissionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  VOID: "Void",
};

const CHANNEL_LABEL: Record<string, string> = {
  DIRECT: "Direct",
  REFERRAL: "Referral",
  ASSISTED: "Assisted",
};

// ---- stat card ----
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </Card>
  );
}

// ---- main page ----
export default function AttributionPage() {
  const [tab, setTab] = useState<"overview" | "commissions">("overview");
  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [result, setResult] = useState<CommissionsResult | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api<AttributionSummary>("/attribution/summary");
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load summary");
    }
  }, []);

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter !== "ALL" ? "?status=" + statusFilter : "";
      const data = await api<CommissionsResult>(
        "/attribution/commissions" + qs,
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (tab === "commissions") loadCommissions();
  }, [tab, loadCommissions]);

  async function updateStatus(id: string, status: CommissionStatus) {
    setActionLoading(id + status);
    try {
      await api("/attribution/commissions/" + id, {
        method: "PATCH",
        body: { status },
      });
      await loadCommissions();
      await loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  const ct = summary?.commissionTotals;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Attribution & Commissions"
        subtitle="Referral performance, channel breakdown, and commission approvals."
      />

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {/* tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(["overview", "commissions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-lg px-4 py-2 text-sm font-medium capitalize transition " +
              (tab === t
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* overview tab */}
      {tab === "overview" ? (
        <div>
          {!summary ? (
            <Spinner />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Pending"
                  value={pkr(ct?.pending ?? 0)}
                  sub="Awaiting approval"
                />
                <StatCard
                  label="Approved"
                  value={pkr(ct?.approved ?? 0)}
                  sub="Ready to pay out"
                />
                <StatCard
                  label="Paid out"
                  value={pkr(ct?.paid ?? 0)}
                  sub="All time"
                />
                <StatCard
                  label="Total earned"
                  value={pkr(ct?.total ?? 0)}
                  sub="Excl. voided"
                />
              </div>

              {summary.byChannel.length > 0 ? (
                <Card className="mt-6">
                  <h2 className="mb-4 font-semibold text-slate-900">
                    Sales by channel
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-2 pr-4">Channel</th>
                          <th className="pb-2 pr-4">Sales</th>
                          <th className="pb-2">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.byChannel.map((row) => (
                          <tr key={row.channel}>
                            <td className="py-3 pr-4 font-medium text-slate-800">
                              {CHANNEL_LABEL[row.channel] ?? row.channel}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {row.count}
                            </td>
                            <td className="py-3 font-semibold text-slate-900">
                              {pkr(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card className="mt-6">
                  <p className="text-sm text-slate-500">
                    No attribution data yet. Share referral links to start
                    tracking sales.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      ) : null}

      {/* commissions tab */}
      {tab === "commissions" ? (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </Select>
            <Button onClick={loadCommissions} variant="outline" size="sm">
              Refresh
            </Button>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <Card>
              {!result || result.commissions.length === 0 ? (
                <p className="text-sm text-slate-500">No commissions found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-3">Beneficiary</th>
                        <th className="pb-2 pr-3">Commission</th>
                        <th className="pb-2 pr-3">Sale</th>
                        <th className="pb-2 pr-3">Channel</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.commissions.map((c) => (
                        <tr key={c.id}>
                          <td className="py-3 pr-3">
                            <p className="font-medium text-slate-900">
                              {c.beneficiary?.name ?? "—"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {c.beneficiary?.email}
                            </p>
                          </td>
                          <td className="py-3 pr-3 font-semibold">
                            {pkr(c.amount)}
                          </td>
                          <td className="py-3 pr-3 text-slate-600">
                            {c.saleAttribution
                              ? pkr(c.saleAttribution.amount)
                              : "—"}
                          </td>
                          <td className="py-3 pr-3">
                            <Badge color="blue">
                              {CHANNEL_LABEL[
                                c.saleAttribution?.channel ?? ""
                              ] ??
                                c.saleAttribution?.channel ??
                                "—"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-3">
                            <Badge color={STATUS_COLOR[c.status]}>
                              {STATUS_LABEL[c.status]}
                            </Badge>
                          </td>
                          <td className="py-3 pr-3 text-slate-600">
                            {fmtDate(c.createdAt)}
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              {c.status === "PENDING" ? (
                                <Button
                                  size="sm"
                                  onClick={() => updateStatus(c.id, "APPROVED")}
                                  loading={actionLoading === c.id + "APPROVED"}
                                >
                                  Approve
                                </Button>
                              ) : null}
                              {c.status === "APPROVED" ? (
                                <Button
                                  size="sm"
                                  onClick={() => updateStatus(c.id, "PAID")}
                                  loading={actionLoading === c.id + "PAID"}
                                >
                                  Mark paid
                                </Button>
                              ) : null}
                              {c.status !== "PAID" && c.status !== "VOID" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateStatus(c.id, "VOID")}
                                  loading={actionLoading === c.id + "VOID"}
                                >
                                  Void
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
