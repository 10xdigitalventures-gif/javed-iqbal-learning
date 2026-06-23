import { Injectable, Logger } from "@nestjs/common";
import { PaymentProvider } from "./providers/payment-provider.interface";
import { MockProvider } from "./providers/mock.provider";
import { GoPayFastProvider } from "./providers/gopayfast.provider";
import { WhopProvider } from "./providers/whop.provider";

// Central registry of payment providers. Which providers are "active" is driven
// by the PAYMENT_PROVIDERS env var (comma-separated keys). The mock provider is
// always available as a development fallback.
@Injectable()
export class PaymentProvidersService {
  private readonly logger = new Logger("PaymentProvidersService");
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    mock: MockProvider,
    gopayfast: GoPayFastProvider,
    whop: WhopProvider,
  ) {
    this.providers = new Map(
      [mock, gopayfast, whop].map((p) => [p.name, p]),
    );
  }

  // Provider keys listed in PAYMENT_PROVIDERS that are also actually enabled
  // (have their credentials configured). This is what the client is offered.
  enabledNames(): string[] {
    const configured = (process.env.PAYMENT_PROVIDERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const enabled = configured.filter((name) => {
      const p = this.providers.get(name);
      return p && p.isEnabled();
    });
    // Fall back to the mock provider so checkout always works in development.
    return enabled.length > 0 ? enabled : ["mock"];
  }

  // Resolve a provider by name, falling back to a sensible default. Unknown or
  // disabled gateways fall back to the first enabled provider (or mock).
  get(name?: string): PaymentProvider {
    if (name) {
      const direct = this.providers.get(name);
      if (direct && direct.isEnabled()) return direct;
      this.logger.warn(
        `Requested gateway "${name}" is not enabled; using fallback`,
      );
    }
    const fallbackName = this.enabledNames()[0];
    return this.providers.get(fallbackName) || this.providers.get("mock")!;
  }
}
