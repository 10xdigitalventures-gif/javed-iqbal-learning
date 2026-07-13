import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.schedule();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule() {
    const everyHours = Math.max(
      1,
      Number(process.env.AUDIT_RETENTION_SWEEP_HOURS || 24),
    );
    this.timer = setTimeout(
      async () => {
        try {
          await this.enforce();
        } catch (e: any) {
          this.logger.warn(`Audit retention sweep failed: ${e?.message || e}`);
        } finally {
          this.schedule();
        }
      },
      everyHours * 60 * 60 * 1000,
    );
    this.timer.unref?.();
  }

  async enforce() {
    const days = Math.max(
      30,
      Number(process.env.AUDIT_LOG_RETENTION_DAYS || 30),
    );
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const result = await this.prisma.activityLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count)
      this.logger.log(
        `Deleted ${result.count} audit logs older than ${days} days`,
      );
    return { deleted: result.count, cutoff };
  }
}
