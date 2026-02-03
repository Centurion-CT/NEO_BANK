import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsIn } from 'class-validator';

/**
 * Create Support Request DTO
 */
export class CreateSupportRequestDto {
  @ApiProperty({
    description: 'Subject of the support request',
    example: 'Unable to complete transaction',
    minLength: 5,
    maxLength: 200,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Detailed message describing the issue',
    example: 'I tried to send money to another account but the transaction keeps failing with an error.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    description: 'Category of the support request',
    example: 'transactions',
    enum: ['account', 'transactions', 'security', 'general'],
  })
  @IsString()
  @IsIn(['account', 'transactions', 'security', 'general'])
  category: string;
}
