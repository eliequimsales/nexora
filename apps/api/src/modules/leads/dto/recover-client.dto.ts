import { IsIn, IsOptional } from 'class-validator';

/**
 * Body do endpoint POST /leads/:id/recuperar.
 * Quando `channel` é omitido o service auto-detecta (whatsapp se houver phone,
 * senão email).
 */
export class RecoverClientDto {
  @IsOptional()
  @IsIn(['whatsapp', 'email'])
  channel?: 'whatsapp' | 'email';
}
