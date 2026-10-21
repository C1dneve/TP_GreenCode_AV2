# GreenCode AV2

API REST monolítica para logística reversa. A AV2 é uma implementação nova, orientada pelo enunciado da atividade, pelas decisões aprovadas e pelas regras de negócio herdadas da AV1. O ZIP legado é usado somente como referência; a CLI e a persistência local da AV1 não fazem parte da nova arquitetura.

> **Estado em 21/10/2026:** `npm install`, `npm run prisma:validate` e `npm run build` foram executados localmente com sucesso. A aplicação ainda não está funcional ponta a ponta: a migração contra PostgreSQL, o seed e os testes de runtime precisam ser executados. Autenticação, RBAC e endpoints de negócio continuam no backlog de implementação.

## Stack

- Node.js 24 LTS e TypeScript
- Fastify 5
- Prisma ORM 7 com driver adapter PostgreSQL
- PostgreSQL 17 para desenvolvimento local
- Swagger/OpenAPI
- Testes nativos com `node:test`

## Pré-requisitos

- Node.js 24.x
- npm compatível com a versão do Node.js
- PostgreSQL 17 ou compatível, local ou por Docker Desktop com Docker Compose
- Git para versionamento

Docker é uma opção, não a única: quem não tiver Docker pode usar uma instalação local do PostgreSQL. Nesse caso, ajuste `DATABASE_URL` no `.env` para as credenciais e o banco locais.

## Iniciar localmente

1. Na raiz do projeto, copie `.env.example` para `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Edite `.env`: confirme `DATABASE_URL` e substitua `JWT_SECRET` por uma chave aleatória com pelo menos 32 bytes. Nunca use o valor de exemplo como segredo definitivo.
3. Instale dependências. Na primeira instalação, use `npm install`; depois que `package-lock.json` estiver versionado, prefira `npm ci`.
4. Valide o schema e compile:
   ```bash
   npm run prisma:validate
   npm run build
   ```
5. Inicie PostgreSQL. Com Docker:
   ```bash
   docker compose up -d postgres
   docker compose ps
   ```
   Se usar PostgreSQL instalado localmente, inicie o serviço do banco pelo mecanismo do seu sistema operacional.
6. Aplique a migração de desenvolvimento:
   ```bash
   npm run db:migrate
   ```
   Se o Prisma indicar divergência de schema/migração ou sugerir reset, pare e revise o diagnóstico; não aceite reset destrutivo sem verificar os dados e a migração.
7. Opcionalmente configure `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME` e `BOOTSTRAP_ADMIN_PASSWORD` no `.env`. A senha inicial precisa ter pelo menos 12 caracteres. Não há senha padrão.
8. Prepare os parâmetros globais e, quando as três variáveis de bootstrap forem configuradas, o primeiro Administrador:
   ```bash
   npm run db:seed
   ```
9. Inicie a API:
   ```bash
   npm run dev
   ```

A API fica disponível em `http://127.0.0.1:3000/health`; o Swagger fica em `/docs` e o documento OpenAPI em `/docs/json`.

## Scripts disponíveis

| Comando | Objetivo |
|---|---|
| `npm run dev` | Iniciar servidor com recarga durante o desenvolvimento |
| `npm run build` | Gerar Prisma Client e compilar TypeScript |
| `npm test` | Executar build e testes existentes |
| `npm run prisma:validate` | Validar o schema Prisma |
| `npm run prisma:generate` | Gerar Prisma Client |
| `npm run db:migrate` | Criar/aplicar migrações de desenvolvimento |
| `npm run db:deploy` | Aplicar migrações já versionadas no ambiente alvo |
| `npm run db:seed` | Executar seed explicitamente |
| `npm run db:studio` | Abrir Prisma Studio |

O seed não deve ser tratado como criação automática de credenciais: sem as três variáveis `BOOTSTRAP_ADMIN_*`, ele prepara os parâmetros globais, mas não cria um Administrador.

## Estrutura do projeto

```text
src/
├── app.ts                         # Fastify, Swagger, erros e /health
├── server.ts                      # Inicialização e encerramento gracioso
├── config/env.ts                  # Validação de ambiente
├── infrastructure/database/       # Fábrica do Prisma Client
├── controllers/                   # Camada HTTP (a desenvolver)
├── services/                      # Regras de negócio (a desenvolver)
├── repositories/                  # Persistência encapsulada (a desenvolver)
└── tests/                         # Testes da fundação

prisma/
├── schema.prisma                  # Modelo de persistência
├── migrations/                    # Migrações SQL versionadas
└── seed.ts                        # Parâmetros e bootstrap explícito

docs/
├── README.md                      # Índice documental
├── visao-geral-e-escopo.md
├── arquitetura-e-padroes.md
├── modelo-de-dados.md
├── regras-de-negocio.md
├── seguranca-e-rbac.md
├── contrato-api-rest.md
├── epicos-e-user-stories.md
├── testes-e-criterios-de-aceite.md
├── plano-de-implementacao.md
├── 10-matriz-de-rastreabilidade.md
├── adr/                           # Decisões arquiteturais/de domínio
└── referencias/                   # Planejamento histórico pré-decisão
```

A arquitetura normativa é **Controller → Service → Repository**. Controllers não acessam Prisma diretamente; services aplicam regras, autorização e transações; repositories encapsulam consultas e escritas. As pastas estão preparadas, mas os fluxos de negócio ainda precisam ser implementados.

## Documentação normativa

Toda a documentação do projeto fica em `docs/`. Comece por [`docs/README.md`](docs/README.md), o índice canônico.

| Documento | Conteúdo |
|---|---|
| [01 — Visão geral e escopo](docs/visao-geral-e-escopo.md) | Objetivo, limites e regras herdadas da AV1 |
| [02 — Arquitetura e padrões](docs/arquitetura-e-padroes.md) | Camadas, configuração e padrões técnicos |
| [03 — Modelo de dados](docs/modelo-de-dados.md) | Entidades, relacionamentos, tipos e enums |
| [04 — Regras de negócio](docs/regras-de-negocio.md) | Validações, transições, contratos, movimentações e cálculos |
| [05 — Segurança e RBAC](docs/seguranca-e-rbac.md) | JWT, senhas, papéis e matriz de permissões |
| [06 — Contrato REST](docs/contrato-api-rest.md) | Rotas planejadas, payloads, paginação e erros HTTP |
| [07 — Épicos e User Stories](docs/epicos-e-user-stories.md) | 9 épicos, 41 US e critérios de aceite |
| [08 — Testes e aceite](docs/testes-e-criterios-de-aceite.md) | Estratégia e requisitos de verificação |
| [09 — Plano de implementação](docs/plano-de-implementacao.md) | Marcos e estado atual |
| [10 — Matriz de rastreabilidade](docs/10-matriz-de-rastreabilidade.md) | Relação entre requisitos, decisões, documentos, US, código e testes |
| [ADR-0001 — Fundação técnica](docs/adr/ADR-0001-fundacao-tecnica.md) | Stack e arquitetura aprovadas |
| [ADR-0002 — Decisões de domínio](docs/adr/ADR-0002-decisoes-dominio.md) | Decisões de negócio aprovadas |

### Hierarquia e rastreabilidade

- O PDF da AV2 define o escopo obrigatório da atividade.
- A AV1 fornece regras de domínio herdadas, não a arquitetura nem a persistência.
- As decisões aprovadas são consolidadas nos ADRs e nos documentos numerados.
- Os documentos em `docs/referencias/planejamento-pre-decisao/` são históricos; se divergirem dos ADRs aprovados, prevalecem os ADRs.
- A matriz de rastreabilidade conecta requisitos e decisões às US e às evidências de código/teste, separando o que está documentado do que foi realmente implementado ou validado.

## Segurança

- Nunca versionar `.env`, senhas, hashes, tokens ou dados de execução.
- Não existe senha padrão administrativa.
- `BOOTSTRAP_ADMIN_*` só deve ser configurado intencionalmente para provisionar o primeiro Administrador.
- Senhas novas usam bcrypt; a API usa JWT com validade de 30 minutos e revogação persistida por `jti` conforme a especificação aprovada.
- Não registrar credenciais, JWT completo, `JWT_SECRET` ou `DATABASE_URL` em logs ou auditoria.

## Estado de validação

| Verificação | Estado conhecido | Observação |
|---|---|---|
| `npm install` | Executado com sucesso | Dependências instaladas no ambiente local do responsável |
| `npm run prisma:validate` | Passou | Prisma validou `prisma/schema.prisma` |
| `npm run build` | Passou | Prisma Client gerado e TypeScript compilado sem erros reportados |
| Migração PostgreSQL | Pendente | Requer PostgreSQL em execução |
| `npm test` | Pendente | Ainda não há resultado de execução confirmado nesta etapa |
| `npm run db:seed` | Pendente | Executar após conectar/aplicar a migração no banco |
| Autenticação, RBAC e endpoints de negócio | Não implementados ainda | Planejados nas US da documentação |

## Matriz de rastreabilidade

A matriz não declara uma User Story concluída apenas porque possui documentação. O estado de implementação e validação deve ser atualizado com evidências reais.

Consulte [`docs/10-matriz-de-rastreabilidade.md`](docs/10-matriz-de-rastreabilidade.md).
