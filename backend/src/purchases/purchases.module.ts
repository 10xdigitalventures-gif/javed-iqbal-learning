import { Module } from "@nestjs/common";
import { PurchasesService } from "./purchases.service";
import { PurchasesController } from "./purchases.controller";
import { UsageService } from "./usage.service";

@Module({
  providers: [PurchasesService, UsageService],
  controllers: [PurchasesController],
  exports: [PurchasesService, UsageService],
})
export class PurchasesModule {}
