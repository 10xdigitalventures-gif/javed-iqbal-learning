import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto";
import {
  Paginated,
  parsePagination,
  buildOrderBy,
  searchOr,
} from "../common/list-query";

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  tenantId: true,
  scopes: true,
  isActive: true,
  title: true,
  expertise: true,
  bio: true,
  avatarUrl: true,
  maxDevices: true,
  tags: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: PUBLIC_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  // Paginated, searchable, sortable list for admin tables.
  async listPaged(opts: {
    role?: Role;
    q?: string;
    status?: string; // "active" | "inactive"
    page?: string | number;
    pageSize?: string | number;
    sort?: string;
    order?: string;
  }): Promise<Paginated<any>> {
    const where: any = {};
    if (opts.role) where.role = opts.role;
    if (opts.status === "active") where.isActive = true;
    if (opts.status === "inactive") where.isActive = false;
    const search = searchOr(opts.q, ["name", "email", "phone"]);
    if (search) Object.assign(where, search);

    const orderBy = buildOrderBy(
      opts.sort,
      opts.order,
      { name: "name", email: "email", createdAt: "createdAt" },
      { createdAt: "desc" },
    );
    const { page, pageSize, skip, take } = parsePagination(
      opts.page,
      opts.pageSize,
    );

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy,
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException("Email already in use");
    const hash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hash,
        role: dto.role,
        phone: dto.phone,
        title: dto.title,
        expertise: dto.expertise,
        bio: dto.bio,
      },
      select: PUBLIC_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.get(id);
    return this.prisma.user.update({
      where: { id },
      data: { ...dto },
      select: PUBLIC_SELECT,
    });
  }

  listTenantRoles(userId: string) {
    return (this.prisma as any).userTenantRole.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async assignTenantRole(userId: string, tenantId: string, role: Role) {
    await this.get(userId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return (this.prisma as any).userTenantRole.upsert({
      where: { userId_tenantId_role: { userId, tenantId, role } },
      create: { userId, tenantId, role },
      update: {},
    });
  }

  async removeTenantRole(userId: string, tenantId: string, role: Role) {
    await (this.prisma as any).userTenantRole.deleteMany({
      where: { userId, tenantId, role },
    });
    return { ok: true };
  }

  // Register (or clear) a user's Expo push token for mobile notifications.
  async setPushToken(id: string, token: string | null | undefined) {
    await this.prisma.user.update({
      where: { id },
      data: { pushToken: token ?? null },
    });
    return { ok: true };
  }

  async setActive(id: string, isActive: boolean) {
    await this.get(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: PUBLIC_SELECT,
    });
  }

  // Distinct list of segmentation tags currently in use (for admin pickers).
  async listTags(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { NOT: { tags: { isEmpty: true } } },
      select: { tags: true },
    });
    const set = new Set<string>();
    for (const r of rows) for (const t of r.tags) set.add(t);
    return Array.from(set).sort();
  }

  // Consultants the public/clients can browse (active only).
  listConsultants() {
    return this.prisma.user.findMany({
      where: { role: Role.CONSULTANT, isActive: true },
      select: PUBLIC_SELECT,
      orderBy: { name: "asc" },
    });
  }

  // Clients a consultant is connected to (via purchases / conversations).
  async assignedClients(consultantId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: { consultantId },
      select: { clientId: true },
    });
    const convos = await this.prisma.conversation.findMany({
      where: { consultantId },
      select: { clientId: true },
    });
    const ids = Array.from(
      new Set([
        ...purchases.map((p) => p.clientId),
        ...convos.map((c) => c.clientId),
      ]),
    );
    if (ids.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: PUBLIC_SELECT,
    });
  }
}
