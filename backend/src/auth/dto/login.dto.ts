import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com', description: 'Email or phone number' })
  @IsString()
  @MinLength(3)
  emailOrPhone: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(1)
  password: string;
}
