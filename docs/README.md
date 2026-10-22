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

A fundação do Dia 1 foi documentada previamente como validada pelo responsável. No incremento G1 de 22/10/2026 foram adicionados os módulos de autenticação, usuários e auditoria e uma migração para `authVersion`; porém a validação deste incremento permanece pendente: o ambiente atual só oferece Node.js 22 (o projeto exige Node.js 24) e `npm ci` não concluiu por indisponibilidade de dependências, fazendo `npm run build` falhar com `prisma: not found`. Não declarar migração, testes ou CI como aprovados até repetir os comandos em Node 24 com dependências e PostgreSQL disponíveis. Consulte a matriz de rastreabilidade para o estado por requisito.
