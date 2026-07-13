"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Spinner, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Flags = Record<string, boolean | string>;

const BOOL_GROUPS: {
  title: string;
  hint?: string;
  items: { key: string; label: string; hint?: string }[];
}[] = [
  {
    title: "Learning module",
    hint: "Turning off the module hides the entire section for clients.",
    items: [
      { key: "learning", label: "Learning module (master switch)" },
      { key: "books", label: "E-Books (novels / PDF books)" },
      { key: "audiobooks", label: "Audiobooks" },
      { key: "courses", label: "Courses & video lessons" },
      { key: "certificates", label: "Certificates" },
      { key: "achievements", label: "Achievements & gamification" },
    ],
  },
  {
    title: "Consultation module",
    items: [
      { key: "consultation", label: "Consultation module (master switch)" },
      { key: "chat", label: "1:1 chat / messaging" },
      { key: "packages", label: "Consultation packages" },
      { key: "meetings", label: "Live meetings / sessions" },
      { key: "live_sessions", label: "Live sessions / webinars" },
      { key: "subscription", label: "Subscription plans" },
    ],
  },
  {
    title: "Community module",
    items: [{ key: "community", label: "Community module (master switch)" }],
  },
  {
    title: "Commerce",
    items: [{ key: "bundles", label: "Bundles & bundle offers" }],
  },
];

const BOOK_LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "both", label: "Both English and Urdu" },
  { value: "en", label: "English only" },
  { value: "urdu", label: "Urdu only" },
];

const CONSULT_CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All channels (text, audio, video, live)" },
  { value: "text", label: "Text only" },
  { value: "audio", label: "Audio only" },
  { value: "video", label: "Video only" },
  { value: "live", label: "Live sessions only" },
];

export default function TenantFeaturesPage() {
  const [tenants, setTenants] = useState<
    {
      id: string;
      name: string;
      moduleFlags: Flags | null;
      platformFeePercent?: number;
      hasDedicatedPortal?: boolean;
    }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flags>({});
  const [feePct, setFeePct] = useState<number>(15);
  const [dedicated, setDedicated] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ tenants: any[] }>("/tenant")
      .then((data) => {
        const list = Array.isArray(data) ? data : ((data as any).tenants ?? []);
        setTenants(list);
        if (list.length > 0) {
          setSelected(list[0].id);
          setFlags(normalise(list[0].moduleFlags));
          setFeePct(
            typeof list[0].platformFeePercent === "number"
              ? list[0].platformFeePercent
              : 15,
          );
          setDedicated(Boolean(list[0].hasDedicatedPortal));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function normalise(raw: Flags | null): Flags {
    const src = raw || {};
    const boolKeys = [
      "learning",
      "consultation",
      "community",
      "books",
      "audiobooks",
      "courses",
      "certificates",
      "achievements",
      "subscription",
      "packages",
      "meetings",
      "chat",
      "live_sessions",
      "bundles",
    ];
    const out: Flags = {};
    for (const k of boolKeys) out[k] = src[k] !== false;
    out.books_language = (src.books_language as string) || "both";
    out.consultation_channels = (src.consultation_channels as string) || "all";
    return out;
  }

  function selectTenant(id: string) {
    const t = tenants.find((t) => t.id === id);
    if (!t) return;
    setSelected(id);
    setFlags(normalise(t.moduleFlags));
    setFeePct(typeof t.platformFeePercent === "number" ? t.platformFeePercent : 15);
    setDedicated(Boolean(t.hasDedicatedPortal));
    setError(null);
    setInfo(null);
  }

  function toggle(key: string) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setOption(key: string, value: string) {
    setFlags((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api(`/tenant/${selected}`, {
        method: "PATCH",
        body: {
          moduleFlags: flags,
          platformFeePercent: feePct,
          hasDedicatedPortal: dedicated,
        },
      });
      setInfo("Feature settings saved.");
      // refresh local cache
      setTenants((prev) =>
        prev.map((t) =>
          t.id === selected
            ? {
                ...t,
                moduleFlags: flags,
                platformFeePercent: feePct,
                hasDedicatedPortal: dedicated,
              }
            : t,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Tenant feature settings" />

      {tenants.length > 1 && (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-slate-600">Tenant:</span>
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTenant(t.id)}
              className={
                "rounded-xl border px-4 py-1.5 text-sm font-semibold transition " +
                (selected === t.id
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50")
              }
            >
              {t.name}
            </button>
          ))}
        </Card>
      )}

      {BOOL_GROUPS.map((group) => (
        <Card key={group.title} className="p-5">
          <h2 className="mb-1 font-bold text-slate-900">{group.title}</h2>
          {group.hint && (
            <p className="mb-4 text-xs text-slate-500">{group.hint}</p>
          )}
          <div className="divide-y divide-slate-100">
            {group.items.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.label}
                  </p>
                  {item.hint && (
                    <p className="text-xs text-slate-500">{item.hint}</p>
                  )}
                </div>
                <div
                  onClick={() => toggle(item.key)}
                  className={
                    "relative inline-flex h-6 w-11 cursor-pointer rounded-full transition-colors " +
                    (flags[item.key] !== false ? "bg-brand" : "bg-slate-200")
                  }
                >
                  <span
                    className={
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 " +
                      (flags[item.key] !== false
                        ? "translate-x-5"
                        : "translate-x-0.5")
                    }
                  />
                </div>
              </label>
            ))}
          </div>
        </Card>
      ))}

      {/* Books language option */}
      {flags.learning !== false && flags.books !== false && (
        <Card className="p-5">
          <h2 className="mb-1 font-bold text-slate-900">
            Book language filter
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Choose which language edition of books to show to clients.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {BOOK_LANG_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition " +
                  (flags.books_language === opt.value
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50")
                }
              >
                <input
                  type="radio"
                  name="books_language"
                  value={opt.value}
                  checked={flags.books_language === opt.value}
                  onChange={() => setOption("books_language", opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Consultation channels option */}
      {flags.consultation !== false && (
        <Card className="p-5">
          <h2 className="mb-1 font-bold text-slate-900">
            Consultation channels
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Which chat channels are available for this tenant.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONSULT_CHANNEL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition " +
                  (flags.consultation_channels === opt.value
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50")
                }
              >
                <input
                  type="radio"
                  name="consultation_channels"
                  value={opt.value}
                  checked={flags.consultation_channels === opt.value}
                  onChange={() => setOption("consultation_channels", opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Commercial + dedicated portal (set at onboarding approval) */}
      <Card className="p-5">
        <h2 className="mb-1 font-bold text-slate-900">Commercial & portal</h2>
        <p className="mb-4 text-xs text-slate-500">
          Set the platform commission for this consultant (minimum 15%). The
          owner keeps the remainder of every sale. Enable a dedicated portal to
          give them their own branded frontend — they still appear in the global
          marketplace too.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Platform commission (%)
            </span>
            <input
              type="number"
              min={0}
              max={90}
              value={feePct}
              onChange={(e) => setFeePct(Number(e.target.value))}
              className="w-32 rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 py-2">
            <div
              onClick={() => setDedicated((v) => !v)}
              className={
                "relative inline-flex h-6 w-11 cursor-pointer rounded-full transition-colors " +
                (dedicated ? "bg-brand" : "bg-slate-200")
              }
            >
              <span
                className={
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 " +
                  (dedicated ? "translate-x-5" : "translate-x-0.5")
                }
              />
            </div>
            <span className="text-sm font-medium text-slate-800">
              Has dedicated portal
            </span>
          </label>
        </div>
      </Card>

      {error && <ErrorText message={error} />}
      {info && <p className="text-sm font-medium text-green-600">{info}</p>}

      <Button onClick={save} disabled={busy || !selected}>
        {busy ? "Saving..." : "Save feature settings"}
      </Button>
    </div>
  );
}
