import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GeoScopeType } from '@prisma/client';

export class CreatePostDto {
  @ApiProperty({ example: 'Lagos State Budget 2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'The Lagos State government has announced...' })
  @IsString()
  @MinLength(10)
  body: string;

  @ApiPropertyOptional({ enum: GeoScopeType, default: GeoScopeType.NATIONAL })
  @IsOptional()
  @IsEnum(GeoScopeType)
  geoScopeType?: GeoScopeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lgaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  communityId?: string;

  @ApiPropertyOptional({ type: 'object', description: 'Media object (images, videos)' })
  @IsOptional()
  @IsObject()
  media?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}
