import { IsString, IsOptional, IsEnum, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfficeLevel, ElectionStatus } from '@prisma/client';

export class CreateElectionDto {
  @ApiProperty({ example: '2027 General Elections' })
  @IsString()
  name: string;

  @ApiProperty({ example: '2027-02-20' })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: OfficeLevel })
  @IsEnum(OfficeLevel)
  level: OfficeLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  geoScope?: string;

  @ApiPropertyOptional({ type: [String], description: 'Office IDs involved' })
  @IsOptional()
  @IsArray()
  officesInvolved?: string[];

  @ApiPropertyOptional({ enum: ElectionStatus })
  @IsOptional()
  @IsEnum(ElectionStatus)
  status?: ElectionStatus;
}
