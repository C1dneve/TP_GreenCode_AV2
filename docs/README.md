# Documentação do GreenCode AV2

Esta pasta reúne a documentação normativa e a rastreabilidade da AV2. O código ainda está em implementação; não considere uma regra concluída apenas porque ela está documentada.

## Documentos normativos

| Documento | Conteúdo |
|---|---|
| [Visão geral e escopo](visao-geral-e-escopo.md) | Objetivo, fronteiras da AV2 e herança da AV1 |
| [Arquitetura e padrões](arquitetura-e-padroes.md) | Stack, camadas e convenções |
| [Modelo de dados](modelo-de-dados.md) | Entidades, relações, enums e integridade |
| [Regras de negócio](regras-de-negocio.md) | Validações e transições de estado |
| [Segurança e RBAC](seguranca-e-rbac.md) | JWT, senhas e permissões por papel |
| [Contrato da API REST](contrato-api-rest.md) | Rotas, schemas, paginação, erros e status HTTP |
| [Épicos e User Stories](epicos-e-user-stories.md) | Backlog e critérios de aceite por história |
| [Testes e critérios de aceite](testes-e-criterios-de-aceite.md) | Estratégia de testes e definição de pronto |
| [Plano de implementação](plano-de-implementacao.md) | Marcos, bloqueios e próxima sequência de trabalho |
| [Matriz de rastreabilidade](10-matriz-de-rastreabilidade.md) | Requisitos → decisões → US → implementação → evidência |

## Decisões arquiteturais (ADRs)

- [ADR-0001 — Fundação técnica](adr/ADR-0001-fundacao-tecnica.md)
- [ADR-0002 — Decisões de domínio](adr/ADR-0002-decisoes-dominio.md)

Há também `ADR-0001-fundacao-av2.md` no repositório atual. Como dois arquivos não devem compartilhar o mesmo número de ADR, compare-o com `ADR-0001-fundacao-tecnica.md` e consolide qualquer conteúdo exclusivo antes de arquivar/remover um deles.

## Referências históricas

`referencias/planejamento-pre-decisao/` preserva os documentos de planejamento anteriores à confirmação final. Use os ADRs e documentos normativos acima como fonte de verdade quando houver divergência.

A pasta `spec/` atualmente contém cópias anteriores dos mesmos documentos de planejamento. Antes de removê-la, compare os arquivos com as versões históricas em `referencias/`; se a diferença for apenas o aviso histórico, mantenha apenas a pasta `referencias/` para evitar ambiguidade.

## Estado de validação conhecido

O responsável confirmou sucesso para `npm install`, `npm run prisma:validate` e `npm run build`. Migração PostgreSQL, seed, `npm test` e os fluxos de autenticação/negócio precisam de validação/implementação próprias. A matriz de rastreabilidade registra essa diferença.
