# ADR-0004 — JWT, autorização, revogação de sessões e auditoria

**Status:** Aceita

## Contexto

A API possui papéis distintos e precisa rejeitar credenciais inválidas, encerrar uma sessão antes do vencimento do token e manter evidências de operações relevantes. O histórico operacional e de auditoria não deve ser apagado como parte de atualizações comuns.

## Decisão

Autenticar com JWT assinado por HS256, com validade de 30 minutos, e armazenar senhas como hashes bcrypt. Validar a identidade em rotas protegidas, verificar o papel autorizado para a operação, comparar `authVersion` com o estado atual do usuário e consultar `tokens_revogados` pelo identificador `jti`. O logout grava o token na lista de revogação. Operações críticas registram eventos em `eventos_auditoria`; quando a auditoria é parte da operação, sua gravação compartilha a transação. O modelo mantém histórico de movimentações e snapshots dos responsáveis.

## Alternativas consideradas

- **JWT sem revogação no servidor:** reduz consultas por requisição, mas um token emitido continuaria válido até expirar após logout.
- **Sessão opaca integralmente armazenada no servidor:** facilita a revogação por sessão, mas alteraria o modelo de autenticação já implementado.
- **Auditoria fora da transação da operação:** desacopla a escrita, mas pode deixar o dado operacional persistido sem o evento correspondente ou vice-versa.

## Justificativa

A verificação de `jti` permite que o logout invalide o mesmo JWT imediatamente. `authVersion` invalida sessões antigas após alteração de credenciais, e o RBAC é aplicado no servidor a cada requisição. A transação compartilhada mantém a consistência entre mutações e eventos que pertencem à mesma operação.

## Consequências e trade-offs

**Positivas:** revogação efetiva antes do vencimento; autorização central no servidor; invalidação de sessões após troca de senha; hashes de senha; histórico consultável e trilha de auditoria atomicamente vinculada aos casos de uso pertinentes.

**Negativas:** rotas autenticadas consultam o estado do usuário e a revogação no banco; os segredos JWT precisam ser configurados e protegidos; a lista de tokens revogados exige política operacional de retenção/limpeza; a indisponibilidade do banco impede validar identidades atuais.

## Relação com a AV2

A decisão corresponde a US-AV2-010 a US-AV2-015 e US-AV2-036, além de preservar o histórico exigido pelas operações de movimentação e pelas regras de negócio. As verificações automatizadas devem provar tanto o status de logout quanto a rejeição subsequente do mesmo token.
