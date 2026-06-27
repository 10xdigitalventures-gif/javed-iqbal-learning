"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Button, ErrorText } from "@/components/ui";
import { GatewayLabel } from "@/components/gateway-label";
import { ChevronLeft, ShieldCheck } from "lucide-react";

// Dedicated checkout screen. The order + pending payment are already created;
// here the customer picks a payment gateway and we hand off to the hosted
// redirect for that gateway (PayFast, Whop, ...).
function CheckoutInner() {
  const params = useParams();
  const search = useSearchParams();
  const paymentId = String(params.paymentId);
  const title = search.get("title") || "your order";
  const amount = search.get("amount");
  const currency = search.get("currency") || "PKR";
  const back = search.get("back") || "/client/courses";

  const [providers, setProviders] = useState<string[]>([]);
  const [gateway, setGateway] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ providers: string[] }>("/payments/providers")
      .then((r) => {
        const list = (r.providers || []).filter(Boolean);
        setProviders(list);
        setGateway(list[0] || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ url: string }>(
        `/payments/checkout/${paymentId}`,
        { method: "POST", body: gateway ? { gateway } : {} },
      );
      window.location.href = res.url;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={back}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <Card>
        <h1 className="text-xl font-bold text-slate-950">Checkout</h1>
        <p className="mt-1 text-sm text-slate-600">{title}</p>
        {amount ? (
          <p className="mt-3 text-2xl font-bold text-brand">
            {currency} {Number(amount).toLocaleString()}
          </p>
        ) : null}

        <p className="mt-6 mb-2 text-sm font-semibold text-slate-900">
          Choose a payment method
        </p>
        <div className="space-y-2">
          {providers.length === 0 ? (
            <p className="text-sm text-slate-400">
              No payment gateway is configured yet.
            </p>
          ) : (
            providers.map((g) => (
              <label
                key={g}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                  gateway === g
                    ? "border-brand bg-brand-light"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="gateway"
                  value={g}
                  checked={gateway === g}
                  onChange={() => setGateway(g)}
                  className="accent-brand"
                />
                <span className="text-sm font-medium text-slate-800">
                  {GatewayLabel(g)}
                </span>
              </label>
            ))
          )}
        </div>

        <ErrorText message={error} />

        <Button
          onClick={pay}
          disabled={busy || providers.length === 0}
          className="mt-5 w-full"
        >
          {busy ? "Redirecting\u2026" : "Proceed to payment"}
        </Button>

        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
          <ShieldCheck className="h-3 w-3" /> Secure checkout via your selected
          gateway
        </p>
      </Card>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary (Next.js 14). Wrap the inner
// client component so the production build doesn't bail out of prerendering.
export default function CheckoutPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CheckoutInner />
    </Suspense>
  );
}
