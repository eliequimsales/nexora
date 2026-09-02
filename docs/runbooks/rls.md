# Row Level Security — o que falta, e por que ainda não foi aplicado

**Estado: NÃO aplicado.** O isolamento entre contas existe hoje só no código de
aplicação. Toda consulta a tabela de tenant filtra por `companyId`, e isso foi
verificado rota por rota na auditoria de 01/09/2026 — mas "toda consulta filtra"
é uma propriedade que depende de ninguém esquecer, e ninguém-esquece não é
controle de segurança.

## Por que não apliquei

Duas razões, e a segunda é a que pesa:

1. **RLS exige transação por requisição.** O padrão é `SET LOCAL app.company_id`
   dentro de uma transação, e a política lê essa variável. Isso significa que
   *toda* consulta do app precisa rodar dentro de uma transação — refatoração
   das 35 rotas e de toda `lib/`.

2. **Não há banco de pé para verificar.** O Railway está fora desde 06/07/2026.
   Política de RLS errada não falha barulhento: ela faz *toda* consulta devolver
   zero linhas. Aplicar sem poder testar transformaria uma melhoria de segurança
   numa queda total, e a primeira pessoa a descobrir seria um cliente pagante.

Escrever a migração e não aplicá-la é a escolha honesta. O que está abaixo é
para ser executado e conferido com o banco no ar.

## O que existe no lugar, enquanto isso

`tests/escopo-tenant.test.ts` verifica **no build** o caso que o RLS pegaria em
execução: consulta a modelo de tenant usando id vindo da requisição sem
`companyId` no filtro. O teste foi validado plantando um IDOR real — ele falha
com a falha presente e passa sem ela.

Isso **não substitui** RLS. Cobre o erro entrando no repositório, não o erro em
execução, e não cobre código que a análise estática não enxerga (query montada
dinamicamente, por exemplo). É a camada anterior, não a mesma.

## A migração, para quando houver banco

### 1. Papel restrito para a aplicação

RLS **não se aplica ao dono da tabela** por padrão. Se a `DATABASE_URL` do app
usa o mesmo papel que criou o schema, as políticas são ignoradas em silêncio —
o pior resultado possível, porque tudo parece protegido e nada está.

```sql
CREATE ROLE nexora_app LOGIN PASSWORD '<gerar>';
GRANT CONNECT ON DATABASE railway TO nexora_app;
GRANT USAGE ON SCHEMA public TO nexora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexora_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_app;
```

O `prisma db push` do boot continua rodando com o papel dono; a `DATABASE_URL`
da aplicação passa a usar `nexora_app`. São duas URLs distintas.

### 2. Políticas nas tabelas de tenant

Dezesseis tabelas têm `companyId`. Para cada uma:

```sql
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Customer"
  USING ("companyId" = current_setting('app.company_id', true))
  WITH CHECK ("companyId" = current_setting('app.company_id', true));
```

`FORCE` é obrigatório: sem ele o dono da tabela continua ignorando a política.
`WITH CHECK` é obrigatório: sem ele dá para **inserir** linha no tenant de outro,
mesmo sem conseguir ler.

O terceiro argumento `true` em `current_setting` evita erro quando a variável
não está definida — a comparação então falha e a consulta devolve zero linhas,
que é o lado seguro.

Tabelas: `CompanyProfile`, `Conversation`, `Lead`, `KnowledgeGap`,
`KnowledgeItem`, `ErrorLog`, `Customer`, `Service`, `Appointment`,
`RecoveryTouch`, `RecoveryEntry`, `Reengajamento`, `PasswordReset`,
`RegistroImportacao`, `Supressao`, `VerificacaoEmail`.

`Visit` e `Message` não têm `companyId` — herdam por `customerId` e
`conversationId`. Ou ganham a coluna, ou a política vai por `EXISTS` no pai.

### 3. Onde o `SET LOCAL` entra

```ts
export function comTenant<T>(companyId: string, fn: (tx) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    // set_config com is_local=true: vale só nesta transação, e não vaza para
    // a próxima requisição que pegar a mesma conexão do pool.
    await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
    return fn(tx);
  });
}
```

**A armadilha do pool:** `SET` sem `LOCAL` gruda na conexão. Como o pool
reaproveita conexões entre requisições, a requisição seguinte herdaria o tenant
da anterior — vazamento pior do que não ter RLS. `set_config(..., true)` é o
que amarra ao escopo da transação.

### 4. Como saber que funcionou

Uma política errada devolve zero linhas em vez de estourar. O teste tem que ser
positivo **e** negativo:

1. Duas empresas, `A` e `B`, cada uma com clientes.
2. Com `app.company_id = A`: `SELECT count(*) FROM "Customer"` devolve só os de A.
3. Com `app.company_id = A`: `INSERT` com `"companyId" = B` é **recusado** (é o
   `WITH CHECK`).
4. **Sem** a variável definida: devolve zero linhas, nunca a tabela inteira.
5. O app inteiro sobe e o painel carrega — se as políticas estiverem erradas,
   tudo vem vazio, e é isso que este passo pega antes do cliente.

### 5. Ordem de aplicação

Uma tabela por vez, começando por `Customer`, que é a que guarda dado de
terceiro e é o pior vazamento possível. Confirmar cada uma antes da próxima.
Todas de uma vez, sem poder testar, é como se perde a base inteira de vista.
