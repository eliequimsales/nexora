import { IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  wizardStep?: number;

  @IsOptional()
  @IsBoolean()
  wizardCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  dismissed?: boolean;
}
