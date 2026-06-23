import { Module } from "@nestjs/common";
import { MeetingsService } from "./meetings.service";
import { MeetingsController } from "./meetings.controller";
import { PurchasesModule } from "../purchases/purchases.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PurchasesModule, NotificationsModule],
  providers: [MeetingsService],
  controllers: [MeetingsController],
})
export class MeetingsModule {}
