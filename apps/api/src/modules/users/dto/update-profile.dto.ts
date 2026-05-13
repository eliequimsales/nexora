import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;
}
