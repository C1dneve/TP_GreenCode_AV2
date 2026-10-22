# 08 — Testes e critérios de aceite

## 1. Pirâmide de testes

### Unitários — services e regras

Testar validações de CNPJ, janela de data, valores monetários/peso, ordem de estado físico, transição de lote, justificativas, vigência contratual, depreciação, normalização de login e regras de desativação.

### Integração — Prisma/PostgreSQL

Testar migrações em banco vazio, FKs, constraints de unicidade, relações e consultas paginadas. Validar rollback de operações que envolvem múltiplas entidades, como triagem e movimentação + auditoria.

### HTTP/API

Testar request schemas, códigos HTTP, envelope de sucesso/erro, `requestId`, paginação, filtros, OpenAPI e autenticação nas rotas protegidas.

### Autorização

Cobrir pelo menos um caminho permitido e um negado por cada papel para cada área protegida. Testar chamada direta a rota, não somente a ausência de opção em interface/documentação.

### Jornada ponta a ponta

Organização → contrato → lote → equipamento → triagem → encaminhamento → finalização → movimentação → rastreabilidade/relatório.

## 2. Casos mínimos de negócio

- CNPJ com dígitos incorretos, CNPJ repetido e formatos com pontuação diferentes que normalizam ao mesmo CNPJ.
- `dataEntrada` futura, anterior a 90 dias, exatamente no limite e data válida.
- Desativação de organização com lote não finalizado e sem lote pendente.
- Contrato vencido, cancelado, renovação, dois contratos concorrentes e tentativa de editar contrato cancelado.
- Lote vazio, triagem repetida, encaminhamento antes da triagem e finalização antes de encaminhar.
- Equipamento desativado, código interno duplicado, ano inválido, peso/valor negativos.
- Tentativa de `EM_DESMONTE` antes de `AGUARDANDO_DESMONTE` e status sem justificativa.
- Queda de estado físico de zero/uma categoria e de duas ou mais categorias sem justificativa.
- Movimentação com ator falsificado no corpo, evento sem equipamento ativo, origem inicial e origem a partir do último destino.
- Logout seguido de reutilização do mesmo JWT; usuário desativado com token ainda não expirado.
- Atualização com `versaoEsperada` atual e obsoleta; conflito simultâneo de contrato vigente.
- Auditoria e mutação confirmadas juntas; falha de auditoria provoca rollback quando o evento é requisito de integridade.
- Parâmetros fora de 0–100 e tentativa de alteração por papel não administrador.

## 3. Critérios de API

- Recurso único retorna objeto direto; coleção retorna `data` e `meta`.
- Lista vazia retorna `200` com `data: []` e `totalItems=0`/`totalPages=0`.
- UUID malformado: `400`; UUID válido sem recurso: `404`.
- `400`, `401`, `403`, `404`, `409` e `500` têm testes; erros inesperados não vazam detalhes internos.
- Paginação tem `pageSize` máximo 100 e allow-list de ordenação.
- Todas as escritas de recurso mutável seguem a política de `versaoEsperada`.
- Rotas críticas de estado são ações `POST` específicas, não `PATCH` livre de status.

## 4. Critérios de segurança

- `.env`, senhas, hashes, tokens e segredos não aparecem no Git ou logs.
- JWT expirado, invalidado, revogado ou de usuário desativado é rejeitado.
- Login não revela se a conta existe.
- Não desativar a própria conta nem o último Administrador ativo.
- `Movimentacao` e `EventoAuditoria` não têm rotas convencionais de alteração/exclusão.

## 5. CI e ambientes

A CI deve instalar com lockfile (`npm ci`), compilar, executar testes e validar migrações/integração contra PostgreSQL quando o serviço estiver configurado. A homologação Windows 10+ e Ubuntu 24.04.03+ deve ser marcada por evidências de comandos executados; não basta o código ser teoricamente multiplataforma.

## 6. Definição de pronto

Uma história só está pronta quando: regras no service; autorização conforme matriz; schemas e erros documentados; persistência/transação correta; testes relevantes aprovados; OpenAPI/README atualizado; nenhum segredo introduzido; e evidência de validação guardada quando for requisito de entrega.


## Evidências do incremento G1 (22/10/2026)

- Foram adicionadas rotas de autenticação e gerenciamento administrativo, proteção JWT, invalidação global por `authVersion` e serviço/repositório de auditoria.
- A migração `20261022080000_usuario_auth_version` adiciona o campo de versão de autenticação sem reescrever migrações anteriores.
- **Validação pendente neste ambiente:** a instalação das dependências não terminou dentro do tempo disponível e o runtime disponível reporta Node.js 22, enquanto o projeto exige Node.js 24. Não declarar build, testes HTTP/RBAC ou integração PostgreSQL como aprovados até executá-los em Node 24 com dependências instaladas e banco acessível.
- O endpoint de consulta de auditoria não faz parte da implementação G1 entregue.
