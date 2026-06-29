import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
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

export const PRICE_BANDS = ['ate_49', 'ate_99', 'ate_149', 'mais_149', 'nao_pagaria'] as const;

/**
 * Feedback estruturado do piloto (fim da análise). O aprendizado mais valioso —
 * por isso é capturado e gravado, nunca perdido.
 */
export class FeedbackRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsBoolean()
  wouldUseAgain!: boolean;

  @IsBoolean()
  wouldPay!: boolean;

  @IsIn(PRICE_BANDS)
  priceBand!: (typeof PRICE_BANDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  whatMissing?: string;

  // Metadados (preenchidos pela tela a partir do resultado/contexto)
  @IsOptional() @IsString() @MaxLength(120) orgId?: string;
  @IsOptional() @IsString() @MaxLength(120) orgSlug?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) recoverableCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalRecoverableCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) confidencePct?: number;
}

export const FUNNEL_EVENTS = [
  'landing_view',
  'cta_pilot',
  'signup',
  'analyze',
  'result',
  'feedback',
] as const;

/** Evento de funil (analytics próprio). Sem PII — só onde a clínica trava. */
export class EventRequestDto {
  @IsIn(FUNNEL_EVENTS)
  name!: (typeof FUNNEL_EVENTS)[number];

  @IsOptional() @IsString() @MaxLength(64) anonId?: string;
  @IsOptional() @IsString() @MaxLength(120) orgSlug?: string;
}
