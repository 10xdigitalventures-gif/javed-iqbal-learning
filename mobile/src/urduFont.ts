import { useEffect, useState } from "react";
import * as Font from "expo-font";

// Jameel Noori Nastaleeq is the standard Urdu Nasta'liq typeface. We load it at
// runtime from a hosted URL so the .ttf does not have to be bundled into the
// build. If loading fails (offline / bad URL) the reader gracefully falls back
// to the system Urdu font, so the app never breaks.
export const URDU_FONT_FAMILY = "JameelNooriNastaleeq";

// To self-host: upload JameelNooriNastaleeq.ttf somewhere public (e.g. your S3
// bucket or CDN) and replace this URL. Any valid .ttf/.otf URL works.
export const URDU_FONT_URL =
  "https://cdn.jsdelivr.net/gh/urdufonts/jameel-noori-nastaleeq@main/JameelNooriNastaleeq.ttf";

let loadPromise: Promise<boolean> | null = null;

async function ensureUrduFont(): Promise<boolean> {
  try {
    if (Font.isLoaded(URDU_FONT_FAMILY)) return true;
  } catch {}
  if (!loadPromise) {
    loadPromise = Font.loadAsync({ [URDU_FONT_FAMILY]: URDU_FONT_URL })
      .then(() => true)
      .catch(() => {
        // Allow a later retry and fall back to the system font meanwhile.
        loadPromise = null;
        return false;
      });
  }
  return loadPromise;
}

// Returns the Urdu font family name once the font is loaded, otherwise
// undefined (so callers fall back to the system font).
export function useUrduFont(): string | undefined {
  const [ready, setReady] = useState<boolean>(() => {
    try {
      return Font.isLoaded(URDU_FONT_FAMILY);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let alive = true;
    ensureUrduFont().then((ok) => {
      if (alive && ok) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready ? URDU_FONT_FAMILY : undefined;
}
