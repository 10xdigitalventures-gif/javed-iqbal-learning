import { Module } from "@nestjs/common";
import { LeadConnectorService } from "./leadconnector.service";
import { LeadConnectorController } from "./leadconnector.controller";
import { LeadConnectorMcpService } from "./leadconnector-mcp.service";

@Module({
  providers: [LeadConnectorService, LeadConnectorMcpService],
  controllers: [LeadConnectorController],
  exports: [LeadConnectorService, LeadConnectorMcpService],
})
export class LeadConnectorModule {}
