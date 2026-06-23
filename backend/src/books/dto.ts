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
import { AccessType } from "@prisma/client";

export class CreateCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class CreateBookDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() author?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsInt() pageCount?: number;
  @IsOptional() @IsString() categoryId?: string;

  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(0) hardCopyPrice?: number;
  @IsOptional() @IsBoolean() allowHardCopy?: boolean;

  @IsOptional() @IsEnum(AccessType) accessType?: AccessType;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isPublished?: boolean;

  @IsOptional() @IsString() contentKey?: string;
  @IsOptional() @IsString() previewContentKey?: string;
}

export class UpdateBookDto extends CreateBookDto {
  @IsOptional() declare title: string;
}

export class CreateChapterDto {
  @IsInt() index: number;
  @IsString() title: string;
  @IsOptional() @IsString() contentKey?: string;
  @IsOptional() @IsInt() pageStart?: number;
  @IsOptional() @IsInt() pageEnd?: number;
}

export class CreateBundleDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsArray() bookIds?: string[];
}

export class UpdateBundleDto extends CreateBundleDto {
  @IsOptional() declare title: string;
}
