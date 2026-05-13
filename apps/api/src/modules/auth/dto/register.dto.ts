import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { getSupportedNiches } from '@reshit/shared';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

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

  @IsString()
  @IsIn(getSupportedNiches())
  niche!: string;
}
