import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateTenantDto {
  @IsString() @MaxLength(60) slug: string;
  @IsString() @MaxLength(120) name: string;

  @IsOptional() @IsString() @MaxLength(160) customDomain?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() listed?: boolean;

  @IsOptional() @IsString() @MaxLength(120) brandName?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) logoDarkUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) faviconUrl?: string;
  @IsOptional() @IsString() @MaxLength(20) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(20) secondaryColor?: string;
  @IsOptional() @IsString() @MaxLength(20) accentColor?: string;
  @IsOptional() @IsString() @MaxLength(80) fontFamily?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(160) supportEmail?: string;

  @IsOptional() @IsObject() moduleFlags?: Record<string, boolean>;
}

export class UpdateTenantDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(160) customDomain?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() listed?: boolean;

  @IsOptional() @IsString() @MaxLength(120) brandName?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) logoDarkUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) faviconUrl?: string;
  @IsOptional() @IsString() @MaxLength(20) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(20) secondaryColor?: string;
  @IsOptional() @IsString() @MaxLength(20) accentColor?: string;
  @IsOptional() @IsString() @MaxLength(80) fontFamily?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(160) supportEmail?: string;

  @IsOptional() @IsObject() moduleFlags?: Record<string, boolean>;
}

// Constrained public payload for self-serve onboarding from the marketplace.
export class OnboardTenantDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) slug?: string;
  @IsOptional() @IsString() @MaxLength(160) supportEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) brandName?: string;
  @IsOptional() @IsString() @MaxLength(20) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
}
