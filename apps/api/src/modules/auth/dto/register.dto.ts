import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { getSupportedNiches } from '@nexora/shared';

export class RegisterDto {
  /** Opcional no piloto barbearia — usa orgName como fallback */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  orgName!: string;

  /** Opcional no piloto — default 'barbearia' quando omitido */
  @IsOptional()
  @IsString()
  @IsIn(getSupportedNiches())
  niche?: string;
}
