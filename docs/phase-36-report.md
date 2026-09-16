# Relatório da Fase 36

## Implementado

- `README.md` reescrito por completo: a versão anterior ainda descrevia o projeto como "Fase 0" (fundação inicial), sem refletir nenhuma das ~35 fases de produto construídas desde então.
- Novo README cobre: visão geral do produto, lista de funcionalidades principais com screenshots reais (capturados via Playwright contra a API/web rodando em modo demo), tabela de stack por camada, mapa do monorepo (apps/pacotes), instruções de setup (com e sem Postgres/Redis reais), credenciais de login demo, tabela de variáveis de ambiente opcionais e o que cada uma habilita, comandos de verificação/E2E/banco de dados, e uma seção "Estado do projeto" apontando para `docs/backlog.md`.
- 5 screenshots novos em `docs/screenshots/`: Início (dashboard com KPIs/mapa/insights), Despacho (mapa + drag-and-drop, data 2026-01-16 para refletir os dados demo), Ordens (checklist, anexos com botão "Revogar" da Fase 34), Relatórios (gráficos ECharts) e Copiloto (uma recomendação real de reatribuição gerada pelo caminho heurístico, evidenciando a correção da Fase 33).

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 112 testes, todos passando (mudança é só de documentação/imagens, sem código de produto alterado).
- Verificação manual: subiu API + web localmente em modo demo, navegou pelas 5 telas fotografadas e confirmou visualmente que refletem o estado atual do produto antes de capturar cada imagem.

## Decisões

- Não incluí um roteiro de deploy passo a passo (Neon/Upstash/Vercel/Render) porque nenhuma dessas integrações foi validada contra a infraestrutura real nesta sessão (ver itens abertos do backlog sobre validação de rede real); o README aponta as variáveis de ambiente e o efeito de cada uma, mas evita prescrever um roteiro não testado.
- O mapa do despacho aparece sem tiles carregados no screenshot porque o ambiente onde as capturas foram feitas não tinha acesso à internet para o provedor público de tiles — isso é uma limitação do ambiente de captura, não do produto (com internet, carrega `demotiles.maplibre.org` ou MapTiler se configurado).

## Limitações

- Item 38 do backlog ("documentação final") ainda pode evoluir — por exemplo, se o projeto for de fato implantado (Neon/Upstash/Vercel/Render), vale a pena substituir a tabela de variáveis por um roteiro de deploy validado na prática.
