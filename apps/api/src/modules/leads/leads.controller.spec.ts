import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ClientRecoveryService } from './services/client-recovery.service';
import { LeadsImportService } from './services/leads-import.service';

/**
 * Testes focados na proteção do webhook público `/leads/webhooks/response`.
 *
 * Este endpoint não passa pelo JwtAuthGuard (é @Public). Sem proteção
 * adicional, qualquer um na internet poderia poluir o estado dos leads.
 * O header `X-Webhook-Secret` é a defesa.
 */
describe('LeadsController — webhook security', () => {
  let controller: LeadsController;
  let recoveryServiceMock: any;
  let configMock: { get: jest.Mock };

  function build(secret: string, env: 'development' | 'production' = 'production') {
    recoveryServiceMock = {
      markResponseReceived: jest.fn().mockResolvedValue({
        matched: true,
        leadId: 'lead-1',
        optedOut: false,
      }),
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'webhook.secret') return secret;
        if (key === 'app.env') return env;
        return undefined;
      }),
    };

    return Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: {} },
        { provide: ClientRecoveryService, useValue: recoveryServiceMock },
        { provide: LeadsImportService, useValue: {} },
        { provide: ConfigService, useValue: configMock },
      ],
    })
      .compile()
      .then((m: TestingModule) => m.get(LeadsController));
  }

  describe('production mode — secret configurado', () => {
    beforeEach(async () => {
      controller = await build('top-secret-value', 'production');
    });

    it('rejeita quando header X-Webhook-Secret está ausente', async () => {
      await expect(
        controller.handleResponseWebhook(
          { channel: 'whatsapp', from: '11999998888', message: 'oi' },
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(recoveryServiceMock.markResponseReceived).not.toHaveBeenCalled();
    });

    it('rejeita quando header está errado', async () => {
      await expect(
        controller.handleResponseWebhook(
          { channel: 'whatsapp', from: '11999998888', message: 'oi' },
          'wrong-secret',
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(recoveryServiceMock.markResponseReceived).not.toHaveBeenCalled();
    });

    it('rejeita secret de tamanho diferente (timing attack defense)', async () => {
      await expect(
        controller.handleResponseWebhook(
          { channel: 'whatsapp', from: '11999998888', message: 'oi' },
          'short',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('aceita quando secret bate', async () => {
      const result = await controller.handleResponseWebhook(
        { channel: 'whatsapp', from: '11999998888', message: 'oi' },
        'top-secret-value',
      );
      expect(result.ok).toBe(true);
      expect(recoveryServiceMock.markResponseReceived).toHaveBeenCalled();
    });
  });

  describe('production mode — sem secret configurado (config errada)', () => {
    beforeEach(async () => {
      controller = await build('', 'production');
    });

    it('rejeita em produção mesmo sem header — força admin a configurar o secret', async () => {
      await expect(
        controller.handleResponseWebhook(
          { channel: 'whatsapp', from: '11999998888', message: 'oi' },
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('development mode — sem secret configurado', () => {
    beforeEach(async () => {
      controller = await build('', 'development');
    });

    it('aceita em dev mesmo sem header (facilita teste local)', async () => {
      const result = await controller.handleResponseWebhook(
        { channel: 'whatsapp', from: '11999998888', message: 'oi' },
        undefined,
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('payload validation', () => {
    beforeEach(async () => {
      controller = await build('', 'development');
    });

    it('retorna matched:false para corpo incompleto (não chama service)', async () => {
      const result = await controller.handleResponseWebhook(
        { channel: 'whatsapp', from: '', message: '' } as any,
        undefined,
      );
      expect(result).toEqual({ ok: false, matched: false });
      expect(recoveryServiceMock.markResponseReceived).not.toHaveBeenCalled();
    });
  });
});
