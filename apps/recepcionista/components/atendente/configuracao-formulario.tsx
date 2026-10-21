"use client";

import { useEffect, useRef, useState } from "react";
import type { ConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { AvisoCampoNexa as AvisoCampo, BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, CampoNexa as Campo, CartaoNexa as Cartao, DetalhesNexa as Detalhes, EscolhaNexa as Escolha, InformacaoNexaCampo as Informacao, RevisaoNexa as Revisao } from "./configuracao-campos";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
function horariosCompletos(horarios: ConfiguracaoNexa["informacoes"]["horarios"]) {
  return horarios.length === 7 && new Set(horarios.map(h => h.day)).size === 7 && horarios.every(h => h.closed || HORA_VALIDA.test(h.open) && HORA_VALIDA.test(h.close) && h.open < h.close);
}
function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}
function resumoHorarios(horarios: ConfiguracaoNexa["informacoes"]["horarios"]) {
  const grupos: { inicio: number; fim: number; horario: string }[] = [];
  ORDEM_DIAS.forEach((day, index) => {
    const h = horarios.find(v => v.day === day);
    const horario = !h ? "Não informado" : h.closed ? "Fechado" : `${h.open} às ${h.close}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.horario === horario) ultimo.fim = index;
    else grupos.push({ inicio: index, fim: index, horario });
  });
  return grupos.map(g => ({ dia: g.inicio === g.fim ? DIAS[ORDEM_DIAS[g.inicio]] : `${DIAS[ORDEM_DIAS[g.inicio]]} a ${DIAS[ORDEM_DIAS[g.fim]].toLocaleLowerCase("pt-BR")}`, horario: g.horario }));
}
type Props = {
  etapa: number;
  dados: ConfiguracaoNexa;
  editar: <K extends keyof ConfiguracaoNexa>(secao: K, dados: Partial<ConfiguracaoNexa[K]>) => void;
};

function AssuntosDaEquipe({ assuntos, mudar }: { assuntos: string[]; mudar: (assuntos: string[]) => void }) {
  const [texto, setTexto] = useState(assuntos.join("\n"));
  const ultimaLista = useRef(assuntos.join("\n"));
  useEffect(() => {
    const novoTexto = assuntos.join("\n");
    if (novoTexto !== ultimaLista.current) { ultimaLista.current = novoTexto; setTexto(novoTexto); }
  }, [assuntos]);
  return <Campo campo="atendimento.handoffKeywords" titulo="Quais assuntos precisam de uma pessoa?" dica="Um assunto por linha. Ex.: reclamação ou desconto. Até 30 assuntos de 80 caracteres."><textarea className={CAMPO} rows={3} maxLength={2430} value={texto} onChange={e => {
    const valor = e.target.value;
    const lista = valor.split("\n").map(v => v.trim()).filter(Boolean);
    if (lista.length > 30 || lista.some(v => v.length > 80)) return;
    setTexto(valor); ultimaLista.current = lista.join("\n"); mudar(lista);
  }} /></Campo>;
}

export function FormularioConfiguracaoNexa({ etapa, dados: d, editar }: Props) {
  const [novaData, setNovaData] = useState("");
  const usaAgenda = d.negocio.objetivo === "AGENDAMENTOS" || d.atendimento.agendamento !== "DESLIGADO";

  if (etapa === 0) return <Cartao titulo="Sobre a empresa" descricao="Estas informações ajudam o atendente a apresentar o seu negócio corretamente.">
    <div className="grid gap-4 sm:grid-cols-2"><Campo titulo="Nome da empresa" campo="negocio.nome"><input className={CAMPO} maxLength={120} value={d.negocio.nome} onChange={e => editar("negocio", { nome: e.target.value })} autoComplete="organization" /></Campo>
    <Campo campo="negocio.segmento" titulo="O que a empresa faz" dica="Ex.: barbearia, clínica ou assistência técnica."><input className={CAMPO} maxLength={120} value={d.negocio.segmento} onChange={e => editar("negocio", { segmento: e.target.value })} /></Campo>
    <Campo titulo="Onde você atende"><select className={CAMPO} value={d.negocio.modalidade} onChange={e => editar("negocio", { modalidade: e.target.value as typeof d.negocio.modalidade })}><option value="PRESENCIAL">Em um endereço</option><option value="ONLINE">Online</option><option value="DOMICILIO">No local do cliente</option><option value="HIBRIDO">De mais de uma forma</option></select></Campo>
    <Campo titulo="Principal tarefa do atendente" dica="Você pode definir os detalhes em Como atender."><select className={CAMPO} value={d.negocio.objetivo} onChange={e => {
      const objetivo = e.target.value as typeof d.negocio.objetivo;
      editar("negocio", { objetivo });
      if (objetivo !== "AGENDAMENTOS" && d.atendimento.agendamento !== "DESLIGADO") editar("atendimento", { agendamento: "DESLIGADO" });
    }}><option value="DUVIDAS">Responder dúvidas</option><option value="SOLICITACOES">Receber pedidos e solicitações</option><option value="AGENDAMENTOS">Ajudar com agendamentos</option></select></Campo></div>
    <p className="text-xs leading-relaxed text-panel-sub">Responder dúvidas e receber solicitações não autoriza o atendente a fazer reservas. A forma de agendar é escolhida em Como atender.</p>
    <Detalhes titulo={d.negocio.modalidade === "DOMICILIO" ? "Região atendida e apresentação" : "Apresentação e região atendida (opcional)"} aberto={d.negocio.modalidade === "DOMICILIO" || d.negocio.regiao.situacao === "REVISAR" || d.negocio.descricao.situacao === "REVISAR"} campo={["negocio.regiao", "negocio.descricao"]}>
      <Informacao campo="negocio.regiao" titulo={d.negocio.modalidade === "DOMICILIO" ? "Região atendida" : "Região atendida (opcional)"} dica="Cidades, bairros ou limites de deslocamento." valor={d.negocio.regiao} mudar={regiao => editar("negocio", { regiao })} />
      <Informacao campo="negocio.descricao" titulo="Como funciona o negócio (opcional)" dica="Uma breve apresentação para quem ainda não conhece sua empresa." valor={d.negocio.descricao} multiline mudar={descricao => editar("negocio", { descricao })} />
    </Detalhes>
  </Cartao>;

  if (etapa === 1) {
    const segunda = d.informacoes.horarios.find(h => h.day === 1);
    const podeRepetir = !!segunda && !segunda.closed && HORA_VALIDA.test(segunda.open) && HORA_VALIDA.test(segunda.close) && segunda.open < segunda.close;
    const completos = horariosCompletos(d.informacoes.horarios);
    const mudarHorarios = (horarios: typeof d.informacoes.horarios) => editar("informacoes", { horarios, horariosSituacao: d.informacoes.horariosSituacao === "REVISAR" ? "REVISAR" : "CONFIRMADO" });
    return <>
      <Cartao titulo="Local e pagamento">
        <div className="grid gap-4 sm:grid-cols-2"><Informacao campo="informacoes.endereco" titulo={d.negocio.modalidade === "ONLINE" ? "Endereço presencial (se houver)" : "Endereço de atendimento"} dica={d.negocio.modalidade === "ONLINE" ? "Se atende só online, marque “Não se aplica ao meu negócio”." : "Inclua número e orientações para chegar, se necessário."} valor={d.informacoes.endereco} multiline mudar={endereco => editar("informacoes", { endereco })} />
        <Informacao campo="informacoes.pagamento" titulo="Formas de pagamento" dica="Ex.: Pix e cartão. Informe condições somente se existirem." valor={d.informacoes.pagamento} multiline mudar={pagamento => editar("informacoes", { pagamento })} /></div>
      </Cartao>
      <Cartao titulo="Horário do seu negócio" descricao="O atendente usa esse horário para saber quando o negócio está aberto.">
        {completos && <dl className="space-y-2 rounded-xl bg-panel-bg p-3">{resumoHorarios(d.informacoes.horarios).map(g => <div key={g.dia} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><dt className="text-panel-sub">{g.dia}</dt><dd className="font-medium text-panel-ink">{g.horario}</dd></div>)}</dl>}
        <Detalhes titulo={completos ? "Alterar horários" : "Preencher os horários da semana"} aberto={!completos || d.informacoes.horariosSituacao === "REVISAR"} campo="informacoes.horarios">
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
        </Detalhes>
        <Revisao titulo="Horários do negócio" valor={d.informacoes.horariosSituacao} confirmavel={completos && d.informacoes.horarios.some(h => !h.closed)} confirmarTexto="Confirmar horários" mudar={horariosSituacao => editar("informacoes", { horariosSituacao })} />
        <Detalhes titulo={`Feriados e outras datas sem atendimento${d.informacoes.diasFechados.length ? ` (${d.informacoes.diasFechados.length})` : " (opcional)"}`} campo="informacoes.diasFechados">
          <p className="text-xs leading-relaxed text-panel-sub">Nestas datas o negócio fica fechado e não oferece horários para agendamento.</p>
          {d.informacoes.diasFechados.map((dia, i) => <div className="flex items-center justify-between gap-2 rounded-xl border border-panel-line p-3" key={dia}><span className="text-sm text-panel-ink">{dia.split("-").reverse().join("/")}</span><button type="button" className={BOTAO} aria-label={`Excluir data ${dia.split("-").reverse().join("/")}`} onClick={() => editar("informacoes", { diasFechados: d.informacoes.diasFechados.filter((_, n) => n !== i) })}>Excluir</button></div>)}
          <div className="flex flex-wrap items-end gap-2"><Campo titulo="Nova data sem atendimento"><input aria-label="Nova data sem atendimento" type="date" className={CAMPO} value={novaData} onChange={e => setNovaData(e.target.value)} /></Campo><button type="button" className={BOTAO} disabled={!dataValida(novaData) || d.informacoes.diasFechados.includes(novaData)} onClick={() => {
            if (!dataValida(novaData) || d.informacoes.diasFechados.includes(novaData)) return;
            editar("informacoes", { diasFechados: [...d.informacoes.diasFechados, novaData].sort() }); setNovaData("");
          }}>Adicionar data</button></div>
        </Detalhes>
      </Cartao>
      <Cartao titulo="Serviços e produtos" descricao={usaAgenda ? "Informe o que o cliente pode agendar, o preço e a duração de cada serviço." : "Informe o que o seu atendente pode apresentar ao cliente."}>
        {!d.informacoes.servicos.length && <p className="rounded-xl bg-panel-bg p-4 text-sm text-panel-sub">Adicione seu primeiro serviço ou produto. Se não houver preço definido, mantenha “Sob consulta”.</p>}
        {d.informacoes.servicos.map((s, i) => {
          const mudar = (novo: Partial<typeof s>) => editar("informacoes", { servicos: d.informacoes.servicos.map(v => v.id === s.id ? { ...v, ...novo, origem: "MANUAL" } : v) });
          const duracao = <Campo campo={[`informacoes.servicos.${i}.duracaoMin`, `servico:${s.id}:duracao`]} titulo={usaAgenda ? "Duração em minutos" : "Duração em minutos (opcional)"} dica={usaAgenda ? "Minutos inteiros que serão reservados na agenda." : "Deixe em branco se não usar agendamentos."}><input type="text" inputMode="numeric" pattern="[0-9]*" className={CAMPO} value={s.duracaoMin ?? ""} onChange={e => {
            const valor = e.target.value;
            if (valor === "") mudar({ duracaoMin: null });
            else if (/^\d+$/.test(valor) && Number.isInteger(Number(valor)) && Number(valor) >= 1 && Number(valor) <= 1440) mudar({ duracaoMin: Number(valor) });
          }} /></Campo>;
          return <div className="space-y-3 rounded-xl border border-panel-line p-4" key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{s.nome.trim() || `Novo serviço ou produto`}</p><button type="button" className="rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => editar("informacoes", { servicos: d.informacoes.servicos.filter(v => v.id !== s.id) })}>Remover item</button></div>
            <Campo titulo="Nome do serviço ou produto" campo={[`informacoes.servicos.${i}.nome`, `servico:${s.id}:nome`]}><input className={CAMPO} maxLength={140} value={s.nome} onChange={e => mudar({ nome: e.target.value })} /></Campo>
            <div className="grid gap-3 sm:grid-cols-2"><Campo titulo="Preço"><select className={CAMPO} value={s.precoModo} onChange={e => mudar({ precoModo: e.target.value as typeof s.precoModo, ...(e.target.value === "SOB_CONSULTA" ? { precoCents: null } : {}) })}><option value="SOB_CONSULTA">Sob consulta</option><option value="FIXO">Valor definido</option></select></Campo>
              {s.precoModo === "FIXO" && <Campo titulo="Valor em reais" campo={[`informacoes.servicos.${i}.precoCents`, `servico:${s.id}:preco`]}><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" className={CAMPO} value={s.precoCents == null ? "" : s.precoCents / 100} onChange={e => {
                if (e.target.value === "") mudar({ precoCents: null });
                else { const valor = Number(e.target.value); if (Number.isFinite(valor) && valor >= 0 && valor <= 1000000) mudar({ precoCents: Math.round(valor * 100) }); }
              }} /></Campo>}
              {usaAgenda && duracao}
            </div>
            <Detalhes titulo="Descrição e outros detalhes (opcional)" aberto={s.situacao === "REVISAR" && !!s.descricao} campo={[`informacoes.servicos.${i}.descricao`, `informacoes.servicos.${i}.duracaoMin`, `servico:${s.id}:duracao`]}><Campo titulo="Descrição (opcional)" campo={`informacoes.servicos.${i}.descricao`}><textarea className={CAMPO} rows={2} maxLength={1500} value={s.descricao} onChange={e => mudar({ descricao: e.target.value })} /></Campo>{!usaAgenda && duracao}</Detalhes>
            <AvisoCampo campo={`servico:${s.id}`} />
            <Revisao titulo={`Serviço ou produto ${i + 1}`} valor={s.situacao} confirmavel={s.nome.trim().length >= 2 && (s.precoModo !== "FIXO" || s.precoCents !== null) && (!usaAgenda || !!s.duracaoMin)} confirmarTexto={s.origem === "MANUAL" ? "Usar este item" : "Confirmar serviço ou produto"} mudar={situacao => mudar({ situacao })} />
          </div>;
        })}
        <button type="button" className={BOTAO} onClick={() => editar("informacoes", { servicos: [...d.informacoes.servicos, { id: `novo:${crypto.randomUUID()}`, nome: "", descricao: "", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: null, situacao: "REVISAR", origem: "MANUAL" }] })}>Adicionar serviço ou produto</button>
        <AvisoCampo campo="informacoes.servicos" />
      </Cartao>
    </>;
  }

  if (etapa === 2) return <>
    <Cartao titulo="Como o atendente conversa" descricao="Dê um nome e escolha o jeito de falar da sua empresa.">
      <Campo titulo="Nome do atendente" campo="atendimento.nome" dica="O nome usado para se apresentar aos clientes."><input className={CAMPO} maxLength={80} value={d.atendimento.nome} onChange={e => editar("atendimento", { nome: e.target.value })} /></Campo>
      <Escolha titulo="Estilo de conversa" valor={d.atendimento.jeito} mudar={jeito => editar("atendimento", { jeito })} opcoes={[{ valor: "ACOLHEDOR", titulo: "Acolhedor", descricao: "Atencioso e próximo, sem perder a objetividade." }, { valor: "DIRETO", titulo: "Direto", descricao: "Claro e objetivo, sempre com educação." }, { valor: "DESCONTRAIDO", titulo: "Descontraído", descricao: "Leve e informal, com profissionalismo." }]} />
    </Cartao>
    <Cartao titulo="Quando o seu atendente responde">
      <Escolha titulo="Escolha o período" valor={d.atendimento.quando} mudar={quando => editar("atendimento", { quando })} opcoes={[{ valor: "FORA_EXPEDIENTE", titulo: "Só quando o negócio estiver fechado", descricao: "Usa os horários que você informou." }, { valor: "APOIO_EXPEDIENTE", titulo: "Fora do horário e quando a equipe precisar de apoio", descricao: "Durante o expediente, aguarda cinco minutos sem resposta da equipe. Fora dele, responde às novas mensagens." }]} />
      <p className="text-xs leading-relaxed text-panel-sub">Quando alguém da equipe responde, o atendente pausa naquela conversa. Uma pessoa precisa reativá-lo para que volte a responder.</p>
    </Cartao>
    <Cartao titulo="Quando agendar ou chamar a equipe">
      <Escolha titulo="Como lidar com pedidos de agendamento" valor={d.atendimento.agendamento} mudar={agendamento => {
        editar("atendimento", { agendamento });
        if (agendamento !== "DESLIGADO" && d.negocio.objetivo !== "AGENDAMENTOS") editar("negocio", { objetivo: "AGENDAMENTOS" });
        else if (agendamento === "DESLIGADO" && d.negocio.objetivo === "AGENDAMENTOS") editar("negocio", { objetivo: "DUVIDAS" });
      }} opcoes={[{ valor: "DESLIGADO", titulo: "Chamar a equipe", descricao: "Recebe o pedido e deixa a reserva com uma pessoa." }, { valor: "LINK", titulo: "Enviar o link da agenda", descricao: "O cliente escolhe e conclui o agendamento pelo link." }, { valor: "DIRETO", titulo: "Agendar pela conversa", descricao: "Consulta horários e só confirma após registrar a reserva." }]} />
      <p className="text-xs leading-relaxed text-panel-sub">Ao escolher uma opção com agenda, a principal tarefa passa a ser “Ajudar com agendamentos”. Preencha os serviços, as durações e os horários do negócio para usar essa opção.</p>
      <AvisoCampo campo="atendimento.agendamento" />
      <Detalhes titulo="Assuntos exclusivos da equipe (opcional)" campo="atendimento.handoffKeywords"><AssuntosDaEquipe assuntos={d.atendimento.handoffKeywords} mudar={handoffKeywords => editar("atendimento", { handoffKeywords })} /></Detalhes>
      <p className="text-xs leading-relaxed text-panel-sub">O cliente sempre pode pedir uma pessoa. O seu atendente também recorre à equipe quando não sabe ou não pode resolver.</p>
    </Cartao>
  </>;

  if (etapa === 3) return <Cartao titulo="Respostas para perguntas frequentes" descricao="Opcional: ensine regras e respostas específicas do seu negócio.">
    <AvisoCampo campo="conhecimento" />
    <Detalhes titulo={d.conhecimento.itens.length ? `Perguntas e regras (${d.conhecimento.itens.length})` : "Adicionar uma pergunta ou regra"} aberto={d.conhecimento.itens.some(p => p.situacao === "REVISAR")} campo={["conhecimento", ...d.conhecimento.itens.map(p => `pergunta:${p.id}`)]}>
      <div className="space-y-2"><p className="text-xs text-panel-sub">Escolha uma pergunta para começar. A resposta fica por sua conta.</p><div className="flex flex-wrap gap-2">{["Como funciona o cancelamento?", "Qual é a tolerância de atraso?", "Vocês têm estacionamento?", "É necessário pagar um sinal?", "Quais regiões vocês atendem?"].map(pergunta => <button key={pergunta} type="button" className="rounded-full border border-panel-line px-3 py-2 text-xs text-panel-ink hover:border-amber" onClick={() => editar("conhecimento", { itens: [...d.conhecimento.itens, { id: `novo:${crypto.randomUUID()}`, pergunta, resposta: "", situacao: "REVISAR", origem: "MANUAL" }] })}>+ {pergunta}</button>)}</div></div>
      {d.conhecimento.itens.map((p, i) => {
        const mudar = (novo: Partial<typeof p>) => editar("conhecimento", { itens: d.conhecimento.itens.map(v => v.id === p.id ? { ...v, ...novo, origem: "MANUAL" } : v) });
        return <div className="space-y-3 rounded-xl border border-panel-line bg-panel-card p-4" key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Pergunta {i + 1}</p><button type="button" className="rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => editar("conhecimento", { itens: d.conhecimento.itens.filter(v => v.id !== p.id) })}>Remover pergunta</button></div>
          <Campo titulo="O que o cliente pergunta?" campo={[`conhecimento.itens.${i}.pergunta`, `pergunta:${p.id}`]}><input className={CAMPO} maxLength={500} value={p.pergunta} onChange={e => mudar({ pergunta: e.target.value })} /></Campo>
          <Campo titulo="Qual resposta o seu atendente deve dar?" campo={[`conhecimento.itens.${i}.resposta`, `pergunta:${p.id}`]}><textarea rows={3} maxLength={3000} className={CAMPO} value={p.resposta} placeholder="Escreva a regra ou a informação real do seu negócio…" onChange={e => mudar({ resposta: e.target.value })} /></Campo>
          <Revisao titulo={`Resposta ${i + 1}`} valor={p.situacao} confirmavel={!!p.pergunta.trim() && !!p.resposta.trim()} confirmarTexto={p.origem === "MANUAL" ? "Usar esta resposta" : "Confirmar resposta"} mudar={situacao => mudar({ situacao })} />
        </div>;
      })}
      <button type="button" className={BOTAO} onClick={() => editar("conhecimento", { itens: [...d.conhecimento.itens, { id: `novo:${crypto.randomUUID()}`, pergunta: "", resposta: "", situacao: "REVISAR", origem: "MANUAL" }] })}>Adicionar pergunta ou regra</button>
    </Detalhes>
  </Cartao>;

  return null;
}
