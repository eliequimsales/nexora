import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title!: string;

  @IsUUID()
  leadId!: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
