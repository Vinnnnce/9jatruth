import { IsString, IsOptional, IsEnum, IsArray, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FactCheckStatus } from '@prisma/client';

export class CreateFactCheckDto {
  @ApiProperty({ description: 'Post ID to fact-check' })
  @IsString()
  relatedPostId: string;

  @ApiProperty({ enum: FactCheckStatus, example: FactCheckStatus.TRUE })
  @IsEnum(FactCheckStatus)
  status: FactCheckStatus;

  @ApiPropertyOptional({ type: [String], description: 'Source URLs' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  sources?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;
}
