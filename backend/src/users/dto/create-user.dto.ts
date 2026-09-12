import { IsString, IsOptional, MinLength, MaxLength, IsEmail, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, VerificationStatus } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

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
