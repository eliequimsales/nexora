import { IsOptional, IsIn, IsString, MaxLength, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLeadsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['new', 'contacted', 'qualified', 'disqualified', 'closed_won', 'closed_lost'])
  status?: string;

  @IsOptional()
  @IsIn(['hot', 'warm', 'cold'])
  classification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
