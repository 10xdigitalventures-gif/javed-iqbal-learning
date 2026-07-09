import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  HardCopyOrderStatus,
  PaymentKind,
  PaymentStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHardCopyOrderDto, UpdateHardCopyStatusDto } from "./dto";

// Maps the checkout payment method to a gateway. "cod" has no gateway (it needs
// no Payment row); "bank_transfer" reuses the manual proof/verify flow; the two
// online gateways drive the existing hosted checkout + webhook flow.
const GATEWAY_BY_METHOD: Record<string, string> = {
  payfast: "gopayfast",
  whop: "whop",
  bank_transfer: "bank_transfer",
};

// Physical-book delivery requests. Fulfilment is manual (admin updates status).
// Payment is real: cash-on-delivery collects nothing up front, every other
// method settles through a Payment row so PayFast/Whop/Bank-transfer all work
// exactly like a digital order.
@Injectable()
export class HardCopyService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateHardCopyOrderDto) {
    const method = (dto.paymentMethod || "cod").toLowerCase();

    // Price the physical order from the book hardCopyPrice (server is the source
    // of truth) x quantity.
    let unitPrice = 0;
    let currency = "PKR";
    if (dto.bookId) {
      const book = await this.prisma.book.findUnique({
        where: { id: dto.bookId },
        select: { allowHardCopy: true, hardCopyPrice: true, currency: true },
      });
      if (!book || !book.allowHardCopy)
        throw new NotFoundException("Hard copy is not available for this book");
      unitPrice = book.hardCopyPrice ?? 0;
      currency = book.currency || "PKR";
    }
    const amount = Math.round(unitPrice * dto.quantity * 100) / 100;

    // Online gateways need a real price to charge.
    if (method !== "cod" && amount <= 0)
      throw new BadRequestException(
        "This book has no hard copy price set, so only Cash on Delivery is available.",
      );

    const order = await this.prisma.hardCopyOrder.create({
      data: {
        userId,
        bookId: dto.bookId ?? null,
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        address: dto.address,
        addressLine2: dto.addressLine2 ?? null,
        city: dto.city,
        state: dto.state ?? null,
        country: dto.country ?? null,
        quantity: dto.quantity,
        paymentMethod: method,
        amount,
        currency,
        notes: dto.notes ?? null,
        status: HardCopyOrderStatus.PENDING,
      },
    });

    // Cash on delivery: collect nothing now, so no Payment is created.
    if (method === "cod") {
      return { order, paymentMethod: "cod" };
    }

    // Every other method settles through a Payment row.
    const gateway = GATEWAY_BY_METHOD[method] || "bank_transfer";
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        hardCopyOrderId: order.id,
        amount,
        currency,
        gateway,
        kind: PaymentKind.ONE_TIME,
        status: PaymentStatus.PENDING,
        invoiceNo: "HC-" + Date.now().toString(36).toUpperCase(),
      },
    });

    return { order, payment, paymentMethod: method };
  }

  listForUser(userId: string) {
    return this.prisma.hardCopyOrder.findMany({
      where: { userId },
      include: { book: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listAll() {
    return this.prisma.hardCopyOrder.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  updateStatus(id: string, dto: UpdateHardCopyStatusDto) {
    return this.prisma.hardCopyOrder.update({
      where: { id },
      data: { status: dto.status, notes: dto.notes ?? undefined },
    });
  }
}
