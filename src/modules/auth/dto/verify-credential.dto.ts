import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCredentialDto {
  @ApiProperty({
    description: 'Credential type',
    enum: ['pin', 'password'],
    example: 'password',
  })
  @IsNotEmpty()
  @IsIn(['pin', 'password'])
  type: 'pin' | 'password';

  @ApiProperty({
    description: 'The credential value (PIN or password)',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  credential: string;
}
