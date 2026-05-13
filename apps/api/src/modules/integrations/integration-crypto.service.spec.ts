import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IntegrationCryptoService } from './integration-crypto.service';

function buildModule(encryptionKey: string, nodeEnv = 'test') {
  return Test.createTestingModule({
    providers: [
      IntegrationCryptoService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            if (key === 'integrations.encryptionKey') return encryptionKey;
            if (key === 'nodeEnv') return nodeEnv;
            return undefined;
          },
        },
      },
    ],
  }).compile();
}

describe('IntegrationCryptoService', () => {
  describe('encrypt / decrypt roundtrip', () => {
    let service: IntegrationCryptoService;

    beforeEach(async () => {
      const module = await buildModule('my-super-secret-key-32-bytes-xxx');
      service = module.get<IntegrationCryptoService>(IntegrationCryptoService);
    });

    it('decrypts back to the original plaintext', () => {
      const plaintext = 'api-key-abc123';
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it('produces different ciphertexts for the same input (random IV)', () => {
      const a = service.encrypt('same-value');
      const b = service.encrypt('same-value');
      expect(a).not.toBe(b);
    });

    it('roundtrips empty string', () => {
      expect(service.decrypt(service.encrypt(''))).toBe('');
    });

    it('roundtrips string with special characters', () => {
      const special = 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig==';
      expect(service.decrypt(service.encrypt(special))).toBe(special);
    });

    it('ciphertext has iv:authTag:cipherHex format', () => {
      const parts = service.encrypt('test').split(':');
      expect(parts).toHaveLength(3);
      // IV is 12 bytes → 24 hex chars
      expect(parts[0]).toHaveLength(24);
    });
  });

  describe('production safety guard', () => {
    it('throws on startup when default dev key is used in production', async () => {
      await expect(
        buildModule('dev-key-change-in-production-32b', 'production'),
      ).rejects.toThrow('INTEGRATION_ENCRYPTION_KEY must be set in production');
    });

    it('does NOT throw when default dev key is used in test/development', async () => {
      await expect(
        buildModule('dev-key-change-in-production-32b', 'test'),
      ).resolves.toBeDefined();
    });
  });
});
