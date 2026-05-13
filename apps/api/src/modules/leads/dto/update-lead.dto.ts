import { IsString, IsEmail, IsOptional, IsUUID, IsIn, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsIn(['new', 'contacted', 'qualified', 'disqualified', 'closed_won', 'closed_lost'])
  status?: string;

  @IsOptional()
  @IsUUID()
  pipelineStageId?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
