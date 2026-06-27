"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, Spinner, Button, Badge, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { Check, Crown, RefreshCw, Sparkles } from "lucide-react";

type Money = {
  amount: number;
  currency: string;
  symbol: string;
  formatted: string;
};

type Plan = {
  id: string;
  name: string;
  description?: string | null;
  interval: "MONTHLY" | "SIX_MONTHS" | "YEARLY" | "LIFETIME";
  durationDays?: number | null;
  price: number;
  currency: string;
  features?: string | null;
  display?: Money;
};

type MySub = {
  active: boolean;
  inGrace?: boolean;
  subscription: {
    id: string;
    plan: Plan;
    expiresAt?: string | null;
    autoRenew: boolean;
  } | null;
};

type CurrencyInfo = { code: string; symbol: string; name: string };

type ChangeQuote = {
  isSamePlan: boolean;
  creditDays: number;
  display: { targetPrice: Money; credit: Money; amountDue: Money };
};

const intervalLabel: Record<Plan["interval"], string> = {
  MONTHLY: "Monthly",
  SIX_MONTHS: "Half-yearly",
  YEARLY: "Yearly",
  LIFETIME: "Lifetime",
};

function parseFeatures(features?: string | null): string[] {
  if (!features) return [];
  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function validityText(p: Plan): string {
  if (p.interval === "LIFETIME" || !p.durationDays) return "Lifetime access";
  return p.durationDays + " days access";
}

function priceText(p: Plan): string {
  if (p.display) return p.display.formatted;
  return p.currency + " " + p.price.toLocaleString();
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [mine, setMine] = useState<MySub | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [currency, setCurrency] = useState("PKR");
  const [quote, setQuote] = useState<ChangeQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load currencies once.
  useEffect(() => {
    api<{ currencies: CurrencyInfo[] }>("/subscriptions/currencies")
      .then((d) => setCurrencies(d.currencies || []))
      .catch(() => setCurrencies([]));
    api<MySub>("/subscriptions/me")
      .then(setMine)
      .catch(() => setMine({ active: false, subscription: null }));
  }, []);

  // Reload plans whenever display currency changes.
  useEffect(() => {
    api<Plan[]>("/subscriptions/plans?currency=" + encodeURIComponent(currency))
      .then((list) => {
        setPlans(list);
        setSelected((cur) => cur || (list.length > 0 ? list[0].id : null));
      })
      .catch((e) => setError(e.message));
  }, [currency]);

  const activeSub = mine?.active ? mine.subscription : null;
  const isSwitch = !!activeSub && selected !== activeSub.plan.id;

  // Fetch a prorated quote when switching to a different plan.
  useEffect(() => {
    if (!isSwitch || !selected) {
      setQuote(null);
      return;
    }
    api<ChangeQuote>(
      "/subscriptions/me/change/" +
        selected +
        "/quote?currency=" +
        encodeURIComponent(currency),
    )
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [isSwitch, selected, currency]);

  async function subscribe() {
    if (!selected || !plans) return;
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      if (isSwitch) {
        // Prorated plan change.
        const res = await api<{ order: any; payment: any; quote: any }>(
          "/subscriptions/me/change/" + plan.id,
          { method: "POST", body: { currency } },
        );
        const due = res.quote?.amountDue ?? plan.price;
        const q = new URLSearchParams({
          title: "Switch to " + plan.name,
          amount: String(due),
          currency: plan.currency,
          back: "/client/subscription",
        }).toString();
        router.push(`/checkout/${res.payment.id}?${q}`);
        return;
      }
      const res = await api<{ order: any; payment: any }>("/orders", {
        method: "POST",
        body: { kind: "SUBSCRIPTION", planId: plan.id },
      });
      const q = new URLSearchParams({
        title: plan.name,
        amount: String(plan.price),
        currency: plan.currency,
        back: "/client/subscription",
      }).toString();
      router.push(`/checkout/${res.payment.id}?${q}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function renewNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ order: any; payment: any; itemName: string }>(
        "/subscriptions/me/renew",
        { method: "POST" },
      );
      const q = new URLSearchParams({
        title: "Renew " + (res.itemName || "subscription"),
        amount: String(res.payment.amount),
        currency: res.payment.currency,
        back: "/client/subscription",
      }).toString();
      router.push(`/checkout/${res.payment.id}?${q}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (plans === null) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Choose Your Plan"
        subtitle="Enjoy exclusive access to novels, courses, audiobooks and chat rooms"
      />
      <ErrorText message={error} />

      <div className="mb-4 flex items-center justify-end gap-2">
        <label className="text-xs text-slate-500">Show prices in</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol})
            </option>
          ))}
        </select>
      </div>

      {activeSub ? (
        <Card className="mb-5 border-brand bg-brand-light">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-brand" />
              <div>
                <p className="text-sm font-semibold text-brand-dark">
                  You are subscribed to {activeSub.plan.name}
                </p>
                <p className="text-xs text-slate-600">
                  {activeSub.expiresAt
                    ? "Renews / expires on " +
                      new Date(activeSub.expiresAt).toLocaleDateString()
                    : "Lifetime access"}
                  {activeSub.autoRenew ? " · auto-renew on" : ""}
                </p>
                {mine?.inGrace ? (
                  <p className="mt-1 text-xs font-semibold text-red-600">
                    Payment overdue — renew now to avoid losing access.
                  </p>
                ) : null}
              </div>
            </div>
            {activeSub.plan.durationDays ? (
              <Button
                variant="outline"
                onClick={renewNow}
                disabled={busy}
                className="shrink-0"
              >
                <RefreshCw className="mr-1.5 h-4 w-4" /> Renew now
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {plans.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            No subscription plans are available yet.
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {plans.map((p) => {
              const isSel = selected === p.id;
              const isCurrent = activeSub?.plan.id === p.id;
              const feats = parseFeatures(p.features);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    isSel
                      ? "border-brand bg-brand-light/60 ring-2 ring-brand"
                      : "border-slate-200 bg-white hover:border-brand/50"
                  }`}
                >
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSel ? "border-brand bg-brand" : "border-slate-300"
                    }`}
                  >
                    {isSel ? (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {p.name}
                      </span>
                      <Badge color="amber">{intervalLabel[p.interval]}</Badge>
                      {isCurrent ? <Badge color="green">Current</Badge> : null}
                    </span>
                    {p.description ? (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {p.description}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-slate-400">
                      {validityText(p)}
                    </span>
                    {feats.length > 0 ? (
                      <span className="mt-2 block space-y-1">
                        {feats.map((f, i) => (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 text-xs text-slate-600"
                          >
                            <Check className="h-3 w-3 text-brand" /> {f}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-bold text-brand">
                      {priceText(p)}
                    </span>
                    {p.display && p.display.currency !== p.currency ? (
                      <span className="block text-[11px] text-slate-400">
                        billed {p.currency} {p.price.toLocaleString()}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          {isSwitch && quote ? (
            <Card className="mt-4 border-brand/40">
              <p className="mb-2 text-sm font-semibold text-slate-800">
                Plan change summary
              </p>
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>New plan price</span>
                  <span>{quote.display.targetPrice.formatted}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Credit for {quote.creditDays} unused days</span>
                  <span>- {quote.display.credit.formatted}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
                  <span>Due now</span>
                  <span>{quote.display.amountDue.formatted}</span>
                </div>
              </div>
            </Card>
          ) : null}

          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="h-3 w-3" /> Subscription auto-renews unless
            cancelled. Switching plans credits your unused time automatically.
          </p>

          <Button
            className="mt-4 w-full"
            onClick={subscribe}
            disabled={busy || !selected}
          >
            {busy
              ? "Starting checkout…"
              : isSwitch
                ? "Switch plan"
                : "Continue"}
          </Button>
        </>
      )}
    </div>
  );
}
