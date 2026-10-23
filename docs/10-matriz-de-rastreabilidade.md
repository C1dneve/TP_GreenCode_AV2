# Matriz de rastreabilidade — GreenCode AV2

**Atualizada em:** 23/10/2026. Esta matriz diferencia o que passou nas verificações executadas do que ainda tem cobertura incompleta. Código presente ou teste escrito não equivale a requisito totalmente homologado.

## Legenda

- **Validado no recorte atual:** o teste ou comando relacionado foi executado e passou.
- **Parcial:** há evidência positiva, mas ela não cobre todos os cenários do requisito.
- **Pendente:** ainda falta evidência de execução apropriada.

## Rastreabilidade de requisitos

| ID | Requisito/decisão | Código principal | Estado e evidência atual |
|---|---|---|---|
| RT-001 | Node 24, Fastify 5, Prisma 7, PostgreSQL 17 e monólito modular | `package.json`, `prisma.config.ts`, `src/app.ts` | **Validado no recorte atual:** Node 24.19.0 e PostgreSQL 17.11 usados localmente; build aprovado. |
| RT-002 | Configuração, `/health`, inicialização e encerramento | `src/config/env.ts`, `src/app.ts`, `src/server.ts` | **Parcial:** testes de configuração e `/health` passaram; encerramento gracioso precisa de cenário dedicado. |
| RT-003 | Validação de payload, erros uniformes, request ID e OpenAPI | `src/app.ts`, rotas dos módulos | **Validado no recorte atual:** testes de envelope de erro, health, Swagger UI e `/docs/json` passaram; cobertura completa de schemas não está provada. |
| RT-004 | Rotas/controllers sem Prisma direto e services desacoplados do Fastify | `src/modules/*` | **Validado no recorte atual:** testes de arquitetura passaram. |
| RT-005 | Schema relacional, FKs, unicidade, índices e enums | `prisma/schema.prisma`, `prisma/migrations/*` | **Parcial:** validação Prisma e testes PostgreSQL passaram para as constraints específicas cobertas; não representa todas as combinações do modelo. |
| RT-006 | Migrações versionadas, seed repetível, defaults e bootstrap explícito | `prisma/migrations/*`, `prisma/seed.ts` | **Validado no recorte atual:** deploy/status de migrações sem pendências; seed executado duas vezes; defaults 0%/15% conferidos. |
| RT-007 | bcrypt, JWT de 30 minutos, validação de usuário ativo e claims | `src/modules/auth/*`, `src/app.ts` | **Parcial:** login, credenciais inválidas, papéis em `/auth/me` e tokens ausente/malformado testados; expiração e todas as condições de claims ainda exigem evidência. |
| RT-008 | Logout com revogação e invalidação de sessões por `authVersion` | `src/modules/auth/*`, `src/modules/usuarios/*` | **Parcial:** logout seguido de reutilização do mesmo JWT resultou em HTTP 401; troca de senha e invalidação global ainda precisam de testes dedicados. |
| RT-009 | Quatro papéis e matriz de RBAC | rotas e services em `src/modules/*` | **Parcial:** testes cobrem `/auth/me`, áreas administrativas e autorização nos services; a matriz completa para todos os endpoints continua pendente. |
| RT-010 | Gestão de usuários, proteção ao último Administrador e autodesativação | `src/modules/usuarios/*` | **Pendente:** falta evidência específica de todos os invariantes e dos casos concorrentes. |
| RT-011 | Organizações, CNPJ, busca, paginação, versionamento e inativação | `src/modules/organizacoes/*` | **Parcial:** validação unitária de CNPJ, unicidade no banco e criação na jornada HTTP passaram; filtros, versionamento e bloqueios de inativação precisam de cobertura adicional. |
| RT-012 | Contratos históricos, vigência única, renovação e cancelamento | `src/modules/contratos/*` | **Parcial:** criação de contrato na jornada HTTP passou; concorrência de vigência, renovação, cancelamento e rollback precisam de testes específicos. |
| RT-013 | Lotes, janela temporal, estados, bloqueio de lote vazio e versionamento | `src/modules/lotes/*` | **Parcial:** fluxo básico de lote/triagem passou na jornada; limites de data, lote vazio e transições negativas continuam pendentes. |
| RT-014 | Triagem simplificada transacional | `src/modules/lotes/lotes.service.ts` | **Parcial:** jornada básica de triagem passou; atomicidade e rollback por falha precisam de teste dedicado. |
| RT-015 | Equipamentos, código único, vínculo lote/posição e persistência | `src/modules/equipamentos/*`, migrações | **Parcial:** jornada HTTP e constraints específicas de código, lote e posição passaram; cenários de atualização/ativação ainda precisam de cobertura. |
| RT-016 | Estado físico, rastreamento, transições e justificativas | `src/modules/equipamentos/equipamentos.service.ts` | **Pendente:** faltam testes de fronteira para transições e justificativas. |
| RT-017 | Movimentações append-only e histórico | `src/modules/movimentacoes/*` | **Parcial:** a jornada básica registrou movimentação; autoria, origem/destino e todas as proteções append-only precisam de testes específicos. |
| RT-018 | Auditoria na mesma transação e consulta protegida | `src/modules/auditoria/*` e repositories | **Pendente:** falta evidência específica de rollback quando a auditoria falha e de todas as permissões de consulta. |
| RT-019 | Relatórios operacionais, de triagem e financeiros simplificados | `src/modules/relatorios/*` | **Pendente:** resultados precisam ser comparados com dados persistidos e cenários de filtro/consistência. |
| RT-020 | Parâmetros globais, intervalo de 0–100%, RBAC e auditoria | `src/modules/parametros/*` | **Parcial:** defaults 0%/15% foram confirmados; alterações inválidas, autorização e auditoria requerem testes específicos. |
| RT-021 | Coleções `{data, meta}`, erros estáveis e OpenAPI | `src/shared/*`, `src/app.ts`, rotas | **Parcial:** OpenAPI e erros básicos passaram; falta confirmar paginação, listas vazias e schemas de todos os recursos. |
| RT-022 | Testes, documentação, CI e homologação | `src/tests/*`, `.github/workflows/ci.yml`, `docs/*` | **Parcial:** 25 testes unitários/HTTP e 10 de integração passaram localmente; CI remota ainda não foi verificada. |

## Situação por épico

| Épico | User Stories | Evidência atual | Situação |
|---|---|---|---|
| E0 — Fundação HTTP e arquitetura | US-AV2-001–004 | Build, health, Swagger, erros e testes de arquitetura passaram. | Parcial: falta conferir mais cenários de inicialização/encerramento e contratos. |
| E1 — Persistência e integridade | US-AV2-005–009 | Prisma, migrações, seed, defaults e constraints específicas passaram. | Parcial: ampliar cobertura de integridade e reversão. |
| E2 — Autenticação e RBAC | US-AV2-010–015 | Login, papéis, negação de acesso e revogação manual aprovados nos cenários executados. | Parcial: cobertura completa de permissões, usuários desativados, troca de senha e último Administrador. |
| E3 — Organizações | US-AV2-016–019 | CNPJ e criação na jornada HTTP testados. | Parcial: paginação, concorrência, atualização e desativação. |
| E4 — Contratos | US-AV2-020–023 | Criação de contrato na jornada HTTP. | Parcial: renovação, cancelamento e concorrência. |
| E5 — Lotes e triagem | US-AV2-024–028 | Jornada básica de lote e triagem. | Parcial: limites, transições negativas e rollback. |
| E6 — Equipamentos | US-AV2-029–033 | Cadastro na jornada e constraints de unicidade/relação. | Parcial: demais estados, valores, versionamento e ativação. |
| E7 — Movimentações | US-AV2-034–035 | Registro de movimentação na jornada HTTP. | Parcial: histórico completo e testes de segurança/imutabilidade. |
| E8 — Auditoria, relatórios e entrega | US-AV2-036–041 | Defaults, OpenAPI, documentação e suites locais aprovadas. | Parcial: atomicidade de auditoria, relatórios e CI remota. |

## Evidências executadas em 23/10/2026

- Node `v24.19.0`, npm `11.17.0` e PostgreSQL `17.11` usados na validação local.
- `npm ci` e `npm ls --depth=0` concluídos; a auditoria do npm reportou zero vulnerabilidades naquela instalação.
- `npm run prisma:validate`, `npm run prisma:generate` e `npm run build` passaram.
- `npm test`: 25 aprovados, 0 falhas.
- `npm run test:integration`: 10 aprovados, 0 falhas.
- `npm run db:deploy` e `npx prisma migrate status`: três migrações, nenhuma pendente no banco de teste.
- `npm run db:seed` foi executado duas vezes; uma conta `av2admin` foi encontrada e os parâmetros padrão 0%/15% foram verificados.
- Login e `/auth/me` passaram antes do logout; após logout, o mesmo token foi recusado com HTTP 401.
- `git diff --check` não apresentou mensagens.
- CI remota do GitHub: ainda não verificada após push.

## Regra de encerramento

Marque uma User Story como validada somente quando houver teste aprovado que cubra o critério relevante. Para concorrência, constraints e transações, use PostgreSQL real. A contagem atual de testes não substitui a cobertura dos cenários que permanecem pendentes. Consulte [`relatorio-final-av2.md`](relatorio-final-av2.md) e [`homologacao-av2.md`](homologacao-av2.md).
