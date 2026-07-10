import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

// LeadConnector (HighLevel) OAuth 2.0 integration.
//
// This gives the platform the same "Connect your account" experience as the
// official LeadConnector WordPress plugin: the admin is redirected to
// LeadConnector to sign in (Google login included) and pick a location; we
// exchange the returned code for tokens server-side and store the selected
// location id as a public setting so the site-wide chat widget can render
// automatically — no manual Widget ID needed.
//
// The Marketplace app Client ID / Secret are supplied by the admin under
// Settings and mirrored into process.env (LEADCONNECTOR_CLIENT_ID / _SECRET).
const AUTH_BASE = "https://marketplace.leadconnectorhq.com";
const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const SCOPES = ["locations.readonly", "businesses.readonly"];

@Injectable()
export class LeadConnectorService {
  private readonly logger = new Logger("LeadConnectorService");

  constructor(private prisma: PrismaService) {}

  private clientId() {
    return process.env.LEADCONNECTOR_CLIENT_ID || "";
  }
  private clientSecret() {
    return process.env.LEADCONNECTOR_CLIENT_SECRET || "";
  }
  private apiBase() {
    return process.env.PUBLIC_API_URL || "http://localhost:4000/api";
  }
  private webBase() {
    return process.env.PUBLIC_WEB_URL || "http://localhost:3000";
  }
  private redirectUri() {
    return `${this.apiBase()}/leadconnector/callback`;
  }

  isConfigured() {
    return !!this.clientId() && !!this.clientSecret();
  }

  // ---- small settings helpers (public rows are readable via GET /settings;
  // secret: rows are skipped there so tokens never leak) ----
  private async setPublic(key: string, value: string) {
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  private async setSecret(key: string, value: string) {
    await this.setPublic("secret:" + key, value);
  }
  private async getSecret(key: string) {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: "secret:" + key },
    });
    return row?.value || "";
  }

  private authorizeUrl(state: string) {
    const params = new URLSearchParams({
      response_type: "code",
      redirect_uri: this.redirectUri(),
      client_id: this.clientId(),
      scope: SCOPES.join(" "),
      state,
    });
    return `${AUTH_BASE}/oauth/chooselocation?${params.toString()}`;
  }

  async beginAuthorize() {
    const state = randomBytes(16).toString("hex");
    await this.setSecret("LEADCONNECTOR_OAUTH_STATE", state);
    return this.authorizeUrl(state);
  }

  async verifyState(state: string) {
    if (!state) return false;
    const saved = await this.getSecret("LEADCONNECTOR_OAUTH_STATE");
    return !!saved && saved === state;
  }

  async exchangeCode(code: string) {
    const body = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      grant_type: "authorization_code",
      code,
      user_type: "Location",
      redirect_uri: this.redirectUri(),
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(
        `Token exchange failed (${res.status}): ${t.slice(0, 300)}`,
      );
    }
    const data: any = await res.json();
    await this.storeTokens(data);

    const locationId = data.locationId || "";
    let locationName = "";
    if (locationId && data.access_token) {
      try {
        locationName = await this.fetchLocationName(
          data.access_token,
          locationId,
        );
      } catch (e: any) {
        this.logger.warn(`Could not fetch location name: ${e?.message || e}`);
      }
    }
    await this.setPublic("leadConnectorLocationId", locationId);
    await this.setPublic("leadConnectorLocationName", locationName);
    await this.setPublic("leadConnectorEnabled", "true");
    return { locationId, locationName };
  }

  private async storeTokens(data: any) {
    await this.setSecret("LEADCONNECTOR_ACCESS_TOKEN", data.access_token || "");
    await this.setSecret(
      "LEADCONNECTOR_REFRESH_TOKEN",
      data.refresh_token || "",
    );
    const expiresMs = Date.now() + Number(data.expires_in || 0) * 1000;
    await this.setSecret("LEADCONNECTOR_TOKEN_EXPIRES", String(expiresMs));
  }

  private async fetchLocationName(token: string, locationId: string) {
    const res = await fetch(`${API_BASE}/locations/${locationId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        Accept: "application/json",
      },
    });
    if (!res.ok) return "";
    const data: any = await res.json();
    return data?.location?.name || data?.name || "";
  }

  async status() {
    const rows = await this.prisma.platformSetting.findMany({
      where: {
        key: {
          in: [
            "leadConnectorEnabled",
            "leadConnectorLocationId",
            "leadConnectorLocationName",
            "leadConnectorWidgetId",
          ],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    const hasToken = !!(await this.getSecret("LEADCONNECTOR_ACCESS_TOKEN"));
    return {
      configured: this.isConfigured(),
      connected: hasToken && !!map.leadConnectorLocationId,
      enabled: map.leadConnectorEnabled === "true",
      locationId: map.leadConnectorLocationId || "",
      locationName: map.leadConnectorLocationName || "",
      widgetId: map.leadConnectorWidgetId || "",
      redirectUri: this.redirectUri(),
    };
  }

  async disconnect() {
    await this.setSecret("LEADCONNECTOR_ACCESS_TOKEN", "");
    await this.setSecret("LEADCONNECTOR_REFRESH_TOKEN", "");
    await this.setSecret("LEADCONNECTOR_TOKEN_EXPIRES", "");
    await this.setPublic("leadConnectorLocationId", "");
    await this.setPublic("leadConnectorLocationName", "");
    await this.setPublic("leadConnectorEnabled", "false");
    return { ok: true };
  }

  // ---- Outbound API access for the GHL sync layer ----
  get apiBaseUrl() {
    return API_BASE;
  }

  get apiVersion() {
    return API_VERSION;
  }

  async getConnectedLocationId(): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: "leadConnectorLocationId" },
    });
    return row?.value || process.env.LEADCONNECTOR_LOCATION_ID || "";
  }

  // Return a valid access token, refreshing first if close to expiry.
  async getValidAccessToken(): Promise<string> {
    const token = await this.getSecret("LEADCONNECTOR_ACCESS_TOKEN");
    if (!token) return "";
    const exp = Number(
      (await this.getSecret("LEADCONNECTOR_TOKEN_EXPIRES")) || 0,
    );
    if (exp && Date.now() > exp - 120000) {
      const refreshed = await this.refreshTokens();
      if (refreshed) return refreshed;
    }
    return token;
  }

  private async refreshTokens(): Promise<string> {
    const refreshToken = await this.getSecret("LEADCONNECTOR_REFRESH_TOKEN");
    if (!refreshToken || !this.isConfigured()) return "";
    const body = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      user_type: "Location",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      this.logger.warn(`LeadConnector token refresh failed (${res.status})`);
      return "";
    }
    const data: any = await res.json();
    await this.storeTokens(data);
    return data.access_token || "";
  }

  webReturn(status: "connected" | "error", msg?: string) {
    const u = new URL(`${this.webBase()}/admin/settings`);
    u.searchParams.set("lc", status);
    if (msg) u.searchParams.set("lc_msg", String(msg).slice(0, 140));
    return u.toString();
  }
}
