import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";

// Exports OrdersService so PaymentsModule can fulfill orders when a payment is
// confirmed. Payments are created directly via Prisma here (no PaymentsModule
// import) to avoid a circular dependency.
@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
