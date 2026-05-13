import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/modules/auth/RegisterForm';

export const metadata: Metadata = { title: 'Criar conta' };

export default function RegisterPage() {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
      <h1 className="text-lg font-semibold text-text-primary mb-1">
        Crie sua conta
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Configure seu workspace em menos de 1 minuto
      </p>
      <RegisterForm />
      <p className="text-xs text-text-muted text-center mt-4">
        Já tem uma conta?{' '}
        <Link href="/login" className="text-brand-amber hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
