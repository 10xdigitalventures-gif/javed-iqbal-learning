import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CommissionStatus } from "@prisma/client";

export class TrackDto {
  @IsOptional() @IsString() @MaxLength(60) code?: string;
}

export class CommissionStatusDto {
  @IsEnum(CommissionStatus) status: CommissionStatus;
}
