"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { ChannelBadge } from "@/components/channel-badge";
import type { Package, User } from "@/lib/types";

export default function ClientConsultants() {
  const router = useRouter();
  const [list, setList] = useState<User[] | null>(null);
  const [booking, setBooking] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "Consultation session",
    scheduledAt: "",
    durationMin: 30,
  });
  // Per-consultant plan lists (assigned + global), loaded on demand.
  const [plansFor, setPlansFor] = useState<Record<string, Package[]>>({});
  const [openPlans, setOpenPlans] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    api<User[]>("/users/consultants")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  async function togglePlans(c: User) {
    if (openPlans === c.id) {
      setOpenPlans(null);
      return;
    }
    setOpenPlans(c.id);
    if (!plansFor[c.id]) {
      try {
        const plans = await api<Package[]>(`/packages/consultant/${c.id}`);
        setPlansFor((prev) => ({ ...prev, [c.id]: plans }));
      } catch (err: any) {
        setError(err.message);
      }
    }
  }

  // Buy a specific consultant's plan: create purchase + start checkout.
  async function buyPlan(consultantId: string, pkg: Package) {
    setError(null);
    setBuying(pkg.id);
    try {
      const res = await api<{ purchase: any; payment: any }>("/purchases", {
        method: "POST",
        body: { packageId: pkg.id, consultantId },
      });
      const checkout = await api<{ url: string }>(
        `/payments/checkout/${res.payment.id}`,
        { method: "POST" },
      );
      window.location.href = checkout.url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuying(null);
    }
  }

  async function startChat(c: User) {
    setError(null);
    try {
      await api("/conversations", {
        method: "POST",
        body: { consultantId: c.id },
      });
      router.push("/client/messages");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setError(null);
    setInfo(null);
    try {
      await api("/meetings", {
        method: "POST",
        body: {
          consultantId: booking.id,
          title: form.title,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          durationMin: Number(form.durationMin),
        },
      });
      setInfo("Meeting request sent! Awaiting consultant approval.");
      setBooking(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Consultants"
        subtitle="Browse consultants, start a chat or book a meeting"
      />
      <ErrorText message={error} />
      {info ? (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {info}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((c) => (
          <Card key={c.id}>
            <p className="font-medium">
              {c.name}{" "}
              <span className="text-sm font-normal text-slate-500">
                {c.title}
              </span>
            </p>
            {c.expertise ? (
              <p className="text-xs text-slate-400">{c.expertise}</p>
            ) : null}
            {c.bio ? (
              <p className="mt-1 text-sm text-slate-600">{c.bio}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => startChat(c)}>Message</Button>
              <Button variant="outline" onClick={() => setBooking(c)}>
                Book meeting
              </Button>
              <Button variant="ghost" onClick={() => togglePlans(c)}>
                {openPlans === c.id ? "Hide plans" : "View plans"}
              </Button>
            </div>
            {openPlans === c.id ? (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {!plansFor[c.id] ? (
                  <Spinner />
                ) : plansFor[c.id].length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No plans available for this consultant yet.
                  </p>
                ) : (
                  plansFor[c.id].map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          <ChannelBadge channel={p.channel} />
                          {p.isGlobal ? (
                            <Badge color="blue">Global</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {p.currency} {p.price.toLocaleString()}
                        </p>
                      </div>
                      <Button
                        disabled={buying === p.id}
                        onClick={() => buyPlan(c.id, p)}
                      >
                        {buying === p.id ? "…" : "Buy"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : null}
            {booking?.id === c.id ? (
              <form
                onSubmit={book}
                className="mt-3 space-y-2 border-t border-slate-100 pt-3"
              >
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
                <Input
                  label="Date & time"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) =>
                    setForm({ ...form, scheduledAt: e.target.value })
                  }
                  required
                />
                <Select
                  label="Duration"
                  value={form.durationMin}
                  onChange={(e) =>
                    setForm({ ...form, durationMin: Number(e.target.value) })
                  }
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </Select>
                <Button type="submit">Request meeting</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
