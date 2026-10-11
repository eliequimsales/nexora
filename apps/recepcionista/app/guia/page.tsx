import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guia Oficial: Como Nunca Mais Perder um Cliente pro Concorrente no WhatsApp",
  description:
    "Manual prático de recepção e fechamento no WhatsApp para donos de pequenos e médios negócios.",
};

export default function PaginaGuia() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950 py-8 px-4 sm:py-12">
      <article className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-sm">
        {/* Topo / Selo */}
        <header className="border-b border-slate-800 pb-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-base">
                N
              </div>
              <span className="font-semibold tracking-tight text-slate-200 text-sm">Nexora • Material Oficial</span>
            </div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              Acesso do Comprador
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
            Como Nunca Mais Perder um Cliente pro Concorrente no WhatsApp
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            O que fazer quando o cliente te manda mensagem fora do horário comercial, para você não deixar ninguém esperando e nunca mais perder a venda.
          </p>
        </header>

        {/* Aviso de Execução Automática */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 mb-8 flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            <strong className="text-emerald-400">Lembre-se:</strong> Você pode usar esses roteiros manualmente, ou pode ligar o seu <strong>Atendente Nexora</strong> que já vem com tudo isso pronto para responder no seu WhatsApp em 3 segundos sem você precisar encostar no celular.
            <div className="mt-2">
              <Link
                href="/ativar"
                className="inline-flex items-center gap-1.5 text-emerald-400 font-bold hover:underline"
              >
                Toque aqui para conectar seu Atendente agora →
              </Link>
            </div>
          </div>
        </div>

        {/* Corpo do Conteúdo */}
        <div className="space-y-8 text-slate-300 text-sm sm:text-base leading-relaxed">
          {/* Pilar 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-mono">1</span>
              A Regra dos 3 Segundos: Por Que Velocidade Bate Preço
            </h2>
            <p>
              Quando uma pessoa te manda mensagem no WhatsApp perguntando sobre preço ou horário, ela está no momento mais quente de compra. Na maioria das vezes, ela pesquisou no Google ou no Instagram e mandou mensagem para você <strong>e para mais dois concorrentes da sua rua</strong>.
            </p>
            <p>
              Quem responde primeiro ganha a atenção. Se você demorar mais de 5 minutos, a probabilidade do cliente já ter fechado com outro ou perdido o interesse aumenta em mais de 70%.
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-sans text-xs sm:text-sm">
              <p className="font-semibold text-emerald-400 mb-1">A Resposta Imediata de Abertura:</p>
              <p className="italic text-slate-200">
                "Olá! Que bom te receber por aqui 😊 Nós temos exatamente o que você precisa. Como posso te ajudar hoje?"
              </p>
            </div>
          </section>

          {/* Pilar 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-mono">2</span>
              Como Passar Preço Sem Assustar e Sem Ficar no Vácuo
            </h2>
            <p>
              O maior erro dos comércios locais é responder mensagens com uma única linha: <em>"Custa R$ 150"</em>.
            </p>
            <p>
              Quando você joga o preço seco, o cliente não vê valor e para de responder. A estrutura correta sempre inclui **o valor + duas opções de horário/ação imediata**.
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-sans text-xs sm:text-sm">
              <p className="font-semibold text-emerald-400 mb-1">A Estrutura de Condução:</p>
              <p className="text-slate-200">
                1. <strong>Acolhimento:</strong> "O valor do procedimento/serviço é R$ X e inclui [benefício principal]."
                <br />
                2. <strong>Opção de Ação:</strong> "Para esta semana temos dois horários livres: quinta às 14h ou sexta às 10h. Qual fica melhor para você garantir?"
              </p>
            </div>
          </section>

          {/* Pilar 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-mono">3</span>
              A Blindagem Noturna e de Finais de Semana
            </h2>
            <p>
              Mais de 40% das mensagens de clientes chegam fora do horário comercial — especialmente sexta à noite, sábado à tarde e domingo.
            </p>
            <p>
              O cliente não quer esperar até segunda-feira às 08h para saber se você tem horário. Ele quer resolver a vida dele no momento em que ele tem tempo. Responder na hora fora de hora é o maior diferencial competitivo que uma empresa local pode ter.
            </p>
          </section>

          {/* Módulo Bônus: O Resgate */}
          <section className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">🎁 MÓDULO EXCLUSIVO:</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                O Resgate Rápido de Clientes que Sumiram
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Mais de 60% dos clientes que pediram orçamento no seu WhatsApp no último mês e não fecharam ainda têm interesse, mas foram interrompidos pela rotina. Use essas 3 mensagens para reativá-los:
            </p>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg">
                <p className="font-bold text-white mb-1">Mensagem 1: O "Esqueci de te perguntar" (24h a 48h depois)</p>
                <p className="text-slate-300 italic">
                  "Oi [Nome]! Tudo bem? Lembrei de você aqui e esqueci de te perguntar: você conseguiu resolver aquela questão do [serviço]? Se ainda precisar, temos um horário livre amanhã!"
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg">
                <p className="font-bold text-white mb-1">Mensagem 2: A Vaga de Encaixe (3 a 5 dias depois)</p>
                <p className="text-slate-300 italic">
                  "Oi [Nome]! Surgiu um encaixe de última hora para amanhã às [Horário]. Como você tinha me pedido orçamento essa semana, quis te avisar primeiro antes de liberar na lista de espera. Quer aproveitar?"
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg">
                <p className="font-bold text-white mb-1">Mensagem 3: A Limpeza Elegante (7 dias depois)</p>
                <p className="text-slate-300 italic">
                  "Oi [Nome]! Passando só para saber se posso encerrar sua cotação por aqui ou se você prefere manter reservada para a próxima semana? Um abraço!"
                </p>
              </div>
            </div>
          </section>

          {/* CTA de Ativação do Atendente */}
          <section className="bg-gradient-to-r from-emerald-950/80 to-slate-900 border-2 border-emerald-500/40 rounded-xl p-6 text-center space-y-4">
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Deixe o Atendente Nexora Fazer Tudo Isso Por Você 24h
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              Você não precisa ficar digitando esses textos todo dia. Conecte seu WhatsApp na Nexora em menos de 1 minuto e tenha uma recepção oficial respondendo clientes dia e noite no automático.
            </p>
            <div>
              <Link
                href="/ativar"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 text-sm sm:text-base uppercase tracking-wide"
              >
                Conectar Meu WhatsApp Agora 📲
              </Link>
            </div>
            <p className="text-[11px] text-slate-500">Já incluído no seu acesso • Conexão em 30 segundos</p>
          </section>
        </div>

        {/* Rodapé */}
        <footer className="mt-10 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
          Nexora Oficial • Todos os direitos reservados.
        </footer>
      </article>
    </main>
  );
}
