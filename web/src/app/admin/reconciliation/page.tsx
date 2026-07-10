"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Input, Select, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

// ---- types ----
type ChannelBreakdown = { channel: string; count: number; amount: number };

type ReconcileResult = {
  period: string;
  app: { total: number; count: number; byChannel: ChannelBreakdown[] };
  external: { total: number };
  totalRevenue: number;
  commissionTotal: number;
  netAfterCommission: number;
  appShare: number;
  externalShare: number;
  closed: {
    id: string;
    closedBy?: string;
    closedAt: string;
  } | null;
};

type ExternalRevenue = {
  id: string;
  source: string;
  period: string;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
};

type MonthlyClose = {
  id: string;
  period: string;
  appRevenue: number;
  externalRevenue: number;
  totalRevenue: number;
  commissionTotal: number;
  closedAt: string;
};

// ---- helpers ----
function pkr(n: number) {
  return "PKR " + Math.round(n || 0).toLocaleString();
}

function pct(n: number) {
  return ((n || 0) * 100).toFixed(1) + "%";
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

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
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-brand" : ""}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          "mt-1 text-2xl font-bold " +
          (highlight ? "text-brand" : "text-slate-900")
        }
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </Card>
  );
}

// ---- main page ----
export default function ReconciliationPage() {
  const [tab, setTab] = useState<"reconcile" | "external" | "closes">(
    "reconcile",
  );
  const [period, setPeriod] = useState(currentPeriod());
  const [recon, setRecon] = useState<ReconcileResult | null>(null);
  const [externals, setExternals] = useState<ExternalRevenue[]>([]);
  const [closes, setCloses] = useState<MonthlyClose[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // add-external form
  const [addSource, setAddSource] = useState("GHL");
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addCurrency, setAddCurrency] = useState("PKR");
  const [addLoading, setAddLoading] = useState(false);

  const loadRecon = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<ReconcileResult>(
        "/reconciliation?period=" + period,
      );
      setRecon(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadExternals = useCallback(async () => {
    try {
      const data = await api<ExternalRevenue[]>("/reconciliation/external");
      setExternals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  const loadCloses = useCallback(async () => {
    try {
      const data = await api<MonthlyClose[]>("/reconciliation/closes");
      setCloses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    loadRecon();
  }, [loadRecon]);

  useEffect(() => {
    if (tab === "external") loadExternals();
    if (tab === "closes") loadCloses();
  }, [tab, loadExternals, loadCloses]);

  async function closeMonth() {
    if (!period) return;
    if (!confirm("Close month " + period + "? This snapshots current numbers."))
      return;
    setClosing(true);
    try {
      await api("/reconciliation/close", {
        method: "POST",
        body: { period },
      });
      await loadRecon();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setClosing(false);
    }
  }

  async function deleteExternal(id: string) {
    if (!confirm("Delete this external revenue entry?")) return;
    try {
      await api("/reconciliation/external/" + id, { method: "DELETE" });
      await loadExternals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function addExternal(ev: React.FormEvent) {
    ev.preventDefault();
    if (!addAmount || !period) return;
    setAddLoading(true);
    try {
      await api("/reconciliation/external", {
        method: "POST",
        body: {
          source: addSource || "GHL",
          period,
          amount: parseFloat(addAmount),
          currency: addCurrency || "PKR",
          note: addNote || undefined,
        },
      });
      setAddAmount("");
      setAddNote("");
      await loadExternals();
      await loadRecon();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Revenue Reconciliation"
        subtitle="Monthly App vs External (GHL) revenue breakdown, commission liability, and month-end close."
        action={
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Period</label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-44"
            />
          </div>
        }
      />

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {/* tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(["reconcile", "external", "closes"] as const).map((t) => (
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
            {t === "reconcile"
              ? "Reconcile"
              : t === "external"
                ? "External revenue"
                : "Closes"}
          </button>
        ))}
      </div>

      {/* reconcile tab */}
      {tab === "reconcile" ? (
        <div>
          {loading ? (
            <Spinner />
          ) : !recon ? null : (
            <>
              {/* closed banner */}
              {recon.closed ? (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <span className="text-sm font-medium text-green-800">
                    Month closed
                  </span>
                  <span className="text-sm text-green-700">
                    — snapshot locked on {fmtDate(recon.closed.closedAt)}
                  </span>
                </div>
              ) : null}

              {/* KPI cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="App revenue"
                  value={pkr(recon.app.total)}
                  sub={
                    recon.app.count + " paid orders · " + pct(recon.appShare)
                  }
                />
                <StatCard
                  label="External (GHL)"
                  value={pkr(recon.external.total)}
                  sub={pct(recon.externalShare) + " of total"}
                />
                <StatCard
                  label="Total revenue"
                  value={pkr(recon.totalRevenue)}
                  highlight
                />
                <StatCard
                  label="Net after commission"
                  value={pkr(recon.netAfterCommission)}
                  sub={"Commission: " + pkr(recon.commissionTotal)}
                />
              </div>

              {/* channel breakdown */}
              {recon.app.byChannel.length > 0 ? (
                <Card className="mt-6">
                  <h2 className="mb-4 font-semibold text-slate-900">
                    App revenue by channel
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-2 pr-4">Channel</th>
                          <th className="pb-2 pr-4">Orders</th>
                          <th className="pb-2 pr-4">Revenue</th>
                          <th className="pb-2">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recon.app.byChannel.map((row) => (
                          <tr key={row.channel}>
                            <td className="py-3 pr-4 font-medium text-slate-800">
                              {CHANNEL_LABEL[row.channel] ?? row.channel}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {row.count}
                            </td>
                            <td className="py-3 pr-4 font-semibold">
                              {pkr(row.amount)}
                            </td>
                            <td className="py-3 text-slate-600">
                              {recon.app.total
                                ? pct(row.amount / recon.app.total)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}

              {/* commission liability */}
              {recon.commissionTotal > 0 ? (
                <Card className="mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Commission liability
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        Pending + approved commissions for {recon.period}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-amber-600">
                      {pkr(recon.commissionTotal)}
                    </p>
                  </div>
                </Card>
              ) : null}

              {/* close month */}
              {!recon.closed ? (
                <div className="mt-6">
                  <Button onClick={closeMonth} loading={closing}>
                    Close month {recon.period}
                  </Button>
                  <p className="mt-1 text-xs text-slate-500">
                    Snapshots current numbers. Can be re-run to recompute.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* external revenue tab */}
      {tab === "external" ? (
        <div>
          {/* add form */}
          <Card className="mb-6">
            <h2 className="mb-4 font-semibold text-slate-900">
              Add external revenue entry
            </h2>
            <form
              onSubmit={addExternal}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Source
                </label>
                <Select
                  value={addSource}
                  onChange={(e) => setAddSource(e.target.value)}
                >
                  <option value="GHL">GoHighLevel (GHL)</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="MANUAL">Manual</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Period
                </label>
                <Input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Amount (PKR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Note (optional)
                </label>
                <Input
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="e.g. GHL sales Mar 2026"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" loading={addLoading}>
                  Add entry
                </Button>
              </div>
            </form>
          </Card>

          {/* entries table */}
          <Card>
            {externals.length === 0 ? (
              <p className="text-sm text-slate-500">
                No external revenue entries yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-4">Period</th>
                      <th className="pb-2 pr-4">Source</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Note</th>
                      <th className="pb-2 pr-4">Added</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {externals.map((e) => (
                      <tr key={e.id}>
                        <td className="py-3 pr-4 font-medium">{e.period}</td>
                        <td className="py-3 pr-4">
                          <Badge color="blue">{e.source}</Badge>
                        </td>
                        <td className="py-3 pr-4 font-semibold">
                          {pkr(e.amount)}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {e.note ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {fmtDate(e.createdAt)}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteExternal(e.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* closes tab */}
      {tab === "closes" ? (
        <Card>
          {closes.length === 0 ? (
            <p className="text-sm text-slate-500">
              No months closed yet. Use the Reconcile tab to close a period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2 pr-4">App revenue</th>
                    <th className="pb-2 pr-4">External</th>
                    <th className="pb-2 pr-4">Total</th>
                    <th className="pb-2 pr-4">Commission</th>
                    <th className="pb-2">Closed on</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {closes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-4 font-semibold">{c.period}</td>
                      <td className="py-3 pr-4">{pkr(c.appRevenue)}</td>
                      <td className="py-3 pr-4">{pkr(c.externalRevenue)}</td>
                      <td className="py-3 pr-4 font-semibold">
                        {pkr(c.totalRevenue)}
                      </td>
                      <td className="py-3 pr-4 text-amber-600">
                        {pkr(c.commissionTotal)}
                      </td>
                      <td className="py-3 text-slate-500">
                        {fmtDate(c.closedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
