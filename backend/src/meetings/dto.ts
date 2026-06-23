import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class AvailabilitySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  startTime: string; // "09:00"

  @IsString()
  endTime: string; // "17:00"
}

export class SetAvailabilityDto {
  @IsArray()
  slots: AvailabilitySlotDto[];
}

export class BookMeetingDto {
  @IsString()
  consultantId: string;

  @IsString()
  title: string;

  @IsString()
  scheduledAt: string; // ISO datetime

  @IsOptional()
  @IsInt()
  durationMin?: number;

  @IsOptional()
  @IsString()
  purchaseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RescheduleDto {
  @IsString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  durationMin?: number;
}
