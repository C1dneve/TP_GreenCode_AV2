# GreenCode AV2

API REST monolítica para apoiar a logística reversa de equipamentos. A AV2 preserva as regras de domínio importantes da AV1, mas entrega o backend como uma API HTTP; uma SPA completa não faz parte deste escopo.

**Estado atual:** o build e os testes locais executados passaram. Isso é um bom marco, mas ainda não representa a homologação completa de todas as regras ou a aprovação da CI do GitHub. O recorte validado e as pendências estão documentados em [`docs/relatorio-final-av2.md`](docs/relatorio-final-av2.md).

## Tecnologias

- Node.js 24.x e TypeScript
- Fastify 5
- Prisma ORM 7 com adapter PostgreSQL
- PostgreSQL 17
- Swagger/OpenAPI
- Testes nativos com `node:test`

## Pré-requisitos

Instale Node.js 24.x, npm compatível e Docker com Docker Compose (ou disponibilize PostgreSQL 17). O banco usado nos testes de integração deve ser dedicado e ter `test` no nome. Não aponte testes para o banco de desenvolvimento.

## Preparar o ambiente local

1. Copie `.env.example` para `.env` e ajuste os valores para o seu ambiente. Use um `JWT_SECRET` local com pelo menos 32 caracteres aleatórios. Não compartilhe nem versione `.env`.
2. Instale as dependências e confira a versão do Node:

   ```bash
   node -v
   npm ci
   npm ls --depth=0
   ```

3. Inicie o PostgreSQL de desenvolvimento com Docker Compose, se for usar essa opção:

   ```bash
   docker compose up -d postgres
   docker compose ps
   ```

4. Valide o Prisma, gere o cliente e compile a aplicação:

   ```bash
   npm run prisma:validate
   npm run prisma:generate
   npm run build
   ```

5. Confira se `DATABASE_URL` aponta para o banco correto antes de aplicar migrações. Para desenvolvimento, use `npm run db:deploy` e depois `npm run db:seed`. Se o Prisma apontar divergência, investigue antes de qualquer ação destrutiva; não faça reset automático.
6. Para criar o primeiro Administrador, configure explicitamente `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME` e `BOOTSTRAP_ADMIN_PASSWORD`. O seed não define uma senha padrão e preserva credenciais já existentes.
7. Inicie a API:

   ```bash
   npm run dev
   ```

A API disponibiliza `GET /health`. A interface Swagger fica em `/docs` e o documento OpenAPI em `/docs/json`.

## Comandos principais

| Comando | Para que serve |
|---|---|
| `npm run dev` | Inicia o servidor em modo de desenvolvimento |
| `npm run build` | Gera o Prisma Client e compila TypeScript |
| `npm test` | Executa build e testes unitários/HTTP |
| `npm run prisma:validate` | Valida o schema Prisma |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run db:deploy` | Aplica migrações versionadas |
| `npm run db:seed` | Prepara os dados iniciais; pode ser executado novamente |
| `npm run test:integration` | Executa testes que dependem de PostgreSQL dedicado |

Antes de `npm run test:integration`, confira se o `.env` aponta para um banco de teste isolado. A suíte verifica o nome do banco para reduzir o risco de executar testes no banco de desenvolvimento.

## Como o código está organizado

As responsabilidades seguem o fluxo `Routes → Controllers → Services → Repositories → Prisma → PostgreSQL`.

```text
src/
├── app.ts                         # Fastify, OpenAPI, health e tratamento de erros
├── server.ts                      # Inicialização e encerramento do servidor
├── config/                        # Ambiente e bootstrap administrativo
├── infrastructure/database/       # Prisma Client centralizado
├── modules/
│   ├── auth/                      # Login, JWT, logout e sessões
│   ├── usuarios/                  # Gestão de usuários e permissões
│   ├── organizacoes/              # Organizações e CNPJ
│   ├── contratos/                 # Vigência, renovação e histórico
│   ├── lotes/                     # Ciclo operacional e triagem simplificada
│   ├── equipamentos/              # Cadastro, estados e ativação
│   ├── movimentacoes/             # Registro e histórico de movimentação
│   ├── auditoria/                 # Eventos e consulta de auditoria
│   ├── relatorios/                # Indicadores operacionais/financeiros básicos
│   └── parametros/                # Parâmetros globais
├── shared/                        # Erros de domínio, paginação e autorização
└── tests/                         # Testes unitários, HTTP, arquitetura e integração
```

As decisões de domínio, permissões e formatos de resposta estão documentados em `docs/`. Comece por [`docs/README.md`](docs/README.md). Para entender o que já foi testado e o que ainda falta, consulte [`docs/homologacao-av2.md`](docs/homologacao-av2.md) e [`docs/relatorio-final-av2.md`](docs/relatorio-final-av2.md).

## Segurança básica

A API define os papéis `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR`. As senhas novas são armazenadas com bcrypt; os JWT têm validade de 30 minutos e consideram usuário ativo, versão de autenticação e revogação do token. Rotas protegidas não devem expor hashes, tokens ou segredos.

Não use credenciais locais de teste em outros ambientes. Não publique valores de `.env`, tokens de acesso ou senhas em issues, commits ou mensagens.

## Situação dos testes

Na execução local registrada em 23/10/2026:

- Prisma validado e cliente gerado; build concluído.
- `npm test`: **25 testes aprovados, 0 falhas**.
- `npm run test:integration`: **10 testes aprovados, 0 falhas**.
- Migrações aplicadas/atualizadas no banco de teste e seed executado duas vezes.
- Fluxo manual de login, `/auth/me`, logout e recusa do token revogado passou.
- `git diff --check` terminou sem apontar problemas.

A matriz completa de RBAC, concorrência, rollback em todos os fluxos críticos, cobertura das regras de fronteira e CI remota ainda precisam de verificação. Também permanece um aviso de depreciação do Fastify sobre `disableRequestLogging`; ele não impediu os testes, mas deve ser atualizado.
