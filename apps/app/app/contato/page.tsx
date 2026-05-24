'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, MessageSquare, CheckCircle } from 'lucide-react';

export default function ContatoPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', mensagem: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simula envio — integração real via email ou Formspree pode ser adicionada
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="border-b border-brand-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            <span className="text-brand-gold">N</span>
            <span className="text-text-primary">exora</span>
          </Link>
          <Link href="/login" className="text-sm text-text-secondary hover:text-text-primary">Entrar</Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Fale com a gente</h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            Tem dúvidas, sugestões ou precisa de ajuda? Envie uma mensagem e respondemos em até 1 dia útil.
          </p>
        </div>

        {/* Contato direto */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <a
            href="mailto:contato@nexora.com.br"
            className="flex items-center gap-3 px-5 py-4 rounded-xl border border-brand-border bg-brand-surface hover:border-brand-amber/40 transition-colors group"
          >
            <Mail size={18} className="text-brand-gold shrink-0" />
            <div>
              <p className="text-xs text-text-muted">Email</p>
              <p className="text-sm font-medium text-text-primary group-hover:text-brand-gold transition-colors">
                contato@nexora.com.br
              </p>
            </div>
          </a>

          <a
            href="https://wa.me/5511999999999?text=Oi%2C+vim+pelo+site+da+Nexora"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-4 rounded-xl border border-brand-border bg-brand-surface hover:border-brand-amber/40 transition-colors group"
          >
            <MessageSquare size={18} className="text-brand-gold shrink-0" />
            <div>
              <p className="text-xs text-text-muted">WhatsApp</p>
              <p className="text-sm font-medium text-text-primary group-hover:text-brand-gold transition-colors">
                Chamar no WhatsApp
              </p>
            </div>
          </a>
        </div>

        {/* Formulário */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <CheckCircle size={36} className="text-brand-gold" />
              <p className="text-base font-semibold text-text-primary">Mensagem enviada!</p>
              <p className="text-sm text-text-secondary">Respondemos em até 1 dia útil no seu email.</p>
              <button
                onClick={() => { setSent(false); setForm({ nome: '', email: '', mensagem: '' }); }}
                className="mt-2 text-sm text-brand-gold hover:underline"
              >
                Enviar outra mensagem
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Nome</label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="João Silva"
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-amber/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="joao@barbearia.com"
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-amber/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Mensagem</label>
                <textarea
                  required
                  rows={5}
                  value={form.mensagem}
                  onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                  placeholder="Descreva sua dúvida ou sugestão..."
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-amber/60 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand-amber text-brand-bg text-sm font-semibold hover:bg-brand-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="border-t border-brand-border px-6 py-6 mt-12">
        <div className="max-w-4xl mx-auto flex gap-6 text-sm text-text-muted">
          <Link href="/privacidade" className="hover:text-text-primary">Privacidade</Link>
          <Link href="/termos" className="hover:text-text-primary">Termos</Link>
          <Link href="/contato" className="hover:text-text-primary">Contato</Link>
        </div>
      </footer>
    </div>
  );
}
