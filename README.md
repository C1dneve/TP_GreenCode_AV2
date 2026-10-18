# GreenCode AV2

MigraÃ§Ã£o do GreenCode da CLI da AV1 para um monÃ³lito HTTP em Node.js, TypeScript, Fastify e Prisma ORM, com PostgreSQL.

## Requisitos locais

- Node.js 24 LTS e npm.
- PostgreSQL 18 em execuÃ§Ã£o.
- Git.

## ConfiguraÃ§Ã£o

1. Copie `.env.example` para `.env` somente se ainda nÃ£o existir um `.env` local.
2. Preencha `DATABASE_URL` com a senha URL-encoded do usuÃ¡rio local `greencode_av2_user`. Nunca versione `.env`.
3. Instale dependÃªncias com `npm ci`.
4. Execute `npm run build` e `npm test`.
5. Execute `npm run dev`; verifique `http://127.0.0.1:3000/health` e a documentaÃ§Ã£o em `http://127.0.0.1:3000/docs`.

O schema Prisma, as migraÃ§Ãµes e os modelos de domÃ­nio serÃ£o definidos como parte do Dia 1. AtÃ© essa etapa, os scripts `prisma:*` e `db:*` estÃ£o declarados para padronizar a interface de comandos, mas ainda nÃ£o devem ser executados.

## Arquitetura prevista

- `src/routes`: registro das rotas HTTP.
- `src/controllers`: traduÃ§Ã£o HTTP e respostas.
- `src/services`: regras de negÃ³cio.
- `src/repositories`: persistÃªncia via Prisma.
- `src/plugins`: plugins Fastify, autenticaÃ§Ã£o e autorizaÃ§Ã£o.
- `src/schemas`: schemas de entrada e saÃ­da.
- `src/config`: configuraÃ§Ã£o e validaÃ§Ã£o de ambiente.
- `src/tests`: testes automatizados.
- `docs/adr`: decisÃµes arquiteturais registradas.

## SeguranÃ§a

NÃ£o inclua `.env`, senhas, chaves, banco de dados local, artefatos gerados ou a pasta `.git` em arquivos de entrega.
