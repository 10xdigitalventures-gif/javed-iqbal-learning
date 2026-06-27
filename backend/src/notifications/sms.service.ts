import { Injectable, Logger } from "@nestjs/common";

// SMS + WhatsApp delivery via Twilio's REST API. If the Twilio env vars are
// not configured the service runs in "mock mode" and just logs the message,
// so the rest of the platform keeps working in development.
//
// Required env for real delivery:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_SMS_FROM        e.g. "+12025550123"
//   TWILIO_WHATSAPP_FROM   e.g. "+14155238886" (the Twilio WhatsApp sender)
@Injectable()
export class SmsService {
  private readonly logger = new Logger("SmsService");

  get smsEnabled() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_SMS_FROM,
    );
  }

  get whatsappEnabled() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
    );
  }

  // Normalise a phone number to E.164-ish form. Numbers stored without a
  // country code are assumed to be Pakistani (default +92) so local demo
  // data still routes somewhere sensible.
  private normalize(phone: string): string {
    const p = (phone || "").replace(/[^\d+]/g, "");
    if (!p) return "";
    if (p.startsWith("+")) return p;
    if (p.startsWith("00")) return "+" + p.slice(2);
    if (p.startsWith("0")) {
      const cc = process.env.DEFAULT_PHONE_COUNTRY_CODE || "92";
      return "+" + cc + p.slice(1);
    }
    return "+" + p;
  }

  async sendSms(to: string | null | undefined, body: string): Promise<void> {
    const num = this.normalize(to || "");
    if (!num) return;
    if (!this.smsEnabled) {
      this.logger.log("[mock-sms] to=" + num + " :: " + body);
      return;
    }
    await this.dispatch(
      num,
      process.env.TWILIO_SMS_FROM as string,
      body,
      "sms",
    );
  }

  async sendWhatsapp(
    to: string | null | undefined,
    body: string,
  ): Promise<void> {
    const num = this.normalize(to || "");
    if (!num) return;
    if (!this.whatsappEnabled) {
      this.logger.log("[mock-whatsapp] to=" + num + " :: " + body);
      return;
    }
    const from =
      "whatsapp:" + this.normalize(process.env.TWILIO_WHATSAPP_FROM as string);
    await this.dispatch("whatsapp:" + num, from, body, "whatsapp");
  }

  private async dispatch(
    to: string,
    from: string,
    body: string,
    kind: "sms" | "whatsapp",
  ): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID as string;
    const token = process.env.TWILIO_AUTH_TOKEN as string;
    const auth = Buffer.from(sid + ":" + token).toString("base64");
    const url =
      "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json";
    const form = new URLSearchParams();
    form.set("To", to);
    form.set("From", from);
    form.set("Body", body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!res.ok) {
        this.logger.warn(
          "Twilio " +
            kind +
            " failed (" +
            res.status +
            "): " +
            (await res.text()),
        );
      }
    } catch (err) {
      this.logger.warn("Twilio " + kind + " error: " + (err as Error).message);
    }
  }
}
