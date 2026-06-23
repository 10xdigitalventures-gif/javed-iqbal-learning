import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { HardCopyOrderStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class CreateHardCopyOrderDto {
  @IsOptional() @IsString() bookId?: string;
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(30) phone: string;
  @IsString() @MaxLength(400) address: string;
  @IsString() @MaxLength(120) city: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateHardCopyStatusDto {
  @IsEnum(HardCopyOrderStatus) status: HardCopyOrderStatus;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
