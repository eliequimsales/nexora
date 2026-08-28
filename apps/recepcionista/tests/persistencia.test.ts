import { describe, expect, it } from "vitest";
import { planejarImportacao, type ClienteExistente } from "@/lib/importacao/persistir";
import type { ClienteImportado } from "@/lib/importacao/parsers";

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function importado(
  over: Partial<ClienteImportado> & { telefone: string },
): ClienteImportado {
  const visitas = over.visitas ?? [];
  return {
    nome: over.nome ?? "Cliente",
    telefone: over.telefone,
    ultimaVisita: over.ultimaVisita ?? visitas[visitas.length - 1]?.data ?? null,
    valorCents: over.valorCents ?? 0,
    visitas,
  };
}

function existente(
  over: Partial<ClienteExistente> & { phone: string },
): ClienteExistente {
  return {
    id: over.id ?? `cus_${over.phone}`,
    phone: over.phone,
    name: over.name ?? "Cliente",
    optOut: over.optOut ?? false,
    visitas: over.visitas ?? [],
  };
}

// ---------------------------------------------------------------------------
// O RESGATE DO CADERNO só serve se puder rodar DUAS VEZES sem estragar o
// número. Receita Recuperada é o North Star: visita duplicada infla o North
// Star, e métrica inflada é a forma mais rápida de perder a confiança do dono.
// ---------------------------------------------------------------------------
describe("planejarImportacao", () => {
  it("cliente que não existe vira CRIAR com todas as visitas dele", () => {
    const plano = planejarImportacao(
      [
        importado({
          nome: "João Silva",
          telefone: "11988887777",
          visitas: [
            { data: d("2026-01-10"), valorCents: 5000 },
            { data: d("2026-02-08"), valorCents: 5000 },
          ],
        }),
      ],
      [],
    );

    expect(plano.clientes).toHaveLength(1);
    expect(plano.clientes[0].acao).toBe("CRIAR");
    expect(plano.clientes[0].clienteId).toBeNull();
    expect(plano.clientes[0].visitasNovas).toHaveLength(2);
    expect(plano.resumo.criar).toBe(1);
    expect(plano.resumo.visitasNovas).toBe(2);
  });

  it("importar o MESMO arquivo duas vezes não cria visita repetida", () => {
    const jaGravadas = [
      { occurredAt: d("2026-01-10"), valueCents: 5000 },
      { occurredAt: d("2026-02-08"), valueCents: 5000 },
    ];

    const plano = planejarImportacao(
      [
        importado({
          nome: "João Silva",
          telefone: "11988887777",
          visitas: [
            { data: d("2026-01-10"), valorCents: 5000 },
            { data: d("2026-02-08"), valorCents: 5000 },
          ],
        }),
      ],
      [existente({ phone: "11988887777", name: "João Silva", visitas: jaGravadas })],
    );

    expect(plano.clientes[0].acao).toBe("ATUALIZAR");
    expect(plano.clientes[0].visitasNovas).toHaveLength(0);
    expect(plano.clientes[0].visitasDuplicadas).toBe(2);
    expect(plano.resumo.visitasNovas).toBe(0);
  });

  it("mesma data com valor DIFERENTE é visita nova, não duplicata", () => {
    const plano = planejarImportacao(
      [
        importado({
          telefone: "11988887777",
          visitas: [{ data: d("2026-01-10"), valorCents: 8000 }],
        }),
      ],
      [
        existente({
          phone: "11988887777",
          visitas: [{ occurredAt: d("2026-01-10"), valueCents: 5000 }],
        }),
      ],
    );

    expect(plano.clientes[0].visitasNovas).toHaveLength(1);
    expect(plano.clientes[0].visitasDuplicadas).toBe(0);
  });

  it("hora diferente no MESMO dia com o mesmo valor conta como duplicata", () => {
    const plano = planejarImportacao(
      [
        importado({
          telefone: "11988887777",
          visitas: [{ data: new Date("2026-01-10T22:30:00.000Z"), valorCents: 5000 }],
        }),
      ],
      [
        existente({
          phone: "11988887777",
          visitas: [{ occurredAt: new Date("2026-01-10T09:00:00.000Z"), valueCents: 5000 }],
        }),
      ],
    );

    expect(plano.clientes[0].visitasNovas).toHaveLength(0);
    expect(plano.clientes[0].visitasDuplicadas).toBe(1);
  });

  // -------------------------------------------------------------------------
  // CDC/LGPD: quem pediu para sair, saiu. Reimportar a planilha antiga não pode
  // ressuscitar ninguém — é o tipo de erro que vira reclamação e multa.
  // -------------------------------------------------------------------------
  it("cliente com opt-out é ignorado e NENHUMA visita dele entra", () => {
    const plano = planejarImportacao(
      [
        importado({
          telefone: "11988887777",
          visitas: [{ data: d("2026-03-01"), valorCents: 9000 }],
        }),
      ],
      [existente({ phone: "11988887777", optOut: true })],
    );

    expect(plano.clientes[0].acao).toBe("IGNORAR_OPT_OUT");
    expect(plano.clientes[0].visitasNovas).toHaveLength(0);
    expect(plano.clientes[0].renomearPara).toBeNull();
    expect(plano.resumo.ignoradosPorOptOut).toBe(1);
    expect(plano.resumo.visitasNovas).toBe(0);
  });

  it("Sem nome nunca sobrescreve um nome real já gravado", () => {
    const plano = planejarImportacao(
      [importado({ nome: "Sem nome", telefone: "11988887777" })],
      [existente({ phone: "11988887777", name: "Maria Aparecida" })],
    );

    expect(plano.clientes[0].renomearPara).toBeNull();
  });

  it("nome real substitui um Sem nome que estava gravado", () => {
    const plano = planejarImportacao(
      [importado({ nome: "Maria Aparecida", telefone: "11988887777" })],
      [existente({ phone: "11988887777", name: "Sem nome" })],
    );

    expect(plano.clientes[0].renomearPara).toBe("Maria Aparecida");
  });

  // -------------------------------------------------------------------------
  // Exportação de conversa do WhatsApp não traz telefone. Com
  // @@unique([companyId, phone]), gravar telefone vazio colapsaria a base
  // inteira num único cliente fantasma. Tem que sair do plano com motivo.
  // -------------------------------------------------------------------------
  it("cliente sem telefone é recusado com motivo, nunca vira registro fantasma", () => {
    const plano = planejarImportacao([importado({ nome: "Carlos", telefone: "" })], []);

    expect(plano.clientes).toHaveLength(0);
    expect(plano.semTelefone).toHaveLength(1);
    expect(plano.semTelefone[0].nome).toBe("Carlos");
    expect(plano.semTelefone[0].motivo).toMatch(/telefone/i);
  });

  it("duas linhas do mesmo arquivo com o mesmo telefone viram um cliente só", () => {
    const plano = planejarImportacao(
      [
        importado({
          nome: "João",
          telefone: "11988887777",
          visitas: [{ data: d("2026-01-10"), valorCents: 5000 }],
        }),
        importado({
          nome: "João Silva",
          telefone: "11988887777",
          visitas: [{ data: d("2026-02-08"), valorCents: 6000 }],
        }),
      ],
      [],
    );

    expect(plano.clientes).toHaveLength(1);
    expect(plano.clientes[0].visitasNovas).toHaveLength(2);
    expect(plano.resumo.criar).toBe(1);
  });

  it("o resumo bate exatamente com os itens do plano", () => {
    const plano = planejarImportacao(
      [
        importado({
          telefone: "11900000001",
          visitas: [{ data: d("2026-01-01"), valorCents: 100 }],
        }),
        importado({
          telefone: "11900000002",
          visitas: [{ data: d("2026-01-02"), valorCents: 200 }],
        }),
        importado({
          telefone: "11900000003",
          visitas: [{ data: d("2026-01-03"), valorCents: 300 }],
        }),
      ],
      [
        existente({ phone: "11900000002" }),
        existente({ phone: "11900000003", optOut: true }),
      ],
    );

    expect(plano.resumo.criar).toBe(1);
    expect(plano.resumo.atualizar).toBe(1);
    expect(plano.resumo.ignoradosPorOptOut).toBe(1);
    expect(plano.resumo.visitasNovas).toBe(2);
  });
});
