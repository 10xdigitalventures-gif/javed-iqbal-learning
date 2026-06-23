import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { CommunitiesService } from "./communities.service";
import {
  CreateCommentDto,
  CreateCommunityDto,
  CreatePostDto,
  UpdateCommunityDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("communities")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunitiesController {
  constructor(private service: CommunitiesService) {}

  @Get()
  list() {
    return this.service.listActive();
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.service.myCommunities(user);
  }

  @Get("all")
  @Roles(Role.ADMIN)
  all() {
    return this.service.listAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCommunityDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateCommunityDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post(":id/join")
  join(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.join(user, id);
  }

  @Post(":id/leave")
  leave(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.leave(user, id);
  }

  @Get(":id/posts")
  posts(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.listPosts(user, id);
  }

  @Post(":id/posts")
  createPost(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.service.createPost(user, id, dto);
  }

  @Post("posts/:postId/comments")
  comment(
    @CurrentUser() user: AuthUser,
    @Param("postId") postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.service.addComment(user, postId, dto);
  }
}
