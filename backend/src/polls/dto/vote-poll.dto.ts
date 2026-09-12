import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VotePollDto {
  @ApiProperty({ description: 'The option ID to vote for' })
  @IsString()
  optionId: string;
}
