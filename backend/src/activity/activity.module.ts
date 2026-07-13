import { Module } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditRetentionService } from "./audit-retention.service";

@Module({
  providers: [ActivityService, AuditInterceptor, AuditRetentionService],
  controllers: [ActivityController],
  exports: [ActivityService, AuditInterceptor],
})
export class ActivityModule {}
