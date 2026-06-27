import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CertificatesService } from "./certificates.service";
import { CertificatesController } from "./certificates.controller";

@Module({
  imports: [PrismaModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
