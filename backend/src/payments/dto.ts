import { IsOptional, IsString, MaxLength } from "class-validator";

// Submitted by a buyer who paid via offline bank transfer. All fields optional
// so the user can submit a receipt image, a typed transaction id, or both.
export class BankTransferDto {
  // Stable media key returned by /media/upload for the uploaded receipt image.
  @IsOptional()
  @IsString()
  @MaxLength(400)
  proofKey?: string;

  // Name on the account the money was sent from.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  senderName?: string;

  // Bank transaction id / reference number the buyer typed in.
  @IsOptional()
  @IsString()
  @MaxLength(160)
  senderRef?: string;

  // Free-form note from the buyer (e.g. "paid from JazzCash").
  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;
}
