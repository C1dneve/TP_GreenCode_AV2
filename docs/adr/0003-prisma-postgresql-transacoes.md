# ADR-0003 — Prisma, PostgreSQL, migrações e transações

**Status:** Aceita

## Contexto

O domínio mantém relações entre organizações, contratos, lotes, equipamentos, movimentações, usuários, tokens revogados e eventos de auditoria. Precisa preservar unicidade e chaves estrangeiras, controlar versões concorrentes e aplicar operações compostas sem deixar alterações parciais.

## Decisão

Usar Prisma 7 como acesso tipado aos dados e PostgreSQL 17 como banco relacional. Versionar alterações de estrutura em `prisma/migrations/`, validar e gerar o client a partir de `prisma/schema.prisma` e executar transações nos casos de uso que alteram múltiplos registros ou exigem auditoria atômica. Operações versionadas condicionam a atualização à versão esperada e incrementam `versao`.

## Alternativas consideradas

- **Persistência em arquivos locais:** inadequada para integridade relacional e atualizações concorrentes.
- **SQL manual em toda a aplicação:** permite controle detalhado, mas amplia a manutenção de mapeamentos e tipos; SQL específico continua disponível quando necessário, por exemplo para verificar restrições no banco.
- **Banco não relacional:** não elimina a necessidade de relações e integridade transacional presentes neste domínio.

## Justificativa

O schema define relações, valores únicos e índices; as migrações acrescentam também restrições específicas do PostgreSQL. O Prisma fornece acesso tipado, e transações interativas permitem agrupar atualização de entidades e registro de auditoria. O isolamento serializável é usado em fluxos selecionados com tratamento de conflito.

## Consequências e trade-offs

**Positivas:** integridade centralizada no banco; migrações revisáveis; acesso tipado; atomicidade de atualizações e seus eventos transacionais; proteção contra sobrescrita por versões antigas.

**Negativas:** execução exige PostgreSQL disponível e migrações aplicadas; migrações devem acompanhar schema e aplicação; transações serializáveis podem conflitar e exigir tratamento/repetição; alguns índices ou checks específicos dependem das migrações SQL.

## Relação com a AV2

A decisão sustenta US-AV2-005 a US-AV2-009, o fluxo operacional e os critérios de teste de integração de US-AV2-040. Os testes que verificam persistência, rollback e concorrência devem usar banco isolado e confirmar o estado final no PostgreSQL.
