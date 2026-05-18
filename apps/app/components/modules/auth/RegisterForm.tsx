'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { getSupportedNiches, getNicheConfig } from '@nexora/shared';

const NICHE_OPTIONS = getSupportedNiches().map((key) => ({
  value: key,
  label: getNicheConfig(key).labels.nicheDisplayName,
}));

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  orgName: z.string().min(2, 'Mínimo 2 caracteres'),
  niche: z.string().min(1, 'Selecione o segmento'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar o termo de uso para continuar' }),
  }),
});

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const orgNameValue = watch('orgName') || 'sua empresa';

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      // Cria a conta — o aceite efetivo do termo é registrado logo após o registro
      // chamando POST /organizations/current/lgpd-accept (já temos o hook).
      // Como o registro retorna access_token, o cliente já está autenticado.
      await registerUser(data.name, data.email, data.password, data.orgName, data.niche);
      // O hook useAcceptLgpd usa o token JWT que acabou de ser setado.
      // Fire-and-forget aqui é OK porque o backend já guarda o aceite no DB.
      try {
        const { apiClient } = await import('@/lib/api/client');
        await apiClient.post('/organizations/current/lgpd-accept');
      } catch {
        // Se falhar, o banner aparece dentro do app e o usuário aceita lá — não bloqueia o fluxo
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message ?? 'Erro ao criar conta. Tente novamente.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        label="Nome completo"
        type="text"
        autoComplete="name"
        placeholder="João Silva"
        iconLeft={<User size={15} />}
        error={errors.name?.message}
        {...register('name')}
      />

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com"
        iconLeft={<Mail size={15} />}
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Senha"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="••••••••"
        iconLeft={<Lock size={15} />}
        iconRight={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="text-text-muted hover:text-text-secondary transition-colors pointer-events-auto"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label="Nome da empresa"
        type="text"
        autoComplete="organization"
        placeholder="Minha Empresa"
        iconLeft={<Building2 size={15} />}
        error={errors.orgName?.message}
        {...register('orgName')}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-primary">
          Segmento de negócio
        </label>
        <select
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
          {...register('niche')}
          defaultValue=""
        >
          <option value="" disabled>Selecione seu segmento...</option>
          {NICHE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.niche && (
          <p className="text-xs text-status-error">{errors.niche.message}</p>
        )}
      </div>

      {/* Termo de uso — obrigatório para criar conta */}
      <div className="rounded-lg border border-brand-border bg-brand-surface-2/40 p-3 space-y-2">
        <p className="text-xs text-text-secondary leading-relaxed">
          O estabelecimento <strong>{orgNameValue}</strong> declara que seus clientes consentiram em
          receber comunicações sobre produtos e serviços, e autoriza a Nexora a enviar mensagens em
          seu nome para fins de reativação de clientes inativos. O estabelecimento assume total
          responsabilidade pelo consentimento de sua base de clientes.
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded shrink-0"
            {...register('acceptTerms')}
          />
          <span className="text-xs text-text-primary">
            Li e concordo com o termo de uso acima.
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-xs text-status-error">{errors.acceptTerms.message}</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-xs text-status-error flex items-center gap-1.5">
          <span aria-hidden>✗</span> {serverError}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isSubmitting}
        className="w-full mt-2"
      >
        {isSubmitting ? 'Criando conta...' : 'Criar conta'}
      </Button>
    </form>
  );
}
