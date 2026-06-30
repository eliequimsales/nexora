/**
 * buildStrategy — o CÉREBRO da Nexora: decide a abordagem por cliente.
 *
 * Determinístico e auditável (Art. VI): só usa RFM (recência, frequência, valor,
 * chance de retorno). Não inventa contexto. A redação da mensagem deriva daqui.
 */

import type { RecoveryStrategy } from '../contracts/recovery.contracts';

export interface StrategyInput {
  recencyMonths: number;
  frequency: number;
  avgTicketCents: number;
  pReturn: number; // 0..1
}

const HIGH_CHANCE_P = 0.4;
const RECENT_MONTHS = 4;
const LOYAL_FREQ = 4;
const HIGH_TICKET_CENTS = 30_000; // R$ 300
const VERY_LONG_MONTHS = 24;

export function buildStrategy({
  recencyMonths,
  frequency,
  avgTicketCents,
  pReturn,
}: StrategyInput): RecoveryStrategy {
  // 1) Recente / boa chance → só lembrar, nunca queimar margem.
  if (pReturn >= HIGH_CHANCE_P || recencyMonths <= RECENT_MONTHS) {
    return {
      approach: 'Apenas um lembrete cordial',
      recommendations: ['Convite amigável', 'Não oferecer desconto', 'Reforçar prevenção'],
      reason:
        'Ausência curta / boa chance de retorno espontâneo. ' +
        'Um lembrete tende a bastar — não vale gastar desconto.',
      offerDiscount: false,
    };
  }

  // 2) Cliente fiel (volta várias vezes) → convite cordial, sem incentivo.
  if (frequency >= LOYAL_FREQ) {
    return {
      approach: 'Convite cordial, sem desconto',
      recommendations: ['Convite personalizado', 'Não oferecer desconto', 'Valorizar a relação'],
      reason:
        'Cliente fiel, que costuma voltar sozinho. Um convite basta — ' +
        'oferecer desconto só queimaria margem.',
      offerDiscount: false,
    };
  }

  // 3) Alto valor e já voltou antes → convite cordial, sem incentivo.
  if (avgTicketCents >= HIGH_TICKET_CENTS && frequency >= 2) {
    return {
      approach: 'Convite cordial, sem desconto',
      recommendations: ['Convite personalizado', 'Não oferecer desconto', 'Valorizar a relação'],
      reason:
        'Cliente de alto valor que já voltou antes. Um convite costuma funcionar ' +
        'sem incentivo financeiro — oferecer desconto só queimaria margem.',
      offerDiscount: false,
    };
  }

  // 3) Ausência muito longa → chance baixa: convite leve + avaliação, sem desconto.
  if (recencyMonths >= VERY_LONG_MONTHS) {
    return {
      approach: 'Convite leve com avaliação gratuita',
      recommendations: ['Convite sem pressão', 'Oferecer avaliação gratuita', 'Evitar desconto agressivo'],
      reason:
        `Ausência longa (${Math.round(recencyMonths)} meses) indica chance baixa. ` +
        'Uma avaliação gratuita reabre a porta sem desperdiçar margem com desconto.',
      offerDiscount: false,
    };
  }

  // 4) Baixo histórico/valor com ausência média → um incentivo aumenta a resposta.
  return {
    approach: 'Convite com incentivo (avaliação ou oferta)',
    recommendations: ['Oferecer avaliação gratuita', 'Considerar incentivo pontual', 'Tom acolhedor'],
    reason:
      'Histórico e valor baixos com ausência considerável: a chance sem incentivo é pequena. ' +
      'Um benefício pontual aumenta a probabilidade de resposta.',
    offerDiscount: true,
  };
}
