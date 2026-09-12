import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { GeoScopeType, NewsCategory } from '@prisma/client';

export class QueryNewsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NewsCategory })
  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @ApiPropertyOptional({ enum: GeoScopeType })
  @IsOptional()
  @IsEnum(GeoScopeType)
  geoScopeType?: GeoScopeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;
}
