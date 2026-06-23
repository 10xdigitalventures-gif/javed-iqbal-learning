import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Key/value platform configuration store. Admin-editable.
const DEFAULTS: Record<string, string> = {
  platformName: "Consultant & Mentorship Platform",
  supportEmail: "support@example.com",
  defaultCurrency: "PKR",
  meetingDurations: "15,30,60",
  audioMaxSeconds: "90",
  videoMaxSeconds: "120",
  brandColor: "#1B4DFF",
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.platformSetting.findMany();
    const map: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  async update(values: Record<string, string>) {
    const entries = Object.entries(values || {});
    for (const [key, value] of entries) {
      await this.prisma.platformSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    return this.getAll();
  }
}
