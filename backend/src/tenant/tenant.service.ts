import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Tenant } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTenantDto, OnboardTenantDto, UpdateTenantDto } from "./dto";

// The id of the tenant seeded by the multi_tenant_foundation migration. Every
// pre-existing row is backfilled to this tenant, so it is the safe fallback for
// all single-tenant behaviour.
export const DEFAULT_TENANT_ID = "tenant_default_javed";

// Subdomains that cannot be claimed as a tenant slug (platform-reserved).
const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "marketplace",
  "experts",
  "mail",
  "smtp",
  "static",
  "cdn",
  "assets",
  "dashboard",
  "portal",
  "help",
  "support",
  "docs",
  "blog",
  "default",
  "consulthub",
  "status",
  "auth",
  "login",
  "register",
  "onboard",
  "checkout",
  "payment",
]);

// Normalise arbitrary text into a safe DNS-style subdomain slug.
function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// A Tenant is one expert/brand running on the platform (Dr. Javed Iqbal,
// Dr. Zeeshan Usmani, ...). This service resolves the active tenant for a
// request and lets admins manage tenants + their branding.
@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
  }

  // Public marketplace directory: every active, listed tenant (expert),
  // returned as a compact, safe card the central 10X marketplace renders.
  async directory(category?: string) {
    const where: Record<string, unknown> = { isActive: true, listed: true };
    if (category) where.category = category;
    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      brandName: t.brandName ?? t.name,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      tagline: t.tagline,
      category: t.category,
    }));
  }

  async getById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  // Public: a single listed tenant storefront view, resolved by slug for
  // the marketplace expert detail page.
  async publicBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: (slug || "").toLowerCase().trim(), isActive: true },
    });
    if (!tenant) throw new NotFoundException("Expert not found");
    const view = this.publicView(tenant)!;
    return {
      ...view,
      subdomainUrl: this.subdomainUrl(tenant.slug),
      listed: tenant.listed,
    };
  }

  // Public: a listed tenant storefront catalog (published courses + active
  // packages) for the marketplace expert detail page.
  async publicCatalog(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: (slug || "").toLowerCase().trim(), isActive: true },
    });
    if (!tenant) throw new NotFoundException("Expert not found");
    const [courses, packages] = await Promise.all([
      this.prisma.course.findMany({
        where: { tenantId: tenant.id, isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          coverUrl: true,
          price: true,
          currency: true,
          tags: true,
        },
      }),
      this.prisma.package.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          channel: true,
          price: true,
          currency: true,
          billingDays: true,
        },
      }),
    ]);
    return { courses, packages };
  }

  // Public: check if a custom domain is already claimed and return DNS
  // setup instructions so tenants can point their vanity domain here.
  async verifyDomain(domain: string) {
    const normalized = (domain || "")
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!normalized) return { ok: false, error: "domain param required" };
    const tenant = await this.prisma.tenant.findFirst({
      where: { customDomain: normalized, isActive: true },
      select: { slug: true },
    });
    const cname =
      process.env.PLATFORM_CNAME_TARGET || "cname." + this.rootDomain();
    return {
      domain: normalized,
      claimed: !!tenant,
      claimedBySlug: tenant ? tenant.slug : null,
      dns: {
        type: "CNAME",
        name: normalized,
        value: cname,
        ttl: 3600,
      },
      instructions: [
        "1. In your DNS provider add a CNAME record: " +
          normalized +
          " -> " +
          cname,
        "2. Wait for DNS propagation (up to 48h; usually <1h).",
        "3. Ask an admin to set customDomain on your tenant: PATCH /api/tenant/:id",
        "4. Verify SSL: the platform auto-provisions a certificate once CNAME resolves.",
      ],
    };
  }

  // The fallback tenant. Prefers the explicit default flag, then the seeded id.
  getDefault() {
    return this.prisma.tenant.findFirst({
      where: { OR: [{ isDefault: true }, { id: DEFAULT_TENANT_ID }] },
      orderBy: { isDefault: "desc" },
    });
  }

  // Resolve the active tenant from an explicit header (id or slug) or the
  // request host (custom domain first, then subdomain). Always falls back to
  // the default tenant so existing single-tenant behaviour never breaks.
  async resolve(opts: {
    tenantId?: string;
    host?: string;
  }): Promise<Tenant | null> {
    const { tenantId, host } = opts;

    if (tenantId) {
      const byKey = await this.prisma.tenant.findFirst({
        where: { OR: [{ id: tenantId }, { slug: tenantId }], isActive: true },
      });
      if (byKey) return byKey;
    }

    if (host) {
      const hostname = host.split(":")[0].toLowerCase().trim();
      if (hostname) {
        const byDomain = await this.prisma.tenant.findFirst({
          where: { customDomain: hostname, isActive: true },
        });
        if (byDomain) return byDomain;

        const sub = hostname.split(".")[0];
        if (sub && sub !== "www") {
          const bySlug = await this.prisma.tenant.findFirst({
            where: { slug: sub, isActive: true },
          });
          if (bySlug) return bySlug;
        }
      }
    }

    return this.getDefault();
  }

  // The platform root domain new tenants get a subdomain under, GHL-style
  // (e.g. drjaved.10xdigitalventures.com). Custom domains are opt-in.
  private rootDomain() {
    return process.env.PLATFORM_ROOT_DOMAIN || "10xdigitalventures.com";
  }

  // The provisioned platform URL for a tenant slug.
  subdomainUrl(slug: string) {
    return "https://" + slug + "." + this.rootDomain();
  }

  // Validate + normalise a desired subdomain slug for onboarding.
  async isSlugAvailable(rawSlug: string) {
    const slug = slugify(rawSlug);
    if (!slug || slug.length < 3) {
      return { slug, available: false, reason: "too_short" as const };
    }
    if (RESERVED_SLUGS.has(slug)) {
      return { slug, available: false, reason: "reserved" as const };
    }
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    return {
      slug,
      available: !existing,
      reason: existing ? ("taken" as const) : null,
    };
  }

  // Self-serve onboarding from the marketplace. Provisions a new tenant on
  // its platform subdomain immediately, but leaves it UNLISTED until an
  // admin reviews it, so self-serve signups cannot publish themselves.
  async onboard(dto: OnboardTenantDto) {
    const check = await this.isSlugAvailable(dto.slug || dto.name);
    if (!check.available) {
      throw new BadRequestException(
        check.reason === "reserved"
          ? "That subdomain is reserved. Please choose another."
          : check.reason === "too_short"
            ? "Please choose a subdomain with at least 3 characters."
            : "That subdomain is already taken. Please choose another.",
      );
    }
    const tenant = await this.prisma.tenant.create({
      data: {
        slug: check.slug,
        name: dto.name,
        brandName: dto.brandName ?? dto.name,
        supportEmail: dto.supportEmail,
        primaryColor: dto.primaryColor,
        tagline: dto.tagline,
        isActive: true,
        listed: false,
        category: dto.category ?? null,
      },
    });
    return {
      tenant: this.publicView(tenant),
      subdomainUrl: this.subdomainUrl(tenant.slug),
      listed: tenant.listed,
    };
  }

  create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: { ...dto } });
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.getById(id);
    return this.prisma.tenant.update({ where: { id }, data: { ...dto } });
  }

  // Public, safe subset the web/mobile apps use to theme themselves. Never
  // exposes internal-only fields.
  // Known feature modules. A missing/undefined flag defaults to ON so
  // existing single-tenant deployments keep every module; only an explicit
  // false hides a module for the tenant.
  private normalizeModuleFlags(
    raw: unknown,
  ): Record<string, boolean | string> {
    const src = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    // Top-level module toggles (default ON).
    const boolKeys = [
      "learning",
      "consultation",
      "community",
      // Learning sub-features
      "books",
      "audiobooks",
      "courses",
      "certificates",
      "achievements",
      "subscription",
      // Consultation sub-features
      "packages",
      "meetings",
      // Direct 1:1 chat/messaging with the consultant. Some tenants get
      // courses-only and no chat — hence a dedicated toggle.
      "chat",
      // Live group/1:1 sessions (webinars / live classes).
      "live_sessions",
      // Commerce sub-features
      "bundles",
    ];
    const out: Record<string, boolean | string> = {};
    for (const k of boolKeys) out[k] = src[k] !== false;
    // String options with defaults.
    out.books_language =
      typeof src.books_language === "string"
        ? src.books_language
        : "both";
    out.consultation_channels =
      typeof src.consultation_channels === "string"
        ? src.consultation_channels
        : "all";
    return out;
  }

  publicView(tenant: Tenant | null) {
    if (!tenant) return null;
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      brandName: tenant.brandName ?? tenant.name,
      logoUrl: tenant.logoUrl,
      logoDarkUrl: tenant.logoDarkUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      fontFamily: tenant.fontFamily,
      tagline: tenant.tagline,
      supportEmail: tenant.supportEmail,
      category: tenant.category,
      moduleFlags: this.normalizeModuleFlags(tenant.moduleFlags),
    };
  }
}
