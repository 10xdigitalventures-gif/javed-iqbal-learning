import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { StorageService } from "./storage.service";
import { MediaService } from "./media.service";

@Module({
  controllers: [MediaController],
  providers: [StorageService, MediaService],
  exports: [StorageService, MediaService],
})
export class MediaModule {}
