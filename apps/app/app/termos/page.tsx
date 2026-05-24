import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso — Nexora',
  robots: { index: true, follow: true },
};

export default function TermosPage() {
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
        <h1 className="text-3xl font-bold text-text-primary mb-2">Termos de Uso</h1>
        <p className="text-text-muted text-sm mb-10">Última atualização: maio de 2026</p>

        <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">1. Aceitação dos termos</h2>
            <p>Ao criar uma conta ou utilizar a plataforma Nexora, você concorda com estes Termos de Uso. Se você não concordar com qualquer parte, não utilize a plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">2. O serviço</h2>
            <p>A Nexora é uma plataforma de recuperação de clientes para barbearias. Ela permite:</p>
            <ul className="list-disc ml-4 space-y-1 mt-2">
              <li>Identificar clientes que não retornam há mais de 30 dias.</li>
              <li>Gerar sugestões de mensagens de reativação personalizadas via IA.</li>
              <li>Acompanhar métricas de recência e engajamento dos clientes.</li>
            </ul>
            <p className="mt-2">A Nexora <strong className="text-text-primary">não envia mensagens automaticamente</strong>. O envio é sempre manual e de responsabilidade do usuário.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">3. Cadastro e conta</h2>
            <p>Para usar a Nexora você precisa:</p>
            <ul className="list-disc ml-4 space-y-1 mt-2">
              <li>Ser maior de 18 anos ou ter autorização legal para gerir um negócio.</li>
              <li>Fornecer informações verdadeiras no cadastro.</li>
              <li>Manter sua senha segura e não compartilhá-la.</li>
            </ul>
            <p className="mt-2">Você é responsável por toda a atividade realizada na sua conta.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">4. Uso permitido</h2>
            <p>Você pode usar a Nexora para fins legítimos de relacionamento com seus próprios clientes. É <strong className="text-text-primary">proibido</strong>:</p>
            <ul className="list-disc ml-4 space-y-1 mt-2">
              <li>Enviar spam ou mensagens não solicitadas em massa.</li>
              <li>Importar listas de contatos de terceiros sem consentimento.</li>
              <li>Usar a plataforma para fins ilegais ou fraudulentos.</li>
              <li>Tentar acessar dados de outras organizações.</li>
              <li>Fazer engenharia reversa ou extrair código da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">5. Responsabilidade pelo conteúdo</h2>
            <p>As sugestões geradas pela IA são apenas sugestões. Você é responsável por:</p>
            <ul className="list-disc ml-4 space-y-1 mt-2">
              <li>Revisar e editar as mensagens antes de enviá-las.</li>
              <li>Garantir que seus clientes aceitaram receber comunicações suas.</li>
              <li>Cumprir as regras da plataforma de mensagens utilizada (WhatsApp, SMS, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">6. Pagamento e planos</h2>
            <p>Durante o período de piloto, o acesso à Nexora é gratuito. Quando planos pagos forem lançados, você será notificado com antecedência mínima de 15 dias. A cobrança será por assinatura mensal. Cancelamentos são efetivos ao fim do período vigente.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">7. Disponibilidade</h2>
            <p>Fazemos o melhor esforço para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta. Podemos fazer manutenções programadas ou emergenciais a qualquer momento.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">8. Limitação de responsabilidade</h2>
            <p>A Nexora não se responsabiliza por:</p>
            <ul className="list-disc ml-4 space-y-1 mt-2">
              <li>Resultados de campanhas de reativação enviadas pelo usuário.</li>
              <li>Bloqueios em aplicativos de mensagens por uso inadequado.</li>
              <li>Perda de receita decorrente de indisponibilidade do serviço.</li>
              <li>Conteúdo de mensagens enviadas pelo usuário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">9. Encerramento</h2>
            <p>Você pode cancelar sua conta a qualquer momento em Configurações → Conta. A Nexora pode encerrar contas que violem estes termos, com ou sem aviso prévio.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">10. Alterações nos termos</h2>
            <p>Podemos atualizar estes termos periodicamente. Notificaremos mudanças relevantes por email. O uso continuado da plataforma após a notificação implica aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">11. Lei aplicável</h2>
            <p>Estes termos são regidos pelas leis brasileiras. O foro eleito é o da Comarca de São Paulo – SP, com renúncia a qualquer outro.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">12. Contato</h2>
            <p>Dúvidas sobre estes termos: <a href="mailto:contato@nexora.com.br" className="text-brand-gold hover:underline">contato@nexora.com.br</a></p>
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
