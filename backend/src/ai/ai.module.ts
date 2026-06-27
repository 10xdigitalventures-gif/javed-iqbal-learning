import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";
import { LibraryModule } from "../library/library.module";

@Module({
  imports: [LibraryModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
