import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartyDto {
  @ApiProperty({ example: 'All Progressives Congress' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'APC' })
  @IsString()
  acronym: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ideology?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionFocus?: string;
}
