'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Download, Upload, Users, ArrowRight, Zap } from 'lucide-react';
import { useOrg } from '@/lib/hooks/org/useOrg';
import { useDashboardSummary } from '@/lib/hooks/dashboard/useDashboardSummary';
import { downloadSampleXlsx } from '@/lib/utils/xlsx';
import { useToast } from '@/lib/providers/ToastProvider';

const STORAGE_KEY = 'nexora_pilot_wizard_state';

interface WizardState {
  downloadedSample: boolean;
  // Não persistimos "importedAtLeastOne" — derivamos sempre do summary do dashboard
}

function loadState(): WizardState {
  if (typeof window === 'undefined') return { downloadedSample: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { downloadedSample: false };
    return JSON.parse(raw);
  } catch {
    return { downloadedSample: false };
  }
}

function saveState(state: WizardState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * NexoraPilotWizard
 *
 * Modal full-screen exibido na primeira sessão de uma barbearia até que ela
 * importe pelo menos 1 cliente. Não fecha por clique fora — apenas quando os
 * 3 passos forem concluídos.
 *
 * Os 3 passos:
 *   1. Baixar planilha modelo (.xlsx) — completado ao clicar no botão
 *   2. Importar planilha — completado quando dashboard.leads.total >= 1
 *   3. Ver clientes inativos — link que fecha o wizard
 *
 * Heurística pra mostrar: niche=barbearia && total de leads === 0 && passo 2 não está completo.
 * O passo 2 é a barreira real — antes disso, o wizard não desaparece.
 */
export function NexoraPilotWizard() {
  const org = useOrg();
  const { slug } = useParams<{ slug: string }>();
  const { data: summary } = useDashboardSummary();
  const { toast } = useToast();

  const [state, setState] = useState<WizardState>({ downloadedSample: false });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setState(loadState());
  }, []);

  // Só pra barbearia + LGPD aceito (sem aceite, o banner LGPD aparece primeiro)
  const isBarbearia = org.niche === 'barbearia';
  const totalLeads = summary?.leads?.total ?? null;
  const importedAtLeastOne = (totalLeads ?? 0) >= 1;

  // Mostra quando: barbearia + ainda não importou (== 0) + não dispensado nessa sessão
  // Quando totalLeads === null (loading), não mostra ainda — evita flash.
  const shouldShow =
    isBarbearia && totalLeads === 0 && !dismissed && !importedAtLeastOne;

  if (!shouldShow) return null;

  async function handleDownloadSample() {
    try {
      await downloadSampleXlsx();
      const next = { ...state, downloadedSample: true };
      setState(next);
      saveState(next);
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erro ao gerar planilha',
        description: err?.message ?? 'Tente novamente.',
      });
    }
  }

  const step1Done = state.downloadedSample;
  const step2Done = importedAtLeastOne;
  // Passo 3 (ver inativos) só fica disponível depois do 2

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-full bg-brand-gold/15 items-center justify-center mb-3">
            <Zap size={20} className="text-brand-gold" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">
            Bem-vindo à Nexora!
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Vamos colocar seu primeiro cliente na lista em 3 passos.
          </p>
        </div>

        {/* Step 1: Baixar */}
        <Step
          number={1}
          done={step1Done}
          title="Baixe a planilha modelo"
          description="É um arquivo Excel com 3 colunas: nome, telefone e última visita."
        >
          <button
            onClick={handleDownloadSample}
            disabled={step1Done}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              step1Done
                ? 'bg-status-success-muted text-status-success cursor-default'
                : 'bg-brand-gold text-brand-bg hover:bg-brand-gold/90'
            }`}
          >
            {step1Done ? (
              <>
                <CheckCircle2 size={14} />
                Planilha baixada
              </>
            ) : (
              <>
                <Download size={14} />
                Baixar planilha modelo
              </>
            )}
          </button>
        </Step>

        {/* Step 2: Importar */}
        <Step
          number={2}
          done={step2Done}
          locked={!step1Done}
          title="Preencha com seus clientes e importe"
          description="Você pode começar com 5 a 10 clientes pra testar. Acrescente mais depois."
        >
          <Link
            href={step1Done ? `/${slug}/clientes/importar` : '#'}
            onClick={(e) => !step1Done && e.preventDefault()}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              step2Done
                ? 'bg-status-success-muted text-status-success cursor-default'
                : !step1Done
                  ? 'bg-brand-surface-2 text-text-muted cursor-not-allowed'
                  : 'bg-brand-gold text-brand-bg hover:bg-brand-gold/90'
            }`}
          >
            {step2Done ? (
              <>
                <CheckCircle2 size={14} />
                {totalLeads} {Number(totalLeads) === 1 ? 'cliente importado' : 'clientes importados'}
              </>
            ) : (
              <>
                <Upload size={14} />
                Importar agora
              </>
            )}
          </Link>
        </Step>

        {/* Step 3: Ver inativos */}
        <Step
          number={3}
          done={false}
          locked={!step2Done}
          title="Veja seus clientes inativos"
          description="A Nexora identifica automaticamente quem tem 30+ dias sem voltar."
          isLast
        >
          <button
            onClick={() => setDismissed(true)}
            disabled={!step2Done}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              !step2Done
                ? 'bg-brand-surface-2 text-text-muted cursor-not-allowed'
                : 'bg-brand-gold text-brand-bg hover:bg-brand-gold/90'
            }`}
          >
            <Users size={14} />
            Ver meus clientes
            <ArrowRight size={14} />
          </button>
        </Step>

        <p className="text-2xs text-text-muted text-center mt-4">
          Esse guia some quando você importar seu primeiro cliente.
        </p>
      </div>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
  done: boolean;
  locked?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}

function Step({ number, title, description, done, locked, isLast, children }: StepProps) {
  return (
    <div className={`flex gap-3 ${isLast ? '' : 'pb-5 border-b border-brand-border mb-5'}`}>
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          done
            ? 'bg-status-success text-white'
            : locked
              ? 'bg-brand-surface-2 text-text-muted'
              : 'bg-brand-gold text-brand-bg'
        }`}
      >
        {done ? <CheckCircle2 size={16} /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className={`text-sm font-semibold ${locked ? 'text-text-muted' : 'text-text-primary'}`}
        >
          {title}
        </h3>
        <p className={`text-xs mt-0.5 ${locked ? 'text-text-muted' : 'text-text-secondary'}`}>
          {description}
        </p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
