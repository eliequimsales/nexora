import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/modules/auth/LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
      <h1 className="text-lg font-semibold text-text-primary mb-1">
        Bem-vindo de volta
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Entre na sua conta para continuar
      </p>
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
