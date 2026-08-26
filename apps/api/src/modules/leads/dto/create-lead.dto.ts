import { IsString, IsEmail, IsOptional, IsUUID, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // Observação livre do usuário. Persistida em nicheData.notes (sem coluna própria).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  notes?: string;

  @IsOptional()
  @IsIn(['manual', 'form', 'import', 'api'])
  source?: string;

  @IsOptional()
  @IsUUID()
  pipelineStageId?: string;
}
