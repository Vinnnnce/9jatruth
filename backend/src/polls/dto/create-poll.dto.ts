import { IsString, IsOptional, IsEnum, IsDateString, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GeoScopeType } from '@prisma/client';

export class CreatePollDto {
  @ApiProperty({ example: 'Who will win the 2027 presidential election?' })
  @IsString()
  question: string;

  @ApiProperty({ type: [String], example: ['APC', 'PDP', 'LP', 'NNPP'], description: 'Poll options' })
  @IsArray()
  @ArrayMinSize(2)
  options: string[];

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

  @ApiProperty({ example: '2026-01-01T00:00:00Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z' })
  @IsDateString()
  endAt: string;
}
