import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OrgNotificationsDto {
  @IsOptional()
  @IsBoolean()
  newLead?: boolean;

  @IsOptional()
  @IsBoolean()
  aiAlert?: boolean;
}

class OrgAssistantDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsIn(['formal', 'casual', 'friendly'])
  tone?: 'formal' | 'casual' | 'friendly';

  @IsOptional()
  @IsIn(['concise', 'detailed', 'empathetic'])
  style?: 'concise' | 'detailed' | 'empathetic';
}

class OrgSecretaryDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class OrgSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsIn(['pt-BR', 'en-US'])
  language?: 'pt-BR' | 'en-US';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrgNotificationsDto)
  notifications?: OrgNotificationsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrgAssistantDto)
  assistant?: OrgAssistantDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrgSecretaryDto)
  secretary?: OrgSecretaryDto;
}
