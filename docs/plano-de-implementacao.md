# Plano de implementação — GreenCode AV2

## Estado em 23/10/2026

A API foi organizada em módulos para autenticação, usuários, organizações, contratos, lotes, equipamentos, movimentações, auditoria, relatórios e parâmetros. O build, os testes automatizados executados e o teste manual de revogação passaram no ambiente local. Agora o foco é fechar a documentação, revisar as alterações e verificar a CI remota antes de ampliar a cobertura dos casos de negócio.

## Feito e verificado

- [x] Revisão do escopo, das regras de domínio e das decisões arquiteturais.
- [x] Separação dos módulos em rotas, controllers, services e repositories.
- [x] Testes de arquitetura para impedir acesso direto ao Prisma nas camadas HTTP e dependência HTTP nos services.
- [x] Validação do schema e geração do Prisma Client.
- [x] Build TypeScript concluído.
- [x] `npm test`: 25 testes aprovados, sem falhas.
- [x] `npm run test:integration`: 10 testes aprovados, sem falhas.
- [x] Migrações aplicadas/atualizadas no banco de teste e `prisma migrate status` sem migrações pendentes.
- [x] Seed executado duas vezes; a conta Administrador existente foi preservada e os defaults globais foram verificados.
- [x] Jornada HTTP de organização → contrato → lote → equipamento → triagem → movimentação executada pela integração.
- [x] Login, `/auth/me`, logout e recusa do token revogado confirmados manualmente.
- [x] `git diff --check` terminou sem mensagens.
- [x] Identificadas e removidas no pacote de revisão cópias documentais redundantes.

## Pendências antes da entrega

- [ ] Revisar `git diff` e `git status --short` para confirmar o escopo do commit e excluir segredos/temporários.
- [ ] Commitar e enviar a branch de trabalho para o GitHub.
- [ ] Conferir a CI remota após o push.
- [ ] Completar a matriz RBAC por endpoint e papel.
- [ ] Cobrir JWT expirado, conta desativada, troca de senha, último Administrador e invalidação global de sessões.
- [ ] Testar concorrência e `versaoEsperada` nos recursos mutáveis, especialmente contratos simultaneamente vigentes.
- [ ] Testar limites de data, lote vazio, transições inválidas e justificativas obrigatórias.
- [ ] Testar rollback das mutações quando falha o registro de auditoria ou a triagem.
- [ ] Conferir cálculos e relatórios com dados persistidos; aumentar a cobertura de filtros e paginação.
- [ ] Atualizar o aviso de depreciação do Fastify relacionado a `disableRequestLogging`.

## Como repetir a validação local

Use Node.js 24.x, dependências do lockfile e PostgreSQL de teste dedicado. Confirme a URL do banco antes de aplicar migrações ou executar testes:

```powershell
npm ci
npm ls --depth=0
npm run prisma:validate
npm run prisma:generate
npm run build
npm run db:deploy
npm run db:seed
npm run db:seed
npm test
npm run test:integration
git diff --check
```

Os resultados já registrados estão em `relatorio-final-av2.md`; o roteiro `homologacao-av2.md` explica o que observar em cada etapa.

## Regra de acompanhamento

A presença de código ou de um teste no repositório não equivale a aprovação. Marque um requisito como validado somente depois que o cenário correspondente for executado e passar. A evidência local atual não substitui a CI remota nem os testes complementares listados neste plano.
