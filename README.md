# GreenCode AV2

O GreenCode apoia o controle da logística reversa de equipamentos. Na AV1, o fluxo era operado por linha de comando; na AV2, as principais funções passam a ser acessadas por uma API REST, com banco de dados, usuários, permissões e histórico.

## Como executar

A forma preparada para avaliação é usar Docker Desktop com Docker Compose. São necessários apenas o repositório e Docker Desktop instalado e iniciado.

1. Copie `.env.example` para `.env`.
2. Abra `.env` e substitua a senha do PostgreSQL, o segredo JWT e as credenciais do administrador local de avaliação. Não compartilhe esse arquivo.
3. Na raiz do projeto, execute:

   ```powershell
   docker compose up --build -d
   docker compose ps
   ```

4. Abra `http://localhost:3000/docs` para testar a API ou `http://localhost:3000/health` para conferir se está respondendo.

A primeira inicialização cria o banco, aplica as migrações e prepara os parâmetros globais. O administrador inicial é criado com os valores de `BOOTSTRAP_ADMIN_*` somente quando ainda não existe; mudar a variável depois não troca a senha de um usuário já criado.

Para acompanhar a inicialização: `docker compose logs -f api`. Para parar sem apagar os dados: `docker compose down`. **Somente para descartar o banco local e recomeçar do zero**, use `docker compose down -v`; esse comando apaga os dados gravados nos volumes desse Compose.

## O que o sistema cobre

A API gerencia usuários e permissões, organizações e contratos, lotes, equipamentos, movimentações, parâmetros globais, auditoria e relatórios básicos. A sequência principal é:

`Organização → Contrato → Lote → Equipamentos → Triagem → Encaminhamento → Finalização`.

## Documentação

- [Visão, história e arquitetura da AV2](docs/GreenCode-AV2.md)
- [Épicos e User Stories](docs/epicos-e-user-stories.md)
- [Guia de testes do professor](docs/guia-de-testes-professor.md)

Os testes automatizados registrados no ambiente do desenvolvedor passaram: 25 testes unitários/HTTP e 10 de integração. Isso não significa que todas as User Stories estejam homologadas; o guia explica como conferir as funções principais e testar permissões e regras de negócio. A CI remota do GitHub deve ser conferida separadamente.

## Tecnologias principais

Node.js 24, TypeScript, Fastify 5, Prisma 7, PostgreSQL 17, JWT e Swagger/OpenAPI. O código é organizado em rotas/controllers, services, repositories e acesso ao banco.
