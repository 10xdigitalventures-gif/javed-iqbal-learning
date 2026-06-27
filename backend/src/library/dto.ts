import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpdateProgressDto {
  @IsOptional() @IsInt() @Min(0) lastChapterIndex?: number;
  @IsOptional() @IsInt() @Min(0) lastPage?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) percentComplete?: number;
  @IsOptional() @IsInt() @Min(0) chaptersCompleted?: number;
  // Incremental reading time (seconds) to add to the running total.
  @IsOptional() @IsInt() @Min(0) addReadingSeconds?: number;
  // Audiobook playback resume state: chapter id + offset within it (seconds).
  @IsOptional() @IsString() lastAudioChapterId?: string;
  @IsOptional() @IsInt() @Min(0) lastAudioPositionSec?: number;
  @IsOptional() @IsBoolean() isCompleted?: boolean;
}

export class CreateBookmarkDto {
  @IsInt() page: number;
  @IsOptional() @IsString() chapterId?: string;
  @IsOptional() @IsString() label?: string;
}

export class CreateHighlightDto {
  @IsInt() page: number;
  @IsString() text: string;
  @IsOptional() @IsString() chapterId?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() position?: string;
}

export class CreateNoteDto {
  @IsInt() page: number;
  @IsString() body: string;
  @IsOptional() @IsString() chapterId?: string;
}
