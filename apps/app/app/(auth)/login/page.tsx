import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/modules/auth/LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

interface LoginPageProps {
  searchParams?: { error?: string; detail?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const hasError = searchParams?.error === 'google_oauth';

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
      <h1 className="text-lg font-semibold text-text-primary mb-1">
        Bem-vindo de volta
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Entre na sua conta para continuar
      </p>
      {hasError && (
        <div className="rounded-lg border border-status-error/40 bg-status-error-muted/30 p-3 mb-4 text-sm text-status-error">
          <p className="font-medium">Não foi possível entrar com o Google.</p>
          <p className="text-xs mt-1">Tente novamente ou use email e senha.</p>
        </div>
      )}
      <LoginForm />
      <p className="text-xs text-text-muted text-center mt-4">
        Não tem uma conta?{' '}
        <Link href="/register" className="text-brand-amber hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
