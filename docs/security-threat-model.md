# Threat model — FieldOps

## Escopo

Revisão focada em acesso por organização, permissões por objeto, anexos, exports, sincronização offline, canais realtime e ferramentas de IA.

## Ameaças e controles

### Acesso entre organizações

- Risco: ator consultar ou mutar recurso de outra organização.
- Controle atual: controllers exigem ator autenticado e serviços filtram por `organization_id`; ordens também chamam `authorizeObjectAccess` antes de detalhe/mutação.
- Próximo reforço: substituir headers de desenvolvimento por sessão real em todos os clientes.

### Escopo de equipe, território e atribuição

- Risco: usuário com permissão ampla ler ordem fora de sua equipe/território.
- Controle atual: `authorizeObjectAccess` aceita organização, atribuição direta, equipe, território ou permissão administrativa.
- Próximo reforço: aplicar o mesmo padrão a clientes, ativos e relatórios quando tiverem mutações.

### Anexos e exports

- Risco: link assinado vazar, path traversal, download sem auditoria.
- Controle atual: assinatura HMAC, expiração curta, proteção de resolução de caminho local e auditoria de export quando há metadado persistido.
- Próximo reforço: revogação antecipada e storage cloud com política equivalente.

### Sincronização offline

- Risco: replay de comandos, conflito silencioso e alteração fora de escopo.
- Controle atual: idempotência por operação, status de conflito e mutações reaproveitando regras do servidor.
- Próximo reforço: testes Playwright offline e background sync com Service Worker.

### Tempo real

- Risco: evento entregue para organização errada ou perdido em múltiplas instâncias.
- Controle atual: envelopes carregam `organizationId` e assinatura de stream recebe a organização.
- Próximo reforço: broker Redis para pub/sub compartilhado e persistência de localização.

### Copiloto de IA

- Risco: execução arbitrária ou ação destrutiva sem aprovação.
- Controle atual: conjunto fechado de ferramentas somente leitura, saída estruturada e aprovação humana explícita antes de reatribuição.
- Próximo reforço: persistir recomendações pendentes em tabela própria.

### Sessão

- Risco: headers de desenvolvimento serem usados como autenticação em ambiente real.
- Controle atual: a API aceita bearer token assinado por HMAC para representar o ator, preservando headers como ponte local.
- Próximo reforço: login real com hash de senha ou SSO, rotação de sessão e cookies seguros.
