import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Nexora',
  robots: { index: true, follow: true },
};

export default function PrivacidadePage() {
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

      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Política de Privacidade</h1>
        <p className="text-text-muted text-sm mb-10">Última atualização: maio de 2026</p>

        <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">1. Quem somos</h2>
            <p>A Nexora é uma plataforma de recuperação de clientes para barbearias. Operamos no Brasil e estamos em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">2. Dados que coletamos</h2>
            <ul className="list-disc ml-4 space-y-1">
              <li><strong className="text-text-primary">Dados da conta:</strong> nome, email, senha (criptografada), nome da barbearia.</li>
              <li><strong className="text-text-primary">Dados dos clientes da barbearia:</strong> nome, telefone e data do último atendimento, importados pelo próprio dono da barbearia.</li>
              <li><strong className="text-text-primary">Dados de uso:</strong> logs de acesso, ações na plataforma, erros técnicos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">3. Como usamos os dados</h2>
            <ul className="list-disc ml-4 space-y-1">
              <li>Identificar clientes inativos com base na data do último atendimento.</li>
              <li>Gerar sugestões de mensagens de reativação personalizadas via IA.</li>
              <li>Exibir métricas e relatórios para o dono da barbearia.</li>
              <li>Enviar comunicações sobre o serviço (não spam comercial).</li>
            </ul>
            <p className="mt-2">Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins comerciais.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">4. Base legal (LGPD)</h2>
            <p>Processamos dados com base em: (a) execução do contrato de serviço, (b) consentimento explícito do usuário no cadastro, (c) legítimo interesse para melhoria do serviço.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">5. Seus direitos</h2>
            <p>Como titular de dados, você pode a qualquer momento:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Acessar e exportar todos os seus dados (via configurações da conta).</li>
              <li>Corrigir dados incorretos.</li>
              <li>Solicitar a exclusão completa da sua conta e dados.</li>
              <li>Revogar consentimento.</li>
            </ul>
            <p className="mt-2">Para exercer esses direitos, entre em contato: <a href="mailto:privacidade@nexora.com.br" className="text-brand-gold hover:underline">privacidade@nexora.com.br</a></p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">6. Segurança</h2>
            <p>Utilizamos criptografia TLS em trânsito, senhas armazenadas com hash bcrypt, e isolamento de dados por organização. Acesso à produção é restrito e auditado.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">7. Cookies</h2>
            <p>Usamos cookies estritamente necessários para autenticação. Não utilizamos cookies de rastreamento ou marketing.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">8. Retenção de dados</h2>
            <p>Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão, os dados são removidos em até 30 dias, exceto quando exigido por lei.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">9. Contato</h2>
            <p>Dúvidas sobre privacidade: <a href="mailto:privacidade@nexora.com.br" className="text-brand-gold hover:underline">privacidade@nexora.com.br</a></p>
          </section>
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
