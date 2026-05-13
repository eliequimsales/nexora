'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/hooks/auth/useAuth';

const schema = z.object({
  slug: z.string().min(1, 'Informe o workspace'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      await login(data.email, data.password, data.slug);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message ?? 'Email ou senha incorretos');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        label="Workspace"
        type="text"
        autoComplete="organization"
        placeholder="minha-empresa"
        iconLeft={<Building2 size={15} />}
        error={errors.slug?.message}
        {...register('slug')}
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
        autoComplete="current-password"
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
        {isSubmitting ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  );
}
