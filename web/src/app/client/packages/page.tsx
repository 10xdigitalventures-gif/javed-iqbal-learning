"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  FileAudio,
  FileText,
  FileVideo,
  Timer,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Select,
  Spinner,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { ChannelBadge } from "@/components/channel-badge";
import { GatewayLabel } from "@/components/gateway-label";
import type { Package, User } from "@/lib/types";

export default function ClientPackages() {
  const [list, setList] = useState<Package[] | null>(null);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [gateways, setGateways] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>(""); // consultant filter
  const [gateway, setGateway] = useState<string>("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<User[]>("/users/consultants")
      .then(setConsultants)
      .catch(() => setConsultants([]));
    api<{ providers: string[] }>("/payments/providers")
      .then((r) => {
        setGateways(r.providers);
        setGateway(r.providers[0] || "");
      })
      .catch(() => setGateways([]));
  }, []);

  // Reload the plan list whenever the consultant filter changes.
  useEffect(() => {
    setList(null);
    const path = filter ? `/packages/consultant/${filter}` : "/packages";
    api<Package[]>(path)
      .then(setList)
      .catch(() => setList([]));
  }, [filter]);

  // Buy -> create purchase (+ pending payment) -> start checkout -> redirect.
  async function buy(pkg: Package) {
    setError(null);
    setBusy(pkg.id);
    try {
      // When browsing a specific consultant, default the purchase to them.
      const consultantId = chosen[pkg.id] || filter || undefined;
      const res = await api<{ purchase: any; payment: any }>("/purchases", {
        method: "POST",
        body: { packageId: pkg.id, consultantId },
      });
      const checkout = await api<{ url: string }>(
        `/payments/checkout/${res.payment.id}`,
        { method: "POST", body: { gateway } },
      );
      window.location.href = checkout.url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Packages"
        subtitle="Purchase a consultation or mentorship package"
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Filter by consultant"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All plans</option>
          {consultants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {gateways.length > 1 ? (
          <Select
            label="Payment method"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
          >
            {gateways.map((g) => (
              <option key={g} value={g}>
                {GatewayLabel(g)}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <ErrorText message={error} />

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          No plans available{filter ? " for this consultant" : ""} yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {list.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{p.name}</p>
                <ChannelBadge channel={p.channel} />
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge color="amber">{p.type}</Badge>
                {p.isGlobal ? <Badge color="blue">Any consultant</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{p.description}</p>
              <p className="mt-3 text-2xl font-bold text-brand">
                {p.currency} {p.price.toLocaleString()}
              </p>
              <ul className="mt-3 flex-1 space-y-1 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Text:{" "}
                  {channelText(p.textLimit)}
                </li>
                <li className="flex items-center gap-2">
                  <FileAudio className="h-3.5 w-3.5" /> Audio:{" "}
                  {channelText(p.audioLimit)}
                </li>
                <li className="flex items-center gap-2">
                  <FileVideo className="h-3.5 w-3.5" /> Video:{" "}
                  {channelText(p.videoLimit)}
                </li>
                <li className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5" /> Sessions:{" "}
                  {channelText(p.sessionLimit)}
                </li>
                {p.sessionDuration ? (
                  <li className="flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5" /> {p.sessionDuration}{" "}
                    min/session
                  </li>
                ) : null}
              </ul>
              <div className="mt-3 space-y-2">
                {/* Only show the consultant picker for global plans that are
                    not already scoped by the filter. */}
                {p.isGlobal && !filter ? (
                  <Select
                    value={chosen[p.id] || ""}
                    onChange={(e) =>
                      setChosen({ ...chosen, [p.id]: e.target.value })
                    }
                  >
                    <option value="">Choose a consultant…</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Button
                  className="w-full"
                  disabled={busy === p.id}
                  onClick={() => buy(p)}
                >
                  {busy === p.id ? "Starting checkout…" : "Buy now"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// 0 = not allowed for this channel; null = unlimited; n = that many.
function channelText(limit: number | null) {
  if (limit === null) return "Unlimited";
  if (limit === 0) return "Not included";
  return String(limit);
}
