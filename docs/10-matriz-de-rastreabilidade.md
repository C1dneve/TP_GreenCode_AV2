# 10 — Matriz de rastreabilidade

**Versão:** 1.0  
**Data de referência:** 21/10/2026  
**Escopo aprovado:** ENT1-A; recomendações ER/NEG/SEG/REST aceitas sem exceções; triagem simplificada da AV1.

## 1. Objetivo

Esta matriz liga os requisitos e decisões da AV2 às fontes documentais, ADRs, regras de negócio, épicos/User Stories e evidências de implementação/teste. Ela existe para permitir responder:

1. De onde vem o requisito?
2. Onde a decisão foi formalizada?
3. Qual US implementa o requisito?
4. Em que parte do projeto deve existir a implementação?
5. Qual evidência prova que está concluído?

**Regra de rastreabilidade:** documentação aprovada não é evidência de implementação. Uma linha só deve ser marcada como validada quando houver comando/teste executado ou evidência verificável correspondente.

## 2. Legenda dos estados

| Estado | Significado |
|---|---|
| **DOC** | Decisão/regra documentada e consolidada |
| **CODE-PARCIAL** | Parte da fundação/camada existe, mas falta o fluxo funcional completo |
| **PENDENTE** | Implementação ainda não realizada |
| **VALIDAÇÃO-PENDENTE** | Código preparado, mas migração/teste/runtime ainda não foi executado ou confirmado |
| **VALIDADO** | Teste ou verificação pertinente foi executado e passou; registrar evidência |

Os estados abaixo refletem apenas evidências conhecidas em 21/10/2026. Não presumir estado verde da CI ou do banco.

## 3. Rastreabilidade de requisitos

| ID | Requisito / decisão rastreada | Fonte / documentos normativos | ADR / regra | Épico e US | Implementação esperada | Evidência e estado conhecido |
|---|---|---|---|---|---|---|
| RT-001 | Monólito HTTP Fastify, TypeScript e endpoints JSON | AV2.pdf; `visao-geral-e-escopo.md`; `arquitetura-e-padroes.md` | ADR-0001 | E0: US-AV2-001 a 004 | `src/app.ts`, `src/server.ts`, rotas e controllers | `/health`/Swagger estão estruturados; build local passou. **CODE-PARCIAL** |
| RT-002 | Configuração por ambiente, sem segredos no Git | `arquitetura-e-padroes.md`; `seguranca-e-rbac.md` | ADR-0001; SEG | US-AV2-001, 004 | `src/config/env.ts`, `.env.example`, `.gitignore`, `prisma.config.ts` | `npm run build` passou com `.env` presente. Revisar `.env` nunca versionado. **CODE-PARCIAL** |
| RT-003 | Controller → Service → Repository; controller não acessa Prisma | `arquitetura-e-padroes.md` | ADR-0001 | US-AV2-002 | `src/controllers/`, `src/services/`, `src/repositories/` | Estrutura preparada; serviços/repos funcionais ainda não implementados. **PENDENTE** |
| RT-004 | Schema relacional com entidades centrais e transversais | `modelo-de-dados.md` | ADR-0002 | E1: US-AV2-005, 007, 009 | `prisma/schema.prisma` | `prisma validate` e `prisma generate` passaram localmente. Migração ainda não aplicada. **VALIDAÇÃO-PENDENTE** |
| RT-005 | Migrações versionadas e banco reproduzível | `arquitetura-e-padroes.md`; `testes-e-criterios-de-aceite.md`; `plano-de-implementacao.md` | ADR-0001 | US-AV2-006, 040, 041 | `prisma/migrations/`, script `db:migrate`, serviço PostgreSQL na CI | PostgreSQL/Docker indisponível na máquina no último checkpoint; migração ainda sem validação real. **VALIDAÇÃO-PENDENTE** |
| RT-006 | Seed repetível e bootstrap explícito do primeiro Administrador | `modelo-de-dados.md`; `seguranca-e-rbac.md` | ADR-0002 | US-AV2-008, 014 | `prisma/seed.ts` | Código do seed existe, mas não foi executado contra banco. **VALIDAÇÃO-PENDENTE** |
| RT-007 | Login bcrypt, JWT 30 min, usuário ativo e `jti` revogável | `seguranca-e-rbac.md`; `contrato-api-rest.md` | ADR-0002; SEG | E2: US-AV2-010, 011, 012, 015 | Plugin JWT, services/repos de usuário e `TokenRevogado`, rotas `/api/v1/auth/*` | Login/logout e middleware ainda não implementados. **PENDENTE** |
| RT-008 | Autorização por quatro papéis e matriz RBAC | `seguranca-e-rbac.md`; `contrato-api-rest.md` | ADR-0002 | US-AV2-013 e critérios de todas as US protegidas | hooks/guards e políticas por rota/service | Não há teste de permitido/negado confirmado. **PENDENTE** |
| RT-009 | CNPJ normalizado, DV validado e único; cadastro de organização | `modelo-de-dados.md`; `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG1 | E3: US-AV2-016 a 019 | `OrganizacaoRepository`, service, controller/rotas, índice único no schema | Modelo existe; regra de serviço/endpoints ainda não existem. **PENDENTE** |
| RT-010 | Histórico de contratos 1:N, vigência derivada, renovação transacional e no máximo um vigente | `modelo-de-dados.md`; `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG2 | E4: US-AV2-020 a 023 | `ContratoRepository/Service`, transações e serialização da criação/renovação | Modelo existe; caso de uso e proteção contra concorrência ainda pendentes. **PENDENTE** |
| RT-011 | Lote ligado a organização ativa; data de entrada não futura nem anterior a 90 dias | `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG3 | E5: US-AV2-024, 025 | `LoteService` e endpoints de lote | Sem service/endpoint funcional. **PENDENTE** |
| RT-012 | Triagem simplificada e transação de lote/equipamentos; sequência operacional controlada | `regras-de-negocio.md`; `epicos-e-user-stories.md`; `testes-e-criterios-de-aceite.md` | ADR-0002; NEG4 | US-AV2-026, 027 | operação de triagem em `LoteService`, atualização conjunta e testes de rollback | Regra aprovada/documentada; operação não implementada. **PENDENTE** |
| RT-013 | Vínculo de equipamento removível apenas antes do processamento/rastreabilidade | `modelo-de-dados.md`; `regras-de-negocio.md` | ADR-0002; NEG4 | US-AV2-028 | `loteId`/posição, índices e serviço de vínculo | **Divergência conhecida:** schema inicial exige `loteId`; alinhar nulabilidade/índice antes da migração homologada. **VALIDAÇÃO-PENDENTE** |
| RT-014 | Equipamento: código interno único, ano, peso/valor, estado físico e status | `modelo-de-dados.md`; `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG5 | E6: US-AV2-029 a 033 | `EquipamentoService`, repositório, rotas, constraints | Parte dos campos/índices existe no schema; geração de código e regras de domínio ainda não implementadas. **CODE-PARCIAL** |
| RT-015 | Mudança de rastreamento sempre justificada; queda física de duas categorias exige justificativa | `regras-de-negocio.md`; `testes-e-criterios-de-aceite.md` | ADR-0002; NEG5 | US-AV2-031, 040 | service de transição de estado, auditoria e testes de fronteira | Documentado, sem execução funcional/teste confirmado. **PENDENTE** |
| RT-016 | Movimentação imutável, responsável autenticado, origem do histórico e instante do servidor | `modelo-de-dados.md`; `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG6 | E7: US-AV2-034, 035 | `MovimentacaoRepository/Service`, endpoint aninhado e transação | Modelo existe; rotas/service/testes pendentes. **CODE-PARCIAL** |
| RT-017 | Auditoria de mutações e segurança, sem segredos; evento correlacionado em transação | `regras-de-negocio.md`; `seguranca-e-rbac.md`; `testes-e-criterios-de-aceite.md` | ADR-0002 | E8: US-AV2-036, 040 | `EventoAuditoria` repository/service e chamadas transacionais | Modelo existe, mas nenhuma instrumentação completa das mutações foi implementada. **CODE-PARCIAL** |
| RT-018 | Relatórios operacionais, triagem e financeiro simplificável; defaults 0% e 15% | `visao-geral-e-escopo.md`; `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG10 | E8: US-AV2-037, 038 | services/rotas de relatórios e parâmetros | Modelo/seed de parâmetro preparados; relatórios e atualização autorizada ainda não implementados. **CODE-PARCIAL** |
| RT-019 | Contrato REST: envelopes, paginação, erros HTTP e OpenAPI | `arquitetura-e-padroes.md`; `contrato-api-rest.md` | ADR-0001; REST | E0/E8: US-AV2-003, 039 | schemas Fastify por rota, handlers de erro, Swagger | Fundação Swagger e handler existem; contrato completo de rotas de negócio ainda ausente. **CODE-PARCIAL** |
| RT-020 | Concorrência otimista por `versaoEsperada` e `versao` | `modelo-de-dados.md`; `regras-de-negocio.md`; `contrato-api-rest.md` | ADR-0002; NEG/REST | US-AV2-018, 022, 025, 030, 031, 038, 040 | atualização condicional nos repositories/services e resposta `409` | Campos de versão estão previstos no schema; mecanismo de atualização e testes pendentes. **CODE-PARCIAL** |
| RT-021 | Testes unitários, integração, RBAC e jornada ponta a ponta | `testes-e-criterios-de-aceite.md` | ADR-0001/0002 | US-AV2-040 | `src/tests/`, banco de teste, CI | Testes básicos estão escritos, mas `npm test` e integração PostgreSQL não têm resultado confirmado. **VALIDAÇÃO-PENDENTE** |
| RT-022 | README, OpenAPI, ADRs, migração/seed e homologação documentados | `visao-geral-e-escopo.md`; `testes-e-criterios-de-aceite.md`; `plano-de-implementacao.md` | ADR-0001/0002 | US-AV2-039, 041 | README, `docs/`, `.github/workflows/ci.yml`, lockfile | Documentação canônica preparada; `package-lock.json` deve ser versionado e workflow migrado para `npm ci` antes de declarar CI reproduzível. **CODE-PARCIAL** |

## 4. Rastreabilidade entre arquivos de documentação

Esta tabela responde quais arquivos são fonte, quais aprofundam o assunto e quais transformam a decisão em backlog/evidência.

| Documento | Fonte / depende de | Desdobra em / relacionado a | Uso principal |
|---|---|---|---|
| `docs/README.md` | AV2, decisões aprovadas | Todos os documentos listados abaixo | Índice, precedência e entrada única |
| `visao-geral-e-escopo.md` | PDF AV2; regras herdadas AV1; decisão ENT1-A | `02`, `07`, `09`, ADR-0002 | Delimitar o que entra e o que não entra |
| `arquitetura-e-padroes.md` | AV2 e ADR-0001 | `06`, `08`, `09`; US 001–009 e 039–041 | Responsabilidades técnicas e fluxo de dependência |
| `modelo-de-dados.md` | AV1 (entidades) e decisões ER | `04`, `05`, `06`, ADR-0002; US 005–009 e US de domínio | Schema, relações, índices e integridade |
| `regras-de-negocio.md` | AV1 e decisões NEG | `06`, `07`, `08`; US 016–038 | Comportamento esperado de cada caso de uso |
| `seguranca-e-rbac.md` | AV1 e decisões SEG/RBAC | `06`, `07`, `08`; US 010–015 e permissões das US protegidas | Autenticação e autorização por papel |
| `contrato-api-rest.md` | AV2, arquitetura, modelo e RBAC | OpenAPI/rotas futuras, `07`, `08`; US 003 e 039 | Contrato externo verificável |
| `epicos-e-user-stories.md` | Escopo, modelo, regras, RBAC e API | Código, testes e critérios de aceite | Backlog rastreável da entrega |
| `testes-e-criterios-de-aceite.md` | Todas as regras e o contrato REST | Testes unitários, integração, API, RBAC e E2E | Como provar cada requisito |
| `plano-de-implementacao.md` | Priorização e estado real do repositório | Marcos e status refletidos na matriz | Sequência de execução e bloqueios |
| `10-matriz-de-rastreabilidade.md` | Todos os documentos normativos e estado observado do código | Atualização por incremento/commit | Visão cruzada de requisito, US, implementação e evidência |
| `adr/ADR-0001-fundacao-tecnica.md` | Requisitos técnicos AV2 | `02`, `06`, `08`, `09` | Decisões estruturais de stack/arquitetura |
| `adr/ADR-0002-decisoes-dominio.md` | AV1, ER/NEG/SEG/REST, confirmação final | `03`, `04`, `05`, `06`, `07` | Fonte normativa para escolhas aprovadas |
| `referencias/planejamento-pre-decisao/*` | Documentos de planejamento antes da confirmação | Rastreabilidade histórica apenas | Preservação histórica; não substituem ADRs |

## 5. Rastreabilidade por épico

| Épico | Escopo | User Stories | Teste/evidência mínima |
|---|---|---|---|
| E0 — Fundação HTTP, configuração e arquitetura | Servidor, camadas, erro e ambiente | US-AV2-001–004 | Build, `/health`, OpenAPI e testes de erros/configuração |
| E1 — Persistência relacional | Schema, migração, client, seed e constraints | US-AV2-005–009 | Validar schema, migrar banco vazio, seed repetível e FKs/uniques |
| E2 — Autenticação e RBAC | Login, validação JWT, logout, permissões e conta | US-AV2-010–015 | Tokens ausentes/inválidos/expirados/revogados, quatro papéis |
| E3 — Organizações | CRUD, CNPJ, versionamento e desativação | US-AV2-016–019 | CNPJ inválido/duplicado, versão e bloqueio por lote pendente |
| E4 — Contratos | Criar, consultar, renovar, cancelar e histórico | US-AV2-020–023 | Vigência, renovação concorrente, cancelamento e histórico preservado |
| E5 — Lotes | Cadastro, janela de data, triagem e ciclo operacional | US-AV2-024–028 | Lote vazio, datas limite, transições e rollback da triagem |
| E6 — Equipamentos | Cadastro, código, estados e valores | US-AV2-029–033 | Código único, ano/peso/valor, justificativas e estado permitido |
| E7 — Movimentações | Registrar e consultar trilha imutável | US-AV2-034–035 | Ator do token, origem do histórico, append-only e RBAC |
| E8 — Auditoria, relatórios e entrega | Logs de auditoria, parâmetros, OpenAPI, testes e README | US-AV2-036–041 | Auditoria transacional, relatórios, defaults, CI e jornada completa |

## 6. Como manter a matriz atualizada

Após cada incremento:

1. Atualize a coluna de evidência com o comando/teste realmente executado.
2. Mude para `VALIDADO` somente se o teste correspondente passou.
3. Atualize o status das US em `epicos-e-user-stories.md` ou no rastreador do time quando a US estiver concluída.
4. Atualize o plano em `plano-de-implementacao.md`.
5. Se uma decisão mudar, atualize ADR e documentos dependentes no mesmo commit.
6. Não marque uma rota como concluída só porque aparece na proposta de API; confirme a implementação e o teste.

## 7. Critério para encerrar um requisito

Um requisito só é encerrado quando há vínculo explícito com pelo menos uma US, implementação na camada esperada, testes relevantes passando e evidência registrável (saída do teste, CI verde ou validação reproduzível). Para regras críticas, a evidência deve incluir caminho negativo e autorização aplicável.
