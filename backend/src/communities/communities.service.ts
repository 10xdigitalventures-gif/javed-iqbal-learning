import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LearningProductKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { AuthUser, isAdmin } from "../common/access";
import {
  CreateCommentDto,
  CreateCommunityDto,
  CreateCommunityOfferDto,
  CreatePostDto,
  UpdateCommunityDto,
  UpdateCommunityOfferDto,
} from "./dto";

@Injectable()
export class CommunitiesService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  // --- Admin management ---
  listAll() {
    return this.prisma.community.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true, posts: true } } },
    });
  }

  create(dto: CreateCommunityDto) {
    return this.prisma.community.create({
      data: {
        name: dto.name,
        description: dto.description,
        isPaid: dto.isPaid ?? false,
        price: dto.price ?? 0,
        currency: dto.currency || "PKR",
      },
    });
  }

  async update(id: string, dto: UpdateCommunityDto) {
    await this.get(id);
    return this.prisma.community.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isPaid: dto.isPaid ?? false,
        price: dto.price ?? 0,
        currency: dto.currency || "PKR",
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    return this.prisma.community.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // --- Public / member ---
  listActive() {
    return this.prisma.community.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true, posts: true } } },
    });
  }

  async get(id: string) {
    const c = await this.prisma.community.findUnique({
      where: { id },
      include: { _count: { select: { members: true, posts: true } } },
    });
    if (!c) throw new NotFoundException("Community not found");
    return c;
  }

  // Join a community. Free communities (and admins) join immediately. Paid
  // communities return a paymentId so the client can route to the existing
  // gateway-selection checkout; membership is granted by OrdersService.fulfill()
  // once the payment webhook confirms.
  async join(user: AuthUser, communityId: string) {
    const community = await this.get(communityId);

    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: user.userId } },
    });
    if (existing) return { joined: true, membership: existing };

    if (isAdmin(user) || !community.isPaid || community.price <= 0) {
      const membership = await this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId, userId: user.userId } },
        update: {},
        create: { communityId, userId: user.userId },
      });
      return { joined: true, membership };
    }

    const { order, payment, itemName } = await this.orders.create(user.userId, {
      kind: LearningProductKind.COMMUNITY,
      communityId,
    });
    return {
      joined: false,
      requiresPayment: true,
      paymentId: payment.id,
      orderId: order.id,
      amount: payment.amount,
      currency: payment.currency,
      itemName,
    };
  }

  async leave(user: AuthUser, communityId: string) {
    await this.prisma.communityMember.deleteMany({
      where: { communityId, userId: user.userId },
    });
    return { ok: true };
  }

  async myCommunities(user: AuthUser) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId: user.userId },
      include: {
        community: {
          include: { _count: { select: { members: true, posts: true } } },
        },
      },
    });
    return memberships.map((m) => m.community);
  }

  async isMember(user: AuthUser, communityId: string) {
    if (isAdmin(user)) return true;
    const m = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: user.userId } },
    });
    return Boolean(m);
  }

  // --- Feed ---
  async listPosts(user: AuthUser, communityId: string) {
    if (!(await this.isMember(user, communityId)))
      throw new ForbiddenException("Join this community to view its feed");
    return this.prisma.communityPost.findMany({
      where: { communityId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async createPost(user: AuthUser, communityId: string, dto: CreatePostDto) {
    if (!(await this.isMember(user, communityId)))
      throw new ForbiddenException("Join this community to post");
    return this.prisma.communityPost.create({
      data: {
        communityId,
        authorId: user.userId,
        body: dto.body,
        mediaUrl: dto.mediaUrl,
      },
    });
  }

  // --- Community access plans (offers) ---
  listOffers(communityId: string) {
    return this.prisma.communityOffer.findMany({
      where: { communityId },
      orderBy: [{ index: "asc" }, { createdAt: "asc" }],
    });
  }

  listAllActiveOffers() {
    return this.prisma.communityOffer.findMany({
      where: { isActive: true, community: { isActive: true } },
      orderBy: [{ index: "asc" }, { createdAt: "asc" }],
      include: {
        community: { select: { id: true, name: true, description: true } },
      },
    });
  }

  private async getOffer(id: string) {
    const o = await this.prisma.communityOffer.findUnique({ where: { id } });
    if (!o) throw new NotFoundException("Community plan not found");
    return o;
  }

  createOffer(dto: CreateCommunityOfferDto) {
    return this.prisma.communityOffer.create({
      data: {
        communityId: dto.communityId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price ?? 0,
        currency: dto.currency || "PKR",
        accessDurationDays: dto.accessDurationDays ?? null,
        isActive: dto.isActive ?? true,
        index: dto.index ?? 0,
      },
    });
  }

  async updateOffer(id: string, dto: UpdateCommunityOfferDto) {
    await this.getOffer(id);
    return this.prisma.communityOffer.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        accessDurationDays: dto.accessDurationDays,
        isActive: dto.isActive,
        index: dto.index,
      },
    });
  }

  async removeOffer(id: string) {
    await this.getOffer(id);
    return this.prisma.communityOffer.delete({ where: { id } });
  }

  // Buy a community access plan. Free plans (and admins) join immediately; paid
  // plans return a paymentId so the client routes to the gateway checkout.
  async buyOffer(user: AuthUser, offerId: string) {
    const offer = await this.getOffer(offerId);
    if (!offer.isActive) throw new NotFoundException("Plan not available");
    const existing = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: offer.communityId,
          userId: user.userId,
        },
      },
    });
    if (existing) return { joined: true, membership: existing };
    if (isAdmin(user) || offer.price <= 0) {
      const membership = await this.prisma.communityMember.upsert({
        where: {
          communityId_userId: {
            communityId: offer.communityId,
            userId: user.userId,
          },
        },
        update: {},
        create: { communityId: offer.communityId, userId: user.userId },
      });
      return { joined: true, membership };
    }
    const { order, payment, itemName } = await this.orders.create(user.userId, {
      kind: LearningProductKind.COMMUNITY,
      communityId: offer.communityId,
      offerId: offer.id,
    });
    return {
      joined: false,
      requiresPayment: true,
      paymentId: payment.id,
      orderId: order.id,
      amount: payment.amount,
      currency: payment.currency,
      itemName,
    };
  }

  async addComment(user: AuthUser, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException("Post not found");
    if (!(await this.isMember(user, post.communityId)))
      throw new ForbiddenException("Join this community to comment");
    return this.prisma.communityComment.create({
      data: { postId, authorId: user.userId, body: dto.body },
    });
  }
}
