"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

type TenantBranding = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  tagline: string | null;
  supportEmail: string | null;
  customDomain?: string | null;
};

const FONT_OPTIONS = ["Inter", "Geist", "Poppins", "Montserrat", "Arial"];
function cleanHex(v?: string | null) {
  const t = (v || "").trim();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t}`;
}

export default function TenantBrandingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState<TenantBranding | null>(null);

  useEffect(() => {
    api<TenantBranding>("/tenant-admin/branding")
      .then(setForm)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const preview = useMemo(() => {
    const primary = cleanHex(form?.primaryColor) || "#2783DE";
    const accent = cleanHex(form?.accentColor) || "#E5F2FC";
    return {
      primary,
      accent,
      heroStyle: { backgroundColor: primary },
      accentStyle: { backgroundColor: accent },
    };
  }, [form]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await api<TenantBranding>("/tenant-admin/branding", {
        method: "PATCH",
        body: {
          brandName: form.brandName,
          tagline: form.tagline,
          supportEmail: form.supportEmail,
          logoUrl: form.logoUrl,
          logoDarkUrl: form.logoDarkUrl,
          faviconUrl: form.faviconUrl,
          primaryColor: cleanHex(form.primaryColor),
          secondaryColor: cleanHex(form.secondaryColor),
          accentColor: cleanHex(form.accentColor),
          fontFamily: form.fontFamily,
          customDomain: form.customDomain,
        },
      });
      setForm(saved);
      setInfo(
        "Branding saved. Refresh any open portal tabs to see the new theme everywhere.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!form) return <ErrorText message={error || "Branding not found"} />;
  const set = (key: keyof TenantBranding, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className="space-y-6">
      <PageHeader
        title="White-label branding"
        subtitle="Set your own logo, colors, favicon, domain and mobile-app identity. Saved colors apply across the whole tenant portal."
      />
      <ErrorText message={error} />
      {info ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {info}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Brand name"
                value={form.brandName || ""}
                onChange={(e) => set("brandName", e.target.value)}
                required
              />
              <Input
                label="Support email"
                type="email"
                value={form.supportEmail || ""}
                onChange={(e) => set("supportEmail", e.target.value)}
              />
              <Input
                label="Logo URL"
                value={form.logoUrl || ""}
                onChange={(e) => set("logoUrl", e.target.value)}
                placeholder="https://.../logo.png"
              />
              <Input
                label="Dark logo URL"
                value={form.logoDarkUrl || ""}
                onChange={(e) => set("logoDarkUrl", e.target.value)}
                placeholder="https://.../logo-dark.png"
              />
              <Input
                label="Favicon URL"
                value={form.faviconUrl || ""}
                onChange={(e) => set("faviconUrl", e.target.value)}
                placeholder="https://.../favicon.png"
              />
              <Input
                label="Custom domain"
                value={form.customDomain || ""}
                onChange={(e) => set("customDomain", e.target.value)}
                placeholder="portal.yourbrand.com"
              />
            </div>
            <Textarea
              label="Tagline"
              value={form.tagline || ""}
              onChange={(e) => set("tagline", e.target.value)}
              rows={3}
            />
            <div className="grid gap-4 md:grid-cols-4">
              <Input
                label="Primary color"
                type="color"
                value={cleanHex(form.primaryColor) || "#2783DE"}
                onChange={(e) => set("primaryColor", e.target.value)}
              />
              <Input
                label="Secondary color"
                type="color"
                value={cleanHex(form.secondaryColor) || "#1D4ED8"}
                onChange={(e) => set("secondaryColor", e.target.value)}
              />
              <Input
                label="Accent color"
                type="color"
                value={cleanHex(form.accentColor) || "#E5F2FC"}
                onChange={(e) => set("accentColor", e.target.value)}
              />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Font family
                </span>
                <select
                  className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand/20"
                  value={form.fontFamily || "Inter"}
                  onChange={(e) => set("fontFamily", e.target.value)}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button type="submit" loading={saving}>
              Save white-label settings
            </Button>
          </form>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-500">Live preview</p>
          <div
            className="mt-4 overflow-hidden rounded-2xl border border-slate-200"
            style={{
              fontFamily: `${form.fontFamily || "Inter"}, system-ui, sans-serif`,
            }}
          >
            <div className="p-5 text-white" style={preview.heroStyle}>
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="mb-4 h-10 w-auto rounded bg-white/10 object-contain"
                />
              ) : (
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 font-bold">
                  {(form.brandName || form.name).slice(0, 1)}
                </div>
              )}
              <h2 className="text-2xl font-bold">
                {form.brandName || form.name}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                {form.tagline ||
                  "Your branded learning and consultation portal"}
              </p>
            </div>
            <div className="space-y-3 p-5" style={preview.accentStyle}>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Portal card
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Buttons, links and highlights use your selected colors.
                </p>
                <button
                  className="mt-3 cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white transition duration-200 hover:opacity-90"
                  style={preview.heroStyle}
                >
                  Primary action
                </button>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Mobile app builds use these tenant values through runtime tenant
            config and EAS build variables.
          </p>
        </Card>
      </div>
    </div>
  );
}
