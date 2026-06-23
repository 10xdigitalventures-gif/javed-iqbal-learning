import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser, isAdmin } from "../common/access";
import {
  CreateCommentDto,
  CreateCommunityDto,
  CreatePostDto,
  UpdateCommunityDto,
} from "./dto";

@Injectable()
export class CommunitiesService {
  constructor(private prisma: PrismaService) {}

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

  async join(user: AuthUser, communityId: string) {
    await this.get(communityId);
    return this.prisma.communityMember.upsert({
      where: {
        communityId_userId: { communityId, userId: user.userId },
      },
      update: {},
      create: { communityId, userId: user.userId },
    });
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

  async createPost(
    user: AuthUser,
    communityId: string,
    dto: CreatePostDto,
  ) {
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
