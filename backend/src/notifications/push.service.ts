import { Injectable, Logger } from "@nestjs/common";

// Expo push notifications. Sends to the Expo push service
// (https://docs.expo.dev/push-notifications/sending-notifications/).
// Uses the global fetch available in Node 18+. No SDK dependency required.
type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default";
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  private isExpoToken(token: string | null | undefined): token is string {
    return (
      !!token &&
      (token.startsWith("ExponentPushToken[") ||
        token.startsWith("ExpoPushToken["))
    );
  }

  async send(
    token: string | null | undefined,
    title: string,
    body?: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.isExpoToken(token)) return;
    const message: ExpoMessage = {
      to: token,
      title,
      body,
      data,
      sound: "default",
    };
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      if (!res.ok) {
        this.logger.warn(
          `Expo push failed (${res.status}): ${await res.text()}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Expo push error: ${(err as Error).message}`);
    }
  }
}
