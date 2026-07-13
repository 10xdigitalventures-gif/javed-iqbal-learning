import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { ConsultationMode, PackageChannel, PackageType } from "@prisma/client";

export class CreatePackageDto {
  @IsOptional() @IsString() tenantId?: string;
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PackageType)
  type: PackageType;

  // Communication channel this plan unlocks. Defaults to COMBINED.
  @IsOptional()
  @IsEnum(PackageChannel)
  channel?: PackageChannel;

  // When true the plan is available with every consultant.
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  // Consultant user ids this plan is assigned to (ignored when isGlobal).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consultantIds?: string[];

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  textLimit?: number;

  @IsOptional()
  @IsNumber()
  audioLimit?: number;

  @IsOptional()
  @IsNumber()
  videoLimit?: number;

  @IsOptional()
  @IsNumber()
  sessionLimit?: number;

  @IsOptional()
  @IsNumber()
  sessionDuration?: number;

  @IsOptional()
  @IsNumber()
  audioDuration?: number;

  @IsOptional()
  @IsNumber()
  videoDuration?: number;

  @IsOptional()
  @IsNumber()
  responseAllowance?: number;

  // Max words per text message (null/omitted = unlimited).
  @IsOptional()
  @IsNumber()
  textWordLimit?: number;

  // Ongoing chat vs one-time "Book a Chat" submission.
  @IsOptional()
  @IsEnum(ConsultationMode)
  consultationMode?: ConsultationMode;

  @IsOptional()
  @IsNumber()
  billingDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePackageDto extends CreatePackageDto {}
