# ADR-0001 — Fundação técnica da AV2

- **Status:** aprovado.
- **Data de consolidação:** 20/10/2026 (a decisão inicial foi registrada em 18/10/2026).

## Contexto

A AV2 transforma o sistema de linha de comando da AV1 em um monólito HTTP com API REST e persistência relacional. A implementação é nova: arquivos cifrados, journal local, CLI, credenciais e histórico Git da AV1 não serão importados. A API é o foco desta etapa; uma SPA completa fica fora do escopo.

## Decisões

1. Usar Node.js 24.x, TypeScript e Fastify 5.
2. Usar Prisma ORM 7 com adapter PostgreSQL e PostgreSQL 17.
3. Organizar a aplicação em `Routes → Controllers → Services → Repositories`. Controllers não acessam Prisma diretamente e services não dependem de `request`/`reply` do Fastify.
4. Versionar a API em `/api/v1`, com recursos plurais em português, schemas de entrada, Swagger/OpenAPI, respostas JSON e erros padronizados.
5. Manter os quatro papéis: `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR`; a autorização é validada no servidor.
6. Usar bcrypt para novas credenciais, com senha de pelo menos 12 caracteres. Não reutilizar diretamente hashes antigos de SHA-256 como se fossem bcrypt.
7. Usar JWT com validade de 30 minutos, verificar usuário ativo e versão de autenticação e permitir revogação imediata do token por `jti` persistido.
8. Usar transações em mutações de negócio relacionadas e controle otimista de concorrência onde for necessário impedir atualizações perdidas.
9. Manter migrações versionadas, seed repetível, `.env.example`, CI e documentação/testes como parte da entrega.
10. Permitir configuração de host/porta e encerramento gracioso do servidor.
11. Preservar histórico de negócio: cancelar ou desativar não deve apagar registros necessários à rastreabilidade.
12. Usar a CI em Ubuntu como evidência automatizada do ambiente declarado; ela não substitui a homologação manual em outros sistemas operacionais.

## Consequências

- O desenvolvimento requer Node.js 24 e PostgreSQL 17 ou compatível.
- `DATABASE_URL` é configurada no ambiente; segredos reais ficam fora do Git.
- Rotas protegidas exigem autenticação e RBAC, exceto endpoints explicitamente públicos.
- A implementação deve ser validada por build, testes automatizados, migrações e cenários de integração em PostgreSQL.
- A verificação do `jti` no banco reduz o caráter totalmente stateless do JWT, mas permite que o logout invalide uma sessão imediatamente.

## Rastreabilidade

Este ADR define a fundação técnica. As regras de domínio aprovadas estão em [ADR-0002 — Decisões de domínio](ADR-0002-decisoes-dominio.md). Mudanças posteriores devem atualizar o ADR pertinente ou criar uma nova decisão com contexto e consequências.
