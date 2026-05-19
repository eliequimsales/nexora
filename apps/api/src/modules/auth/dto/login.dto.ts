import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** Opcional — quando omitido, o sistema resolve o workspace pelo email. */
  @IsOptional()
  @IsString()
  slug?: string;
}
