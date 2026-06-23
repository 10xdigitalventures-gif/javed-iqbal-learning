import { IsOptional, IsString } from "class-validator";

export class CreatePurchaseDto {
  @IsString()
  packageId: string;

  // The consultant this purchase is tied to (for one-to-one consultation).
  @IsOptional()
  @IsString()
  consultantId?: string;
}
