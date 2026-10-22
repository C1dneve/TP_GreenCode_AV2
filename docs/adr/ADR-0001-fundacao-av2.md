# ADR-0001 â€” FundaÃ§Ã£o tÃ©cnica da AV2

- **Status:** aceita para o inÃ­cio da AV2
- **Data:** 2026-10-18

## Contexto

A AV2 transforma a CLI da AV1 em um servidor HTTP monolÃ­tico com API REST e persistÃªncia relacional. O prazo Ã© de seis dias de implementaÃ§Ã£o, com o sÃ©timo dia reservado a testes e homologaÃ§Ã£o.

## Diretrizes do enunciado

- Node.js, TypeScript e Prisma ORM.
- MonÃ³lito HTTP; arquitetura inspirada em Controllerâ€“Serviceâ€“Repository.
- Fastify Ã© recomendado; Express Ã© uma alternativa permitida.
- PostgreSQL Ã© recomendado.
- JWT, transaÃ§Ãµes em operaÃ§Ãµes relacionadas, controle de concorrÃªncia, seed e API documentada.
- Porta configurÃ¡vel, encerramento gracioso e compatibilidade pretendida com Windows e Ubuntu.

## DecisÃµes iniciais

1. Usar Fastify.
2. Usar Controllerâ€“Serviceâ€“Repository com schemas e plugins separados.
3. Usar PostgreSQL local para desenvolvimento e um serviÃ§o PostgreSQL isolado nos testes do GitHub Actions.
4. Priorizar a API REST na AV2; a SPA completa nÃ£o Ã© requisito obrigatÃ³rio explÃ­cito do PDF.
5. Preservar os quatro papÃ©is da AV1 com autorizaÃ§Ã£o validada no servidor.
6. Usar hash de senha adaptativo para novas credenciais; nÃ£o copiar diretamente hashes SHA-256 antigos como se fossem bcrypt.
7. Usar JWT com validade definida e revogaÃ§Ã£o individual por identificador de token, incluindo testes de logout e de usuÃ¡rio desativado.
8. Usar transaÃ§Ãµes nos fluxos crÃ­ticos e controle otimista onde houver risco concreto de atualizaÃ§Ã£o perdida.
9. Preservar contratos e rastreabilidade; cancelamento/desativaÃ§Ã£o nÃ£o deve apagar histÃ³rico necessÃ¡rio.
10. Documentar endpoints com OpenAPI/Swagger e manter testes automatizados desde o inÃ­cio.

## Trade-offs e pontos a validar

- A verificaÃ§Ã£o de revogaÃ§Ã£o no banco reduz a caracterÃ­stica totalmente stateless do JWT, mas permite logout individual imediato.
- As decisÃµes de modelo de dados serÃ£o refinadas no Dia 1 antes da primeira migraÃ§Ã£o.
- O uso de GitHub Actions em Ubuntu fornece evidÃªncia automatizada de CI; nÃ£o serÃ¡ apresentado como teste manual completo de todas as distribuiÃ§Ãµes Linux.
- O histÃ³rico Git da AV1 nÃ£o serÃ¡ importado para este repositÃ³rio novo.

## Rastreabilidade

As decisÃµes devem permanecer associadas a issues, User Stories, commits e testes. MudanÃ§as futuras precisam atualizar este ADR ou criar um novo ADR com contexto, alternativas e consequÃªncia.
