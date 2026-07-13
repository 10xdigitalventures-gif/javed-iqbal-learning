import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PackagesModule } from "./packages/packages.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { OrdersModule } from "./orders/orders.module";
import { BooksModule } from "./books/books.module";
import { LibraryModule } from "./library/library.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { HardCopyModule } from "./hardcopy/hardcopy.module";
import { ActivityModule } from "./activity/activity.module";
import { MessagingModule } from "./messaging/messaging.module";
import { MeetingsModule } from "./meetings/meetings.module";
import { PaymentsModule } from "./payments/payments.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CommunitiesModule } from "./communities/communities.module";
import { CoursesModule } from "./courses/courses.module";
import { CertificatesModule } from "./certificates/certificates.module";
import { ReportsModule } from "./reports/reports.module";
import { SettingsModule } from "./settings/settings.module";
import { MediaModule } from "./media/media.module";
import { AiModule } from "./ai/ai.module";
import { GamificationModule } from "./gamification/gamification.module";
import { MailModule } from "./mail/mail.module";
import { StorageModule } from "./storage/storage.module";
import { SupportModule } from "./support/support.module";
import { LeadConnectorModule } from "./leadconnector/leadconnector.module";
import { GhlSyncModule } from "./ghl-sync/ghl-sync.module";
import { AttributionModule } from "./attribution/attribution.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { TenantModule } from "./tenant/tenant.module";
import { TenantContextMiddleware } from "./tenant/tenant-context.middleware";
import { AppController } from "./app.controller";
import { AuditInterceptor } from "./activity/audit.interceptor";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_SEC || 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX || 120),
      },
    ]),
    PrismaModule,
    TenantModule,
    RealtimeModule,
    MailModule,
    AuthModule,
    UsersModule,
    PackagesModule,
    PurchasesModule,
    OrdersModule,
    BooksModule,
    LibraryModule,
    SubscriptionsModule,
    HardCopyModule,
    ActivityModule,
    MessagingModule,
    MeetingsModule,
    PaymentsModule,
    NotificationsModule,
    CommunitiesModule,
    CoursesModule,
    CertificatesModule,
    ReportsModule,
    SettingsModule,
    MediaModule,
    StorageModule,
    SupportModule,
    LeadConnectorModule,
    GhlSyncModule,
    AttributionModule,
    ReconciliationModule,
    MarketplaceModule,
    PayoutsModule,
    AiModule,
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes("*");
  }
}
