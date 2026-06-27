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
import { SubscriptionInterval } from "@prisma/client";

export class CreatePlanDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(SubscriptionInterval) interval: SubscriptionInterval;
  // null/omitted = lifetime. Admin-configurable access duration in days.
  @IsOptional() @IsInt() @Min(1) durationDays?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() features?: string[];
}

export class ChangePlanDto {
  // Display currency only; the charge is always in the plan's own currency.
  @IsOptional() @IsString() currency?: string;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(SubscriptionInterval) interval?: SubscriptionInterval;
  @IsOptional() @IsInt() @Min(1) durationDays?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() features?: string[];
}
