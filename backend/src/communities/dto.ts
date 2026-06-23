import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateCommunityDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateCommunityDto extends CreateCommunityDto {}

export class CreatePostDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}

export class CreateCommentDto {
  @IsString()
  body: string;
}
