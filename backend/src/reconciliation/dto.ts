import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class ExternalRevenueDto {
  @IsOptional() @IsString() @MaxLength(40) source?: string;

  @IsString() @Matches(/^\d{4}-\d{2}$/) period: string;

  @IsNumber() @Min(0) amount: number;

  @IsOptional() @IsString() @MaxLength(8) currency?: string;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CloseMonthDto {
  @IsString() @Matches(/^\d{4}-\d{2}$/) period: string;
}
