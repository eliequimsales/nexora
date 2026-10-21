"use client";

import type { ConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { AvisoCampoNexa as AvisoCampo, BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, CampoNexa as Campo, CartaoNexa as Cartao, DetalhesNexa as Detalhes, EscolhaNexa as Escolha, InformacaoNexaCampo as Informacao, RevisaoNexa as Revisao } from "./configuracao-campos";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
type Props = {
  etapa: number;
  dados: ConfiguracaoNexa;
  editar: <K extends keyof ConfiguracaoNexa>(secao: K, dados: Partial<ConfiguracaoNexa[K]>) => void;
};

export function FormularioConfiguracaoNexa({ etapa, dados: d, editar }: Props) {
  const usaAgenda = d.negocio.objetivo === "AGENDAMENTOS" || d.atendimento.agendamento !== "DESLIGADO";

  if (etapa === 0) return <Cartao titulo="Seu negócio" descricao="O que o seu atendente precisa conhecer para começar.">
    <Campo titulo="Nome do negócio" campo="negocio.nome"><input className={CAMPO} maxLength={120} value={d.negocio.nome} onChange={e => editar("negocio", { nome: e.target.value })} autoComplete="organization" /></Campo>
    <Campo campo="negocio.segmento" titulo="Área de atuação" dica="Por exemplo: barbearia, clínica ou assistência técnica."><input className={CAMPO} maxLength={120} value={d.negocio.segmento} onChange={e => editar("negocio", { segmento: e.target.value })} /></Campo>
    <Campo titulo="Como você atende"><select className={CAMPO} value={d.negocio.modalidade} onChange={e => editar("negocio", { modalidade: e.target.value as typeof d.negocio.modalidade })}><option value="PRESENCIAL">Em um endereço</option><option value="ONLINE">Online</option><option value="DOMICILIO">No local do cliente</option><option value="HIBRIDO">De mais de uma forma</option></select></Campo>
    <Escolha titulo="Qual será a principal tarefa do seu atendente?" valor={d.negocio.objetivo} mudar={objetivo => editar("negocio", { objetivo })} opcoes={[
      { valor: "DUVIDAS", titulo: "Responder dúvidas", descricao: "Explicar as informações do seu negócio." },
      { valor: "SOLICITACOES", titulo: "Receber pedidos e solicitações", descricao: "Entender o que o cliente precisa e encaminhar para a equipe." },
      { valor: "AGENDAMENTOS", titulo: "Ajudar com agendamentos", descricao: "Oferecer o link ou agendar pela conversa, como você escolher." },
    ]} />
    <Detalhes titulo={d.negocio.modalidade === "DOMICILIO" ? "Região atendida e apresentação" : "Mais sobre o negócio (opcional)"} aberto={d.negocio.modalidade === "DOMICILIO" || !!d.negocio.regiao.valor || !!d.negocio.descricao.valor || d.negocio.regiao.situacao === "REVISAR" || d.negocio.descricao.situacao === "REVISAR"} campo={["negocio.regiao", "negocio.descricao"]}>
      <Informacao campo="negocio.regiao" titulo={d.negocio.modalidade === "DOMICILIO" ? "Região atendida" : "Região atendida (opcional)"} dica="Cidades, bairros ou limites de deslocamento." valor={d.negocio.regiao} mudar={regiao => editar("negocio", { regiao })} />
      <Informacao campo="negocio.descricao" titulo="Como funciona o negócio (opcional)" dica="Uma breve apresentação para quem ainda não conhece sua empresa." valor={d.negocio.descricao} multiline mudar={descricao => editar("negocio", { descricao })} />
    </Detalhes>
  </Cartao>;

  if (etapa === 1) {
    const segunda = d.informacoes.horarios.find(h => h.day === 1);
    const horaValida = /^([01]\d|2[0-3]):[0-5]\d$/;
    const podeRepetir = !!segunda && !segunda.closed && horaValida.test(segunda.open) && horaValida.test(segunda.close) && segunda.open < segunda.close;
    const mudarHorarios = (horarios: typeof d.informacoes.horarios) => editar("informacoes", { horarios, horariosSituacao: d.informacoes.horariosSituacao === "REVISAR" ? "REVISAR" : "CONFIRMADO" });
    return <>
      <Cartao titulo="Local e pagamento">
        <Informacao campo="informacoes.endereco" titulo={d.negocio.modalidade === "ONLINE" ? "Endereço presencial (se houver)" : "Endereço de atendimento"} dica={d.negocio.modalidade === "ONLINE" ? "Se atende só online, selecione “Não se aplica” em Outras opções." : "Inclua número e orientações para chegar, se necessário."} valor={d.informacoes.endereco} multiline mudar={endereco => editar("informacoes", { endereco })} />
        <Informacao campo="informacoes.pagamento" titulo="Como o cliente pode pagar" dica="Por exemplo: Pix e cartão. Inclua condições somente se existirem." valor={d.informacoes.pagamento} multiline mudar={pagamento => editar("informacoes", { pagamento })} />
      </Cartao>
      <Cartao titulo="Horário do seu negócio" descricao="O atendente usa esse horário para saber quando o negócio está aberto.">
        <div className="space-y-2"><button type="button" className={BOTAO} disabled={!podeRepetir} onClick={() => {
          if (!segunda || !podeRepetir) return;
          mudarHorarios(Array.from({ length: 7 }, (_, day) => day >= 1 && day <= 5 ? { day, open: segunda.open, close: segunda.close, closed: false } : d.informacoes.horarios.find(h => h.day === day) || { day, open: "", close: "", closed: false }));
        }}>Repetir este horário de segunda a sexta</button>{!podeRepetir && <p className="text-xs text-panel-sub">Preencha a segunda-feira para repetir nos outros dias úteis.</p>}</div>
        <div className="space-y-2">{ORDEM_DIAS.map(day => {
          const dia = DIAS[day];
          const h = d.informacoes.horarios.find(h => h.day === day) || { day, open: "", close: "", closed: false };
          const mudar = (novo: Partial<typeof h>) => mudarHorarios([...d.informacoes.horarios.filter(v => v.day !== day), { ...h, ...novo }].sort((a, b) => a.day - b.day));
          return <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-panel-line p-3 sm:grid-cols-[105px_auto_1fr]" key={dia}>
            <span className="text-sm font-medium text-panel-ink">{dia}</span><label className="flex items-center gap-2 text-xs text-panel-sub"><input type="checkbox" checked={h.closed} onChange={e => mudar({ closed: e.target.checked, ...(e.target.checked ? { open: "", close: "" } : {}) })} className="accent-amber" />Fechado</label>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1"><input type="time" aria-label={`Abertura: ${dia}`} className={CAMPO} disabled={h.closed} value={h.open} onChange={e => mudar({ open: e.target.value })} /><span className="text-xs text-panel-sub">até</span><input type="time" aria-label={`Fechamento: ${dia}`} className={CAMPO} disabled={h.closed} value={h.close} onChange={e => mudar({ close: e.target.value })} /></div>
          </div>;
        })}</div>
        <AvisoCampo campo="informacoes.horarios" />
        <Revisao titulo="Horários do negócio" valor={d.informacoes.horariosSituacao} confirmavel={d.informacoes.horarios.length === 7 && d.informacoes.horarios.every(h => h.closed || horaValida.test(h.open) && horaValida.test(h.close) && h.open < h.close)} mudar={horariosSituacao => editar("informacoes", { horariosSituacao })} />
        <Detalhes titulo="Feriados e outras datas sem atendimento (opcional)" aberto={d.informacoes.diasFechados.length > 0} campo="informacoes.diasFechados">
          {d.informacoes.diasFechados.map((dia, i) => <div className="flex items-start gap-2" key={i}><Campo titulo={`Data ${i + 1}`} campo={`informacoes.diasFechados.${i}`}><input aria-label={`Data sem atendimento ${i + 1}`} type="date" className={CAMPO} value={dia} onChange={e => editar("informacoes", { diasFechados: d.informacoes.diasFechados.map((v, n) => n === i ? e.target.value : v) })} /></Campo><button type="button" className={`${BOTAO} mt-6`} aria-label={`Excluir data ${i + 1}`} onClick={() => editar("informacoes", { diasFechados: d.informacoes.diasFechados.filter((_, n) => n !== i) })}>Excluir</button></div>)}
          <button type="button" className={BOTAO} onClick={() => editar("informacoes", { diasFechados: [...d.informacoes.diasFechados, ""] })}>Adicionar data</button>
        </Detalhes>
      </Cartao>
      <Cartao titulo="O que você oferece" descricao={usaAgenda ? "Cadastre os serviços, os preços e o tempo necessário para agendar." : "Adicione os serviços ou produtos que o seu atendente pode apresentar."}>
        {!d.informacoes.servicos.length && <p className="rounded-xl bg-panel-bg p-4 text-sm text-panel-sub">Adicione seu primeiro serviço ou produto. Se não houver preço definido, mantenha “Sob consulta”.</p>}
        {d.informacoes.servicos.map((s, i) => {
          const mudar = (novo: Partial<typeof s>) => editar("informacoes", { servicos: d.informacoes.servicos.map(v => v.id === s.id ? { ...v, ...novo, origem: "MANUAL" } : v) });
          const duracao = <Campo campo={[`informacoes.servicos.${i}.duracaoMin`, `servico:${s.id}:duracao`]} titulo={usaAgenda ? "Duração em minutos" : "Duração em minutos (opcional)"} dica={usaAgenda ? "Tempo reservado para esse serviço na agenda." : "Deixe em branco se não usar agendamentos."}><input type="number" min="1" max="1440" className={CAMPO} value={s.duracaoMin ?? ""} onChange={e => mudar({ duracaoMin: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>;
          return <div className="space-y-3 rounded-xl border border-panel-line p-4" key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Item {i + 1}</p><button type="button" className="rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => editar("informacoes", { servicos: d.informacoes.servicos.filter(v => v.id !== s.id) })}>Remover item</button></div>
            <Campo titulo="Nome do serviço ou produto" campo={[`informacoes.servicos.${i}.nome`, `servico:${s.id}:nome`]}><input className={CAMPO} maxLength={140} value={s.nome} onChange={e => mudar({ nome: e.target.value })} /></Campo>
            <div className="grid gap-3 sm:grid-cols-2"><Campo titulo="Preço"><select className={CAMPO} value={s.precoModo} onChange={e => mudar({ precoModo: e.target.value as typeof s.precoModo, ...(e.target.value === "SOB_CONSULTA" ? { precoCents: null } : {}) })}><option value="SOB_CONSULTA">Sob consulta</option><option value="FIXO">Valor definido</option></select></Campo>
              {s.precoModo === "FIXO" && <Campo titulo="Valor em reais" campo={[`informacoes.servicos.${i}.precoCents`, `servico:${s.id}:preco`]}><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" className={CAMPO} value={s.precoCents == null ? "" : s.precoCents / 100} onChange={e => mudar({ precoCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} /></Campo>}
              {usaAgenda && duracao}
            </div>
            <Detalhes titulo="Detalhes do item (opcional)" aberto={!!s.descricao || s.situacao === "REVISAR" || !usaAgenda && s.duracaoMin !== null} campo={[`informacoes.servicos.${i}.descricao`, `informacoes.servicos.${i}.duracaoMin`, `servico:${s.id}:duracao`]}><Campo titulo="Descrição (opcional)" campo={`informacoes.servicos.${i}.descricao`}><textarea className={CAMPO} rows={2} maxLength={1500} value={s.descricao} onChange={e => mudar({ descricao: e.target.value })} /></Campo>{!usaAgenda && duracao}</Detalhes>
            <AvisoCampo campo={`servico:${s.id}`} />
            <Revisao titulo={`Serviço ou produto ${i + 1}`} valor={s.situacao} confirmavel={!!s.nome.trim() && (s.precoModo !== "FIXO" || s.precoCents !== null) && (!usaAgenda || !!s.duracaoMin)} mudar={situacao => mudar({ situacao })} />
          </div>;
        })}
        <button type="button" className={BOTAO} onClick={() => editar("informacoes", { servicos: [...d.informacoes.servicos, { id: `novo:${crypto.randomUUID()}`, nome: "", descricao: "", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: null, situacao: "REVISAR", origem: "MANUAL" }] })}>Adicionar serviço ou produto</button>
        <AvisoCampo campo="informacoes.servicos" />
      </Cartao>
    </>;
  }

  if (etapa === 2) return <>
    <Cartao titulo="Jeito de conversar" descricao="Escolha como o seu atendente se apresenta aos clientes.">
      <Campo titulo="Nome do atendente" campo="atendimento.nome"><input className={CAMPO} maxLength={80} value={d.atendimento.nome} onChange={e => editar("atendimento", { nome: e.target.value })} /></Campo>
      <Escolha titulo="Estilo de conversa" valor={d.atendimento.jeito} mudar={jeito => editar("atendimento", { jeito })} opcoes={[{ valor: "ACOLHEDOR", titulo: "Acolhedor", descricao: "Atencioso e próximo, sem perder a objetividade." }, { valor: "DIRETO", titulo: "Direto", descricao: "Claro e objetivo, sempre com educação." }, { valor: "DESCONTRAIDO", titulo: "Descontraído", descricao: "Leve e informal, com profissionalismo." }]} />
    </Cartao>
    <Cartao titulo="Quando o seu atendente responde">
      <Escolha titulo="Escolha o período" valor={d.atendimento.quando} mudar={quando => editar("atendimento", { quando })} opcoes={[{ valor: "FORA_EXPEDIENTE", titulo: "Só quando o negócio estiver fechado", descricao: "Usa os horários que você informou." }, { valor: "APOIO_EXPEDIENTE", titulo: "Fora do horário e quando a equipe precisar de apoio", descricao: "Durante o expediente, aguarda cinco minutos sem resposta da equipe. Fora dele, responde às novas mensagens." }]} />
      <p className="text-xs leading-relaxed text-panel-sub">Quando alguém da equipe responde, o atendente pausa naquela conversa. Uma pessoa precisa reativá-lo para que volte a responder.</p>
    </Cartao>
    <Cartao titulo="Quando agendar ou chamar a equipe">
      <Detalhes titulo="Agendamentos" aberto={usaAgenda} campo="atendimento.agendamento">
        <Escolha titulo="O que você autoriza?" valor={d.atendimento.agendamento} mudar={agendamento => editar("atendimento", { agendamento })} opcoes={[{ valor: "DESLIGADO", titulo: "Responder sem agendar", descricao: "Encaminha os pedidos de agendamento para a equipe." }, { valor: "LINK", titulo: "Enviar o link da agenda", descricao: "O cliente escolhe e conclui o agendamento pelo link." }, { valor: "DIRETO", titulo: "Agendar pela conversa", descricao: "Consulta horários e confirma somente depois de registrar a reserva." }]} />
        {!usaAgenda && <p className="text-xs leading-relaxed text-panel-sub">Para usar a agenda, escolha “Ajudar com agendamentos” como principal tarefa, em Seu negócio.</p>}
        <AvisoCampo campo="atendimento.agendamento" />
      </Detalhes>
      <Detalhes titulo="Assuntos exclusivos da equipe (opcional)" aberto={d.atendimento.handoffKeywords.some(v => !!v.trim())} campo="atendimento.handoffKeywords"><Campo campo="atendimento.handoffKeywords" titulo="Quais assuntos precisam de uma pessoa?" dica="Um por linha. Por exemplo: reclamação ou pedido de desconto."><textarea className={CAMPO} rows={3} maxLength={2000} value={d.atendimento.handoffKeywords.join("\n")} onChange={e => editar("atendimento", { handoffKeywords: e.target.value.split("\n") })} /></Campo></Detalhes>
      <p className="text-xs leading-relaxed text-panel-sub">O cliente sempre pode pedir uma pessoa. O seu atendente também recorre à equipe quando não sabe ou não pode resolver.</p>
    </Cartao>
  </>;

  if (etapa === 3) return <Cartao titulo="Respostas para perguntas frequentes" descricao="Opcional: ensine regras e respostas específicas do seu negócio.">
    <Detalhes titulo={d.conhecimento.itens.length ? "Perguntas e regras cadastradas" : "Adicionar perguntas e regras"} aberto={d.conhecimento.itens.length > 0} campo={["conhecimento.itens", ...d.conhecimento.itens.map(p => `pergunta:${p.id}`)]}>
      <div className="space-y-2"><p className="text-xs text-panel-sub">Escolha uma pergunta para começar. A resposta fica por sua conta.</p><div className="flex flex-wrap gap-2">{["Como funciona o cancelamento?", "Qual é a tolerância de atraso?", "Vocês têm estacionamento?", "É necessário pagar um sinal?", "Quais regiões vocês atendem?"].map(pergunta => <button key={pergunta} type="button" className="rounded-full border border-panel-line px-3 py-2 text-xs text-panel-ink hover:border-amber" onClick={() => editar("conhecimento", { itens: [...d.conhecimento.itens, { id: `novo:${crypto.randomUUID()}`, pergunta, resposta: "", situacao: "REVISAR", origem: "MANUAL" }] })}>+ {pergunta}</button>)}</div></div>
      {d.conhecimento.itens.map((p, i) => {
        const mudar = (novo: Partial<typeof p>) => editar("conhecimento", { itens: d.conhecimento.itens.map(v => v.id === p.id ? { ...v, ...novo, origem: "MANUAL" } : v) });
        return <div className="space-y-3 rounded-xl border border-panel-line bg-panel-card p-4" key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Pergunta {i + 1}</p><button type="button" className="rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => editar("conhecimento", { itens: d.conhecimento.itens.filter(v => v.id !== p.id) })}>Remover pergunta</button></div>
          <Campo titulo="O que o cliente pergunta?" campo={[`conhecimento.itens.${i}.pergunta`, `pergunta:${p.id}`]}><input className={CAMPO} maxLength={500} value={p.pergunta} onChange={e => mudar({ pergunta: e.target.value })} /></Campo>
          <Campo titulo="Qual resposta o seu atendente deve dar?" campo={[`conhecimento.itens.${i}.resposta`, `pergunta:${p.id}`]}><textarea rows={3} maxLength={3000} className={CAMPO} value={p.resposta} placeholder="Escreva a regra ou a informação real do seu negócio…" onChange={e => mudar({ resposta: e.target.value })} /></Campo>
          <Revisao titulo={`Resposta ${i + 1}`} valor={p.situacao} confirmavel={!!p.pergunta.trim() && !!p.resposta.trim()} mudar={situacao => mudar({ situacao })} />
        </div>;
      })}
      <button type="button" className={BOTAO} onClick={() => editar("conhecimento", { itens: [...d.conhecimento.itens, { id: `novo:${crypto.randomUUID()}`, pergunta: "", resposta: "", situacao: "REVISAR", origem: "MANUAL" }] })}>Adicionar pergunta ou regra</button>
    </Detalhes>
  </Cartao>;

  return null;
}
