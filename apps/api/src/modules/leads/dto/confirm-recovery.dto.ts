import { IsNumber, Max, Min } from 'class-validator';

/**
 * Body do endpoint POST /leads/:id/confirm-recovery.
 *
 * Quando o barbeiro confirma que um cliente recuperado realmente voltou e
 * pagou, registramos o valor real — isso vira "Receita recuperada" no
 * dashboard. É o número que retém o cliente da Nexora.
 *
 * Limite de R$ 10.000 por confirmação para evitar typos absurdos.
 */
export class ConfirmRecoveryDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000)
  value!: number;
}
