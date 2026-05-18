import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LeadsImportService } from './leads-import.service';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantContext } from '../../../common/tenant/tenant-context';

const CTX: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  role: 'admin',
  tokenId: 'tok-1',
};

describe('LeadsImportService', () => {
  let service: LeadsImportService;
  let prismaMock: any;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock = {
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsImportService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(LeadsImportService);
  });

  describe('header detection and parsing', () => {
    it('parses comma-separated CSV with PT headers', async () => {
      const csv = [
        'Nome,Telefone,Email',
        'João Silva,(11) 99999-8888,joao@example.com',
        'Maria,11988887777,maria@example.com',
      ].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.totalRows).toBe(2);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].name).toBe('João Silva');
      expect(result.valid[0].phone).toBe('11999998888'); // normalizado
      expect(result.valid[0].email).toBe('joao@example.com');
    });

    it('parses semicolon-separated CSV (Brazilian Excel default)', async () => {
      const csv = [
        'Nome;Telefone',
        'Carlos;(11) 91234-5678',
        'Ana;11987654321',
      ].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].name).toBe('Carlos');
      expect(result.valid[0].phone).toBe('11912345678');
    });

    it('recognizes English headers', async () => {
      const csv = ['Name,Phone,Email', 'John,11999998888,j@e.com'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].name).toBe('John');
    });

    it('handles quoted fields containing commas', async () => {
      const csv = [
        'Nome,Telefone',
        '"Silva, João",11999998888',
      ].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.valid[0].name).toBe('Silva, João');
    });

    it('normalizes phone to digits only', async () => {
      const csv = ['Nome,Telefone', 'A,+55 (11) 9 9999-8888'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.valid[0].phone).toBe('5511999998888');
    });

    it('rejects phone with fewer than 8 digits', async () => {
      const csv = ['Nome,Telefone,Email', 'A,123,a@e.com'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      // phone é null, mas email é válido → linha aceita
      expect(result.valid[0].phone).toBeNull();
      expect(result.valid[0].email).toBe('a@e.com');
    });
  });

  describe('validation errors', () => {
    it('throws when CSV is empty', async () => {
      await expect(service.importCsv('', CTX)).rejects.toThrow(BadRequestException);
    });

    it('throws when CSV has only header', async () => {
      await expect(service.importCsv('Nome,Telefone', CTX)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when there is no Name column', async () => {
      const csv = ['Telefone,Email', '11999998888,a@e.com'].join('\n');
      await expect(service.importCsv(csv, CTX)).rejects.toThrow(/Nome/);
    });

    it('throws when there is no Phone NOR Email column', async () => {
      const csv = ['Nome,Cidade', 'João,SP'].join('\n');
      await expect(service.importCsv(csv, CTX)).rejects.toThrow(/Telefone ou Email/i);
    });

    it('marks row as invalid when name is empty', async () => {
      const csv = ['Nome,Telefone', ',11999998888'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toBe('Nome vazio');
    });

    it('marks row as invalid when both phone and email are missing', async () => {
      const csv = ['Nome,Telefone,Email', 'João,,'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toBe('Sem telefone nem email');
    });
  });

  describe('deduplication', () => {
    it('skips duplicates within the same file (same phone)', async () => {
      const csv = [
        'Nome,Telefone',
        'João,11999998888',
        'João Silva,11999998888',
      ].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.valid).toHaveLength(1);
      expect(result.duplicatesInFile).toBe(1);
    });

    it('skips duplicates that already exist in DB (matched by phone)', async () => {
      prismaMock.lead.findMany.mockResolvedValueOnce([
        { id: 'existing-1', phone: '11999998888', email: null },
      ]);

      const csv = ['Nome,Telefone', 'João,11999998888'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.duplicatesInDb).toBe(1);
      expect(result.valid).toHaveLength(0);
    });

    it('skips duplicates that already exist in DB (matched by email)', async () => {
      prismaMock.lead.findMany.mockResolvedValueOnce([
        { id: 'existing-1', phone: null, email: 'a@e.com' },
      ]);

      const csv = ['Nome,Email', 'João,a@e.com'].join('\n');

      const result = await service.importCsv(csv, CTX, true);

      expect(result.duplicatesInDb).toBe(1);
    });
  });

  describe('persistence (real run)', () => {
    it('calls createMany with parsed rows when dryRun=false', async () => {
      prismaMock.lead.createMany.mockResolvedValueOnce({ count: 2 });

      const csv = [
        'Nome,Telefone',
        'João,11999998888',
        'Maria,11988887777',
      ].join('\n');

      const result = await service.importCsv(csv, CTX, false);

      expect(prismaMock.lead.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'João',
            phone: '11999998888',
            orgId: 'org-1',
            source: 'import',
          }),
        ]),
        skipDuplicates: true,
      });
      expect(result.created).toBe(2);
    });

    it('does NOT call createMany when dryRun=true', async () => {
      const csv = ['Nome,Telefone', 'João,11999998888'].join('\n');

      await service.importCsv(csv, CTX, true);

      expect(prismaMock.lead.createMany).not.toHaveBeenCalled();
    });

    it('uses lastVisitAt to backfill updatedAt when present', async () => {
      prismaMock.lead.createMany.mockResolvedValueOnce({ count: 1 });

      const csv = [
        'Nome,Telefone,Última Visita',
        'João,11999998888,15/03/2026',
      ].join('\n');

      await service.importCsv(csv, CTX, false);

      expect(prismaMock.lead.updateMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', phone: '11999998888' },
        data: { updatedAt: expect.any(Date) },
      });
    });
  });
});
