import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  LessonType,
  LessonSource,
  SubmissionStatus,
  ModuleLockMode,
  QuizQuestionType,
} from "@prisma/client";

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

// ---- Modules (sections) ----
export class CreateModuleDto {
  @IsString() courseId: string;
  @IsString() title: string;
  @IsInt() @Min(0) index: number;
  // SINGLE = open when previous module completed; BOTH = + time delay elapsed.
  @IsOptional() @IsEnum(ModuleLockMode) lockMode?: ModuleLockMode;
  @IsOptional() @IsInt() @Min(0) unlockDelayHours?: number;
}

export class UpdateModuleDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() @Min(0) index?: number;
  @IsOptional() @IsEnum(ModuleLockMode) lockMode?: ModuleLockMode;
  @IsOptional() @IsInt() @Min(0) unlockDelayHours?: number;
}

export class CreateLessonDto {
  @IsString() courseId: string;
  @IsInt() @Min(0) index: number;
  @IsString() title: string;
  @IsOptional() @IsEnum(LessonType) type?: LessonType;
  // Optional module (section) this lesson belongs to.
  @IsOptional() @IsString() moduleId?: string;
  // SINGLE = open when previous lesson completed; BOTH = + time delay elapsed.
  @IsOptional() @IsEnum(ModuleLockMode) lockMode?: ModuleLockMode;
  @IsOptional() @IsInt() @Min(0) unlockDelayHours?: number;
  // Storage key when the video was uploaded to the bucket (source = UPLOAD/MEDIA).
  @IsOptional() @IsString() contentKey?: string;
  // External streaming/embed URL (YouTube, Vimeo, direct mp4) when source = LINK.
  @IsOptional() @IsString() videoUrl?: string;
  // Optional per-lesson thumbnail (URL or storage key).
  @IsOptional() @IsString() thumbnailUrl?: string;
  // UPLOAD (bucket) | LINK (external) | MEDIA (picked from media library).
  @IsOptional() @IsEnum(LessonSource) source?: LessonSource;
  @IsOptional() @IsInt() durationSec?: number;
  @IsOptional() @IsBoolean() isPreview?: boolean;
}

// Partial update for an existing lesson (module assignment, lock config, etc.).
export class UpdateLessonDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() @Min(0) index?: number;
  @IsOptional() @IsEnum(LessonType) type?: LessonType;
  // Pass an empty string to detach the lesson from its module.
  @IsOptional() @IsString() moduleId?: string;
  @IsOptional() @IsEnum(ModuleLockMode) lockMode?: ModuleLockMode;
  @IsOptional() @IsInt() @Min(0) unlockDelayHours?: number;
  @IsOptional() @IsString() contentKey?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsEnum(LessonSource) source?: LessonSource;
  @IsOptional() @IsInt() durationSec?: number;
  @IsOptional() @IsBoolean() isPreview?: boolean;
}

export class CreateQuizDto {
  @IsString() courseId: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsString() title: string;
  @IsOptional() @IsInt() passScore?: number;
  // Optional whole-quiz countdown in seconds.
  @IsOptional() @IsInt() timeLimitSec?: number;
  // Allowed attempts (0 = unlimited).
  @IsOptional() @IsInt() maxAttempts?: number;
  // Randomize question + option order.
  @IsOptional() @IsBoolean() shuffle?: boolean;
}

export class UpdateQuizDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() passScore?: number;
  @IsOptional() @IsInt() timeLimitSec?: number;
  @IsOptional() @IsInt() maxAttempts?: number;
  @IsOptional() @IsBoolean() shuffle?: boolean;
}

export class CreateQuizQuestionDto {
  @IsString() quizId: string;
  @IsInt() index: number;
  @IsString() prompt: string;
  // JSON-encoded array of option strings
  @IsString() options: string;
  // Correct option index (SINGLE / TRUE_FALSE).
  @IsInt() answer: number;
  @IsOptional() @IsEnum(QuizQuestionType) type?: QuizQuestionType;
  @IsOptional() @IsInt() points?: number;
  @IsOptional() @IsString() explanation?: string;
  // JSON-encoded array of correct option indices (MULTI).
  @IsOptional() @IsString() correct?: string;
}

export class UpdateQuizQuestionDto {
  @IsOptional() @IsInt() index?: number;
  @IsOptional() @IsString() prompt?: string;
  @IsOptional() @IsString() options?: string;
  @IsOptional() @IsInt() answer?: number;
  @IsOptional() @IsEnum(QuizQuestionType) type?: QuizQuestionType;
  @IsOptional() @IsInt() points?: number;
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsString() correct?: string;
}

export class SubmitQuizDto {
  // Preferred: selected answer per question. For SINGLE / TRUE_FALSE this is an
  // option index; for MULTI it is an array of selected indices. The server
  // grades authoritatively and records answers for later review.
  @IsOptional() @IsArray() answers?: Array<number | number[]>;
  // How long the learner took, in seconds.
  @IsOptional() @IsInt() timeTakenSec?: number;
  // Legacy client-computed values, still accepted as a fallback.
  @IsOptional() @IsInt() score?: number;
  @IsOptional() @IsBoolean() passed?: boolean;
}

export class LessonProgressDto {
  // Fraction of the lesson watched, 0..1.
  @IsNumber() @Min(0) progress: number;
  // Optional last playback position in seconds, for resume-where-you-left-off.
  @IsOptional() @IsInt() @Min(0) positionSec?: number;
}

// ---- Engagement (Phase 8) ----
export class ReviewDto {
  // Star rating 1..5.
  @IsInt() @Min(1) rating: number;
  @IsOptional() @IsString() comment?: string;
}

export class CreateLessonNoteDto {
  @IsString() lessonId: string;
  @IsString() body: string;
  // Optional video timestamp (seconds) the note is anchored to.
  @IsOptional() @IsInt() @Min(0) positionSec?: number;
}

export class UpdateLessonNoteDto {
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsInt() @Min(0) positionSec?: number;
}

export class AskQuestionDto {
  @IsString() lessonId: string;
  @IsString() body: string;
}

export class AnswerQuestionDto {
  @IsString() body: string;
}

export class CreateAssignmentDto {
  @IsString() courseId: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  // Link this assignment to an ASSIGNMENT-type lesson.
  @IsOptional() @IsString() lessonId?: string;
  // JSON-encoded array of instructor reference files: [{ key, name, size }].
  @IsOptional() @IsString() attachments?: string;
}

export class UpdateAssignmentDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsOptional() @IsString() attachments?: string;
}

export class SubmitAssignmentDto {
  // The learner's typed answer.
  @IsOptional() @IsString() answerText?: string;
  // JSON-encoded array of submitted files: [{ key, name, size }].
  @IsOptional() @IsString() attachments?: string;
  // Legacy single-file key.
  @IsOptional() @IsString() contentKey?: string;
}

export class GradeSubmissionDto {
  @IsOptional() @IsInt() grade?: number;
  @IsOptional() @IsString() feedback?: string;
  // Defaults to APPROVED when omitted.
  @IsOptional() @IsEnum(SubmissionStatus) status?: SubmissionStatus;
}
