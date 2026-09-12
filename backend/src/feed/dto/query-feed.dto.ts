import { IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { GeoScopeType } from '@prisma/client';

export class QueryFeedDto extends PaginationDto {
  @ApiPropertyOptional({ enum: GeoScopeType })
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

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Search query for title/body' })
  @IsOptional()
  @IsString()
  search?: string;
}
