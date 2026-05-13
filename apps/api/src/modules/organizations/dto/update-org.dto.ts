import { IsString, IsOptional, MaxLength, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrgSettingsDto } from './org-settings.dto';

class AiPromptsDto {
  @IsOptional()
  @IsString()
  classify?: string;

  @IsOptional()
  @IsString()
  respond?: string;

  @IsOptional()
  @IsString()
  followUp?: string;
}

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrgSettingsDto)
  settings?: OrgSettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AiPromptsDto)
  aiPrompts?: AiPromptsDto;
}
