import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class AnalyticsPeriodDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
