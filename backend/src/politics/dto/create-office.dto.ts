import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OfficeLevel } from '@prisma/client';

export class CreateOfficeDto {
  @ApiProperty({ example: 'President' })
  @IsString()
  name: string;

  @ApiProperty({ enum: OfficeLevel, example: OfficeLevel.FEDERAL })
  @IsEnum(OfficeLevel)
  level: OfficeLevel;
}
