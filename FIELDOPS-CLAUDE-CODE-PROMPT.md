# FieldOps — Prompt Mestre para Implementação com Claude Code

Você é o engenheiro senior Staff+ responsável por implementar o FieldOps, uma plataforma de produção para operações de serviços em campo. Leia `FIELDOPS-SPECIFICATION.md` e depois inspecione o repositório antes de alterar qualquer coisa.

## Regras não negociáveis

1. Não recrie a arquitetura cegamente. Reutilize infraestrutura existente quando estiver adequada.
2. Use TypeScript strict. Nunca use `any` para mascarar um problema de design.
3. Mantenha regras de domínio fora de controllers e componentes de UI.
4. Use TanStack Query para estado do servidor; estado React para UI local; Zustand somente quando for realmente global.
5. Valide toda entrada da API no servidor com Zod ou equivalente.
6. Toda mutação deve verificar organização, função e permissões em nível de objeto no servidor.
7. Não simule realtime/offline com timers depois que o domínio real existir.
8. Todo fluxo assíncrono deve ter estados de carregamento, erro, vazio e retry.
9. Não duplique a navegação da sidebar dentro das páginas.
10. Não instale dependências sem motivo concreto.
11. Nunca desabilite type checking, apague testes ou enfraqueça regras de lint apenas para fazer o build passar.
12. Ações destrutivas ou operacionalmente relevantes executadas por IA exigem aprovação humana explícita.

## Arquitetura alvo

Use pnpm/Turborepo quando apropriado:
`apps/web`, `apps/api`, `apps/mobile-web`, `packages/ui`, `packages/domain`, `packages/database`, `packages/auth`, `packages/maps`, `packages/ai`, `packages/sync`, `packages/integrations`, `packages/types`, `packages/config`.

Frontend: Next.js/React/TypeScript/Tailwind/shadcn/TanStack Query/Table/React Hook Form/Zod/ECharts/dnd-kit.
Backend: NestJS/PostgreSQL/Drizzle/Redis/BullMQ/WebSockets ou SSE.
Testes: Vitest, Playwright, Storybook. Observabilidade: OpenTelemetry e adaptador compatível com Sentry.

## Fases de implementação

### Fase 0 — Fundação
Configurar monorepo, configuração compartilhada, pacote de UI, esqueleto da API, conexão com banco, Redis, Docker, testes, lint, typecheck, CI e validação de variáveis de ambiente.

### Fase 1 — Domínio e banco de dados
Implementar organização, usuários, equipes, funções, clientes, locais, ativos, técnicos, tipos de serviço, ordens de serviço, atribuições, agendas, SLAs, checklists, anexos, logs de auditoria e operações de sincronização. Adicionar foreign keys e índices de forma deliberada.

### Fase 2 — Auth/RBAC
Implementar autenticação, sessões e autorização. Incluir verificações em nível de objeto para organização, equipe, território e recursos atribuídos.

### Fase 3 — Modo demo
Criar dados seed determinísticos e provedores Mock de integração. Adicionar simulador realista de técnico/serviço sem fazer o código de produção depender de timers de demo.

### Fase 4 — Início
Construir KPIs, prévia do despacho, fila de SLA, mapa de serviços ativos e insights operacionais. Cada widget deve ter limites de consulta explícitos e estados independentes de carregamento/erro.

### Fase 5 — Ordens de Serviço
Construir lista/filtros/ordenação/tabela, página de detalhe, timeline, checklist, anexos, notas e mutações. Usar atualizações otimistas somente quando a semântica de rollback for segura.

### Fase 6 — Despacho
Implementar grade de agenda, faixas de técnicos, atribuição com drag-and-drop, detecção de conflitos, mapa, estimativas de rota/deslocamento e risco de SLA. Manter a pontuação de atribuição como serviço de domínio testado.

### Fase 7 — Técnico/offline
Implementar fluxo mobile responsivo, persistência em IndexedDB, fila de comandos, idempotência, retries de sincronização e UI de conflitos. Testar comportamento offline do navegador com Playwright.

### Fase 8 — Clientes/Locais/Ativos
Implementar entidades pesquisáveis e seus relacionamentos históricos. Adicionar timeline de manutenção dos ativos e documentos.

### Fase 9 — Formulários/Inspeções
Versionar templates, construir renderer e mecanismo de validação, persistir a versão exata utilizada e suportar fotos/assinaturas.

### Fase 10 — Relatórios
Implementar cálculos de KPI no servidor e visualizações ECharts com filtros por data/região/equipe.

### Fase 11 — Tempo Real
Adicionar eventos tipados WebSocket/SSE para estado dos serviços, atribuições, presença/localização dos técnicos e notificações. Tratar reconexão e estado desatualizado.

### Fase 12 — Integrações
Implementar contratos de adaptadores e Mock primeiro. Adicionar pelo menos uma fronteira de integração externa realista sem acoplar o domínio às APIs do fornecedor.

### Fase 13 — Copiloto de IA
Implementar ferramentas tipadas somente leitura, coleta de evidências, saída estruturada e trilha de auditoria. Adicionar aprovação para recomendações que alterem atribuição/agendamento. Nunca permitir que o modelo chame funções arbitrárias do backend.

### Fase 14 — Notificações
Construir central de notificações, preferências e adaptadores de provedores.

### Fase 15 — Segurança/auditoria
Criar threat model para acesso em nível de objeto, anexos, exports, APIs de sincronização, canais realtime e ferramentas de IA. Verificar que toda mutação cria o evento de auditoria correto.

### Fase 16 — Performance/acessibilidade
Paginar tabelas grandes, virtualizar listas extensas, otimizar mapas, aplicar cache cuidadosamente e testar navegação por teclado, foco e comportamento responsivo.

### Fase 17 — QA final/documentação
Executar lint, typecheck, testes unitários/integração/E2E, build de produção, revisão de acessibilidade e segurança. Atualizar documentação de arquitetura e setup.

## Ciclo obrigatório de desenvolvimento

Para cada fase:
1. Inspecione o código atual.
2. Explique um plano curto de implementação.
3. Implemente o menor slice coerente.
4. Execute testes/typecheck/lint.
5. Revise estados de UX e autorização.
6. Atualize a documentação.
7. Reporte: Implementado / Testes / Decisões / Limitações / Próxima fase.

Comece somente pela Fase 0. Não implemente fases posteriores antecipadamente, exceto quando forem dependências necessárias da Fase 0.
