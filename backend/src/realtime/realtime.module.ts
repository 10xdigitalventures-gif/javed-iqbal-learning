import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeService } from "./realtime.service";
import { RealtimeController } from "./realtime.controller";

// Global so any feature module can inject RealtimeService without re-importing.
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
    }),
  ],
  providers: [RealtimeService],
  controllers: [RealtimeController],
  exports: [RealtimeService],
})
export class RealtimeModule {}
