import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  onModuleInit() {
    // Connect in the background so Nest finishes bootstrapping and the HTTP
    // server calls listen() immediately. Passenger/Hostinger abort startup if
    // the app has not listened within 3 seconds; Prisma also connects lazily on
    // the first query, so queued queries still succeed if this resolves later.
    void this.$connect().catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
