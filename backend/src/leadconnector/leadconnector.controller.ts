import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { LeadConnectorService } from "./leadconnector.service";
import { LeadConnectorMcpService } from "./leadconnector-mcp.service";

@Controller("leadconnector")
export class LeadConnectorController {
  constructor(
    private service: LeadConnectorService,
    private mcp: LeadConnectorMcpService,
  ) {}

  // Current connection status (admin panel).
  @Get("status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  status() {
    return this.service.status();
  }

  // Start the OAuth flow — returns the LeadConnector authorize URL for the
  // admin browser to redirect to.
  @Get("authorize")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async authorize() {
    if (!this.service.isConfigured()) {
      return {
        error: "Add your LeadConnector Client ID and Secret first, then save.",
      };
    }
    const url = await this.service.beginAuthorize();
    return { url };
  }

  // Public callback — LeadConnector redirects the browser here after login.
  // No JWT guard: a top-level browser redirect cannot carry an auth header, so
  // the request is validated by the one-time OAuth `state` instead.
  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Res() res: Response,
  ) {
    if (error) return res.redirect(this.service.webReturn("error", error));
    try {
      const ok = await this.service.verifyState(state);
      if (!ok)
        return res.redirect(this.service.webReturn("error", "state_mismatch"));
      if (!code)
        return res.redirect(this.service.webReturn("error", "missing_code"));
      await this.service.exchangeCode(code);
      return res.redirect(this.service.webReturn("connected"));
    } catch (e: any) {
      return res.redirect(
        this.service.webReturn("error", e?.message || "exchange_failed"),
      );
    }
  }

  @Post("disconnect")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  disconnect() {
    return this.service.disconnect();
  }

  // ----- MCP (LeadConnector CRM tools) -----

  @Get("mcp/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  mcpStatus() {
    return this.mcp.status();
  }

  // Test the MCP connection by listing the tools the server exposes.
  @Get("mcp/tools")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async mcpTools() {
    return this.mcp.listTools();
  }

  // Invoke a single MCP tool by name.
  @Post("mcp/call")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async mcpCall(
    @Body() body: { toolName: string; arguments?: Record<string, unknown> },
  ) {
    return this.mcp.callTool(body?.toolName, body?.arguments || {});
  }
}
