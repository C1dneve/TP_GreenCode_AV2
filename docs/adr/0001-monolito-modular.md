# ADR-0001 — Monólito modular e separação de responsabilidades

**Status:** Aceita

## Contexto

A AV2 precisa expor uma API de logística reversa com áreas de negócio relacionadas — autenticação, usuários, organizações, contratos, lotes, equipamentos, movimentações, auditoria, parâmetros e relatórios. Essas áreas precisam evoluir em conjunto e compartilhar transações e regras de integridade. A entrega atual é um backend e não inclui uma SPA nem exige implantação de serviços independentes.

## Decisão

Manter a aplicação como um único serviço implantável, organizado em módulos de negócio. Cada módulo concentra rotas/controllers, serviços e repositórios conforme a responsabilidade da operação. O acesso persistente passa pelo Prisma e pelo PostgreSQL.

## Alternativas consideradas

- **Monólito sem módulos definidos:** mais simples inicialmente, mas mistura responsabilidades e dificulta localizar regras de negócio.
- **Microsserviços independentes:** permitem implantação e escala separadas, mas acrescentam comunicação de rede, operação distribuída e coordenação de dados sem necessidade demonstrada no escopo atual.

## Justificativa

A estrutura observada em `src/modules/` permite manter casos de uso próximos de suas entidades, preservar limites entre camadas e executar fluxos que envolvem várias entidades em transações locais ao banco. A entrega e a execução permanecem simples por meio de uma imagem da API e Docker Compose.

## Consequências e trade-offs

**Positivas:** implantação e execução simples; menos componentes operacionais; transações entre entidades no mesmo banco; separação do código por domínio.

**Negativas:** os módulos compartilham processo e ciclo de implantação; isolamento de escala é menor que em serviços independentes; limites entre módulos dependem de disciplina arquitetural e testes.

## Relação com a AV2

A decisão sustenta a separação de responsabilidades e a organização da API prevista em US-AV2-002, além de manter uma implantação reproduzível para avaliação. Não demonstra, isoladamente, que todas as User Stories foram homologadas.
