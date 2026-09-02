/**
 * Segredos de TESTE.
 *
 * Depois da auditoria, as funções que assinam ou derivam segredo falham fechado
 * — `hashTelefone` e `tokenDescadastro` exigem chave de pelo menos 32 caracteres
 * em vez de cair para string vazia. Isso é o comportamento certo em produção, e
 * significa que o teste precisa fornecer uma chave, como produção fornece.
 *
 * O valor abaixo é fixo de propósito: hash determinístico entre execuções é o
 * que permite comparar a lista de supressão nos testes. Ele não abre nada — não
 * é usado em lugar nenhum além daqui.
 */
process.env.SUPRESSAO_SECRET =
  process.env.SUPRESSAO_SECRET ?? "chave-apenas-de-teste-com-mais-de-32-caracteres";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "chave-apenas-de-teste-com-mais-de-32-caracteres";
