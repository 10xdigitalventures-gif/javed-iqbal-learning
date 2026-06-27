import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class HawwaMessageDto {
  @IsIn(["user", "assistant"])
  role: "user" | "assistant";

  @IsString()
  content: string;
}

export class HawwaChatDto {
  // The book the reader is currently inside (used to ground answers in the
  // actual chapter text the user has access to). Optional — Hawwa also works
  // as a general study companion when no book is open.
  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsOptional()
  @IsString()
  chapterTitle?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HawwaMessageDto)
  messages: HawwaMessageDto[];
}
