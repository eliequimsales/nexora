'use client';

import { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/Spinner';
import { useOrgQuery, ORG_QUERY_KEY } from '@/lib/hooks/org/useOrgQuery';
import { organizationsApi } from '@/lib/api/organizations.api';
import { useToast } from '@/lib/providers/ToastProvider';

const PROMPT_FIELDS = [
  {
    key: 'classify',
    label: 'Classificação de cliente',
    description: 'Analisa os dados do cliente e define se está inativo, em risco ou ativo. Influencia a prioridade na lista.',
    placeholder: 'Ex: Você é um especialista em retenção de clientes para barbearias. Analise os dados abaixo e classifique...',
  },
  {
    key: 'respond',
    label: 'Mensagem de reativação',
    description: 'Gera a mensagem de WhatsApp que o barbeiro enviará para o cliente inativo. Deve soar natural e pessoal.',
    placeholder: 'Ex: Você é um barbeiro simpático. Escreva uma mensagem curta e descontraída para reconquistar o cliente...',
  },
  {
    key: 'followUp',
    label: 'Follow-up (sem resposta)',
    description: 'Gera mensagem de acompanhamento quando o cliente não respondeu após a primeira tentativa.',
    placeholder: 'Ex: Você é um barbeiro fazendo follow-up. Escreva uma mensagem leve, sem pressão...',
  },
] as const;

export default function AiPromptsPage() {
  const { data: org, isLoading, isError } = useOrgQuery();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [prompts, setPrompts] = useState({ classify: '', respond: '', followUp: '' });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (org?.aiPrompts) {
      setPrompts({
        classify: org.aiPrompts.classify ?? '',
        respond: org.aiPrompts.respond ?? '',
        followUp: org.aiPrompts.followUp ?? '',
      });
    }
  }, [org]);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      organizationsApi.update({ aiPrompts: prompts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
      setDirty(false);
      toast({ variant: 'success', title: 'Prompts salvos com sucesso' });
    },
    onError: () => {
      toast({ variant: 'error', title: 'Erro ao salvar prompts' });
    },
  });

  const anyEmpty = Object.values(prompts).some((v) => !v.trim());

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner variant="amber" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-status-error">Erro ao carregar configurações.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2.5 mb-6">
        <Sparkles size={18} className="text-brand-amber" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Prompts de IA</h1>
          <p className="text-xs text-text-muted">Controle o comportamento da IA em cada etapa</p>
        </div>
      </div>

      {anyEmpty && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-5 text-sm text-amber-400">
          <AlertTriangle size={14} />
          <span>Prompts vazios farão a IA usar instruções padrão. Preencha todos para melhor personalização.</span>
        </div>
      )}

      <div className="space-y-5">
        {PROMPT_FIELDS.map(({ key, label, description, placeholder }) => (
          <div key={key} className="rounded-xl border border-brand-border bg-brand-surface p-5">
            <label className="block text-sm font-medium text-text-primary mb-0.5">{label}</label>
            <p className="text-xs text-text-muted mb-3">{description}</p>
            <textarea
              rows={5}
              value={prompts[key]}
              placeholder={placeholder}
              onChange={(e) => {
                setPrompts((prev) => ({ ...prev, [key]: e.target.value }));
                setDirty(true);
              }}
              className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-amber focus:border-brand-amber transition-colors resize-none"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => mutate()}
          disabled={isPending || !dirty}
          className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-medium text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending && <Spinner size="sm" />}
          Salvar prompts
        </button>
        {!dirty && !isPending && (
          <span className="text-xs text-text-muted">Sem alterações</span>
        )}
      </div>
    </div>
  );
}
