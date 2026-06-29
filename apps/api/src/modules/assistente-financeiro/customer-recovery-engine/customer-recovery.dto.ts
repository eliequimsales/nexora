import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Corpo do POST /customer-recovery/assessment.
 *
 * Segurança (CLAUDE.md, inegociável): toda entrada validada e limitada.
 * O CSV chega como texto (a tela lê o arquivo no cliente) — sem upload binário,
 * sem dependência nova. MaxLength limita o payload (~2 MB) contra abuso.
 */
export class AssessmentRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  csv!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  orgId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  marginPctDefault?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualRevenueCents?: number;
}
