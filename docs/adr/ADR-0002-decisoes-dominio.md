# ADR-0002 — Decisões de domínio da AV2

- **Status:** aprovado pelo responsável em 20/10/2026.
- **Confirmação recebida:** `ENT1-A`; aceitar recomendações ER/NEG/SEG/REST sem exceções; preservar triagem simplificada da AV1.
- **Fontes:** PDF da AV2; PDF, código e documentação de domínio da AV1; contrato REST proposto; confirmação consolidada do responsável.
- **Base de implementação:** projeto AV2 novo. ZIP legado é material de auditoria, não base de código.

## Contexto

A AV2 transforma a CLI em um monólito HTTP com API REST, Node.js, TypeScript, Fastify, Prisma e PostgreSQL. A SPA completa fica fora de escopo. A entrega inclui fluxos essenciais herdados, relatórios operacionais e parâmetros básicos; relatório financeiro avançado pode ser simplificado com documentação da limitação.

## Decisões aprovadas

1. Preservar regras de domínio da AV1; não transportar CLI, arquivos cifrados, journal em arquivo, dados locais, credenciais, hashes ou sessões da AV1.
2. Usar os modelos `Usuario`, `Organizacao`, `Contrato`, `Lote`, `Equipamento`, `Movimentacao`, `TokenRevogado`, `EventoAuditoria` e `ParametroGlobal`.
3. Usar UUIDs técnicos gerados pelo servidor. CNPJ normalizado para 14 dígitos e único; código interno de equipamento gerado pelo servidor e globalmente único.
4. Organização tem relação `1:N` com contratos históricos; no máximo um contrato é vigente por vez. A vigência é derivada de `ativo`, ausência de cancelamento e vencimento futuro. Divergência deliberada da simplificação do PDF para preservar histórico AV1.
5. Renovação fecha o contrato vigente anterior e cria novo registro na mesma transação, sem sobrescrever o histórico. `renovacaoAutomatica` não executa job nesta AV2; o evento de auditoria deve permitir entender o encerramento ocorrido por renovação.
6. Organização exige razão social e CNPJ; demais contatos são opcionais; endereço é texto único. Cláusulas são lista ordenada de strings. Nota fiscal não tem unicidade adicional. Transportadora é texto livre.
7. Equipamento mantém `posicaoNoLote`, ano de fabricação obrigatório validado entre 1900 e ano corrente, peso `Decimal(10,3)` kg, dinheiro `Decimal(12,2)`, e enums da AV1.
8. Os quatro papéis são mantidos: `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO`, `AUDITOR`, um por usuário. Login normalizado em minúsculas. Senhas novas usam bcrypt e tamanho mínimo de 12 caracteres.
9. JWT expira em 30 minutos. Todas as requisições protegidas verificam usuário ativo e `jti` revogado. Logout revoga imediatamente o token atual persistindo `jti`; troca de senha revoga tokens anteriores conhecidos.
10. `TokenRevogado` mantém `jti`, usuário, expiração e instante de revogação. Registros vencidos só podem ser limpos após expiração do JWT correspondente.
11. Movimentações guardam FK de responsável e snapshot do nome; origem/destino são texto. Responsável e data/hora são definidos pelo servidor. Movimentação não altera status de rastreamento automaticamente.
12. Auditar mutações importantes e ações relevantes de segurança. Gravação de mutação e evento de sucesso na mesma transação; auditoria não grava segredos. Movimentações e auditoria são append-only.
13. Dinheiro usa Decimal com duas casas; peso, três casas; persistência temporal em UTC.
14. Recursos mutáveis usam `versao` e escritas pertinentes recebem `versaoEsperada`; conflito retorna `409 VERSION_CONFLICT` sem persistência parcial.
15. Não apagar fisicamente registros de negócio com histórico; usar restrições referenciais, desativação e cancelamento.
16. Data de entrada de lote não pode ser futura nem anterior a 90 dias; o limite de 90 dias é inclusivo. Desativação de organização é bloqueada quando houver lotes não finalizados, mas contrato vigente isolado não bloqueia.
17. Triagem simplificada da AV1: lote ativo e não vazio; operação transacional passa pelo estado intermediário `EM_TRIAGEM` e termina com lote `TRIAGEM_CONCLUIDA`; todos os equipamentos passam de `EM_TRIAGEM` para `AGUARDANDO_DESMONTE`. Não implementar classificação individual de destino nesta entrega.
18. Fluxo de lote: `RECEBIDO → EM_TRIAGEM → TRIAGEM_CONCLUIDA → ENCAMINHADO → FINALIZADO`. Não finalizar lote vazio; encaminhar só após triagem; finalizar só após encaminhamento.
19. Toda mudança de rastreamento exige justificativa. Queda de pelo menos duas categorias de estado físico exige justificativa. `EM_DESMONTE` só após `AGUARDANDO_DESMONTE`.
20. Desativação não permite auto-desativação nem desativação do último Administrador ativo. Desativar usuário impede login e revoga tokens conhecidos.
21. Parâmetros padrão: `aliquotaImpostoPercentual=0` e `taxaDepreciacaoAnualPercentual=15`; faixa de 0 a 100; só Administrador pode alterar, com auditoria.
22. Relatórios operacionais e de triagem e parâmetros básicos fazem parte da entrega; relatório financeiro avançado pode ser simplificado se necessário, documentando a limitação.
23. Contrato REST em `/api/v1`; recursos plurais em português; IDs UUID; item JSON direto; coleções `{data,meta}`; erros `{error:{code,message,details?,requestId?}}`; paginação padrão 20/máximo 100; ações críticas em subrotas `POST`; não usar `DELETE` físico para histórico; `400/401/403/404/409/500`, sem `422` no escopo inicial.

## Consequências e itens de alinhamento

- A concorrência de contratos vigentes deve ser serializada dentro de transação (por exemplo, bloqueando a organização ou adotando uma estratégia equivalente no PostgreSQL).
- A geração concorrente de código de barras deve tratar colisão e preservar unicidade garantida pelo banco.
- O esquema inicial atualmente declara `Equipamento.loteId` obrigatório, mas a decisão de domínio permite desvinculação antes do início do processamento/rastreabilidade. Antes da migração ser homologada, ajustar a nulabilidade/índice de vínculo ou definir estratégia de transferência que preserve exatamente a regra. Não aplicar a migração sem resolver essa divergência.
- A matriz de alto nível herdada deve ser materializada em permissões explícitas por endpoint e confirmada por testes de permitido/negado.

## Divergências deliberadas em relação à AV2/AV1

- O PDF simplifica Organização–Contrato como contrato opcional; a solução preserva `Organizacao 1:N Contrato` devido ao histórico da AV1.
- SHA-256/arquivos/sessões da CLI não são reutilizados; credenciais novas usam bcrypt no banco e JWT na API.
- A triagem individual completa não será adicionada no escopo inicial; preserva-se a transição simplificada efetivamente implementada na AV1.
- SPA completa não faz parte desta etapa.
