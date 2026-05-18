import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class NexoraRecoverySettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(180)
  inactivityDays?: number; // Dias sem atividade para considerar cliente inativo (default: 30)

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  avgTicket?: number; // Ticket médio R$ (default: 80) — usado em "Receita potencial"

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsappTemplate?: string; // Mensagem template para WhatsApp

  @IsOptional()
  @IsString()
  @MaxLength(500)
  emailTemplate?: string; // Mensagem template para Email

  @IsOptional()
  @IsString()
  zapiApiKey?: string; // Chave de API do Z-API (criptografada)

  @IsOptional()
  @IsString()
  resendApiKey?: string; // Chave de API do Resend (criptografada)

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean; // Se WhatsApp está habilitado

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean; // Se Email está habilitado
}

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

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NexoraRecoverySettingsDto)
  nexoraRecovery?: NexoraRecoverySettingsDto;
}
