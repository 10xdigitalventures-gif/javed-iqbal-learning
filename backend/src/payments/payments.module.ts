import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentProvidersService } from "./payment-providers.service";
import { MockProvider } from "./providers/mock.provider";
import { GoPayFastProvider } from "./providers/gopayfast.provider";
import { WhopProvider } from "./providers/whop.provider";
import { BankTransferProvider } from "./providers/bank-transfer.provider";
import { PurchasesModule } from "../purchases/purchases.module";
import { OrdersModule } from "../orders/orders.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PayoutsModule } from "../payouts/payouts.module";

@Module({
  imports: [PurchasesModule, OrdersModule, NotificationsModule, PayoutsModule],
  providers: [
    PaymentsService,
    PaymentProvidersService,
    MockProvider,
    GoPayFastProvider,
    WhopProvider,
    BankTransferProvider,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
