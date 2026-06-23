import { Module } from "@nestjs/common";
import { HardCopyService } from "./hardcopy.service";
import { HardCopyController } from "./hardcopy.controller";

@Module({
  providers: [HardCopyService],
  controllers: [HardCopyController],
  exports: [HardCopyService],
})
export class HardCopyModule {}
