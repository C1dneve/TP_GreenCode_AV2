# ADR-0002 — Fastify, TypeScript e Controller-Service-Repository

**Status:** Aceita

## Contexto

A API precisa validar contratos HTTP, publicar OpenAPI, autenticar requisições e aplicar regras de negócio sem acoplar essas regras ao transporte HTTP ou aos detalhes do banco.

## Decisão

Usar Node.js 24 e TypeScript, com Fastify 5 como servidor HTTP. Organizar as operações no padrão Controller-Service-Repository: rotas descrevem contratos e precondições HTTP, controllers adaptam a requisição ao caso de uso, services executam validações e regras de negócio, e repositories encapsulam consultas, persistência e transações. Swagger/OpenAPI é servido pela aplicação.

## Alternativas consideradas

- **JavaScript sem tipagem estática:** reduz a configuração inicial, mas perde verificações estáticas úteis nas interfaces entre camadas.
- **Acesso ao Prisma diretamente nas rotas/controllers:** encurta alguns caminhos, mas mistura protocolo, regras e persistência.
- **Outro framework HTTP:** seria viável, porém exigiria trocar a integração e a configuração já presentes no projeto; não há requisito atual que justifique essa migração.

## Justificativa

A implementação existente utiliza módulos Fastify e classes de controllers, services e repositories. TypeScript ajuda a expressar os contratos internos, enquanto o Fastify concentra o processamento HTTP, os esquemas de entrada/saída e os plugins JWT e Swagger.

## Consequências e trade-offs

**Positivas:** fronteiras explícitas entre HTTP, regras e persistência; tipagem estática; documentação OpenAPI integrada; testes unitários/HTTP podem substituir dependências de banco quando o objetivo é testar uma camada isolada.

**Negativas:** há mais arquivos e interfaces do que em handlers monolíticos; parte dos tipos de saída ainda depende de transformações e tipos amplos, exigindo testes e revisão; a geração do Prisma Client faz parte da compilação.

## Relação com a AV2

A decisão apoia o contrato REST documentado, a validação uniforme e US-AV2-001, US-AV2-002 e US-AV2-039. O padrão arquitetural não substitui testes de integração de regras que dependem do PostgreSQL.
