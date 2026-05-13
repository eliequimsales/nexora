import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsIn(['pending', 'done'])
  status?: 'pending' | 'done';

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  assignedTo?: string | null;
}
