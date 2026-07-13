import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Powers the GLOBAL marketplace: aggregated experts + books / courses /
// packages across every active, listed tenant. Dedicated-portal tenants ALSO
// appear here (dual presence) — the marketplace is the union of everyone.
//
// The public frontend consumes a single combined endpoint (`/marketplace/
// catalog`) shaped as { experts, courses, books, packages }. Individual
// endpoints are also exposed for the mobile app / incremental loading.
@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  // Active + listed tenants, with the branding fields the storefront needs.
  private async listedTenants() {
    return this.prisma.tenant.findMany({
      where: { isActive: true, listed: true },
      select: {
        id: true,
        slug: true,
        name: true,
        brandName: true,
        logoUrl: true,
        primaryColor: true,
        tagline: true,
        category: true,
        hasDedicatedPortal: true,
      },
    });
  }

  // Compact expert reference embedded on each content card.
  private expertMini(t: {
    id: string;
    slug: string;
    name: string;
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  } | undefined) {
    if (!t) return null;
    return {
      tenantId: t.id,
      slug: t.slug,
      name: t.brandName || t.name,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
    };
  }

  // Full combined catalog for the marketplace home page.
  async catalog() {
    const tenants = await this.listedTenants();
    const tenantIds = tenants.map((t) => t.id);
    const byId = new Map(tenants.map((t) => [t.id, t]));

    // Include legacy null-tenant content so nothing disappears from the store.
    const tenantFilter = {
      OR: [{ tenantId: { in: tenantIds } }, { tenantId: null }],
    };

    const [courseRows, bookRows, packageRows] = await Promise.all([
      this.prisma.course.findMany({
        where: { isPublished: true, ...tenantFilter },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.book.findMany({
        where: { isPublished: true, ...tenantFilter },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      this.prisma.package.findMany({
        where: { isActive: true, ...tenantFilter },
        orderBy: { price: "asc" },
        take: 200,
        include: {
          consultants: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
    ]);

    const experts = tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      brandName: t.brandName || t.name,
      logoUrl: t.logoUrl,
      primaryColor: t.primaryColor,
      tagline: t.tagline,
      category: t.category,
      hasDedicatedPortal: t.hasDedicatedPortal,
    }));

    const courses = courseRows.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      coverUrl: c.coverUrl,
      price: c.price,
      currency: c.currency,
      tags: c.tags,
      tenantId: c.tenantId,
      kind: "COURSE" as const,
      expert: this.expertMini(c.tenantId ? byId.get(c.tenantId) : undefined),
    }));

    const books = bookRows.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      author: b.author,
      description: b.description,
      coverUrl: b.coverUrl,
      price: b.price,
      currency: b.currency,
      language: b.language,
      categoryId: b.categoryId,
      tenantId: b.tenantId,
      kind: "BOOK" as const,
      expert: this.expertMini(b.tenantId ? byId.get(b.tenantId) : undefined),
    }));

    const packages = packageRows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      type: String(p.type),
      channel: String(p.channel),
      price: p.price,
      currency: p.currency,
      billingDays: p.billingDays,
      isGlobal: p.isGlobal,
      tenantId: p.tenantId,
      kind: "PACKAGE" as const,
      expert: this.expertMini(p.tenantId ? byId.get(p.tenantId) : undefined),
      consultants: p.consultants,
    }));

    return { experts, courses, books, packages };
  }

  // ---- Individual endpoints (mobile / incremental) ----

  async books() {
    return (await this.catalog()).books;
  }
  async courses() {
    return (await this.catalog()).courses;
  }
  async packages() {
    return (await this.catalog()).packages;
  }
  async experts() {
    return (await this.catalog()).experts;
  }
}
