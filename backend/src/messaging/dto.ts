import {
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

  @IsOptional()
  @IsInt()
  durationSec?: number;
}
