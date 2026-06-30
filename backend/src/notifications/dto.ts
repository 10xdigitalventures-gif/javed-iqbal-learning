import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdatePreferenceDto {
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutedTypes?: string[];
}

export class BroadcastDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  body?: string;

  // "all" = every active user, "tag" = users with the given tag,
  // "purchase" = users who have made a purchase (optionally within a range).
  @IsString()
  segment: string;

  @IsOptional()
  @IsString()
  tag?: string;

  // ISO date strings used when segment = "purchase".
  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  until?: string;
}

export class ScheduleBroadcastDto extends BroadcastDto {
  // "once" = fire a single time at runAt; "daily" = every day at runAt's time.
  @IsString()
  scheduleType: string;

  // ISO datetime of the first (or only) run.
  @IsString()
  runAt: string;
}
