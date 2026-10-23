# 02 — Arquitetura e padrões

## 1. Arquitetura

O GreenCode AV2 é um monólito modular, com dependências unidirecionais:

```text
Cliente HTTP / Swagger
        ↓
Fastify: plugins, rotas, schemas e hooks
        ↓
Controllers: protocolo HTTP e DTOs
        ↓
Services: casos de uso e regras de negócio
        ↓
Repositories: acesso a dados
        ↓
Prisma Client + driver adapter
        ↓
PostgreSQL
```

## 2. Responsabilidades por camada

### HTTP / rotas / controllers

- declarar método, caminho, schema de entrada e respostas;
- extrair parâmetros autenticados e parâmetros HTTP;
- converter requisições em chamadas de serviço;
- converter resultados e erros conhecidos em respostas HTTP;
- não conter regra de negócio e não acessar Prisma diretamente.

### Services

- aplicar validações de domínio e autorização por papel, revalidando o RBAC mesmo quando o service é invocado sem passar pelo guard HTTP; o papel deve vir do contexto autenticado (papel atual persistido), nunca do payload do cliente;
- controlar pré-condições e transições de estado;
- orquestrar transações, auditoria e controle otimista;
- não depender de objetos `request` ou `reply` do Fastify.

### Repositories

- encapsular leituras e escritas Prisma;
- disponibilizar operações tipadas para os services;
- centralizar consultas, paginação, filtros e atualização condicional por versão;
- mapear erros conhecidos de integridade quando apropriado, sem expor mensagens internas do banco.

### Infraestrutura

- instância reutilizável do Prisma Client;
- validação de variáveis de ambiente;
- logger/requestId, JWT, Swagger, migrations e seed;
- encerramento gracioso do servidor e desconexão do Prisma.

## 3. Configuração e rotas públicas

- host e porta configuráveis por ambiente;
- `DATABASE_URL` para a conexão com PostgreSQL;
- `JWT_SECRET` mantido fora do Git e forte o suficiente para o algoritmo escolhido;
- `.env` nunca versionado; `.env.example` contém nomes e exemplos sem segredos reais;
- rotas públicas: `GET /health`, `GET /docs`, `GET /docs/json` e `POST /api/v1/auth/login`;
- todas as outras rotas de negócio exigem JWT válido e autorização.

O servidor deve tratar falhas de inicialização com mensagens claras e encerrar conexões de forma graciosa em `SIGINT`/`SIGTERM`.

## 4. Padrões de persistência e consistência

- PostgreSQL é a fonte de verdade; não usar arquivos da AV1;
- mudanças de schema são registradas por migrações versionadas;
- unicidades e chaves estrangeiras são garantidas pelo banco e complementadas com validações no serviço;
- operações que mudam mais de um registro relacionado usam transação Prisma;
- atualização de um recurso mutável verifica `versaoEsperada` e incrementa `versao`;
- falhas na transação não podem deixar status do lote, equipamento, movimento ou auditoria parcialmente atualizados;
- registros históricos e eventos de auditoria não têm edição/exclusão física por endpoints usuais.

## 5. Respostas e erros

- recurso individual: objeto JSON direto;
- coleção: `{ "data": [...], "meta": {...} }`;
- erro: `{ "error": { "code", "message", "details?", "requestId?" } }`;
- não retornar stack trace, hashes, credenciais, JWT, segredos, query SQL nem detalhes internos do Prisma.

Consulte [Contrato da API REST](contrato-api-rest.md) para os códigos HTTP e o catálogo de rotas.

## 6. Compatibilidade e CI

A entrega deve ser validável em Windows 10 ou superior e Ubuntu 24.04.03 ou superior/distribuições derivadas, conforme o enunciado. CI deverá executar instalação reproduzível, build, testes e testes de banco/migração quando o ambiente do workflow os disponibilizar.

**Validação:** o build, os testes de arquitetura e os testes HTTP registrados passaram. Consulte o [Plano de implementação](plano-de-implementacao.md) para ver a cobertura confirmada e as pendências restantes.
