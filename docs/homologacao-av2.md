# Roteiro de homologação — GreenCode AV2

Este roteiro serve para repetir as verificações antes de entregar uma versão. Os resultados confirmados na execução local de 23/10/2026 estão marcados abaixo; os itens restantes devem ser testados antes de considerar a AV2 totalmente homologada.

## 1. Ambiente e segurança

Confirme as versões e o estado do repositório:

```powershell
node -v
npm -v
git branch --show-current
git status --short
```

A execução registrada usou Node `v24.19.0`, npm `11.17.0` e PostgreSQL `17.11`. `npm ci` terminou, `npm ls --depth=0` não apontou dependências faltando e a auditoria do npm informou zero vulnerabilidades naquela instalação. Esses valores descrevem aquela execução; confira de novo no ambiente em que for entregar.

Mantenha `.env` fora do Git. Antes de qualquer operação de escrita, confirme que `DATABASE_URL` aponta para o banco desejado. Para a integração, use uma base isolada com `test` no nome. Não use o banco de desenvolvimento para testes destrutivos e não execute `git clean`, `git reset --hard` nem reset do banco para tentar resolver uma falha sem entender sua causa.

## 2. Prisma, build e migrações

Com a URL do banco definida corretamente, execute:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run build
npx prisma migrate status
```

**Resultado registrado:** schema validado, Prisma Client gerado, build concluído e migrações atualizadas. O banco de teste informou três migrações e nenhuma pendente.

## 3. Seed e integridade do banco

No banco dedicado de teste:

```powershell
npm run db:deploy
npm run db:seed
npm run db:seed
```

**Resultado registrado:** deploy de migrações concluído e seed executado duas vezes. A segunda execução preservou as credenciais existentes. A consulta de usuários retornou uma única conta `av2admin`; a integração também confirmou os parâmetros globais padrão de imposto `0%` e depreciação anual `15%`.

Não interprete a idempotência do seed como redefinição de senha: o seed preserva a credencial do Administrador já criado. Não exponha a senha nem o conteúdo de `.env` em logs ou mensagens.

## 4. Testes automatizados

```powershell
npm test
if ($LASTEXITCODE -ne 0) { throw "Os testes unitários/HTTP falharam." }

npm run test:integration
if ($LASTEXITCODE -ne 0) { throw "Os testes de integração falharam." }

git diff --check
if ($LASTEXITCODE -ne 0) { throw "O diff contém problemas de whitespace." }
```

**Resultado registrado em 23/10/2026:** `npm test` aprovou 25 testes e `npm run test:integration` aprovou 10 testes, sem falhas. A integração executou uma jornada HTTP de organização, contrato, lote, equipamento, triagem e movimentação, além de verificações de relações, referências e unicidade no PostgreSQL. `git diff --check` terminou sem mensagens.

### Verificações manuais de autenticação

O fluxo manual também passou: login e `GET /api/v1/auth/me` funcionaram antes do logout; depois do logout, a reutilização do token foi recusada com HTTP `401`. O teste sem token em `/auth/me` também retornou `401`. O script usado era compatível com Windows PowerShell 5.1 e foi removido após o teste, caso não seja mais necessário.

## 5. Cobertura que ainda falta

Os resultados acima são positivos, mas não encerram todos os critérios de aceite. Antes da homologação final, complemente os testes para:

- matriz de permissões completa por endpoint e por cada um dos quatro papéis;
- JWT expirado, usuário desativado, troca de senha e invalidação de todas as sessões esperadas;
- proteção contra desativar o último Administrador e concorrência em alterações administrativas;
- datas-limite de lote, lote vazio, transições inválidas e justificativas obrigatórias;
- conflitos de `versaoEsperada`, contratos concorrentes e rollback de operações com auditoria;
- resultados de relatórios comparados a dados persistidos e validação de filtros/paginação;
- ausência de tokens, senhas e segredos em respostas e logs.

Use [`10-matriz-de-rastreabilidade.md`](10-matriz-de-rastreabilidade.md) para não marcar como validada uma regra que ainda não tem evidência correspondente.

## 6. CI do GitHub e encerramento

O workflow está em `.github/workflows/ci.yml`. Depois do commit e push, confira a execução de CI para a branch correspondente. O resultado remoto ainda não foi verificado nesta revisão. Não considere a entrega concluída apenas porque os testes locais passaram.

Antes de encerrar:

```powershell
git diff --check
git status --short
```

Revise as alterações e os arquivos novos antes de fazer commit. Preserve alterações que não fazem parte desta revisão e não inclua `.env`, tokens, senhas nem arquivos temporários.
