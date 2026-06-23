import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("payments")
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  // Gateways the client may pick from at checkout.
  @Get("providers")
  providers() {
    return this.service.availableGateways();
  }

  // Records the chosen gateway and returns a URL to open. `gateway` is optional;
  // when omitted the default/first enabled provider is used.
  @UseGuards(JwtAuthGuard)
  @Post("checkout/:paymentId")
  checkout(
    @Param("paymentId") paymentId: string,
    @Body() body: { gateway?: string },
  ) {
    return this.service.checkout(paymentId, body?.gateway);
  }

  // Builds the gateway redirect (plain redirect or self-submitting form) and
  // sends the browser onward. No auth: it is opened directly in the browser and
  // only reveals a hosted-checkout redirect keyed by the opaque payment id.
  @Get("redirect/:paymentId")
  async redirect(
    @Param("paymentId") paymentId: string,
    @Res() res: Response,
  ) {
    const result = await this.service.buildRedirect(paymentId);
    if (result.formHtml) {
      return res.type("html").send(result.formHtml);
    }
    return res.redirect(result.redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.service.listForUser(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get("all")
  all() {
    return this.service.listAll();
  }

  // GoPayFast IPN (server-to-server, no auth; verified inside the provider).
  // The webhook — not the success redirect — is the source of truth.
  @Post("webhook/gopayfast")
  gopayfastWebhook(
    @Body() payload: Record<string, any>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.service.handleWebhook("gopayfast", payload, headers);
  }

  // Whop webhook. Uses the raw request body for HMAC signature verification.
  @Post("webhook/whop")
  whopWebhook(
    @Body() payload: Record<string, any>,
    @Headers() headers: Record<string, string>,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : undefined;
    return this.service.handleWebhook("whop", payload, headers, rawBody);
  }

  // Mock hosted checkout used in development. Visiting it confirms the payment
  // and redirects back to the web success page.
  @Get("mock-checkout/:paymentId")
  async mockCheckout(
    @Param("paymentId") paymentId: string,
    @Res() res: Response,
  ) {
    await this.service.markPaid(paymentId, "MOCK-" + Date.now());
    const web = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
    return res.redirect(`${web}/payment/success?ref=${paymentId}`);
  }
}
