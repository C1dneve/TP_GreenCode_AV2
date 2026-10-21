# Plano de implementação — GreenCode AV2

## Estado atual

- [x] Escopo `ENT1-A` aprovado.
- [x] Recomendações ER/NEG/SEG/REST aprovadas sem exceções.
- [x] Triagem simplificada da AV1 confirmada.
- [x] Documentação de arquitetura, dados, regras, RBAC, REST, US e matriz preparada.
- [x] `npm install`, `npm run prisma:validate` e `npm run build` executados com sucesso no ambiente do responsável.
- [ ] Validar migração contra PostgreSQL.
- [ ] Executar seed e `npm test`.
- [ ] Implementar autenticação JWT, revogação e RBAC.
- [ ] Implementar repositories, services e endpoints de negócio.

## Próxima sequência

1. Disponibilizar PostgreSQL local ou Docker Desktop.
2. Corrigir a divergência documentada de nulabilidade de `Equipamento.loteId`/posição antes de homologar a migração.
3. Aplicar a migração em banco vazio; se o Prisma sugerir reset ou divergência inesperada, parar e revisar antes de confirmar.
4. Executar seed e testes; registrar resultados reais na matriz.
5. Implementar autenticação, usuários e RBAC antes de abrir as rotas de negócio protegidas.
6. Implementar organizações/contratos; depois lotes/equipamentos/triagem; em seguida movimentações, auditoria, relatórios e parâmetros.
7. Fechar com testes de integração, jornada ponta a ponta, OpenAPI, CI e documentação.

## Regra de atualização

Depois de cada incremento, atualizar esta página e `10-matriz-de-rastreabilidade.md` com a evidência realmente executada. Não marcar história como concluída com base apenas na existência de documentação ou código sem teste correspondente.
