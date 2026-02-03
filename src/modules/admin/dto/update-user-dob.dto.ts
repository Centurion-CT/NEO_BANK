import { IsDateString } from 'class-validator';

export class UpdateUserDobDto {
  @IsDateString()
  dateOfBirth: string;
}
