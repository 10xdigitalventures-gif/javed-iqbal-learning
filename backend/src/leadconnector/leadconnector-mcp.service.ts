import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Minimal client for the LeadConnector (HighLevel) MCP server.
// The MCP server speaks JSON-RPC 2.0 over Streamable HTTP. Depending on the
// server it may answer with either a plain JSON body or a text/event-stream
// (SSE) body, so we handle both. Auth uses a Private Integration Token (PIT)
// plus the connected location id.
@Injectable()
export class LeadConnectorMcpService {
  private readonly logger = new Logger("LeadConnectorMcpService");

  constructor(private prisma: PrismaService) {}

  private url() {
    return (
      process.env.LEADCONNECTOR_MCP_URL ||
      "https://services.leadconnectorhq.com/mcp/"
    );
  }

  private token() {
    return process.env.LEADCONNECTOR_MCP_TOKEN || "";
  }

  isConfigured() {
    return !!this.token();
  }

  private async locationId(): Promise<string> {
    try {
      const row = await this.prisma.platformSetting.findUnique({
        where: { key: "leadConnectorLocationId" },
      });
      return row?.value || process.env.LEADCONNECTOR_LOCATION_ID || "";
    } catch {
      return process.env.LEADCONNECTOR_LOCATION_ID || "";
    }
  }

  private headers(locationId: string, sessionId?: string) {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.token()}`,
    };
    if (locationId) h["locationId"] = locationId;
    if (sessionId) h["Mcp-Session-Id"] = sessionId;
    return h;
  }

  // A fetch Response may be JSON or SSE. Return the last JSON-RPC payload found.
  private async parseBody(res: Response): Promise<any> {
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (ct.includes("text/event-stream")) {
      const payloads = text
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);
      for (let i = payloads.length - 1; i >= 0; i--) {
        try {
          return JSON.parse(payloads[i]);
        } catch {
          // keep scanning earlier frames
        }
      }
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private async rpc(
    method: string,
    params: any,
    ctx: { locationId: string; sessionId?: string },
  ): Promise<{ data: any; sessionId?: string }> {
    const res = await fetch(this.url(), {
      method: "POST",
      headers: this.headers(ctx.locationId, ctx.sessionId),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });
    const sessionId = res.headers.get("mcp-session-id") || ctx.sessionId;
    if (!res.ok) {
      const t = await res.text();
      throw new Error(
        `MCP ${method} failed (${res.status}): ${t.slice(0, 300)}`,
      );
    }
    const data = await this.parseBody(res);
    return { data, sessionId: sessionId || undefined };
  }

  // initialize + initialized handshake; returns the negotiated session id.
  private async handshake(locationId: string): Promise<{ sessionId?: string }> {
    const { sessionId } = await this.rpc(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "javed-iqbal-platform", version: "1.0.0" },
      },
      { locationId },
    );
    try {
      await fetch(this.url(), {
        method: "POST",
        headers: this.headers(locationId, sessionId),
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });
    } catch {
      // notification is best-effort
    }
    return { sessionId };
  }

  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    if (!this.isConfigured()) {
      throw new Error(
        "Add your LeadConnector Private Integration Token first, then save.",
      );
    }
    const locationId = await this.locationId();
    const { sessionId } = await this.handshake(locationId);
    const { data } = await this.rpc(
      "tools/list",
      {},
      { locationId, sessionId },
    );
    if (data?.error) {
      throw new Error(data.error?.message || "tools/list error");
    }
    const tools = data?.result?.tools;
    return Array.isArray(tools) ? tools : [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error(
        "Add your LeadConnector Private Integration Token first, then save.",
      );
    }
    if (!name) throw new Error("toolName is required");
    const locationId = await this.locationId();
    const { sessionId } = await this.handshake(locationId);
    const { data } = await this.rpc(
      "tools/call",
      { name, arguments: args || {} },
      { locationId, sessionId },
    );
    if (data?.error) {
      throw new Error(data.error?.message || "tools/call error");
    }
    return data?.result;
  }

  async status() {
    return {
      configured: this.isConfigured(),
      url: this.url(),
      hasToken: !!this.token(),
      locationId: await this.locationId(),
    };
  }
}
