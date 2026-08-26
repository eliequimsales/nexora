'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowLeft,
  MessageCircle,
  FileSpreadsheet,
  Database,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useImportLeads, type ImportPreview } from '@/lib/hooks/leads/useImportLeads';
import { useToast } from '@/lib/providers/ToastProvider';
import { downloadSampleXlsx, xlsxFileToCsv } from '@/lib/utils/xlsx';
import { CreateLeadForm } from '@/components/modules/leads/CreateLeadForm';

type Origin = 'whatsapp' | 'excel' | 'csv' | 'outro' | 'manual';

const ORIGIN_OPTIONS: {
  id: Origin;
  label: string;
  hint: string;
  icon: typeof Upload;
}[] = [
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Contatos do celular', icon: MessageCircle },
  { id: 'excel', label: 'Excel', hint: 'Planilha .xlsx', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV', hint: 'Arquivo .csv', icon: FileText },
  { id: 'outro', label: 'Outro sistema', hint: 'Agenda, CRM, ERP', icon: Database },
  { id: 'manual', label: 'Vou adicionar manualmente', hint: 'Uma pessoa por vez', icon: UserPlus },
];

export default function ImportarClientesPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [step, setStep] = useState<'origem' | 'select' | 'preview' | 'done'>('origem');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const mutation = useImportLeads();

  function handleOrigin(next: Origin) {
    setOrigin(next);
    // Excel e CSV caem direto no fluxo de upload que já existe.
    if (next === 'excel' || next === 'csv') setStep('select');
    if (next === 'manual') setIsAddingClient(true);
  }

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'error', title: 'Arquivo muito grande (máx 5MB)' });
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv') || file.type === 'text/csv';
    const isXlsx =
      lowerName.endsWith('.xlsx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isCsv && !isXlsx) {
      toast({
        variant: 'error',
        title: 'Formato não suportado',
        description: 'Envie um arquivo .csv ou .xlsx.',
      });
      return;
    }

    let content: string;
    try {
      if (isXlsx) {
        content = await xlsxFileToCsv(file);
      } else {
        content = await file.text();
      }
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Não consegui ler o arquivo',
        description: err?.message ?? 'Verifique o formato.',
      });
      return;
    }

    setCsvContent(content);
    setFileName(file.name);

    mutation.mutate(
      { csvContent: content, dryRun: true },
      {
        onSuccess: (data) => {
          setPreview(data);
          setStep('preview');
        },
        onError: (err: any) => {
          toast({
            variant: 'error',
            title: 'Erro ao processar arquivo',
            description: err?.response?.data?.message ?? err?.message ?? 'Verifique o formato.',
          });
        },
      },
    );
  }

  function handleConfirmImport() {
    mutation.mutate(
      { csvContent, dryRun: false },
      {
        onSuccess: (data) => {
          setPreview(data);
          setStep('done');
          toast({
            variant: 'success',
            title: `${data.created} clientes importados`,
          });
        },
        onError: (err: any) => {
          toast({
            variant: 'error',
            title: 'Erro ao importar',
            description: err?.response?.data?.message ?? err?.message ?? 'Tente novamente.',
          });
        },
      },
    );
  }

  async function handleDownloadSample() {
    try {
      await downloadSampleXlsx();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erro ao gerar planilha modelo',
        description: err?.message ?? 'Tente novamente.',
      });
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href={`/${slug}/clientes`}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        Voltar para clientes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {step === 'origem' ? 'Onde seus clientes estão hoje?' : 'Importar clientes'}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {step === 'origem'
            ? 'Escolha de onde eles vêm e a Nexora cuida do resto.'
            : 'Envie sua lista em CSV ou Excel. Clientes repetidos são identificados pelo telefone ou email.'}
        </p>
      </div>

      {/* Step 0: Origem */}
      {step === 'origem' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {ORIGIN_OPTIONS.map(({ id, label, hint, icon: Icon }) => {
              const isActive = origin === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleOrigin(id)}
                  className={`group flex items-center gap-3 rounded-xl border bg-brand-surface p-4 text-left shadow-panel transition-all hover:-translate-y-px ${
                    isActive
                      ? 'border-brand-amber/50'
                      : 'border-brand-border hover:border-brand-border-2'
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-amber/20 bg-brand-amber-subtle">
                    <Icon size={17} className="text-brand-amber" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-primary">
                      {label}
                    </span>
                    <span className="block text-xs text-text-muted">{hint}</span>
                  </span>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              );
            })}
          </div>

          {origin === 'whatsapp' && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
              <div className="flex items-start gap-3">
                <MessageCircle size={16} className="mt-0.5 shrink-0 text-brand-amber" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Em breve você poderá importar do WhatsApp
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Por enquanto, exporte seus contatos para uma planilha ou adicione as
                    pessoas manualmente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {origin === 'outro' && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
              <div className="flex items-start gap-3">
                <Database size={16} className="mt-0.5 shrink-0 text-brand-amber" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    Exporte seus clientes em CSV
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Quase todo sistema tem uma opção de exportar (procure por
                    &ldquo;Exportar&rdquo;, &ldquo;Baixar&rdquo; ou &ldquo;CSV&rdquo;). Com
                    o arquivo em mãos, é só continuar.
                  </p>
                  <button
                    onClick={() => setStep('select')}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand-amber/30 bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-bg transition-all hover:bg-brand-amber/90"
                  >
                    Já tenho o arquivo
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {origin === 'manual' && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
              <div className="flex items-start gap-3">
                <UserPlus size={16} className="mt-0.5 shrink-0 text-brand-amber" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Adicione uma pessoa por vez
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Sem planilha, sem complicação. Você pode voltar aqui e importar uma
                    lista quando quiser.
                  </p>
                  <button
                    onClick={() => setIsAddingClient(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand-amber/30 bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-bg transition-all hover:bg-brand-amber/90"
                  >
                    Adicionar cliente
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 1: Select */}
      {step === 'select' && (
        <>
          <button
            onClick={() => setStep('origem')}
            className="inline-flex items-center gap-2 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={12} />
            Escolher outra origem
          </button>

          <div
            className="rounded-xl border-2 border-dashed border-brand-border bg-brand-surface p-10 text-center cursor-pointer hover:border-brand-gold transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-text-primary mb-1">
              Clique para escolher um arquivo ou arraste aqui
            </p>
            <p className="text-xs text-text-muted">Aceita .csv ou .xlsx até 5 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {/* Formato esperado */}
          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-2">
              Formato esperado
            </h2>
            <p className="text-xs text-text-muted mb-3">
              Colunas reconhecidas (qualquer ordem, qualquer separador):
            </p>
            <ul className="text-xs text-text-secondary space-y-1 mb-4 list-disc list-inside">
              <li>
                <strong>Nome</strong> (obrigatório) — também aceita "Cliente" ou "Name"
              </li>
              <li>
                <strong>Telefone</strong> — aceita "Whatsapp", "Celular", "Phone"
              </li>
              <li>
                <strong>Email</strong> — aceita "E-mail" ou "Mail"
              </li>
              <li>
                <strong>Última Visita</strong> (opcional) — formato DD/MM/AAAA ou ISO
              </li>
            </ul>
            <p className="text-xs text-text-muted mb-3">
              Telefone OU email é obrigatório (pelo menos um dos dois por linha).
            </p>
            <button
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-2 text-xs text-brand-gold hover:underline"
            >
              <Download size={12} />
              Baixar planilha modelo (XLSX)
            </button>
          </div>

          {mutation.isPending && (
            <p className="text-sm text-text-muted text-center">Processando…</p>
          )}
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <>
          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">{fileName}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Stat label="Linhas no arquivo" value={preview.totalRows} />
              <Stat
                label="Vão ser criados"
                value={preview.valid.length}
                variant="success"
              />
              <Stat
                label="Duplicados"
                value={preview.duplicatesInFile + preview.duplicatesInDb}
                variant="warning"
              />
              <Stat label="Inválidos" value={preview.invalid.length} variant="error" />
            </div>

            {preview.invalid.length > 0 && (
              <div className="rounded-lg border border-status-warning/30 bg-status-warning-muted/30 p-3 mb-4">
                <p className="text-xs font-medium text-status-warning mb-2">
                  Linhas ignoradas:
                </p>
                <ul className="text-xs text-text-secondary space-y-1 max-h-32 overflow-y-auto">
                  {preview.invalid.slice(0, 10).map((row) => (
                    <li key={row.rowNumber}>
                      Linha {row.rowNumber + 1}: {row.reason}
                    </li>
                  ))}
                  {preview.invalid.length > 10 && (
                    <li className="text-text-muted">
                      …e mais {preview.invalid.length - 10}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {preview.valid.length > 0 && (
              <>
                <p className="text-xs text-text-muted mb-2">
                  Pré-visualização (primeiros 5):
                </p>
                <div className="rounded-lg border border-brand-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-brand-surface-2 text-text-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Nome</th>
                        <th className="text-left px-3 py-2 font-medium">Telefone</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.valid.slice(0, 5).map((row) => (
                        <tr
                          key={row.rowNumber}
                          className="border-t border-brand-border text-text-secondary"
                        >
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.phone ?? '—'}</td>
                          <td className="px-3 py-2">{row.email ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setStep('select');
                setPreview(null);
                setCsvContent('');
                setFileName('');
              }}
              disabled={mutation.isPending}
              className="px-4 py-2.5 border border-brand-border rounded-lg text-sm text-text-secondary hover:bg-brand-surface-2"
            >
              Trocar arquivo
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={preview.valid.length === 0 || mutation.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-brand-gold/90 disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  Importar {preview.valid.length} clientes
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Step 3: Done */}
      {step === 'done' && preview && (
        <div className="rounded-xl border border-status-success/30 bg-status-success-muted/20 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-status-success-muted mx-auto mb-3 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-status-success" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-1">
            {preview.created} clientes importados
          </h2>
          <p className="text-sm text-text-muted">
            {preview.duplicatesInDb > 0 &&
              `${preview.duplicatesInDb} já existiam (ignorados). `}
            {preview.duplicatesInFile > 0 &&
              `${preview.duplicatesInFile} duplicados no arquivo. `}
            {preview.invalid.length > 0 && `${preview.invalid.length} inválidos.`}
          </p>
          <div className="flex gap-2 mt-5 justify-center">
            <button
              onClick={() => router.push(`/${slug}/clientes`)}
              className="px-5 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-brand-gold/90"
            >
              Ver lista de clientes
            </button>
            <button
              onClick={() => {
                setStep('select');
                setPreview(null);
                setCsvContent('');
                setFileName('');
              }}
              className="px-5 py-2.5 border border-brand-border rounded-lg text-sm text-text-secondary hover:bg-brand-surface-2"
            >
              Importar mais
            </button>
          </div>
        </div>
      )}

      {isAddingClient && <CreateLeadForm onClose={() => setIsAddingClient(false)} />}
    </div>
  );
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: 'success' | 'warning' | 'error';
}) {
  const colorClass =
    variant === 'success'
      ? 'text-status-success'
      : variant === 'warning'
        ? 'text-status-warning'
        : variant === 'error'
          ? 'text-status-error'
          : 'text-text-primary';

  return (
    <div className="rounded-lg bg-brand-surface-2/50 p-3">
      <p className="text-2xs uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
