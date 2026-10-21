"use client";

import type { ConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, CampoNexa as Campo, CartaoNexa as Cartao, EscolhaNexa as Escolha, InformacaoNexaCampo as Informacao, SeletorSituacaoNexa as SeletorSituacao, SituacaoNexa as Situacao } from "./configuracao-campos";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
type Props = {
  etapa: number;
  dados: ConfiguracaoNexa;
  editar: <K extends keyof ConfiguracaoNexa>(secao: K, dados: Partial<ConfiguracaoNexa[K]>) => void;
};

export function FormularioConfiguracaoNexa({ etapa, dados: d, editar }: Props) {
  if (etapa === 0) return <Cartao titulo="Conte sobre o seu negócio" descricao="Essas escolhas adaptam a configuração ao seu atendimento.">
    <Campo titulo="Nome do negócio" campo="negocio.nome"><input className={CAMPO} maxLength={120} value={d.negocio.nome} onChange={e => editar("negocio", { nome: e.target.value })} autoComplete="organization" /></Campo>
    <Campo campo="negocio.segmento" titulo="Segmento" dica="Por exemplo: barbearia, clínica, assistência técnica ou consultoria."><input className={CAMPO} maxLength={120} value={d.negocio.segmento} onChange={e => editar("negocio", { segmento: e.target.value })} /></Campo>
    <Campo titulo="Como o negócio atende"><select className={CAMPO} value={d.negocio.modalidade} onChange={e => editar("negocio", { modalidade: e.target.value as typeof d.negocio.modalidade })}><option value="PRESENCIAL">Presencial, em um endereço</option><option value="ONLINE">Online</option><option value="DOMICILIO">Na casa ou local do cliente</option><option value="HIBRIDO">Mais de uma forma</option></select></Campo>
    <Informacao campo="negocio.regiao" titulo="Região atendida" dica="Informe os locais ou limites de atendimento que a Nexa pode mencionar." valor={d.negocio.regiao} mudar={regiao => editar("negocio", { regiao })} />
    <Informacao campo="negocio.descricao" titulo="Como funciona o negócio" valor={d.negocio.descricao} multiline mudar={descricao => editar("negocio", { descricao })} />
    <Escolha titulo="Qual é o principal objetivo da Nexa?" valor={d.negocio.objetivo} mudar={objetivo => editar("negocio", { objetivo })} opcoes={[
      { valor: "DUVIDAS", titulo: "Responder dúvidas", descricao: "Explicar as informações e regras que você cadastrar." },
      { valor: "SOLICITACOES", titulo: "Receber solicitações", descricao: "Conversar e encaminhar o que precisa da equipe, sem prometer uma ação concluída." },
      { valor: "AGENDAMENTOS", titulo: "Ajudar com agendamentos", descricao: "Consultar a agenda ou oferecer o link, conforme sua autorização." },
    ]} />
  </Cartao>;

  if (etapa === 1) return <>
    <Cartao titulo="Local e pagamento" descricao="Cadastre somente o que a Nexa pode afirmar aos seus clientes.">
      {d.negocio.modalidade === "ONLINE" && <p className="rounded-xl bg-panel-bg p-3 text-xs leading-relaxed text-panel-sub">Seu negócio está definido como online. Se não existe endereço de atendimento presencial, marque o endereço como “Não se aplica”.</p>}
      <Informacao campo="informacoes.endereco" titulo="Endereço e orientações" valor={d.informacoes.endereco} multiline mudar={endereco => editar("informacoes", { endereco })} />
      <Informacao campo="informacoes.pagamento" titulo="Formas e condições de pagamento" valor={d.informacoes.pagamento} multiline mudar={pagamento => editar("informacoes", { pagamento })} />
    </Cartao>
    <Cartao titulo="Funcionamento do negócio" descricao="São os horários do seu negócio. Você escolhe quando a Nexa responde na próxima etapa.">
      <div className="flex flex-wrap items-center justify-between gap-2"><Situacao valor={d.informacoes.horariosSituacao} /><div className="max-w-full sm:max-w-60"><SeletorSituacao titulo="Situação dos horários" valor={d.informacoes.horariosSituacao} mudar={horariosSituacao => editar("informacoes", { horariosSituacao })} /></div></div>
      <div className="space-y-3">{DIAS.map((dia, day) => {
        const h = d.informacoes.horarios.find(h => h.day === day) || { day, open: "", close: "", closed: false };
        const mudar = (novo: Partial<typeof h>) => editar("informacoes", { horarios: [...d.informacoes.horarios.filter(v => v.day !== day), { ...h, ...novo }].sort((a, b) => a.day - b.day), horariosSituacao: d.informacoes.horariosSituacao === "REVISAR" ? "REVISAR" : "CONFIRMADO" });
        return <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-panel-line p-3 sm:grid-cols-[105px_auto_1fr]" key={dia}>
          <span className="text-sm font-medium text-panel-ink">{dia}</span>
          <label className="flex items-center gap-2 text-xs text-panel-sub"><input type="checkbox" checked={h.closed} onChange={e => mudar({ closed: e.target.checked, ...(e.target.checked ? { open: "", close: "" } : {}) })} className="accent-amber" />Fechado</label>
          <div className="col-span-2 flex items-center gap-2 sm:col-span-1"><input type="time" aria-label={`Abertura: ${dia}`} className={CAMPO} disabled={h.closed} value={h.open} onChange={e => mudar({ open: e.target.value })} /><span className="text-xs text-panel-sub">até</span><input type="time" aria-label={`Fechamento: ${dia}`} className={CAMPO} disabled={h.closed} value={h.close} onChange={e => mudar({ close: e.target.value })} /></div>
        </div>;
      })}</div>
      {d.informacoes.horariosSituacao === "REVISAR" && <button className={BOTAO} type="button" onClick={() => editar("informacoes", { horariosSituacao: "CONFIRMADO" })}>Conferi todos os horários exibidos</button>}
      <div className="space-y-2"><p className="text-sm font-medium">Datas sem atendimento</p>{d.informacoes.diasFechados.map((dia, i) => <div className="flex items-center gap-2" key={i}><input aria-label={`Data sem atendimento ${i + 1}`} type="date" className={CAMPO} value={dia} onChange={e => editar("informacoes", { diasFechados: d.informacoes.diasFechados.map((v, n) => n === i ? e.target.value : v) })} /><button type="button" className={BOTAO} aria-label={`Excluir data ${i + 1}`} onClick={() => editar("informacoes", { diasFechados: d.informacoes.diasFechados.filter((_, n) => n !== i) })}>Excluir</button></div>)}<button type="button" className={BOTAO} onClick={() => editar("informacoes", { diasFechados: [...d.informacoes.diasFechados, ""] })}>Adicionar data</button></div>
    </Cartao>
    <Cartao titulo="Serviços e preços" descricao="Preço sob consulta não significa gratuito. A duração é necessária quando a Nexa consulta ou reserva um horário.">
      {!d.informacoes.servicos.length && <p className="rounded-xl bg-panel-bg p-4 text-sm text-panel-sub">Você ainda não cadastrou serviços. Adicione os que a Nexa pode apresentar aos clientes.</p>}
      {d.informacoes.servicos.map((s, i) => {
        const mudar = (novo: Partial<typeof s>) => editar("informacoes", { servicos: d.informacoes.servicos.map(v => v.id === s.id ? { ...v, ...novo, origem: "MANUAL" } : v) });
        return <div className="space-y-3 rounded-xl border border-panel-line p-4" key={s.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Serviço {i + 1}</p><Situacao valor={s.situacao} /></div>
          <Campo titulo="Nome do serviço" campo={[`informacoes.servicos.${i}.nome`, `servico:${s.id}:nome`]}><input className={CAMPO} maxLength={140} value={s.nome} onChange={e => mudar({ nome: e.target.value })} /></Campo>
          <Campo titulo="Descrição" campo={`informacoes.servicos.${i}.descricao`}><textarea className={CAMPO} rows={2} maxLength={1500} value={s.descricao} onChange={e => mudar({ descricao: e.target.value })} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2"><Campo titulo="Como informar o preço"><select className={CAMPO} value={s.precoModo} onChange={e => mudar({ precoModo: e.target.value as typeof s.precoModo, ...(e.target.value === "SOB_CONSULTA" ? { precoCents: null } : {}) })}><option value="SOB_CONSULTA">Sob consulta</option><option value="FIXO">Preço fixo</option></select></Campo>
          {s.precoModo === "FIXO" && <Campo titulo="Preço em reais" campo={[`informacoes.servicos.${i}.precoCents`, `servico:${s.id}:preco`]}><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" className={CAMPO} value={s.precoCents == null ? "" : s.precoCents / 100} onChange={e => mudar({ precoCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} /></Campo>}
          <Campo campo={[`informacoes.servicos.${i}.duracaoMin`, `servico:${s.id}:duracao`]} titulo="Duração em minutos" dica="Deixe em branco se ainda não souber."><input type="number" min="1" max="1440" className={CAMPO} value={s.duracaoMin ?? ""} onChange={e => mudar({ duracaoMin: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>
          <Campo titulo="Situação do serviço"><SeletorSituacao titulo={`Situação do serviço ${i + 1}`} valor={s.situacao} mudar={situacao => mudar({ situacao })} /></Campo></div>
          <div className="flex flex-wrap gap-2">{s.situacao === "REVISAR" && <button type="button" className={BOTAO} onClick={() => mudar({ situacao: "CONFIRMADO" })}>Conferi este serviço</button>}<button type="button" className="rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => editar("informacoes", { servicos: d.informacoes.servicos.filter(v => v.id !== s.id) })}>Remover serviço</button></div>
        </div>;
      })}
      <button type="button" className={BOTAO} onClick={() => editar("informacoes", { servicos: [...d.informacoes.servicos, { id: `novo:${crypto.randomUUID()}`, nome: "", descricao: "", precoModo: "SOB_CONSULTA", precoCents: null, duracaoMin: null, situacao: "REVISAR", origem: "MANUAL" }] })}>Adicionar serviço</button>
    </Cartao>
  </>;

  if (etapa === 2) return <>
    <Cartao titulo="Identidade e linguagem" descricao="A Nexa atende de forma natural e profissional, com identidade de atendente virtual.">
      <Campo titulo="Nome da atendente" campo="atendimento.nome"><input className={CAMPO} maxLength={80} value={d.atendimento.nome} onChange={e => editar("atendimento", { nome: e.target.value })} /></Campo>
      <Escolha titulo="Como ela deve conversar?" valor={d.atendimento.jeito} mudar={jeito => editar("atendimento", { jeito })} opcoes={[{ valor: "ACOLHEDOR", titulo: "Acolhedora", descricao: "Educada, atenciosa e próxima, sem perder a objetividade." }, { valor: "DIRETO", titulo: "Direta", descricao: "Respostas claras e concisas, com cordialidade." }, { valor: "DESCONTRAIDO", titulo: "Descontraída", descricao: "Linguagem leve, com respeito e profissionalismo." }]} />
    </Cartao>
    <Cartao titulo="Quando responder" descricao="A intervenção de uma pessoa da equipe pausa a automação naquela conversa até a reativação manual.">
      <Escolha titulo="Período de atuação" valor={d.atendimento.quando} mudar={quando => editar("atendimento", { quando })} opcoes={[{ valor: "FORA_EXPEDIENTE", titulo: "Fora do expediente", descricao: "Responde quando o negócio está fechado, conforme os horários cadastrados." }, { valor: "APOIO_EXPEDIENTE", titulo: "Fora do expediente e como apoio durante o dia", descricao: "Fora do expediente, responde às novas mensagens. Durante o expediente, espera cinco minutos sem resposta da equipe antes de atuar." }]} />
    </Cartao>
    <Cartao titulo="O que você autoriza a Nexa a fazer?" descricao="Ela responde com o que você confirmou e reconhece quando precisa de uma pessoa.">
      <Escolha titulo="Agendamentos" valor={d.atendimento.agendamento} mudar={agendamento => editar("atendimento", { agendamento })} opcoes={[{ valor: "DESLIGADO", titulo: "Responder sem agendar", descricao: "Informa e encaminha o que depende da equipe. Não confirma reservas." }, { valor: "LINK", titulo: "Oferecer o link da agenda", descricao: "O cliente escolhe e conclui o agendamento pelo link de autoagendamento." }, { valor: "DIRETO", titulo: "Consultar e confirmar pela conversa", descricao: "Consulta a disponibilidade e só confirma depois que a reserva é registrada. Exige serviços, durações e horários conferidos." }]} />
      <Campo campo="atendimento.handoffKeywords" titulo="Assuntos que devem ir para a equipe" dica="Um por linha. Use assuntos específicos, como reclamação ou pedido de desconto. O cliente também pode pedir uma pessoa diretamente."><textarea className={CAMPO} rows={4} maxLength={2000} value={d.atendimento.handoffKeywords.join("\n")} onChange={e => editar("atendimento", { handoffKeywords: e.target.value.split("\n") })} /></Campo>
      <p className="rounded-xl bg-panel-bg p-3 text-xs leading-relaxed text-panel-sub">A Nexa não confirma descontos, reembolsos, cancelamentos ou outras ações que não tenha realizado. Solicitações fora da sua autonomia ficam para a equipe.</p>
    </Cartao>
  </>;

  if (etapa === 3) return <Cartao titulo="Perguntas e regras do seu negócio" descricao="Escreva a pergunta de um cliente e a resposta autorizada. Cada regra fica inteira, disponível para conferir e editar.">
    <div className="space-y-2"><p className="text-xs font-medium text-panel-sub">Sugestões de perguntas. Você preenche as respostas.</p><div className="flex flex-wrap gap-2">{["Como funciona o cancelamento?", "Qual é a tolerância de atraso?", "Vocês têm estacionamento?", "É necessário pagar um sinal?", "Quais regiões vocês atendem?"].map(pergunta => <button key={pergunta} type="button" className="rounded-full border border-panel-line px-3 py-2 text-xs text-panel-ink hover:border-amber" onClick={() => editar("conhecimento", { itens: [...d.conhecimento.itens, { id: `novo:${crypto.randomUUID()}`, pergunta, resposta: "", situacao: "REVISAR", origem: "MANUAL" }] })}>+ {pergunta}</button>)}</div></div>
    {!d.conhecimento.itens.length && <p className="rounded-xl bg-panel-bg p-4 text-sm text-panel-sub">Nenhuma pergunta cadastrada. Você pode adicionar agora ou voltar depois.</p>}
    {d.conhecimento.itens.map((p, i) => {
      const mudar = (novo: Partial<typeof p>) => editar("conhecimento", { itens: d.conhecimento.itens.map(v => v.id === p.id ? { ...v, ...novo, origem: "MANUAL" } : v) });
      return <div className="space-y-3 rounded-xl border border-panel-line p-4" key={p.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Pergunta ou regra {i + 1}</p><Situacao valor={p.situacao} /></div>
        <Campo titulo="Pergunta ou assunto" campo={[`conhecimento.itens.${i}.pergunta`, `pergunta:${p.id}`]}><input className={CAMPO} maxLength={500} value={p.pergunta} onChange={e => mudar({ pergunta: e.target.value })} /></Campo>
        <Campo titulo="Resposta autorizada" campo={[`conhecimento.itens.${i}.resposta`, `pergunta:${p.id}`]}><textarea rows={4} maxLength={3000} className={CAMPO} value={p.resposta} placeholder="Informe a regra real do seu negócio…" onChange={e => mudar({ resposta: e.target.value })} /></Campo>
        <Campo titulo="Situação da resposta"><SeletorSituacao titulo={`Situação da resposta ${i + 1}`} valor={p.situacao} mudar={situacao => mudar({ situacao })} /></Campo>
        <div className="flex flex-wrap gap-2">{p.situacao === "REVISAR" && <button type="button" className={BOTAO} onClick={() => mudar({ situacao: "CONFIRMADO" })}>Conferi esta resposta</button>}<button type="button" className="rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => editar("conhecimento", { itens: d.conhecimento.itens.filter(v => v.id !== p.id) })}>Remover pergunta</button></div>
      </div>;
    })}
    <button type="button" className={BOTAO} onClick={() => editar("conhecimento", { itens: [...d.conhecimento.itens, { id: `novo:${crypto.randomUUID()}`, pergunta: "", resposta: "", situacao: "REVISAR", origem: "MANUAL" }] })}>Adicionar pergunta ou regra</button>
    <p className="rounded-xl bg-panel-bg p-3 text-xs leading-relaxed text-panel-sub">“Não informado” significa que a Nexa ainda não sabe. “Não se aplica” significa que você decidiu que aquele assunto não faz parte deste atendimento. Informações aguardando revisão precisam da sua conferência.</p>
  </Cartao>;

  return null;
}


