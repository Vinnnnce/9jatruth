import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, VerificationStatus } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ enum: Role, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;

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
}
