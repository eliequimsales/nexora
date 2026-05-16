import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

/**
 * Body do endpoint POST /leads/batch-recover.
 * Permite enviar mensagens de recuperação para múltiplos clientes de uma vez.
 *
 * Limite de 100 leads por chamada para evitar timeouts e abuso.
 */
export class BatchRecoverDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  leadIds!: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['whatsapp', 'email'], { each: true })
  channels?: Array<'whatsapp' | 'email'>;
}
