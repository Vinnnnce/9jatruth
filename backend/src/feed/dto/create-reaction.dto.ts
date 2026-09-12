import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';

export class CreateReactionDto {
  @ApiProperty({ enum: ReactionType, example: ReactionType.LIKE })
  @IsEnum(ReactionType)
  type: ReactionType;
}
