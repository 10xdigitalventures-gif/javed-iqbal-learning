export type ExpertCard = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  category: string | null;
};

export type ModuleFlags = {
  learning: boolean;
  consultation: boolean;
  community: boolean;
};

// Full public storefront view for one expert/tenant (marketplace detail page).
export type TenantPublic = {
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
  category: string | null;
  supportEmail: string | null;
  moduleFlags: ModuleFlags;
  subdomainUrl: string;
  listed: boolean;
};

export type CatalogCourse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  currency: string;
  tags: string[];
};

export type CatalogPackage = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  channel: string;
  price: number;
  currency: string;
  billingDays: number | null;
};

export type TenantCatalog = {
  courses: CatalogCourse[];
  packages: CatalogPackage[];
};

export type SlugCheck = {
  slug: string;
  available: boolean;
  reason: "too_short" | "reserved" | "taken" | null;
};

export type OnboardResult = {
  tenant: { slug: string; name: string; brandName: string } | null;
  subdomainUrl: string;
  listed: boolean;
};
