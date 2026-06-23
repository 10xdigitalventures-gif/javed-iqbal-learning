import { Module } from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { MessagingController } from "./messaging.controller";
import { PurchasesModule } from "../purchases/purchases.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MediaModule } from "../media/media.module";

@Module({
  imports: [PurchasesModule, NotificationsModule, MediaModule],
  providers: [MessagingService],
  controllers: [MessagingController],
})
export class MessagingModule {}
