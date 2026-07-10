import Constants from 'expo-constants';
import { api } from './api';

// Env-var-baked slug (set at EAS build time per tenant)
export const TENANT_SLUG: string =
  (Constants.expoConfig?.extra as any)?.tenantSlug || '';

// Runtime brand color (falls back to env-var/build-time default)
export const BUILD_BRAND_COLOR: string =
  (Constants.expoConfig?.extra as any)?.brandColor || '#FF9100';

export type TenantConfig = {
  name: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  moduleFlags: Record<string, boolean>;
  subdomainUrl: string;
};

let _config: TenantConfig | null = null;

/**
 * Fetch tenant config from the backend.
 * - If TENANT_SLUG is set (white-label build) → fetches the named tenant.
 * - If empty → fetches the current tenant via /tenant/current (subdomain-based).
 * Falls back silently so the app still works offline.
 */
export async function loadTenantConfig(): Promise<TenantConfig | null> {
  try {
    const data: any = TENANT_SLUG
      ? await fetch(
          (Constants.expoConfig?.extra as any)?.apiUrl +
            '/tenant/public/' +
            TENANT_SLUG,
        ).then(r => (r.ok ? r.json() : null))
      : await api('/tenant/current').catch(() => null);
    if (data) _config = data;
  } catch {
    // silent — keep default branding
  }
  return _config;
}

export function getTenantConfig(): TenantConfig | null {
  return _config;
}

/** Live brand color — prefers server config, falls back to build-time env var. */
export function brandColor(): string {
  return _config?.primaryColor || BUILD_BRAND_COLOR;
}

/** Is this module enabled for the current tenant? */
export function isModuleEnabled(flag: string): boolean {
  if (!_config?.moduleFlags) return true; // default allow if no config
  return _config.moduleFlags[flag] ?? true;
}
