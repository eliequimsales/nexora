'use client';

import { useState } from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import { useAcceptLgpd } from '@/lib/hooks/org/useAcceptLgpd';
import { useToast } from '@/lib/providers/ToastProvider';

/**
 * Banner exibido no topo das telas Nexora quando a organização ainda não
 * aceitou o termo LGPD. Sem aceite, o backend bloqueia envios — então o
 * usuário precisa resolver isso antes de tentar usar o produto.
 */
export function LgpdAcceptanceBanner() {
  const { data: org } = useOrgQuery();
  const mutation = useAcceptLgpd();
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);

  // Se já aceitou, não renderiza nada
  if (!org || org.lgpdAcceptedAt) return null;

  function handleAccept() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          variant: 'success',
          title: 'Termo aceito',
          description: 'Agora você pode enviar mensagens de recuperação.',
        });
      },
      onError: (err: any) => {
        toast({
          variant: 'error',
          title: 'Erro ao registrar aceite',
          description: err?.response?.data?.message ?? err?.message ?? 'Tente novamente.',
        });
      },
    });
  }

  return (
    <div className="rounded-xl border-2 border-status-warning/40 bg-status-warning-muted/30 p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-status-warning-muted flex items-center justify-center shrink-0">
          <ShieldAlert size={20} className="text-status-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">
            Antes de enviar mensagens — termo de uso
          </h3>

          <div className="mt-3 rounded-lg bg-brand-surface p-4 text-sm text-text-secondary leading-relaxed">
            O estabelecimento <strong>{org.name}</strong> declara que seus clientes
            consentiram em receber comunicações sobre produtos e serviços, e autoriza a
            Nexora a enviar mensagens em seu nome para fins de reativação de clientes
            inativos. O estabelecimento assume total responsabilidade pelo consentimento
            de sua base de clientes.
          </div>

          <div className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              id="lgpd-accept"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={mutation.isPending}
              className="mt-1 w-4 h-4 rounded shrink-0"
            />
            <label htmlFor="lgpd-accept" className="text-sm text-text-primary cursor-pointer">
              Li e concordo com os termos acima.
            </label>
          </div>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!checked || mutation.isPending}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Registrando…
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                Aceitar e continuar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
