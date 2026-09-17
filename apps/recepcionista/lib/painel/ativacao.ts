/**
 * OS TRÊS PASSOS ATÉ A PRIMEIRA MENSAGEM.
 *
 * O caminho inteiro do valor da Nexora cabe em três gestos: subir a lista, ver
 * quem parou de voltar, mandar a primeira mensagem. Quem chega de anúncio não
 * conhece o produto e não vai caçar isso no menu — e um dono que sai antes do
 * terceiro gesto nunca viu a Nexora funcionar, ele viu um cadastro.
 *
 * O CHECK É UM FATO, NÃO UM ELOGIO. Cada passo fecha por dado no banco: cliente
 * cadastrado, gente fora do ritmo encontrada, mensagem registrada. Nada aqui
 * marca passo porque o dono clicou em algum lugar — checklist que se
 * autoparabeniza por navegação é a primeira mentira pequena da tela, e esta
 * tela é onde ele decide se confia no resto.
 *
 * Puro e sem banco: quem conta os sinais é a rota de clientes.
 */

export type SinaisDaAtivacao = {
  /** Clientes cadastrados na lista do dono. */
  clientes: number;
  /** Quantos já passaram do tempo que eles mesmos costumam demorar. */
  atrasados: number;
  /** Mensagens de recuperação já registradas por este negócio. */
  mensagensEnviadas: number;
};

export type PassoDaAtivacao = {
  numero: 1 | 2 | 3;
  titulo: string;
  detalhe: string;
  acao: { texto: string; href: string };
  feito: boolean;
  /** Falso enquanto o passo anterior não aconteceu: não adianta abrir. */
  liberado: boolean;
};

const IMPORTAR = "/painel/clientes/importar";
const ONDA = "/painel/onda";

export function passosDaAtivacao(s: SinaisDaAtivacao): PassoDaAtivacao[] {
  const temLista = s.clientes > 0;

  return [
    {
      numero: 1,
      titulo: "Suba sua lista de clientes",
      detalhe: temLista
        ? `${s.clientes} ${s.clientes === 1 ? "cliente já está" : "clientes já estão"} com você aqui.`
        : "Manda do jeito que estiver: planilha, foto do caderno, o arquivo que o WhatsApp gera. A Nexora organiza e diz o que não conseguiu ler.",
      acao: { texto: temLista ? "Trazer mais clientes" : "Trazer meus clientes", href: IMPORTAR },
      feito: temLista,
      liberado: true,
    },
    {
      numero: 2,
      titulo: "Veja quem parou de voltar",
      detalhe: !temLista
        ? "Assim que a sua lista entrar, a Nexora mostra quem sumiu — e por que ela acha isso."
        : s.atrasados > 0
          ? `${s.atrasados} ${s.atrasados === 1 ? "cliente seu já passou" : "clientes seus já passaram"} do tempo que ${s.atrasados === 1 ? "ele costuma" : "eles costumam"} demorar para voltar.`
          : // Lista em dia é boa notícia. Cobrar uma ação que a própria Nexora
            // diz não existir seria inventar urgência.
            "Ninguém da sua lista está fora do ritmo hoje. Quando alguém passar do tempo dele, aparece aqui.",
      acao: { texto: "Ver quem sumiu", href: ONDA },
      feito: temLista,
      liberado: temLista,
    },
    {
      numero: 3,
      titulo: "Mande sua primeira mensagem",
      detalhe:
        s.mensagensEnviadas > 0
          ? `${s.mensagensEnviadas} ${s.mensagensEnviadas === 1 ? "mensagem já saiu" : "mensagens já saíram"} daqui.`
          : "A mensagem já vem escrita para cada cliente. Você lê, muda o que quiser e manda do seu próprio WhatsApp.",
      acao: { texto: "Mandar a primeira mensagem", href: ONDA },
      feito: s.mensagensEnviadas > 0,
      liberado: temLista,
    },
  ];
}

export function progressoDaAtivacao(s: SinaisDaAtivacao): {
  feitos: number;
  total: number;
  concluida: boolean;
} {
  const passos = passosDaAtivacao(s);
  const feitos = passos.filter((p) => p.feito).length;
  return { feitos, total: passos.length, concluida: feitos === passos.length };
}
