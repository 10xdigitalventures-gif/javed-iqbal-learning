"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "./api";

// Public, safe branding shape returned by GET /tenant/current.
export type TenantBranding = {
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
  moduleFlags: Record<string, boolean | string>;
};

// Convert "#ff9100" | "#f90" | "255,145,0" | "255 145 0" into the space-separated
// channel form ("255 145 0") that Tailwind reads via rgb(var(--brand) / <a>).
function toRgbChannels(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  const hex = v.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  const nums = v.match(/\d{1,3}/g);
  if (nums && nums.length >= 3) return nums.slice(0, 3).join(" ");
  return null;
}

// Shade an "r g b" channel string toward white (amount > 0) or black
// (amount < 0). Used to derive dark/light brand shades from a single primary
// color when the tenant did not provide explicit secondary/accent colors.
function shadeChannels(channels: string, amount: number): string {
  const [r, g, b] = channels.split(/\s+/).map((n) => parseInt(n, 10));
  const mix = (c: number) =>
    amount >= 0
      ? Math.round(c + (255 - c) * amount)
      : Math.round(c * (1 + amount));
  return `${mix(r)} ${mix(g)} ${mix(b)}`;
}

function applyBranding(b: TenantBranding) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const primary = toRgbChannels(b.primaryColor);
  if (primary) {
    root.style.setProperty("--brand", primary);
    root.style.setProperty(
      "--brand-dark",
      toRgbChannels(b.secondaryColor) || shadeChannels(primary, -0.18),
    );
    root.style.setProperty(
      "--brand-light",
      toRgbChannels(b.accentColor) || shadeChannels(primary, 0.85),
    );
  }

  if (b.fontFamily) {
    document.body.style.fontFamily = `${b.fontFamily}, Inter, system-ui, sans-serif`;
  }

  if (b.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }

  const title = b.brandName || b.name;
  if (title) document.title = title;
}

const BrandingContext = createContext<TenantBranding | null>(null);

// Access the active tenant branding anywhere in the client tree. Returns null
// until the first fetch resolves (components should fall back to defaults).
export function useBranding() {
  return useContext(BrandingContext);
}

export // ModuleFlags kept as alias for backward compatibility

// Which feature modules are enabled for the active tenant. A missing flag
// defaults to enabled, so the app stays fully featured until a tenant opts
// out. Only an explicit false disables a module.
type ModuleConfig = {
  // Top-level module toggles
  learning: boolean;
  consultation: boolean;
  community: boolean;
  // Learning sub-features
  books: boolean;
  audiobooks: boolean;
  courses: boolean;
  certificates: boolean;
  achievements: boolean;
  subscription: boolean;
  // Consultation sub-features
  packages: boolean;
  meetings: boolean;
  // Commerce
  bundles: boolean;
  // Options
  books_language: "both" | "en" | "urdu";
  consultation_channels: "all" | "text" | "audio" | "video" | "live";
};

export function useModules(): ModuleConfig {
  const branding = useContext(BrandingContext);
  const raw = branding?.moduleFlags || {};
  const b = (key: string) => raw[key] !== false;
  return {
    learning: b("learning"),
    consultation: b("consultation"),
    community: b("community"),
    books: b("learning") && b("books"),
    audiobooks: b("learning") && b("audiobooks"),
    courses: b("learning") && b("courses"),
    certificates: b("learning") && b("certificates"),
    achievements: b("learning") && b("achievements"),
    subscription: b("consultation") && b("subscription"),
    packages: b("consultation") && b("packages"),
    meetings: b("consultation") && b("meetings"),
    bundles: b("bundles"),
    books_language: (raw.books_language as any) || "both",
    consultation_channels: (raw.consultation_channels as any) || "all",
  };
}

// Fetches the active tenant's branding (the API resolves it from host/header)
// and applies it as runtime CSS variables. On any failure it silently keeps the
// build-time defaults, so the app always renders with a valid look.
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/tenant/current`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TenantBranding | null) => {
        if (cancelled || !data) return;
        setBranding(data);
        applyBranding(data);
      })
      .catch(() => {
        /* keep build-time defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
