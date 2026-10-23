# Documentação do GreenCode AV2

Este diretório reúne o que orienta a implementação, descreve o comportamento esperado da API e registra o resultado dos testes. O código estar presente não significa, por si só, que toda a regra foi homologada: use a matriz e o relatório para distinguir implementação, evidência e pendências.

## Por onde começar

| Documento | Quando consultar |
|---|---|
| [Visão geral e escopo](visao-geral-e-escopo.md) | Para entender o que entra e o que fica fora da AV2 |
| [Arquitetura e padrões](arquitetura-e-padroes.md) | Para conhecer as camadas e as convenções do código |
| [Modelo de dados](modelo-de-dados.md) | Para entender entidades, relações e integridade |
| [Regras de negócio](regras-de-negocio.md) | Para conferir validações e transições de estado |
| [Segurança e RBAC](seguranca-e-rbac.md) | Para consultar JWT, senhas e permissões por papel |
| [Contrato da API REST](contrato-api-rest.md) | Para ver rotas, payloads, paginação, erros e status HTTP |
| [Épicos e User Stories](epicos-e-user-stories.md) | Para navegar pelo escopo funcional e pelos critérios de aceite |
| [Testes e critérios de aceite](testes-e-criterios-de-aceite.md) | Para ver a estratégia e os casos que ainda precisam de cobertura |
| [Plano de implementação](plano-de-implementacao.md) | Para acompanhar o que foi feito e os próximos passos |
| [Matriz de rastreabilidade](10-matriz-de-rastreabilidade.md) | Para ligar requisitos, código e evidências de teste |
| [Roteiro de homologação](homologacao-av2.md) | Para repetir as verificações localmente |
| [Relatório de implementação](relatorio-final-av2.md) | Para consultar os resultados obtidos e as limitações conhecidas |

## Decisões arquiteturais

- [ADR-0001 — Fundação técnica da AV2](adr/ADR-0001-fundacao-tecnica.md)
- [ADR-0002 — Decisões de domínio](adr/ADR-0002-decisoes-dominio.md)

Cada decisão tem um número único. O conteúdo útil do rascunho inicial de ADR-0001 foi incorporado ao documento consolidado de fundação técnica.

## Material histórico

`referencias/planejamento-pre-decisao/` preserva as três fontes de planejamento anteriores à confirmação final de 20/10/2026. Elas são mantidas para rastreabilidade, não como especificação atual. Em caso de divergência, valem os documentos normativos acima e os ADRs aprovados.

As cópias idênticas que existiam em `docs/spec/` foram removidas para evitar manter duas versões do mesmo material.

## Estado atual

O build local, os 25 testes unitários/HTTP e os 10 testes de integração passaram em 23/10/2026. O logout foi validado manualmente com recusa do token revogado, e as migrações e o seed foram conferidos no banco dedicado de teste. Isso ainda não comprova a cobertura de todas as histórias nem o resultado da CI remota. Consulte o [relatório](relatorio-final-av2.md) para ver o que foi validado e o que falta.
