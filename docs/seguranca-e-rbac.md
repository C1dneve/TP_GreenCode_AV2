# 05 — Segurança e matriz RBAC

## 1. Papéis

Os quatro papéis herdados são mantidos:

- `ADMINISTRADOR`
- `OPERADOR_CADASTRO`
- `GESTOR_ALMOXARIFADO`
- `AUDITOR`

Cada usuário possui um único papel. A autorização precisa ocorrer no servidor, nas rotas/serviços; ocultar ações no Swagger ou na interface cliente nunca é controle suficiente.

## 2. Matriz de alto nível

A matriz preserva a separação de funções documentada na AV1. As permissões devem ser transformadas em verificações explícitas por endpoint e cobertas por testes de autorização.

| Área/operação | ADMINISTRADOR | OPERADOR_CADASTRO | GESTOR_ALMOXARIFADO | AUDITOR |
|---|---:|---:|---:|---:|
| Gerenciar usuários, papéis e redefinição administrativa de senha | Sim | Não | Não | Não |
| Organizações: criar, consultar, atualizar, ativar/desativar | Sim | Sim | Não | Sem acesso CRUD direto; relatório só lê os dados necessários |
| Contratos: criar, consultar, atualizar, renovar e cancelar | Sim | Sim | Não | Sem acesso CRUD direto; relatório só lê os dados necessários |
| Lotes: ciclo operacional e cadastro | Sim | Não | Sim | Não escreve |
| Equipamentos: cadastro, atualização, estado físico/status e ativação | Sim | Não | Sim | Não escreve |
| Criar movimentação de equipamento | Sim | Não | Sim | Não |
| Consultar rastreabilidade/histórico de movimentações | Sim | Não | Não (restrição herdada) | Sim |
| Relatórios operacionais, triagem e financeiros | Sim | Não pela matriz herdada | Não pela matriz herdada | Sim, leitura |
| Consultar parâmetros globais | Sim | Não | Não | Não por padrão |
| Atualizar parâmetros globais | Sim | Não | Não | Não |
| Consultar auditoria | Sim | Não | Não | Sim, leitura |
| `/auth/me`, trocar própria senha, logout | Sim | Sim | Sim | Sim |

**Base da matriz:** a documentação de auditoria final da AV1 registra acesso do Auditor aos relatórios por organização, por status e financeiro, sempre sem operações de escrita. Essa permissão de leitura é preservada.

**Regra de implementação:** a tabela define o limite geral herdado. Acesso de leitura a relatórios não concede acesso de escrita aos módulos usados no cálculo; as permissões são explícitas por endpoint.

## 3. Autenticação JWT

- `POST /api/v1/auth/login` recebe usuário/senha e retorna JWT com `sub`, papel, `jti` e expiração de 30 minutos.
- Login verifica hash bcrypt e usuário ativo.
- Usuário inexistente e senha incorreta produzem resposta de credenciais inválidas genérica.
- Rotas protegidas verificam assinatura, expiração, `jti` revogado e estado ativo do usuário a cada requisição.
- `POST /api/v1/auth/logout` registra o `jti` atual em `TokenRevogado`; o token é recusado imediatamente após o logout.
- `POST /api/v1/auth/change-password` verifica a senha atual, aplica a nova política e revoga os tokens anteriores conhecidos.
- Não retornar nem registrar senha, hash, JWT completo ou segredo.

## 4. Senhas e bootstrap

- Hash adaptativo bcrypt para credenciais novas; nunca reutilizar os hashes locais da AV1.
- Mínimo de 12 caracteres nesta AV2; aplicar validação também para redefinição administrativa.
- Criar primeiro Administrador por bootstrap explícito no seed usando as variáveis `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME` e `BOOTSTRAP_ADMIN_PASSWORD`.
- Nunca inserir usuário/senha padrão em produção; sem as três variáveis o seed não cria o Administrador.
- Login é normalizado em minúsculas, removendo espaços externos antes de persistir/comparar.
- Não permitir auto-desativação nem desativação do último Administrador ativo.
- Desativar usuário impede autenticação e revoga os tokens conhecidos desse usuário.

## 5. Segredos e logging

- `.env` deve estar no `.gitignore`; versionar somente `.env.example` sem segredos reais.
- Não registrar cabeçalhos `Authorization`, senha, JWT, hash de senha, `JWT_SECRET` ou `DATABASE_URL`.
- Erros públicos não podem expor stack trace, consultas ou mensagens internas do Prisma/PostgreSQL.
- Correlacionar logs com `requestId` quando disponível.

## 6. Testes obrigatórios de RBAC

Para cada grupo de endpoint, testar pelo menos um acesso permitido e um negado por papel. Testar também token ausente, inválido, expirado e revogado; usuário desativado; alteração de papel; último Administrador ativo; e tentativa de chamada direta ao endpoint sem permissão.
