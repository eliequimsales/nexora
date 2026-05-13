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

  @IsOptional()
  @IsIn(['manual', 'form', 'import', 'api'])
  source?: string;

  @IsOptional()
  @IsUUID()
  pipelineStageId?: string;
}
