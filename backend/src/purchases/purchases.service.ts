import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentKind, PurchaseStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseDto } from "./dto";
import { PayoutsService } from "../payouts/payouts.service";

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private payouts: PayoutsService,
  ) {}

  // Create a PENDING purchase + PENDING payment. Activation happens after the
  // payment webhook confirms (or immediately in mock mode via markPaid).
  async create(clientId: string, dto: CreatePurchaseDto) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: dto.packageId },
      include: { consultants: { select: { id: true } } },
    });
    if (!pkg) throw new NotFoundException("Package not found");
    if (!pkg.isActive)
      throw new BadRequestException("This plan is no longer available");

    // Validate the plan is purchasable for the chosen consultant: a global plan
    // works with anyone, otherwise the consultant must be explicitly assigned.
    if (!pkg.isGlobal) {
      if (!dto.consultantId)
        throw new BadRequestException(
          "Select a consultant for this plan before purchasing",
        );
      const assigned = pkg.consultants.some((c) => c.id === dto.consultantId);
      if (!assigned)
        throw new ForbiddenException(
          "This plan is not offered by the selected consultant",
        );
    }

    const expiresAt = pkg.billingDays
      ? new Date(Date.now() + pkg.billingDays * 24 * 60 * 60 * 1000)
      : null;

    const purchase = await this.prisma.purchase.create({
      data: {
        clientId,
        consultantId: dto.consultantId ?? null,
        packageId: pkg.id,
        status: PurchaseStatus.PENDING,
        autoRenew: pkg.type === "MONTHLY" || pkg.type === "ANNUAL",
        textLimit: pkg.textLimit,
        audioLimit: pkg.audioLimit,
        videoLimit: pkg.videoLimit,
        sessionLimit: pkg.sessionLimit,
        sessionDuration: pkg.sessionDuration,
        audioDuration: pkg.audioDuration,
        videoDuration: pkg.videoDuration,
        textWordLimit: pkg.textWordLimit,
        consultationMode: pkg.consultationMode,
        expiresAt,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId: clientId,
        purchaseId: purchase.id,
        amount: pkg.price,
        currency: pkg.currency,
        gateway: this.defaultGateway(),
        kind:
          pkg.type === "ONE_TIME"
            ? PaymentKind.ONE_TIME
            : PaymentKind.SUBSCRIPTION,
        status: "PENDING",
        invoiceNo: this.invoiceNo(),
      },
    });

    return { purchase, payment };
  }

  // Activate a purchase once its payment is confirmed.
  async activate(purchaseId: string) {
    const purchase = await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.ACTIVE },
      include: {
        package: { select: { name: true, price: true, currency: true } },
      },
    });

    // Record a revenue payout for the selling consultant/tenant (non-fatal).
    if (purchase.tenantId && purchase.package && purchase.package.price > 0) {
      await this.payouts.recordSale({
        tenantId: purchase.tenantId,
        ownerUserId: purchase.consultantId ?? null,
        purchaseId: purchase.id,
        productKind: "PACKAGE",
        productId: purchase.packageId,
        productName: purchase.package.name,
        grossAmount: purchase.package.price,
        currency: purchase.package.currency,
      });
    }

    return purchase;
  }

  listForClient(clientId: string) {
    return this.prisma.purchase.findMany({
      where: { clientId },
      include: {
        package: true,
        consultant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listForConsultant(consultantId: string) {
    return this.prisma.purchase.findMany({
      where: { consultantId },
      include: { package: true, client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listAll() {
    return this.prisma.purchase.findMany({
      include: {
        package: true,
        client: { select: { id: true, name: true, email: true } },
        consultant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const p = await this.prisma.purchase.findUnique({
      where: { id },
      include: { package: true },
    });
    if (!p) throw new NotFoundException("Purchase not found");
    return p;
  }

  async getForUser(user: { userId: string; role: string }, id: string) {
    const purchase = await this.get(id);
    if (user.role === "ADMIN") return purchase;
    if (
      purchase.clientId === user.userId ||
      purchase.consultantId === user.userId
    ) {
      return purchase;
    }
    throw new ForbiddenException("This purchase belongs to someone else");
  }

  async cancelForUser(user: { userId: string; role: string }, id: string) {
    const purchase = await this.getForUser(user, id);
    if (user.role !== "ADMIN" && purchase.clientId !== user.userId) {
      throw new ForbiddenException(
        "Only the buyer or admin can cancel this purchase",
      );
    }
    return this.prisma.purchase.update({
      where: { id },
      data: { status: PurchaseStatus.CANCELLED, autoRenew: false },
    });
  }

  // Admin "Book a Chat" view: every one-time SINGLE consultation purchase with
  // its client, package, payment status and linked conversation status.
  listConsultations() {
    return this.prisma.purchase.findMany({
      where: { consultationMode: "SINGLE" },
      include: {
        package: { select: { name: true, consultationMode: true } },
        client: { select: { id: true, name: true, email: true } },
        consultant: { select: { id: true, name: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            invoiceNo: true,
            amount: true,
            currency: true,
          },
        },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: { id: true, status: true, lastMessageAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async cancel(id: string) {
    await this.get(id);
    return this.prisma.purchase.update({
      where: { id },
      data: { status: PurchaseStatus.CANCELLED, autoRenew: false },
    });
  }

  private invoiceNo() {
    return "INV-" + Date.now().toString(36).toUpperCase();
  }

  // Initial gateway before the client picks one at checkout. Uses the first
  // configured provider (PAYMENT_PROVIDERS) or falls back to the dev mock.
  private defaultGateway() {
    const first = (process.env.PAYMENT_PROVIDERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || "mock";
  }
}
