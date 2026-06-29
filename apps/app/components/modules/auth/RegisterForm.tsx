'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { GoogleButton } from './GoogleButton';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  orgName: z.string().min(2, 'Mínimo 2 caracteres'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar o termo para continuar' }),
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

  const orgNameValue = watch('orgName') || 'sua clínica';

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      // niche fixo 'barbearia' no piloto — stages e prompts específicos de barbearia
      // name usa orgName como fallback — backend aceita opcional
      await registerUser(data.orgName, data.email, data.password, data.orgName, 'barbearia');
      try {
        const { apiClient } = await import('@/lib/api/client');
        await apiClient.post('/organizations/current/lgpd-accept');
      } catch {
        // Não bloqueia o fluxo — banner aparece dentro do app
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message ?? 'Erro ao criar conta. Tente novamente.');
    }
  }

  return (
    <div className="space-y-4">
    <GoogleButton label="Cadastrar com Google" />
    <div className="flex items-center gap-3">
      <hr className="flex-1 border-brand-border" />
      <span className="text-xs text-text-muted">ou preencha abaixo</span>
      <hr className="flex-1 border-brand-border" />
    </div>
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        label="Nome da sua clínica"
        type="text"
        autoComplete="organization"
        placeholder="Clínica Sorriso"
        iconLeft={<Building2 size={15} />}
        error={errors.orgName?.message}
        {...register('orgName')}
      />

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="voce@clinica.com"
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

      {/* Termo LGPD — fonte maior para leitura no celular */}
      <div className="rounded-lg border border-brand-border bg-brand-surface-2/40 p-4 space-y-3">
        <p className="text-base sm:text-sm text-text-secondary leading-relaxed">
          Você confirma que seus clientes aceitaram receber mensagens da{' '}
          <strong className="text-text-primary">{orgNameValue}</strong> e autoriza a Nexora a gerar
          mensagens de reativação em seu nome.
        </p>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded shrink-0 accent-brand-gold"
            {...register('acceptTerms')}
          />
          <span className="text-base sm:text-sm text-text-primary">
            Li e concordo com o termo acima.
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
        {isSubmitting ? 'Criando conta...' : 'Criar conta grátis'}
      </Button>
    </form>
    </div>
  );
}
