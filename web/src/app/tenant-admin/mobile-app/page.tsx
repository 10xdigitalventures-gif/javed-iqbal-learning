"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorText, Input, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Branding = {
  slug: string;
  brandName: string;
  primaryColor: string | null;
  logoUrl: string | null;
};

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TenantMobileAppPage() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [androidPkg, setAndroidPkg] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [splashUrl, setSplashUrl] = useState("");

  useEffect(() => {
    api<Branding>("/tenant-admin/branding")
      .then((b) => {
        setBranding(b);
        setAppName(b.brandName);
        const root = slugify(b.brandName || b.slug);
        setBundleId(`com.${root}.app`.replace(/-/g, ""));
        setAndroidPkg(`com.${root}.app`.replace(/-/g, ""));
        setIconUrl(b.logoUrl || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  const env = useMemo(() => {
    if (!branding) return "";
    const appSlug = slugify(appName || branding.slug);
    return [
      `EXPO_PUBLIC_APP_NAME=${appName || branding.brandName}`,
      `EXPO_PUBLIC_APP_SLUG=${appSlug}`,
      `EXPO_PUBLIC_BUNDLE_ID=${bundleId}`,
      `EXPO_PUBLIC_ANDROID_PKG=${androidPkg}`,
      `EXPO_PUBLIC_TENANT_SLUG=${branding.slug}`,
      `EXPO_PUBLIC_BRAND_COLOR=${branding.primaryColor || "#2783DE"}`,
      iconUrl ? `WHITE_LABEL_ICON_URL=${iconUrl}` : "",
      splashUrl ? `WHITE_LABEL_SPLASH_URL=${splashUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [branding, appName, bundleId, androidPkg, iconUrl, splashUrl]);

  if (!branding && !error) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mobile app white-label"
        subtitle="Generate the per-tenant app identity values for EAS builds: app name, bundle id, package id, tenant slug and brand color."
      />
      <ErrorText message={error} />
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="App name"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
          />
          <Input
            label="iOS bundle identifier"
            value={bundleId}
            onChange={(e) => setBundleId(e.target.value)}
          />
          <Input
            label="Android package"
            value={androidPkg}
            onChange={(e) => setAndroidPkg(e.target.value)}
          />
          <Input
            label="App icon URL"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://.../icon.png"
          />
          <Input
            label="Splash image URL"
            value={splashUrl}
            onChange={(e) => setSplashUrl(e.target.value)}
            placeholder="https://.../splash.png"
          />
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">EAS environment</h2>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard?.writeText(env)}
          >
            Copy
          </Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
          {env}
        </pre>
        <p className="mt-3 text-xs text-slate-500">
          Use these values in the tenant EAS build profile. Replace mobile
          assets with the icon/splash before running the build.
        </p>
      </Card>
    </div>
  );
}
