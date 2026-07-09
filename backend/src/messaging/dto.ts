import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { MessageType } from "@prisma/client";

export class StartConversationDto {
  @IsString()
  consultantId: string;
}

export class SendMessageDto {
  @IsEnum(MessageType)
  type: MessageType;

  @IsOptional()
  @IsString()
  body?: string;

  // For AUDIO / VIDEO messages — the stable object key returned by
  // /media/upload (preferred). The server signs a fresh URL on read.
  @IsOptional()
  @IsString()
  mediaKey?: string;

  // Deprecated: full media URL. Still accepted for backward compatibility;
  // the server normalises it down to a stable key before storing.
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  // Original file name for IMAGE / FILE attachments (shown in the UI).
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  durationSec?: number;

  // When set, this message is a reply to an earlier message in the same
  // conversation.
  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class EditMessageDto {
  @IsString()
  body: string;
}

export class ReactDto {
  @IsString()
  emoji: string;
}

export class TypingDto {
  @IsOptional()
  @IsBoolean()
  typing?: boolean;
}

export class SubmitFeedbackDto {
  // Star rating 1-5 (clamped server-side).
  @IsInt()
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
