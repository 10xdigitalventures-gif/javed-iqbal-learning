import { Injectable, NotFoundException } from "@nestjs/common";
import { PackageChannel, PackageType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePackageDto, UpdatePackageDto } from "./dto";

// Lightweight shape of the consultants we expose alongside a package.
const CONSULTANT_SELECT = { id: true, name: true, title: true } as const;
const INCLUDE_CONSULTANTS = {
  consultants: { select: CONSULTANT_SELECT },
} satisfies Prisma.PackageInclude;

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  // Public catalog — active packages only.
  listActive(type?: PackageType) {
    return this.prisma.package.findMany({
      where: { isActive: true, ...(type ? { type } : {}) },
      orderBy: { price: "asc" },
      include: INCLUDE_CONSULTANTS,
    });
  }

  // Active plans offered by a specific consultant: those explicitly assigned to
  // the consultant PLUS any global plans. Used on the client consultant profile
  // and the client browsing filter.
  listForConsultant(consultantId: string) {
    return this.prisma.package.findMany({
      where: {
        isActive: true,
        OR: [
          { isGlobal: true },
          { consultants: { some: { id: consultantId } } },
        ],
      },
      orderBy: { price: "asc" },
      include: INCLUDE_CONSULTANTS,
    });
  }

  // Admin — all packages.
  listAll(tenantId?: string) {
    return this.prisma.package.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
      include: INCLUDE_CONSULTANTS,
    });
  }

  async get(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: INCLUDE_CONSULTANTS,
    });
    if (!pkg) throw new NotFoundException("Package not found");
    return pkg;
  }

  create(dto: CreatePackageDto) {
    const channel = dto.channel ?? PackageChannel.COMBINED;
    const limits = this.channelLimits(channel, dto);
    return this.prisma.package.create({
      data: {
        tenantId: (dto as any).tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        channel,
        price: dto.price,
        currency: dto.currency || "PKR",
        isActive: dto.isActive ?? true,
        isGlobal: dto.isGlobal ?? false,
        ...limits,
        sessionLimit: dto.sessionLimit ?? null,
        sessionDuration: dto.sessionDuration ?? null,
        responseAllowance: dto.responseAllowance ?? null,
        textWordLimit: dto.textWordLimit ?? null,
        consultationMode: dto.consultationMode ?? "CHAT",
        billingDays: dto.billingDays ?? this.defaultBillingDays(dto.type),
        consultants: this.consultantConnect(dto),
      },
      include: INCLUDE_CONSULTANTS,
    });
  }

  async update(id: string, dto: UpdatePackageDto) {
    await this.get(id);
    const channel = dto.channel ?? PackageChannel.COMBINED;
    const limits = this.channelLimits(channel, dto);
    return this.prisma.package.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        channel,
        price: dto.price,
        currency: dto.currency || "PKR",
        isActive: dto.isActive ?? true,
        isGlobal: dto.isGlobal ?? false,
        ...limits,
        sessionLimit: dto.sessionLimit ?? null,
        sessionDuration: dto.sessionDuration ?? null,
        responseAllowance: dto.responseAllowance ?? null,
        textWordLimit: dto.textWordLimit ?? null,
        consultationMode: dto.consultationMode ?? "CHAT",
        billingDays: dto.billingDays ?? this.defaultBillingDays(dto.type),
        // `set` replaces the whole assignment list on every edit.
        consultants: {
          set: (dto.consultantIds ?? []).map((cid) => ({ id: cid })),
        },
      },
      include: INCLUDE_CONSULTANTS,
    });
  }

  async remove(id: string) {
    await this.get(id);
    // Soft-deactivate to preserve purchase history.
    return this.prisma.package.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Enforce the channel rule at write time so usage gating stays consistent:
  //   - For a single-channel plan, the other channels are forced to 0 (not
  //     allowed) regardless of what the form submitted.
  //   - For COMBINED, the per-channel limits are taken as-is (null = unlimited,
  //     0 = not allowed, n = n allowed).
  // `undefined` is normalized to null (unlimited) for the active channel(s).
  private channelLimits(
    channel: PackageChannel,
    dto: CreatePackageDto,
  ): {
    textLimit: number | null;
    audioLimit: number | null;
    videoLimit: number | null;
    audioDuration: number | null;
    videoDuration: number | null;
  } {
    const norm = (v: number | null | undefined) => (v === undefined ? null : v);
    const allowsText = channel === "TEXT" || channel === "COMBINED";
    const allowsAudio = channel === "AUDIO" || channel === "COMBINED";
    const allowsVideo = channel === "VIDEO" || channel === "COMBINED";
    return {
      textLimit: allowsText ? norm(dto.textLimit) : 0,
      audioLimit: allowsAudio ? norm(dto.audioLimit) : 0,
      videoLimit: allowsVideo ? norm(dto.videoLimit) : 0,
      audioDuration: allowsAudio ? norm(dto.audioDuration) : null,
      videoDuration: allowsVideo ? norm(dto.videoDuration) : null,
    };
  }

  private consultantConnect(dto: CreatePackageDto) {
    const ids = dto.consultantIds ?? [];
    if (ids.length === 0) return undefined;
    return { connect: ids.map((cid) => ({ id: cid })) };
  }

  private defaultBillingDays(type: PackageType): number | null {
    if (type === PackageType.MONTHLY) return 30;
    if (type === PackageType.ANNUAL) return 365;
    return null;
  }
}
