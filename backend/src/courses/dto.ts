import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { LessonType } from "@prisma/client";

export class CreateCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateCourseDto extends CreateCourseDto {
  @IsOptional() declare title: string;
}

export class CreateLessonDto {
  @IsString() courseId: string;
  @IsInt() @Min(0) index: number;
  @IsString() title: string;
  @IsOptional() @IsEnum(LessonType) type?: LessonType;
  @IsOptional() @IsString() contentKey?: string;
  @IsOptional() @IsInt() durationSec?: number;
  @IsOptional() @IsBoolean() isPreview?: boolean;
}

export class CreateQuizDto {
  @IsString() courseId: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsString() title: string;
  @IsOptional() @IsInt() passScore?: number;
}

export class CreateQuizQuestionDto {
  @IsString() quizId: string;
  @IsInt() index: number;
  @IsString() prompt: string;
  // JSON-encoded array of option strings
  @IsString() options: string;
  @IsInt() answer: number;
}

export class SubmitQuizDto {
  @IsInt() score: number;
  @IsBoolean() passed: boolean;
}

export class CreateAssignmentDto {
  @IsString() courseId: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
}

export class SubmitAssignmentDto {
  @IsOptional() @IsString() contentKey?: string;
}

export class GradeSubmissionDto {
  @IsInt() grade: number;
  @IsOptional() @IsString() feedback?: string;
}
