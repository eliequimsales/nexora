import { IsEmail, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteUserDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email!: string;

  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}
