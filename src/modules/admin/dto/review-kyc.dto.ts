import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewKycDto {
  @IsString()
  @IsIn(['verified', 'rejected'])
  status: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
