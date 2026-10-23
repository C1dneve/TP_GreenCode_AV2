# Relatório de implementação e validação — GreenCode AV2

**Revisão:** 23/10/2026

**Branch informada:** `feature/develop-AV2`

**Estado:** implementação em andamento; build e testes locais executados passaram. A homologação final e a CI remota continuam pendentes.

**Commit/push desta revisão:** não realizados.

## Resumo

A API está organizada em módulos para autenticação, usuários, organizações, contratos, lotes, equipamentos, movimentações, auditoria, relatórios e parâmetros. O fluxo de responsabilidade esperado é `Routes → Controllers → Services → Repositories → Prisma → PostgreSQL`.

Depois de corrigir a configuração do Swagger removendo a opção `urls.primaryName` que não era aceita pelo tipo instalado, o build passou. As suítes automatizadas passaram no ambiente local configurado com Node 24 e PostgreSQL de teste. O teste manual também confirmou a revogação do JWT no logout.

Isso representa uma melhora concreta em relação ao estado anterior, mas não deve ser descrito como homologação completa: parte das regras de negócio e dos cenários de segurança ainda não tem evidência específica, e a CI do GitHub não foi consultada após o estado atual.

## Evidências registradas

| Verificação | Resultado | Observação |
|---|---|---|
| Ambiente Node/npm | Aprovado nesta execução | Node `v24.19.0`; npm `11.17.0` |
| Instalação de dependências | Aprovada nesta execução | `npm ci` instalou 242 pacotes; auditoria reportou 0 vulnerabilidades |
| Dependências | Aprovada nesta execução | `npm ls --depth=0` listado sem erro |
| Prisma | Aprovado | `prisma:validate` e `prisma:generate` passaram |
| Build TypeScript | Aprovado | `npm run build` passou após ajuste do Swagger |
| Testes unitários/HTTP | **25 passaram, 0 falharam** | `npm test` |
| Testes de integração | **10 passaram, 0 falharam** | `npm run test:integration` contra PostgreSQL de teste |
| Migrações | Aprovadas no banco testado | `db:deploy` passou; `prisma migrate status` indicou três migrações e nenhuma pendente |
| Seed | Aprovado no recorte testado | Executado duas vezes; usuário Administrador existente preservado; parâmetros padrão verificados |
| Integridade PostgreSQL | Parcialmente validada | Testes confirmaram unicidades e relacionamentos específicos listados na suíte |
| Fluxo manual de autenticação | Aprovado | Login, `/auth/me`, logout e recusa do token revogado com HTTP `401` |
| Health, Swagger e erros | Aprovados nos testes executados | `/health`, `/docs`, `/docs/json` e envelope de erro testados |
| `git diff --check` | Sem erros reportados | A saída não apresentou mensagens |
| CI remota do GitHub | **Pendente** | Precisa ser conferida após push |

## O que os testes cobriram

Os testes unitários/HTTP incluíram health, documento OpenAPI, Swagger UI, respostas de erro, separação de camadas, login, credenciais inválidas, acesso a `/auth/me` pelos quatro papéis, restrições de rotas administrativas, proteção de rotas sem token ou com token malformado, autorização na camada de serviços, validação de CNPJ e validação de configuração.

A integração executou uma jornada HTTP real com organização, contrato, lote, equipamento, triagem e movimentação. Também verificou os parâmetros globais padrão, a relação entre lote, organização e equipamento, posição e lote opcionais nas condições esperadas e rejeições do banco para código de equipamento duplicado, posição duplicada, CNPJ duplicado, usuário duplicado, lote inexistente e combinações inconsistentes de lote/posição.

O teste manual isolado de autenticação confirmou que o JWT deixou de ser aceito após o logout. O banco usado para esses testes era `greencode_av2_test`; não é evidência de que outros ambientes ou bancos tenham sido testados.

## O que ainda não pode ser declarado concluído

Não há evidência suficiente para marcar como aprovados todos os critérios P0/P1 ou todas as US. Permanecem testes complementares para a matriz completa de RBAC, expiração de token, usuário desativado, troca de senha, último Administrador, concorrência, versionamento otimista, transações/rollback com auditoria, limites temporais de lotes, justificativas das transições físicas, consistência dos relatórios e segurança dos logs em todos os caminhos.

A CI do GitHub ainda precisa ser executada e conferida após o push do estado atual. O aviso `FSTDEP023` do Fastify sobre `disableRequestLogging` continua aparecendo; ele não bloqueou o build nem as suítes, mas convém atualizar essa configuração antes de uma futura migração para Fastify 6.

## Documentação e estrutura

A documentação normativa está em `docs/`. A matriz de rastreabilidade registra requisito por requisito a evidência e a pendência; o roteiro de homologação reúne os comandos para repetir os testes. Os documentos originais de planejamento permanecem em `docs/referencias/planejamento-pre-decisao/` apenas para rastreabilidade histórica.

Foram identificadas cópias idênticas dos três documentos de planejamento em `docs/spec/`, além de dois arquivos que disputavam o número ADR-0001. O material relevante de fundação foi consolidado no ADR técnico; as duplicatas podem ser removidas sem perder o conteúdo que permanece nos documentos canônicos.

## Próximas etapas

1. Revisar este relatório e a matriz junto com as mudanças do código.
2. Confirmar que `.env`, tokens, senhas e utilitários temporários não serão commitados.
3. Executar `git diff --check` e inspecionar `git status --short`.
4. Fazer commit e push da branch de trabalho.
5. Conferir o resultado do GitHub Actions e corrigir qualquer falha real.
6. Ampliar os testes pendentes descritos acima e atualizar a matriz apenas com resultados executados.

**Conclusão:** há uma base funcional com build, 25 testes unitários/HTTP, 10 testes de integração e fluxo manual de revogação aprovados localmente. O status correto continua sendo **validação parcial aprovada; homologação final pendente**.
