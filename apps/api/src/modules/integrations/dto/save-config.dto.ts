import { IsString, IsIn, IsObject, IsBoolean, IsOptional } from 'class-validator';

export class SaveConfigDto {
  @IsIn(['whatsapp', 'email'])
  channel!: 'whatsapp' | 'email';

  // Plain JSON config — service encrypts before storage
  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
