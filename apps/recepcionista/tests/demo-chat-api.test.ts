import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/demo/chat/route";

describe("POST /api/demo/chat — rota pública de demonstração", () => {
  it("rejeita requisições com mensagem vazia", async () => {
    const req = new Request("http://localhost:3000/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("responde sobre preços informando R$ 97 e teste grátis", async () => {
    const req = new Request("http://localhost:3000/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "Qual o preço dos planos?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resposta).toMatch(/97|197|grátis|plano/i);
  });

  it("responde sobre atendimento noturno e de madrugada", async () => {
    const req = new Request("http://localhost:3000/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "Vocês atendem de madrugada?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resposta).toMatch(/madrugada|noite|dormir|acordad|fechad/i);
  });

  it("responde sobre horários e agendamento", async () => {
    const req = new Request("http://localhost:3000/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "Tem horário livre amanhã?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resposta).toMatch(/horário|livre|amanhã|14h|16h/i);
  });
});
