"use client";

interface Depoimento {
  nome: string;
  cargo: string;
  empresa: string;
  cidade: string;
  tag: string;
  iniciais: string;
  avatarCor: string;
  depoimento: string;
  destaque: string;
}

const DEPOIMENTOS: Depoimento[] = [
  {
    nome: "Dra. Beatriz Ramos",
    cargo: "Proprietária e Biomédica",
    empresa: "Clínica Renove Estética",
    cidade: "São Paulo, SP",
    tag: "Clínica & Estética",
    iniciais: "BR",
    avatarCor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    destaque: "Fechou 5 agendamentos no primeiro domingo à noite",
    depoimento:
      "Eu acordava toda segunda com mensagens de clientes que mandavam mensagem domingo 22h e já tinham marcado em outra clínica. No primeiro fim de semana com a Nexora, o Atendente respondeu em segundos e fechou 3 procedimentos e 2 avaliações no automático. Eu estava jantando com a minha família e as vendas entrando.",
  },
  {
    nome: "Matheus Fontes",
    cargo: "Fundador",
    empresa: "Barbearia Dom Lucas",
    cidade: "Rio de Janeiro, RJ",
    tag: "Barbearia & Cuidados",
    iniciais: "MF",
    avatarCor: "bg-amber/15 text-amber border-amber/30",
    destaque: "Conectou no próprio celular em 1 minuto",
    depoimento:
      "Cortando cabelo o dia todo é impossível ficar com o WhatsApp na mão. Se você demora 10 minutos para responder um valor ou horário, o cliente vai na barbearia ao lado. Com a Nexora, ele responde os preços certos e já fecha o horário sem conflito. Conectei direto pelo celular com código de pareamento, sem precisar de câmera nem de PC.",
  },
  {
    nome: "Dr. Eduardo Camargo",
    cargo: "Cirurgião-Dentista",
    empresa: "OdontoCamargo Integrada",
    cidade: "Curitiba, PR",
    tag: "Consultório & Saúde",
    iniciais: "EC",
    avatarCor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    destaque: "Atendimento humanizado sem parecer robô frio",
    depoimento:
      "Meu receio era parecer aquele 'digite 1 para isso, 2 para aquilo' que todo mundo odeia. Mas a Nexora responde em linguagem natural, tira dúvidas reais de valores e horários e é tão educada que os pacientes chegam no consultório elogiando o atendimento da 'nossa recepcionista'. A taxa de agendamento subiu 35%.",
  },
  {
    nome: "Juliana Alencar",
    cargo: "Sócia-Diretora",
    empresa: "Espaço Movimento & Pilates",
    cidade: "Belo Horizonte, MG",
    tag: "Pilates & Bem-estar",
    iniciais: "JA",
    avatarCor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    destaque: "Zero clientes perdidos no almoço e pós-horário",
    depoimento:
      "A gente não tem recepcionista em tempo integral. No horário de almoço e depois das 19h as mensagens acumulavam. Agora ninguém fica esperando. A primeira semana por conta da Nexora me deu a certeza de testar sem risco nenhum. Já virou item indispensável do estúdio.",
  },
];

const METRICAS = [
  {
    numero: "< 5 seg",
    rotulo: "Tempo de resposta 24/7",
    detalhe: "Nenhum cliente esperando no WhatsApp",
  },
  {
    numero: "+35%",
    rotulo: "Mais agendamentos fechados",
    detalhe: "Respostas imediatas fora do expediente",
  },
  {
    numero: "1 min",
    rotulo: "Conexão no próprio celular",
    detalhe: "Via código de pareamento, sem câmera",
  },
  {
    numero: "4.9 / 5",
    rotulo: "Satisfação dos clientes",
    detalhe: "Atendimento acolhedor e natural",
  },
];

export function ProvaSocialNotion() {
  return (
    <section className="scroll-mt-20 border-t border-nx-border/80 bg-nx-surface-2/30 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        {/* CABEÇALHO ESTILO NOTION */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-nx-gold/30 bg-nx-gold/10 px-3 py-1 text-xs font-semibold text-nx-gold">
            <span>★</span> Prova Social & Casos Reais
          </div>

          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl text-nx-primary">
            Usado por quem atende clientes todos os dias
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-nx-secondary">
            De clínicas e barbearias a consultórios e estúdios: veja como negócios locais pararam de perder clientes de madrugada e finais de semana.
          </p>
        </div>

        {/* BARRA DE NÚMEROS / MÉTRICAS ESTILO NOTION */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {METRICAS.map((m) => (
            <div
              key={m.rotulo}
              className="rounded-2xl border border-nx-border bg-nx-surface p-4 text-center sm:p-5 transition hover:border-nx-gold/30"
            >
              <p className="font-mono text-2xl font-black text-nx-gold sm:text-3xl tabular-nums">
                {m.numero}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-nx-primary sm:text-sm">
                {m.rotulo}
              </p>
              <p className="mt-0.5 text-[11px] text-nx-muted hidden sm:block">
                {m.detalhe}
              </p>
            </div>
          ))}
        </div>

        {/* GRID DE CARDS ESTILO NOTION */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {DEPOIMENTOS.map((d) => (
            <div
              key={d.nome}
              className="group relative flex flex-col justify-between rounded-2xl border border-nx-border bg-nx-surface p-6 sm:p-7 shadow-nx-panel transition-all hover:border-nx-gold/40 hover:shadow-nx-glow-sm"
            >
              <div>
                {/* TOPO: TAG + ESTRELAS */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-nx-border bg-nx-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-nx-secondary">
                    {d.tag}
                  </span>
                  <div className="flex text-amber text-xs tracking-wider" aria-label="5 de 5 estrelas">
                    ★★★★★
                  </div>
                </div>

                {/* DESTAQUE RÁPIDO */}
                <p className="mt-3.5 text-xs font-semibold text-nx-gold">
                  ✦ {d.destaque}
                </p>

                {/* TEXTO DO DEPOIMENTO */}
                <p className="mt-2.5 text-sm leading-relaxed text-nx-secondary">
                  &ldquo;{d.depoimento}&rdquo;
                </p>
              </div>

              {/* AUTOR / PERFIL */}
              <div className="mt-6 flex items-center gap-3 border-t border-nx-border/60 pt-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${d.avatarCor}`}
                >
                  {d.iniciais}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-semibold text-nx-primary truncate">
                    {d.nome}
                  </p>
                  <p className="text-xs text-nx-muted truncate">
                    {d.cargo} • {d.empresa}
                  </p>
                  <p className="text-[11px] text-nx-muted/80">
                    {d.cidade}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* NOTA DE CONFIANÇA RÁPIDA */}
        <div className="mt-10 text-center">
          <p className="text-xs text-nx-secondary">
            ⚡ Configuração em 2 minutos • Conecte no celular sem câmera • Primeira semana por nossa conta
          </p>
        </div>
      </div>
    </section>
  );
}
