import Constants from 'expo-constants';

export const API_URL =
  (Constants.expoConfig?.extra as any)?.apiUrl || 'http://10.0.2.2:4000/api';

export const ROOT_DOMAIN =
  (Constants.expoConfig?.extra as any)?.rootDomain || '10xdigitalventures.com';

export type ExpertCard = {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  category?: string;
  logoUrl?: string;
  subdomainUrl: string;
  listed: boolean;
};

export type TenantPublic = {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  category?: string;
  logoUrl?: string;
  primaryColor?: string;
  subdomainUrl: string;
  moduleFlags: Record<string, boolean>;
};

export async function getDirectory(): Promise<ExpertCard[]> {
  const res = await fetch(API_URL + '/tenant/directory');
  if (!res.ok) return [];
  return res.json();
}

export async function getTenantBySlug(slug: string): Promise<TenantPublic | null> {
  const res = await fetch(API_URL + '/tenant/public/' + slug);
  if (!res.ok) return null;
  return res.json();
}

export async function getTenantCatalog(slug: string): Promise<any> {
  const res = await fetch(API_URL + '/tenant/public/' + slug + '/catalog');
  if (!res.ok) return {};
  return res.json();
}
