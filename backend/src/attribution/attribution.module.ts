import { Global, Module } from "@nestjs/common";
import { AttributionService } from "./attribution.service";
import { AttributionController } from "./attribution.controller";
import { GamificationModule } from "../gamification/gamification.module";

// @Global so the sale hook (PaymentsService) and signup hook (AuthService) can
// inject AttributionService without importing this module explicitly.
@Global()
@Module({
  imports: [GamificationModule],
  providers: [AttributionService],
  controllers: [AttributionController],
  exports: [AttributionService],
})
export class AttributionModule {}
