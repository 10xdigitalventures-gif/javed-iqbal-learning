import { IsEnum, IsOptional, IsString } from "class-validator";
import { LearningProductKind } from "@prisma/client";

// A single checkout order for a digital product. Exactly one id is required
// depending on `kind`.
export class CreateOrderDto {
  @IsEnum(LearningProductKind)
  kind: LearningProductKind;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsString()
  bundleId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  communityId?: string;
}
