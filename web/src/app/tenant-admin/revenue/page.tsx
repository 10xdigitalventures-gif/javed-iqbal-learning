"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type TenantRevenue = {
  tenant: { name: string; brandName?: string | null; platformFeePercent?: number } | null;
  totals: { sales: number; gross: number; platformFee: number; net: number };
};

function money(v: number) { return "PKR " + Number(v || 0).toLocaleString(); }

export default function TenantRevenuePage() {
  const [data, setData] = useState<TenantRevenue | null>(null);
  useEffect(() => {
    api<TenantRevenue>("/payouts/me").then(setData).catch(() => setData({ tenant: null, totals: { sales: 0, gross: 0, platformFee: 0, net: 0 } }));
  }, []);
  if (!data) return <Spinner />;
  return (
    <div>
      <PageHeader title="Revenue & payouts" subtitle="Tenant-scoped sales breakdown for this dedicated portal." />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Sales</p><p className="mt-1 text-2xl font-bold">{data.totals.sales}</p></Card>
        <Card><p className="text-sm text-slate-500">Gross</p><p className="mt-1 text-2xl font-bold">{money(data.totals.gross)}</p></Card>
        <Card><p className="text-sm text-slate-500">Platform fee</p><p className="mt-1 text-2xl font-bold">{money(data.totals.platformFee)}</p></Card>
        <Card><p className="text-sm text-slate-500">Net payout</p><p className="mt-1 text-2xl font-bold">{money(data.totals.net)}</p></Card>
      </div>
    </div>
  );
}
