import { Module } from "@nestjs/common";
import { CommunitiesService } from "./communities.service";
import { CommunitiesController } from "./communities.controller";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  providers: [CommunitiesService],
  controllers: [CommunitiesController],
})
export class CommunitiesModule {}
