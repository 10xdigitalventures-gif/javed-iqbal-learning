import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

// A single tracked learning action. `action` is a stable verb such as
// BOOK_OPENED, CHAPTER_READ, READING_PROGRESS, LESSON_COMPLETED,
// QUIZ_ATTEMPTED, ASSIGNMENT_SUBMITTED, VIDEO_WATCHED.
export class ActivityEventDto {
  @IsString() action: string;
  // Free-form structured context (bookId, chapterId, percent, seconds, ...).
  @IsOptional() @IsObject() meta?: Record<string, any>;
  // Client timestamp (ms epoch) so offline events keep their original time.
  @IsOptional() @IsInt() at?: number;
}

export class SyncActivityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityEventDto)
  events: ActivityEventDto[];
}
