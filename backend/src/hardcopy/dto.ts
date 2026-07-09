import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { HardCopyOrderStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class CreateHardCopyOrderDto {
  @IsOptional() @IsString() bookId?: string;
  @IsString() @MaxLength(120) name: string;
  // WhatsApp / contact number (stored in `phone`).
  @IsString() @MaxLength(30) phone: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  // Address line 1 (street & area).
  @IsString() @MaxLength(400) address: string;
  // Address line 2 (apartment & suite no).
  @IsOptional() @IsString() @MaxLength(400) addressLine2?: string;
  @IsString() @MaxLength(120) city: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(120) country?: string;
  @IsInt() @Min(1) quantity: number;
  // "payfast" | "whop" | "bank_transfer" | "cod".
  @IsOptional() @IsString() @MaxLength(30) paymentMethod?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateHardCopyStatusDto {
  @IsEnum(HardCopyOrderStatus) status: HardCopyOrderStatus;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
