import { Injectable, Logger } from "@nestjs/common";

// Lightweight mailer. If SMTP/SendGrid env vars are not set, it logs to console
// (mock mode) so the platform keeps working in development.
@Injectable()
export class MailService {
  private readonly logger = new Logger("MailService");

  private maskEmail(value: string) {
    const [local = "", domain = ""] = (value || "").split("@");
    const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${shown}***@${domain || "redacted"}`;
  }

  get enabled() {
    return Boolean(process.env.SENDGRID_API_KEY || process.env.SMTP_HOST);
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        `[mock-email] queued subject="${subject}" recipient=${this.maskEmail(to)} bodyLength=${body.length}`,
      );
      return;
    }

    try {
      if (process.env.SENDGRID_API_KEY) {
        await this.sendViaSendgrid(to, subject, body);
      } else {
        // SMTP path intentionally minimal; integrate nodemailer in production.
        this.logger.log(
          `[smtp] queued subject="${subject}" recipient=${this.maskEmail(to)}`,
        );
      }
    } catch (e) {
      this.logger.error(`Email send failed: ${(e as Error).message}`);
    }
  }

  private async sendViaSendgrid(to: string, subject: string, body: string) {
    const from = process.env.MAIL_FROM || "no-reply@example.com";
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from.replace(/^.*<|>.*$/g, "") || from },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!res.ok) {
      this.logger.error(`SendGrid HTTP ${res.status}`);
    }
  }
}
