"use client";

import { useEffect, useState } from "react";
import { BookOpen, CreditCard, GraduationCap, Package } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type TenantRevenue = {
  tenant: { id: string; name: string; brandName?: string | null; platformFeePercent?: number } | null;
  totals: { sales: number; gross: number; platformFee: number; net: number };
};

function money(v: number) {
  return "PKR " + Number(v || 0).toLocaleString();
}

export default function TenantAdminDashboard() {
  const [data, setData] = useState<TenantRevenue | null>(null);

  useEffect(() => {
    api<TenantRevenue>("/payouts/me")
      .then(setData)
      .catch(() => setData({ tenant: null, totals: { sales: 0, gross: 0, platformFee: 0, net: 0 } }));
  }, []);

  if (!data) return <Spinner />;

  const cards = [
    { label: "Sales", value: data.totals.sales, icon: CreditCard },
    { label: "Gross", value: money(data.totals.gross), icon: Package },
    { label: "Platform fee", value: money(data.totals.platformFee), icon: BookOpen },
    { label: "Net payout", value: money(data.totals.net), icon: GraduationCap },
  ];

  return (
    <div>
      <PageHeader
        title="Tenant admin"
        subtitle="Short dedicated admin panel for your branded portal. Content and revenue stay scoped to this tenant only."
      />
      <Card className="mb-4 bg-gradient-to-r from-brand to-brand-dark text-white">
        <p className="text-sm text-white/75">Active tenant</p>
        <p className="mt-1 text-2xl font-bold">{data.tenant?.brandName || data.tenant?.name || "Your tenant"}</p>
        <p className="mt-1 text-sm text-white/75">Platform fee: {data.tenant?.platformFeePercent ?? 15}%</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{c.label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-950">{c.value}</p>
                </div>
                <div className="rounded-xl bg-brand-light p-3 text-brand-dark">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
