# ADR-0001 — Fundação técnica da AV2

- **Status:** aprovado.
- **Data:** 20/10/2026.

## Contexto

A AV2 transforma o sistema CLI da AV1 em um monólito HTTP com API REST e persistência relacional. A implementação deverá ser nova; arquivos cifrados, journal local, CLI e histórico Git da AV1 não serão importados.

## Decisões

1. Node.js 24 LTS + TypeScript.
2. Fastify para servidor HTTP, schemas de entrada e hooks.
3. Arquitetura Controller → Service → Repository. Controllers não acessam Prisma diretamente; Services não dependem de `request`/`reply`.
4. Prisma ORM 7 + PostgreSQL; datasource URL configurada em `prisma.config.ts` e driver adapter PostgreSQL.
5. API REST versionada em `/api/v1`, recursos plurais em português, Swagger/OpenAPI, respostas JSON e erros padronizados.
6. Sem SPA completa nesta etapa; a API será validada via Swagger, testes e cliente HTTP.
7. JWT com validade de 30 minutos, verificação de usuário ativo e revogação individual imediata por `jti` persistido.
8. Hash adaptativo bcrypt para novas credenciais. Não migrar hashes de senhas nem dados locais da AV1.
9. Transações em alterações de negócio relacionadas e controle otimista de concorrência nos recursos mutáveis.
10. Migrações versionadas, seed repetível, `.env.example`, CI e documentação/testes como parte da entrega.
11. Porta/host configuráveis e encerramento gracioso em sinais de parada.

## Consequências

- Desenvolvimento local requer Node.js 24 e PostgreSQL 17 ou compatível.
- A URL de conexão é lida de `DATABASE_URL`; segredos reais permanecem fora do Git.
- As operações HTTP só serão abertas após aplicação de autenticação e RBAC, exceto rotas explicitamente públicas.
- O primeiro marco de implementação é a persistência reproduzível; autenticação e fluxos de negócio serão entregues em incrementos posteriores.
