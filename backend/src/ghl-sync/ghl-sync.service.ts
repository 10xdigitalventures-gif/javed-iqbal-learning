import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LeadConnectorService } from "../leadconnector/leadconnector.service";

// Outbound event-sync layer to LeadConnector (GoHighLevel).
//
// This is the marketing engine bridge: whenever a meaningful thing happens in
// the app (registration, purchase, booking, subscription, course completion,
// inactivity) we upsert the person as a contact in the connected GHL location
// and tag them, so GHL workflows/automations can nurture them.
//
// Design rules:
// - Feature-flagged: does nothing unless GHL_SYNC_ENABLED="true".
// - Fire-and-forget: never throws into the calling business flow. Every public
//   event method returns void immediately and the network work runs detached.
// - Reuses the existing LeadConnector OAuth connection (token + location id).
const SOURCE = "10X Platform";

type ContactSync = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  tags: string[];
  note?: string;
};

@Injectable()
export class GhlSyncService implements OnModuleInit {
  private readonly logger = new Logger("GhlSyncService");
  private cronTimer?: ReturnType<typeof setInterval>;
  private lastInactiveRunDate = "";

  constructor(
    private readonly lc: LeadConnectorService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Daily cron (in-process poller, no extra dependency) ----
  // Mirrors the codebase's existing scheduler style (see NotificationsService).
  // Polls every 15 minutes; once per calendar day, at or after GHL_CRON_HOUR
  // (server local hour, default 03:00), it runs the inactive-contact sweep.
  // A per-day guard (lastInactiveRunDate) prevents duplicate runs in one day.
  onModuleInit() {
    const timer = setInterval(
      () => {
        this.runDailyTick().catch((e: any) =>
          this.logger.warn(`GHL cron tick failed: ${e?.message || e}`),
        );
      },
      15 * 60 * 1000,
    );
    // Do not keep the event loop alive solely for this timer.
    if (typeof timer.unref === "function") timer.unref();
    this.cronTimer = timer;
  }

  // Cron follows GHL_SYNC_ENABLED unless explicitly overridden with
  // GHL_CRON_ENABLED ("true"/"false").
  private cronEnabled() {
    if (process.env.GHL_CRON_ENABLED === "false") return false;
    if (process.env.GHL_CRON_ENABLED === "true") return true;
    return this.isEnabled();
  }

  private cronHour() {
    const h = Number(process.env.GHL_CRON_HOUR);
    return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 3;
  }

  // One poll iteration: run the inactive sweep at most once per calendar day,
  // at or after the configured hour (server local time).
  private async runDailyTick(): Promise<void> {
    if (!this.cronEnabled()) return;
    const now = new Date();
    const today =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");
    if (this.lastInactiveRunDate === today) return; // already ran today
    if (now.getHours() < this.cronHour()) return; // not time yet
    // Set the guard first so a slow/failed run does not re-trigger next tick.
    this.lastInactiveRunDate = today;
    const res = await this.runInactiveSync();
    this.logger.log(
      `GHL daily inactive sweep: scanned=${res.scanned} synced=${res.synced}`,
    );
  }

  isEnabled() {
    return process.env.GHL_SYNC_ENABLED === "true";
  }

  // Run `fn` detached; log (never rethrow) on failure. No-op when disabled.
  private fire(label: string, fn: () => Promise<void>) {
    if (!this.isEnabled()) return;
    fn().catch((e: any) =>
      this.logger.warn(`GHL ${label} sync failed: ${e?.message || e}`),
    );
  }

  // ---- Core: upsert a contact + optional note ----
  private async doSync(payload: ContactSync): Promise<void> {
    const email = payload.email || undefined;
    const phone = payload.phone || undefined;
    if (!email && !phone) return; // GHL needs at least one identifier

    const token = await this.lc.getValidAccessToken();
    const locationId = await this.lc.getConnectedLocationId();
    if (!token || !locationId) {
      this.logger.warn("GHL sync skipped: LeadConnector not connected");
      return;
    }

    const parts = (payload.name || "").trim().split(/\s+/).filter(Boolean);
    const firstName = parts.length ? parts[0] : undefined;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;

    const body: Record<string, unknown> = {
      locationId,
      email,
      phone,
      firstName,
      lastName,
      name: payload.name || undefined,
      tags: payload.tags,
      source: SOURCE,
    };

    const res = await fetch(this.lc.apiBaseUrl + "/contacts/upsert", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Version: this.lc.apiVersion,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error("contacts/upsert " + res.status + ": " + t.slice(0, 200));
    }
    const data: any = await res.json().catch(() => ({}));
    const contactId = data?.contact?.id || data?.id;

    if (contactId && payload.note) {
      await fetch(this.lc.apiBaseUrl + "/contacts/" + contactId + "/notes", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          Version: this.lc.apiVersion,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ body: payload.note }),
      }).catch(() => undefined);
    }
  }

  // ---- Public event methods (all fire-and-forget) ----

  onUserRegistered(u: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  }) {
    this.fire("registration", () =>
      this.doSync({
        email: u.email,
        name: u.name,
        phone: u.phone,
        tags: ["10x-app", "app-registered"],
        note: "Registered on the 10X app.",
      }),
    );
  }

  onPurchase(p: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    item?: string;
    amount?: number;
    currency?: string;
  }) {
    const detail =
      (p.item ? p.item : "an item") +
      (p.amount != null
        ? " for " + (p.currency || "PKR") + " " + p.amount
        : "");
    this.fire("purchase", () =>
      this.doSync({
        email: p.email,
        name: p.name,
        phone: p.phone,
        tags: ["10x-app", "app-customer", "app-purchase"],
        note: "Purchased " + detail + " on the 10X app.",
      }),
    );
  }

  onBooking(b: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    title?: string;
    scheduledAt?: Date | string;
  }) {
    const when = b.scheduledAt ? new Date(b.scheduledAt).toISOString() : "";
    this.fire("booking", () =>
      this.doSync({
        email: b.email,
        name: b.name,
        phone: b.phone,
        tags: ["10x-app", "app-booking"],
        note:
          "Booked a session" +
          (b.title ? ": " + b.title : "") +
          (when ? " (" + when + ")" : "") +
          ".",
      }),
    );
  }

  onSubscription(s: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    planName?: string;
  }) {
    this.fire("subscription", () =>
      this.doSync({
        email: s.email,
        name: s.name,
        phone: s.phone,
        tags: ["10x-app", "app-subscriber"],
        note:
          "Subscription activated" +
          (s.planName ? ": " + s.planName : "") +
          ".",
      }),
    );
  }

  onCourseCompleted(c: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    courseTitle?: string;
  }) {
    this.fire("completion", () =>
      this.doSync({
        email: c.email,
        name: c.name,
        phone: c.phone,
        tags: ["10x-app", "course-completed"],
        note:
          "Completed a course" +
          (c.courseTitle ? ": " + c.courseTitle : "") +
          ".",
      }),
    );
  }

  // ---- Inactive sweep (invoked by admin endpoint / external cron) ----
  // Clients created before the cutoff with no activity log since the cutoff.
  async runInactiveSync(
    days?: number,
  ): Promise<{ scanned: number; synced: number }> {
    if (!this.isEnabled()) return { scanned: 0, synced: 0 };
    const windowDays = days ?? Number(process.env.GHL_INACTIVE_DAYS || 30);
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    let scanned = 0;
    let synced = 0;
    try {
      const users = await this.prisma.user.findMany({
        where: { role: Role.CLIENT, isActive: true, createdAt: { lt: cutoff } },
        select: { id: true, email: true, name: true, phone: true },
        take: 500,
      });
      scanned = users.length;
      for (const u of users) {
        const recent = await this.prisma.activityLog.findFirst({
          where: { userId: u.id, createdAt: { gte: cutoff } },
          select: { id: true },
        });
        if (recent) continue;
        await this.doSync({
          email: u.email,
          name: u.name,
          phone: u.phone,
          tags: ["10x-app", "app-inactive"],
          note: "No activity in the last " + windowDays + " days.",
        }).catch(() => undefined);
        synced++;
      }
    } catch (e: any) {
      this.logger.warn(`GHL inactive sweep failed: ${e?.message || e}`);
    }
    return { scanned, synced };
  }

  // Send a test contact so the admin can verify the connection end-to-end.
  async sendTest(
    email: string,
    name?: string,
  ): Promise<{ ok: boolean; enabled: boolean }> {
    if (!this.isEnabled()) return { ok: false, enabled: false };
    try {
      await this.doSync({
        email,
        name: name || "10X Test Contact",
        tags: ["10x-app", "app-test"],
        note: "Test contact from the 10X platform GHL sync.",
      });
      return { ok: true, enabled: true };
    } catch (e: any) {
      this.logger.warn(`GHL test failed: ${e?.message || e}`);
      return { ok: false, enabled: true };
    }
  }

  status() {
    return {
      enabled: this.isEnabled(),
      inactiveDays: Number(process.env.GHL_INACTIVE_DAYS || 30),
      cron: {
        enabled: this.cronEnabled(),
        hour: this.cronHour(),
        lastInactiveRunDate: this.lastInactiveRunDate || null,
      },
    };
  }
}
