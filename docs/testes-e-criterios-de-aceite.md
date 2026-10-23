# Testes e critérios de aceite

## 1. Estratégia de testes

### Unitários — regras e serviços

Cobrir validações de CNPJ, janela de datas, valores monetários e peso, ordenação de estado físico, transições de lote, justificativas, vigência contratual, depreciação, normalização de login e regras de desativação.

### Integração — Prisma e PostgreSQL

Testar migrações em banco dedicado, chaves estrangeiras, unicidade, relações, consultas paginadas e rollback de operações com múltiplas entidades, como triagem e movimentação com auditoria.

### HTTP/API

Testar schemas de requisição, códigos HTTP, envelope de sucesso/erro, `requestId`, paginação, filtros, OpenAPI e autenticação das rotas protegidas.

### Autorização

Para cada área protegida, testar chamadas permitidas e negadas pelos quatro papéis. A cobertura precisa incluir acesso direto às rotas e chamadas aos services, não apenas o comportamento da documentação ou da interface.

### Jornada ponta a ponta

Organização → contrato → lote → equipamento → triagem → encaminhamento → finalização → movimentação → histórico/relatório.

## 2. Casos de negócio que precisam de evidência

- CNPJ inválido, CNPJ duplicado e valores formatados diferentes que normalizam para o mesmo CNPJ.
- `dataEntrada` futura, anterior a 90 dias, exatamente no limite e dentro da janela válida.
- Desativação de organização com lote não finalizado e sem lote pendente.
- Contrato vencido, cancelado, renovação, tentativa de criar dois contratos vigentes e edição de contrato cancelado.
- Lote vazio, triagem repetida, encaminhamento antes da triagem e finalização antes do encaminhamento.
- Equipamento desativado, código interno duplicado, ano inválido e peso/valor negativos.
- Tentativa de ir para `EM_DESMONTE` antes de `AGUARDANDO_DESMONTE` e mudança de rastreamento sem justificativa.
- Queda de duas ou mais categorias de estado físico sem justificativa.
- Movimentação com ator enviado pelo cliente, evento para equipamento inativo, origem inicial e origem igual ao último destino.
- Logout e tentativa de reutilizar o mesmo JWT; conta desativada com token ainda não expirado; token expirado.
- Atualização com `versaoEsperada` atual e obsoleta; conflito simultâneo de contratos.
- Mutação e auditoria confirmadas juntas; falha de auditoria deve provocar rollback quando o evento é obrigatório.
- Parâmetros fora de 0–100% e tentativa de alteração por papel que não seja Administrador.

## 3. Critérios da API

- Item individual retorna objeto direto; coleção retorna `{ data, meta }`.
- Lista vazia retorna `200` com `data: []` e metadados coerentes.
- UUID malformado retorna `400`; UUID válido sem recurso retorna `404`.
- `400`, `401`, `403`, `404`, `409` e `500` têm cobertura; erros inesperados não expõem detalhes internos.
- Paginação limita `pageSize` a 100 e usa allow-list para ordenação.
- Escritas de recursos mutáveis respeitam `versaoEsperada` conforme a regra do recurso.
- Transições críticas de estado usam ações `POST` específicas, não `PATCH` livre de status.

## 4. Critérios de segurança

- `.env`, senhas, hashes, tokens e segredos não aparecem no Git, nas respostas ou nos logs.
- JWT expirado, invalidado, revogado ou associado a usuário desativado é recusado.
- Login não revela se a conta existe.
- Não permitir autodesativação nem desativação do último Administrador ativo.
- Movimentações e eventos de auditoria não têm rotas convencionais de alteração/exclusão.

## 5. CI e ambientes

A CI deve instalar com `npm ci`, compilar, executar os testes e validar migrações/integração em PostgreSQL. A homologação Windows e Ubuntu deve ser documentada com saídas reais, não presumida por o projeto usar ferramentas multiplataforma.

## 6. Definição de pronto

Uma User Story só deve ser considerada pronta quando as regras estiverem na camada adequada, a autorização corresponder à matriz aprovada, os schemas e erros estiverem documentados, as transações e persistência forem verificadas, os testes relevantes passarem, o OpenAPI/README estiver atualizado e nenhum segredo tiver sido incluído.

## 7. Evidências locais registradas em 23/10/2026

- `npm run prisma:validate`, `npm run prisma:generate` e `npm run build` passaram.
- `npm test`: 25 testes aprovados, 0 falhas.
- `npm run test:integration`: 10 testes aprovados, 0 falhas.
- A integração executou uma jornada HTTP de organização, contrato, lote, equipamento, triagem e movimentação, além de verificações específicas de unicidade e relacionamentos no PostgreSQL de teste.
- O seed foi executado duas vezes; o Administrador existente foi preservado e os parâmetros padrão de imposto `0%` e depreciação anual `15%` foram conferidos.
- Teste manual confirmou login, `/auth/me`, logout e recusa do token revogado com HTTP `401`.
- `git diff --check` terminou sem mensagens.

Essas evidências são limitadas ao conjunto executado. A matriz completa de RBAC, concorrência, todas as regras temporais/de estado, rollback de auditoria e CI remota continuam pendentes. A contagem dos testes não é prova de que todas as User Stories P0/P1 foram homologadas.
