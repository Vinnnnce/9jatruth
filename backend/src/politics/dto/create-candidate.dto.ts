import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCandidateDto {
  @ApiProperty({ example: 'Bola Ahmed Tinubu' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Party ID' })
  @IsString()
  partyId: string;

  @ApiProperty({ description: 'Office ID' })
  @IsString()
  officeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manifesto?: string;

  @ApiPropertyOptional({ type: [String], description: 'Media links array' })
  @IsOptional()
  @IsArray()
  mediaLinks?: string[];
}
