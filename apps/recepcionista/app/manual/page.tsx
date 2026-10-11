import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Como Nunca Mais Perder um Cliente pro Concorrente no WhatsApp — Nexora",
  description:
    "Descubra o que fazer quando o cliente te manda mensagem fora do horário comercial para nunca mais deixar ninguém sem resposta e fechar vendas 24h por dia.",
};

const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_CHECKOUT_MANUAL_URL ||
  "https://pay.kiwify.com.br/placeholder"; // Substituível via variável de ambiente

export default function PaginaManual() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Barra de Alerta Superior */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs sm:text-sm text-center py-2.5 px-4 font-medium flex items-center justify-center gap-2">
        <span>⚠️</span>
        <span>
          <strong>AVISO PARA QUEM VENDE PELO WHATSAPP:</strong> Se você demora mais de 5 minutos para responder, o cliente fecha com o concorrente.
        </span>
      </div>

      {/* 2. Topo com Marca */}
      <header className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-lg">
            N
          </div>
          <span className="font-semibold tracking-tight text-slate-200 text-base">Nexora</span>
        </div>
        <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
          Edição Exclusiva para Negócios Locais
        </span>
      </header>

      {/* 3. Hero Section (A Dor Central) */}
      <section className="max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
        <span className="inline-block text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-full mb-5">
          O Fim das Vendas Perdidas no WhatsApp
        </span>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15] mb-6">
          Enquanto você demora para responder no WhatsApp, o seu cliente está{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 underline decoration-emerald-500/50 decoration-wavy underline-offset-4">
            fechando com o seu concorrente.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-8">
          Descubra como nunca mais deixar um cliente sem resposta, tirar dúvidas e fechar agendamentos 24 horas por dia — sem você virar refém do celular.
        </p>

        {/* Badges de Confiança */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-slate-400 mb-8">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">⚡</span>
            <span>Resposta em 3 segundos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">📱</span>
            <span>No seu WhatsApp atual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">🛡️</span>
            <span>Garantia de 7 dias</span>
          </div>
        </div>

        {/* Botão de Chamada Imediata (Âncora ou Checkout) */}
        <div className="max-w-md mx-auto">
          <a
            href="#oferta"
            className="group w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 transform active:scale-[0.99] text-base sm:text-lg uppercase tracking-wide"
          >
            Quero o Guia Completo + Atendente 24h
            <svg
              className="w-5 h-5 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
          <p className="text-xs text-slate-500 mt-2">Acesso imediato no WhatsApp por apenas R$ 27</p>
        </div>
      </section>

      {/* 4. Demonstração Visual ao Vivo (O Choque de 3 Segundos) */}
      <section className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Topo do WhatsApp Simulado */}
          <div className="bg-slate-800/90 px-4 py-3 flex items-center justify-between border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-sm shadow">
                N
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Recepção Oficial da Empresa</p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online agora (Responde em 3 segundos)
                </p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Sábado, 22:15</span>
          </div>

          {/* Diálogo Simulado */}
          <div className="p-4 sm:p-6 space-y-4 bg-slate-950/80 font-sans text-sm">
            {/* Mensagem do Cliente */}
            <div className="flex justify-end">
              <div className="bg-emerald-950/80 border border-emerald-800/60 text-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                <p>Boa noite! Vocês ainda atendem hoje? Queria saber o preço e se tem horário para amanhã cedo.</p>
                <span className="block text-[10px] text-emerald-400/80 text-right mt-1 font-mono">22:15</span>
              </div>
            </div>

            {/* Resposta em 3 segundos */}
            <div className="flex justify-start">
              <div className="bg-slate-800/90 border border-slate-700 text-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[88%] shadow-sm">
                <p className="leading-relaxed">
                  Boa noite! Que bom te receber por aqui 😊
                  <br />
                  <br />
                  O valor do serviço é R$ 150 e para amanhã temos dois horários disponíveis: <strong>09:30</strong> ou{" "}
                  <strong>11:00</strong>.
                  <br />
                  <br />
                  Qual deles fica melhor para você confirmar na agenda?
                </p>
                <span className="block text-[10px] text-slate-400 text-right mt-1 font-mono">22:15 (3 segundos depois)</span>
              </div>
            </div>

            {/* Cliente fecha */}
            <div className="flex justify-end">
              <div className="bg-emerald-950/80 border border-emerald-800/60 text-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                <p>Nossa, que rápido! Quero às 09:30 por favor!</p>
                <span className="block text-[10px] text-emerald-400/80 text-right mt-1 font-mono">22:16</span>
              </div>
            </div>

            {/* Atendente confirma */}
            <div className="flex justify-start">
              <div className="bg-slate-800/90 border border-slate-700 text-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[88%] shadow-sm">
                <p>Perfeito! Já deixei o horário das 09:30 reservado para você. Qual seu nome completo para confirmação?</p>
                <span className="block text-[10px] text-slate-400 text-right mt-1 font-mono">22:16</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 text-center text-xs text-slate-400">
            📌 <strong>Isso aconteceu em um sábado às 22:15</strong>, sem nenhum funcionário digitando e sem o dono encostar no celular.
          </div>
        </div>
      </section>

      {/* 5. Os 3 Cenários Viscerais de Tortura */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Você abriu uma empresa para ter liberdade ou para virar escravo do WhatsApp?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Veja se você se reconhece em pelo menos uma dessas três cenas que acontecem toda semana:
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6">
          {/* Cenário 1 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl flex-shrink-0">
              🍝
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">1. O almoço de domingo interrompido</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                A família reunida na mesa, conversando e dando risada. O celular em cima da mesa vibra:{" "}
                <em>"Olá, quanto custa o serviço? Vocês atendem amanhã?"</em>. Você larga o garfo, sente o peso no estômago, digita correndo com culpa... e quando você manda a resposta 15 minutos depois, o cliente já chamou outro e nem te responde mais.
              </p>
            </div>
          </div>

          {/* Cenário 2 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
              🌙
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">2. O quarto escuro às 23:45</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Você trabalhou o dia inteiro, tá exausto e só queria dormir. Mas a luz azul da tela do celular tá na sua cara respondendo mensagens de gente perguntando horário e valor. Se você não responder agora, eles somem. Se você responder, você não descansa a cabeça.
              </p>
            </div>
          </div>

          {/* Cenário 3 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl flex-shrink-0">
              ✂️
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">3. As mãos ocupadas no atendimento</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Você tá com as mãos ocupadas atendendo um cliente no seu espaço (com luvas, tesoura, ferramentas ou em reunião). O WhatsApp apita 4 vezes seguidas na bancada. Você não pode parar. Quando você finalmente pega o celular 1 hora depois, os 4 já foram para a próxima empresa da lista.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. A Conta Invisível (O Prejuízo do Vácuo) */}
      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Faça essa conta rápida com a gente:</h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-6">
            Se apenas 3 pessoas te mandam mensagem fora do horário comercial durante a semana... e 2 delas desistem porque você demorou para responder:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <span className="text-2xl font-black text-red-400">8</span>
              <p className="text-xs text-slate-400 mt-1">Clientes perdidos todo mês</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <span className="text-2xl font-black text-red-400">R$ 1.200+</span>
              <p className="text-xs text-slate-400 mt-1">Dinheiro jogado no ralo</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <span className="text-2xl font-black text-emerald-400">3 Segundos</span>
              <p className="text-xs text-slate-400 mt-1">Tempo para fechar a venda</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-400">
            O seu problema nunca foi falta de clientes. O seu problema é que <strong>cliente não espera</strong>.
          </p>
        </div>
      </section>

      {/* 7. O Que Você Recebe no Guia Oficial */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Conteúdo Prático de Aplicação Imediata</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            O que você vai aprender no Guia Oficial:
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
            <span className="text-emerald-400 font-bold text-sm">Pilar 1</span>
            <h3 className="text-base font-bold text-white mt-1 mb-2">A Resposta nos Primeiros Segundos</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Como prender a atenção do cliente antes dele abrir o WhatsApp de outra empresa da sua cidade.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
            <span className="text-emerald-400 font-bold text-sm">Pilar 2</span>
            <h3 className="text-base font-bold text-white mt-1 mb-2">Como Passar Preço Sem Assustar</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              A estrutura de mensagem que tira dúvidas de valores e conduz direto para o agendamento em vez de gerar vácuo.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
            <span className="text-emerald-400 font-bold text-sm">Pilar 3</span>
            <h3 className="text-base font-bold text-white mt-1 mb-2">A Blindagem da Noite e Finais de Semana</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              O jeito exato de acolher e fechar as pessoas que te chamam sexta à noite, sábado e domingo.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
            <span className="text-emerald-400 font-bold text-sm">Pilar 4</span>
            <h3 className="text-base font-bold text-white mt-1 mb-2">O Resgate Educado de Clientes Sumidos</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              O texto de 2 linhas para reativar contatos que pediram orçamento no último mês e sumiram, sem parecer chato.
            </p>
          </div>
        </div>
      </section>

      {/* 8. O Gancho Inevitável: O Atendente Nexora de Presente Inclusivo */}
      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Bônus Exclusivo de Lançamento Incluído
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            E você não vai precisar digitar nada disso na mão. Nós já deixamos a Nexora pronta para você.
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-4">
            Você poderia pegar esse guia e tentar responder todo mundo correndo no celular, parando o seu almoço e acordando de madrugada. Mas nós sabemos que você não tem tempo para isso.
          </p>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
            Por isso, ao garantir o material hoje por <strong>R$ 27</strong>, você ganha de presente o{" "}
            <strong className="text-emerald-400">Atendente Nexora</strong>: a recepção oficial pronta que faz tudo isso direto no seu próprio WhatsApp 24 horas por dia, 7 dias por semana.
          </p>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 grid sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Já preparado para o seu ramo de atuação</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Conecta no seu WhatsApp em 30 segundos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Responde clientes na hora enquanto você dorme</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Zero contratos, cancela quando quiser com 1 toque</span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. A Caixa de Oferta Oficial */}
      <section id="oferta" className="max-w-xl mx-auto px-4 py-12 scroll-mt-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center relative">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full mb-4">
            Acesso Imediato
          </span>

          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Como Nunca Mais Perder um Cliente pro Concorrente no WhatsApp
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mb-6">
            O Guia Completo + Sua Recepção Oficial Nexora Pronta Inclusa
          </p>

          {/* Âncora de Preço */}
          <div className="mb-6 py-4 border-y border-slate-800/80">
            <span className="text-xs text-slate-500 line-through">De R$ 97,00</span>
            <div className="flex items-center justify-center gap-1 my-1">
              <span className="text-slate-400 text-sm">Por apenas</span>
              <span className="text-4xl sm:text-5xl font-black text-emerald-400">R$ 27</span>
              <span className="text-slate-400 text-xs">à vista</span>
            </div>
            <span className="text-xs text-slate-400">ou 3x de R$ 9,90 no cartão</span>
          </div>

          {/* O que está incluso */}
          <ul className="text-left text-xs sm:text-sm text-slate-300 space-y-2.5 mb-8">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Guia Completo: Como Nunca Mais Perder um Cliente pro Concorrente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Atendente Oficial Nexora 24h já pronto para o seu ramo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Ativação instantânea no WhatsApp em menos de 1 minuto</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Garantia incondicional de 7 dias de devolução do dinheiro</span>
            </li>
          </ul>

          {/* Botão de Compra */}
          <a
            href={CHECKOUT_URL}
            className="group w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 transform active:scale-[0.99] text-base sm:text-lg uppercase tracking-wide text-center"
          >
            Garantir Meu Acesso Agora
            <svg
              className="w-5 h-5 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>

          <p className="text-[11px] text-slate-500 mt-3">
            Pagamento seguro via Pix ou Cartão de Crédito. Acesso liberado no WhatsApp em instantes.
          </p>
        </div>
      </section>

      {/* 10. Garantia Incondicional de 7 Dias */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 sm:p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl flex-shrink-0">
            🛡️
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Garantia Incondicional de 7 Dias</h4>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Coloque o guia e o atendente para rodar. Se em até 7 dias você não sentir o alívio de ter seu WhatsApp atendido na hora e clientes sendo agendados, basta um e-mail e devolvemos 100% do seu dinheiro. Sem letras miúdas.
            </p>
          </div>
        </div>
      </section>

      {/* 11. Dúvidas Frequentes (Sem Jargões) */}
      <section className="max-w-2xl mx-auto px-4 py-12">
        <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-6">Dúvidas Frequentes</h3>
        <div className="space-y-3 text-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h5 className="font-bold text-white mb-1">Preciso deixar o computador ligado?</h5>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Não. O atendimento funciona 100% em nuvem. Seu computador e celular podem estar desligados que ele continua atendendo e agendando clientes normalmente.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h5 className="font-bold text-white mb-1">Muda o meu número de WhatsApp?</h5>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Não. Você conecta o seu próprio WhatsApp atual em menos de 1 minuto escaneando o QR Code pelo celular. Você não perde nenhuma conversa.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h5 className="font-bold text-white mb-1">Funciona para o meu tipo de negócio?</h5>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Sim! Já deixamos tudo preparado para clínicas, consultórios, estética, barbearias, mecânicas, pet shops, advogados e mais de 15 setores do comércio e serviços locais.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h5 className="font-bold text-white mb-1">Como eu recebo o material e o atendimento?</h5>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Assim que o seu pagamento for aprovado, seu WhatsApp já abre automaticamente com a Sofia, que entrega o guia e libera o seu atendimento na hora.
            </p>
          </div>
        </div>
      </section>

      {/* 12. Rodapé */}
      <footer className="max-w-4xl mx-auto px-4 py-8 border-t border-slate-900 text-center text-xs text-slate-500">
        <p className="mb-2">Nexora • Solução Oficial de Atendimento para Pequenos e Médios Negócios</p>
        <p>Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
