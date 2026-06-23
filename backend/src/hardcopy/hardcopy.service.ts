import { Injectable } from "@nestjs/common";
import { HardCopyOrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHardCopyOrderDto, UpdateHardCopyStatusDto } from "./dto";

// Physical-book delivery requests. Fulfilment is manual (admin updates status),
// so this stays independent from the digital payment/entitlement flow.
@Injectable()
export class HardCopyService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateHardCopyOrderDto) {
    return this.prisma.hardCopyOrder.create({
      data: {
        userId,
        bookId: dto.bookId ?? null,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        quantity: dto.quantity,
        notes: dto.notes ?? null,
        status: HardCopyOrderStatus.PENDING,
      },
    });
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
