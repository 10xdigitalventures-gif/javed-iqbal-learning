import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { SupportCategory, SupportTicketStatus } from "@prisma/client";

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject: string;

  @IsEnum(SupportCategory)
  category: SupportCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}

export class ReplyTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}

export class AssignTicketDto {
  // The staff user (ADMIN or SUPPORT) to assign this ticket to. Pass null/empty
  // to unassign.
  @IsString()
  assigneeId: string;
}
