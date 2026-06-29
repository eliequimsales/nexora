import { Controller, Post, Body } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { AssessmentRequestDto } from './customer-recovery.dto';
import {
  runCustomerRecoveryAssessment,
  type CustomerRecoveryAssessment,
} from './customer-recovery-assessment';

/**
 * CustomerRecoveryController — a porta do produto.
 *
 * POST /api/v1/customer-recovery/assessment
 * O dono da clínica sobe um CSV → recebe clientes recuperáveis, valor potencial,
 * Top 3 e a ação. Público e stateless: processa o CSV e devolve a análise; nada
 * é persistido nem toca segredo. Validação/limite de tamanho no DTO.
 */
@Controller('customer-recovery')
export class CustomerRecoveryController {
  @Public()
  @Post('assessment')
  async assess(@Body() dto: AssessmentRequestDto): Promise<CustomerRecoveryAssessment> {
    return runCustomerRecoveryAssessment(dto.csv, {
      orgId: dto.orgId ?? 'mvp',
      marginPctDefault: dto.marginPctDefault,
      annualRevenueCents: dto.annualRevenueCents,
    });
  }
}
