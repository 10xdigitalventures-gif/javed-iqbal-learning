import { Module } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { PayoutsController } from "./payouts.controller";

// Exports PayoutsService so OrdersModule / PurchasesModule can record a payout
// when a sale is fulfilled.
@Module({
  providers: [PayoutsService],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
