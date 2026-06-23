import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { SendMessageDto, StartConversationDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private service: MessagingService) {}

  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto) {
    return this.service.startConversation(user.userId, dto.consultantId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listConversations(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.getConversation(user, id);
  }

  @Post(":id/messages")
  send(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(user, id, dto);
  }

  @Post(":id/read")
  read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.markRead(user, id);
  }
}
