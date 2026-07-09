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
import { MessagingService } from "./messaging.service";
import {
  EditMessageDto,
  ReactDto,
  SendMessageDto,
  StartConversationDto,
  SubmitFeedbackDto,
  TypingDto,
} from "./dto";
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

  // Close a "Book a Chat" consultation (consultant/admin participant).
  @Post(":id/close")
  close(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.closeConsultation(user, id);
  }

  // Client leaves feedback for a completed single consultation.
  @Post(":id/feedback")
  feedback(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.service.submitFeedback(user, id, dto.rating, dto.comment);
  }

  @Patch(":id/messages/:messageId")
  edit(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.service.editMessage(user, id, messageId, dto.body);
  }

  @Delete(":id/messages/:messageId")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
  ) {
    return this.service.deleteMessage(user, id, messageId);
  }

  @Post(":id/messages/:messageId/react")
  react(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body() dto: ReactDto,
  ) {
    return this.service.reactToMessage(user, id, messageId, dto.emoji);
  }

  @Post(":id/typing")
  typing(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: TypingDto,
  ) {
    return this.service.setTyping(user, id, dto.typing !== false);
  }
}
