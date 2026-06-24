import { api } from "./api";

// In-app branding logo.
// - The phone launcher icon + native splash screen use the photo baked into the
//   build (assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png)
//   and only change with a fresh EAS build.
// - This module controls the logo shown *inside* the app, which an admin can
//   switch globally from the web admin Settings screen (persisted as the
//   public `brandingMode` setting on GET /settings).
export const BRAND_ICON = require("../assets/brand-icon.png");
export const BRAND_PHOTO = require("../assets/brand-photo.png");

export type BrandingMode = "icon" | "picture";

let cachedMode: BrandingMode = "picture";

// Resolve the image source for the current (or given) branding mode.
export function brandingSource(mode?: string) {
  const m = (mode || cachedMode) === "icon" ? "icon" : "picture";
  return m === "icon" ? BRAND_ICON : BRAND_PHOTO;
}

// Fetch the admin-configured branding mode from the backend and cache it.
export async function loadBrandingMode(): Promise<BrandingMode> {
  try {
    const s: any = await api("/settings");
    if (s?.brandingMode === "icon" || s?.brandingMode === "picture") {
      cachedMode = s.brandingMode;
    }
  } catch {
    // ignore network errors — keep last known / default mode
  }
  return cachedMode;
}
