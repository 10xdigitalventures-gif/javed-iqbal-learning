import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MediaController } from "./media.controller";
import { StorageService } from "./storage.service";
import { MediaService } from "./media.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "changeme",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  controllers: [MediaController],
  providers: [StorageService, MediaService],
  exports: [StorageService, MediaService],
})
export class MediaModule {}
