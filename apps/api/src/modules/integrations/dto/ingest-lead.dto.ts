import { IsString, IsEmail, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class IngestLeadDto {
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
  @IsObject()
  nicheData?: Record<string, unknown>;
}
