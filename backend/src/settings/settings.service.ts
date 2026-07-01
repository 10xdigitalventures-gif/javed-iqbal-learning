import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Key/value platform configuration store. Admin-editable.
const DEFAULTS: Record<string, string> = {
  platformName: "Prof. Dr. Javed Iqbal Learning",
  supportEmail: "support@example.com",
  defaultCurrency: "PKR",
  meetingDurations: "15,30,60",
  audioMaxSeconds: "90",
  videoMaxSeconds: "120",
  brandColor: "#FF7A1A",
  // In-app branding logo shown inside the apps: "picture" (Prof. Dr. Javed
  // Iqbal photo) or "icon" (app monogram). Admin-switchable, global.
  brandingMode: "picture",
};

// Sensitive, environment-style configuration the admin can manage from the
// Settings screen (payment gateways + storage providers). These are persisted
// in the database AND mirrored into process.env at runtime so the payment /
// storage providers \u2014 which read process.env \u2014 pick them up without a
// redeploy. They are stored under the "secret:" prefix so they never leak into
// the public GET /settings response.
export type EnvField = { key: string; label: string; secret?: boolean };
export type EnvGroup = {
  key: string;
  title: string;
  hint?: string;
  fields: EnvField[];
};

const ENV_GROUPS: EnvGroup[] = [
  {
    key: "payment",
    title: "Payment gateways",
    hint: 'Enable the gateways customers can pay with. PAYMENT_PROVIDERS is a comma-separated list, e.g. "gopayfast,whop".',
    fields: [
      {
        key: "PAYMENT_PROVIDERS",
        label: "Enabled providers (comma-separated)",
      },
      { key: "GOPAYFAST_MERCHANT_ID", label: "PayFast \u2013 Merchant ID" },
      {
        key: "GOPAYFAST_SECURED_KEY",
        label: "PayFast \u2013 Secured key",
        secret: true,
      },
      { key: "GOPAYFAST_MERCHANT_NAME", label: "PayFast \u2013 Merchant name" },
      { key: "GOPAYFAST_MODE", label: "PayFast \u2013 Mode (sandbox / live)" },
      {
        key: "GOPAYFAST_API_BASE",
        label: "PayFast \u2013 API base URL (optional override)",
      },
      { key: "WHOP_API_KEY", label: "Whop \u2013 API key", secret: true },
      { key: "WHOP_COMPANY_ID", label: "Whop \u2013 Company ID" },
      {
        key: "WHOP_WEBHOOK_SECRET",
        label: "Whop \u2013 Webhook secret",
        secret: true,
      },
      {
        key: "WHOP_API_BASE",
        label: "Whop \u2013 API base URL (optional override)",
      },
      { key: "WHOP_USD_RATE", label: "Whop \u2013 PKR per 1 USD (e.g. 280)" },
      {
        key: "WHOP_FEE_PERCENT",
        label: "Whop \u2013 Gateway fee % added on top (optional)",
      },
    ],
  },
  {
    key: "storage",
    title: "Storage",
    hint: "STORAGE_PROVIDER selects the active cloud driver: supabase, bunny, r2 or s3.",
    fields: [
      {
        key: "STORAGE_PROVIDER",
        label: "Active provider (supabase / bunny / r2 / s3)",
      },
      { key: "SUPABASE_URL", label: "Supabase \u2013 Project URL" },
      {
        key: "SUPABASE_KEY",
        label: "Supabase \u2013 Service role key",
        secret: true,
      },
      { key: "SUPABASE_BUCKET", label: "Supabase \u2013 Bucket" },
      {
        key: "BUNNY_STORAGE_KEY",
        label: "Bunny \u2013 Storage key",
        secret: true,
      },
      { key: "BUNNY_ZONE_ID", label: "Bunny \u2013 Storage zone name" },
      { key: "BUNNY_REGION", label: "Bunny \u2013 Region" },
      { key: "BUNNY_PULL_ZONE_URL", label: "Bunny \u2013 Pull zone URL" },
      { key: "CLOUDFLARE_R2_KEY", label: "Cloudflare R2 \u2013 Access key ID" },
      {
        key: "CLOUDFLARE_R2_SECRET",
        label: "Cloudflare R2 \u2013 Secret key",
        secret: true,
      },
      { key: "CLOUDFLARE_R2_ENDPOINT", label: "Cloudflare R2 \u2013 Endpoint" },
      { key: "CLOUDFLARE_R2_BUCKET", label: "Cloudflare R2 \u2013 Bucket" },
      {
        key: "CLOUDFLARE_R2_PUBLIC_URL",
        label: "Cloudflare R2 \u2013 Public URL",
      },
      { key: "STORAGE_DRIVER", label: "Legacy media driver (local / s3)" },
      { key: "S3_BUCKET", label: "S3 \u2013 Bucket" },
      { key: "S3_REGION", label: "S3 \u2013 Region" },
      { key: "S3_ACCESS_KEY_ID", label: "S3 \u2013 Access key ID" },
      {
        key: "S3_SECRET_ACCESS_KEY",
        label: "S3 \u2013 Secret access key",
        secret: true,
      },
      { key: "S3_ENDPOINT", label: "S3 \u2013 Endpoint" },
    ],
  },
];

const ENV_FIELDS: EnvField[] = ENV_GROUPS.flatMap((g) => g.fields);
const ENV_KEYS = new Set(ENV_FIELDS.map((f) => f.key));
const SECRET_PREFIX = "secret:";

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger("SettingsService");

  constructor(private prisma: PrismaService) {}

  // On boot, push any persisted env-style settings into process.env so the
  // payment / storage providers see admin-configured credentials.
  onModuleInit() {
    // Load persisted env settings in the background so the HTTP server can
    // start listening immediately (Passenger/Hostinger require listen() within
    // 3 seconds). Providers read these values lazily on the first request.
    void this.loadStoredEnv();
  }

  private async loadStoredEnv() {
    try {
      const rows = await this.prisma.platformSetting.findMany({
        where: { key: { startsWith: SECRET_PREFIX } },
      });
      let applied = 0;
      for (const r of rows) {
        const envKey = r.key.slice(SECRET_PREFIX.length);
        if (ENV_KEYS.has(envKey) && r.value !== "") {
          process.env[envKey] = r.value;
          applied++;
        }
      }
      if (applied) this.logger.log(`Applied ${applied} stored env settings`);
    } catch (e: any) {
      this.logger.warn(`Could not load env settings: ${e?.message || e}`);
    }
  }

  // Public, non-sensitive settings (used to theme the web / mobile apps).
  async getAll() {
    const rows = await this.prisma.platformSetting.findMany();
    const map: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) {
      if (r.key.startsWith(SECRET_PREFIX)) continue;
      map[r.key] = r.value;
    }
    return map;
  }

  async update(values: Record<string, string>) {
    const entries = Object.entries(values || {});
    for (const [key, value] of entries) {
      if (key.startsWith(SECRET_PREFIX) || ENV_KEYS.has(key)) continue; // env keys go through updateEnv
      await this.prisma.platformSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    return this.getAll();
  }

  // Admin-only: the env-style config schema + current values (from process.env).
  getEnv() {
    const values: Record<string, string> = {};
    for (const f of ENV_FIELDS) values[f.key] = process.env[f.key] || "";
    return { groups: ENV_GROUPS, values };
  }

  // Admin-only: persist env-style config and mirror into process.env live.
  async updateEnv(values: Record<string, string>) {
    const entries = Object.entries(values || {}).filter(([k]) =>
      ENV_KEYS.has(k),
    );
    for (const [key, value] of entries) {
      const v = value == null ? "" : String(value);
      await this.prisma.platformSetting.upsert({
        where: { key: SECRET_PREFIX + key },
        update: { value: v },
        create: { key: SECRET_PREFIX + key, value: v },
      });
      process.env[key] = v;
    }
    return this.getEnv();
  }
}
