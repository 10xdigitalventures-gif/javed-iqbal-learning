"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

// Per-consultant / per-tenant revenue breakdown (Phase 5). Shows kis ne kya
// becha, gross, platform fee (commission), aur owner ka net payout.
type BreakdownRow = {
  tenantId: string;
  tenantName: string;
  sales: number;
  gross: number;
  platformFee: number;
  net: number;
  byKind: Record<string, number>;
};
type Breakdown = {
  rows: BreakdownRow[];
  totals: { sales: number; gross: number; platformFee: number; net: number };
};

function money(n: number) {
  return "PKR " + Number(n || 0).toLocaleString();
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function RevenuePage() {
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(
    isoDay(new Date(Date.now() - 30 * 24 * 3600 * 1000)),
  );
  const [to, setTo] = useState(isoDay(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to + "T23:59:59");
      const res = await api<Breakdown>(
        "/payouts/admin/breakdown?" + qs.toString(),
        { auth: true },
      );
      setData(res);
    } catch {
      setData({ rows: [], totals: { sales: 0, gross: 0, platformFee: 0, net: 0 } });
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Payouts"
        subtitle="Per-consultant sales breakdown — gross, platform commission and owner payout."
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total sales</p>
          <p className="mt-1 text-2xl font-bold">{t ? t.sales : 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Gross revenue</p>
          <p className="mt-1 text-2xl font-bold">{money(t ? t.gross : 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Platform commission</p>
          <p className="mt-1 text-2xl font-bold text-brand">
            {money(t ? t.platformFee : 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Owner payouts (net)</p>
          <p className="mt-1 text-2xl font-bold">{money(t ? t.net : 0)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            No sales in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Consultant / Tenant</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Platform fee</th>
                <th className="px-4 py-3 text-right">Net payout</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr
                  key={r.tenantId}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {r.tenantName}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {Object.entries(r.byKind)
                        .map((e) => e[0] + ": " + money(e[1]))
                        .join("  •  ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{r.sales}</td>
                  <td className="px-4 py-3 text-right">{money(r.gross)}</td>
                  <td className="px-4 py-3 text-right text-brand">
                    {money(r.platformFee)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {money(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
