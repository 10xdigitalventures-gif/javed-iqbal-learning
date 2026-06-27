import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { HawwaChatDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private service: AiService) {}

  // Hawwa in-reader study companion.
  @Post("hawwa")
  hawwa(@CurrentUser() user: AuthUser, @Body() dto: HawwaChatDto) {
    return this.service.hawwa(user.userId, dto);
  }
}
