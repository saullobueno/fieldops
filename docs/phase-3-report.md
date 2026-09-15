# Relatório da Fase 3

## Implementado

- Seed demo determinístico para a organização “Acme Field Services”.
- Dados iniciais de territórios, funções, usuários, equipe, técnicos, clientes, locais, ativo, tipos de serviço, ordens de serviço e atribuição.
- Script `pnpm --filter @fieldops/database seed:demo`.
- Adaptadores mock de mapas e calendário em `packages/integrations`.

## Testes

- Testes unitários dos adaptadores mock.
- Teste estrutural de geração das declarações SQL do seed.

## Decisões

- O seed usa UUIDs fixos e timestamps determinísticos para ser repetível.
- Mocks ficam no pacote de integrações e não dependem de timers ou loops de simulação.
- A simulação dinâmica de técnicos/serviços ainda não foi adicionada para não misturar demo com produção.

## Limitações

- O script de seed exige banco com migrations já aplicadas.
- Simulador realista de despacho pode ser adicionado depois como processo separado e controlado, sem contaminar domínio de produção.
