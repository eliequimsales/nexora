import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantContext } from '../../../common/tenant/tenant-context';

export interface ImportRow {
  name: string;
  phone: string | null;
  email: string | null;
  lastVisitAt: Date | null;
  // Raw line number from the CSV (1-indexed, excludes header)
  rowNumber: number;
}

export interface ImportPreview {
  totalRows: number;
  valid: ImportRow[];
  duplicatesInFile: number;
  duplicatesInDb: number;
  invalid: Array<{ rowNumber: number; reason: string }>;
}

export interface ImportResult extends ImportPreview {
  created: number;
  updated: number;
  // Aliases em português — usados pelo frontend de forma mais legível.
  // Mantemos os nomes originais (created, valid, etc) para compatibilidade.
  importados: number;
  duplicados: number;
  erros: number;
}

// Header aliases — robust to common Excel/Sheets exports in pt-BR and en-US.
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['nome', 'cliente', 'name', 'customer'],
  phone: ['telefone', 'whatsapp', 'celular', 'phone', 'tel', 'fone', 'mobile'],
  email: ['email', 'e-mail', 'mail'],
  lastVisitAt: [
    'ultima visita',
    'última visita',
    'ultimo atendimento',
    'último atendimento',
    'last visit',
    'data',
    'date',
  ],
};

/**
 * Normalizes a phone number to digits-only (Brazilian format friendly).
 * Returns null when the result has < 8 digits (likely garbage).
 */
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits;
}

function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.includes('@') || !trimmed.includes('.')) return null;
  return trimmed;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try ISO first
  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) return iso;

  // Try DD/MM/YYYY (Brazilian)
  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const date = new Date(year, parseInt(m) - 1, parseInt(d));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Splits a CSV line respecting double-quoted fields. Handles:
 *   - `,` and `;` as separators (auto-detected per file)
 *   - quoted fields containing the separator
 *   - escaped quotes via `""`
 */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === sep && !inQuote) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

@Injectable()
export class LeadsImportService {
  private readonly logger = new Logger(LeadsImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parses CSV text and either previews (dryRun=true) or commits to DB.
   *
   * Steps:
   *   1. Auto-detect separator (`,` or `;`)
   *   2. Detect header row and map columns
   *   3. Parse each row, normalizing phone/email
   *   4. Dedup within the file (last entry wins)
   *   5. Dedup against existing leads (by phone OR email, in the org)
   *   6. If !dryRun: create new leads + update touched-but-existing ones
   */
  async importCsv(
    csvContent: string,
    ctx: TenantContext,
    dryRun = false,
  ): Promise<ImportResult> {
    if (!csvContent.trim()) {
      throw new BadRequestException('Arquivo vazio');
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV precisa ter pelo menos uma linha de cabeçalho e uma linha de dados',
      );
    }

    // Auto-detect separator using the header line — pick whichever yields >= 2 columns.
    const headerLine = lines[0];
    const semiCount = (headerLine.match(/;/g) ?? []).length;
    const commaCount = (headerLine.match(/,/g) ?? []).length;
    const sep = semiCount > commaCount ? ';' : ',';

    const rawHeaders = splitCsvLine(headerLine, sep).map((h) =>
      h
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, ''),
    );

    // Map column index to canonical field name
    const columnMap: Record<number, keyof Omit<ImportRow, 'rowNumber'>> = {};
    rawHeaders.forEach((header, idx) => {
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(header)) {
          columnMap[idx] = field as keyof Omit<ImportRow, 'rowNumber'>;
          break;
        }
      }
    });

    if (!Object.values(columnMap).includes('name')) {
      throw new BadRequestException(
        'Coluna "Nome" não encontrada. Sua planilha precisa ter uma coluna chamada Nome (ou Name, Cliente).',
      );
    }
    if (
      !Object.values(columnMap).includes('phone') &&
      !Object.values(columnMap).includes('email')
    ) {
      throw new BadRequestException(
        'Sua planilha precisa ter pelo menos uma coluna de Telefone ou Email.',
      );
    }

    // Parse rows
    const valid: ImportRow[] = [];
    const invalid: Array<{ rowNumber: number; reason: string }> = [];
    const seenInFile = new Set<string>(); // phone+email composite
    let duplicatesInFile = 0;

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i;
      // Human-friendly line number (1-indexed including header). Used in error messages.
      const humanLine = i + 1;
      const cols = splitCsvLine(lines[i], sep);

      const partial: Partial<Omit<ImportRow, 'rowNumber'>> = {};
      for (const [idxStr, field] of Object.entries(columnMap)) {
        partial[field as keyof typeof partial] = cols[Number(idxStr)] as any;
      }

      const name = (partial.name as string | undefined)?.trim();
      const rawPhone = (partial.phone as string | undefined) ?? null;
      const rawEmail = (partial.email as string | undefined) ?? null;
      const phone = normalizePhone(rawPhone);
      const email = normalizeEmail(rawEmail);
      const lastVisitAt = parseDate((partial.lastVisitAt as string | undefined) ?? null);

      if (!name) {
        invalid.push({ rowNumber, reason: `Linha ${humanLine}: nome vazio` });
        continue;
      }

      // Telefone foi preenchido mas não passou na validação → mensagem específica
      if (rawPhone && rawPhone.trim() && !phone) {
        invalid.push({
          rowNumber,
          reason: `Linha ${humanLine}: telefone "${rawPhone.trim()}" inválido. Use o formato 21999998888 (com DDD, sem espaços).`,
        });
        continue;
      }

      // Email foi preenchido mas é inválido → mensagem específica
      if (rawEmail && rawEmail.trim() && !email) {
        invalid.push({
          rowNumber,
          reason: `Linha ${humanLine}: email "${rawEmail.trim()}" inválido.`,
        });
        continue;
      }

      if (!phone && !email) {
        invalid.push({
          rowNumber,
          reason: `Linha ${humanLine}: cliente sem telefone nem email`,
        });
        continue;
      }

      const dedupKey = `${phone ?? ''}|${email ?? ''}`;
      if (seenInFile.has(dedupKey)) {
        duplicatesInFile++;
        continue;
      }
      seenInFile.add(dedupKey);

      valid.push({ name, phone, email, lastVisitAt, rowNumber });
    }

    // Check against existing leads in DB
    const phonesToCheck = valid.map((r) => r.phone).filter(Boolean) as string[];
    const emailsToCheck = valid.map((r) => r.email).filter(Boolean) as string[];

    const existing = await this.prisma.lead.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          phonesToCheck.length > 0 ? { phone: { in: phonesToCheck } } : null,
          emailsToCheck.length > 0 ? { email: { in: emailsToCheck } } : null,
        ].filter(Boolean) as any,
      },
      select: { id: true, phone: true, email: true },
    });

    const existingPhones = new Set(existing.map((l) => l.phone).filter(Boolean));
    const existingEmails = new Set(existing.map((l) => l.email).filter(Boolean));

    let duplicatesInDb = 0;
    const toCreate: ImportRow[] = [];
    for (const row of valid) {
      const dupByPhone = row.phone && existingPhones.has(row.phone);
      const dupByEmail = row.email && existingEmails.has(row.email);
      if (dupByPhone || dupByEmail) {
        duplicatesInDb++;
      } else {
        toCreate.push(row);
      }
    }

    const preview: ImportResult = {
      totalRows: lines.length - 1,
      valid: toCreate,
      duplicatesInFile,
      duplicatesInDb,
      invalid,
      created: 0,
      updated: 0,
      // Aliases pt-BR — preenchidos no final, depois da gravação
      importados: 0,
      duplicados: duplicatesInFile + duplicatesInDb,
      erros: invalid.length,
    };

    if (dryRun) return preview;

    // Se chegou aqui sem nada válido pra gravar, falha com mensagem clara.
    // Acontece quando todas as linhas tinham dado ruim ou já existiam.
    if (toCreate.length === 0 && lines.length > 1) {
      throw new BadRequestException(
        'Nenhum cliente foi importado. Verifique se a planilha está no formato correto ou se os clientes já estão cadastrados.',
      );
    }

    // Real run — bulk create
    if (toCreate.length > 0) {
      const result = await this.prisma.lead.createMany({
        data: toCreate.map((row) => ({
          orgId: ctx.orgId,
          name: row.name,
          phone: row.phone,
          email: row.email,
          source: 'import',
          status: 'new',
          // If the CSV had a "last visit" column, use it as updatedAt so the
          // inactive-clients query immediately recognizes who needs recovery.
          // Prisma doesn't let us set updatedAt directly on createMany, so we
          // do it via raw post-process below if needed.
        })),
        skipDuplicates: true,
      });

      preview.created = result.count;

      // Post-process: if any row had lastVisitAt, set updated_at to it.
      // Done as a separate UPDATE since createMany doesn't accept updatedAt.
      const withDates = toCreate.filter((r) => r.lastVisitAt);
      for (const row of withDates) {
        await this.prisma.lead.updateMany({
          where: {
            orgId: ctx.orgId,
            ...(row.phone ? { phone: row.phone } : { email: row.email! }),
          },
          data: { updatedAt: row.lastVisitAt! },
        });
      }
    }

    // Atualiza alias pt-BR depois da gravação
    preview.importados = preview.created;

    this.logger.log(
      `Import for org ${ctx.orgId}: created=${preview.created}, dup_file=${duplicatesInFile}, dup_db=${duplicatesInDb}, invalid=${invalid.length}`,
    );

    return preview;
  }
}
