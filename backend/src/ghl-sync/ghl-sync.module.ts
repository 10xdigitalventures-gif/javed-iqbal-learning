import { Global, Module } from "@nestjs/common";
import { LeadConnectorModule } from "../leadconnector/leadconnector.module";
import { GhlSyncService } from "./ghl-sync.service";
import { GhlSyncController } from "./ghl-sync.controller";

// Global so any service can inject GhlSyncService without importing this module.
// Fire-and-forget event methods keep call sites a single, safe line.
@Global()
@Module({
  imports: [LeadConnectorModule],
  providers: [GhlSyncService],
  controllers: [GhlSyncController],
  exports: [GhlSyncService],
})
export class GhlSyncModule {}
