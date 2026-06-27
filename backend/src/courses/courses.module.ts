import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CertificatesModule } from "../certificates/certificates.module";
import { CoursesService } from "./courses.service";
import { CoursesController } from "./courses.controller";

@Module({
  imports: [PrismaModule, CertificatesModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
