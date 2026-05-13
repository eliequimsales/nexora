import { IsOptional, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
