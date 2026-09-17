# Fase 47 — Design system estilo shadcn/ui

## Contexto

Pedido do usuário: aproximar a UI do padrão visual do shadcn/ui (tokens de cor, raio de borda, sombras, foco) e reconstruir a sidebar no formato shadcn (rail colapsável com ícones), sem regressão funcional. `lucide-react`, `class-variance-authority`, `clsx` e `tailwind-merge` já estavam instalados em `packages/ui` desde a fundação do projeto, mas nunca haviam sido usados — só `Button` e `AppShell` existiam, com cores hex fixas.

## Entregue

### Tokens

- `apps/web/src/app/globals.css` e `apps/mobile-web/src/app/globals.css` (idênticos): variáveis CSS no padrão shadcn (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, mais `--sidebar-*`), com o verde da marca (`#0E5F4B`) como `--primary`/`--ring`. `--radius: 0.625rem` sobrescreve a escala padrão do Tailwind (`rounded-md`/`rounded-lg` ficam mais arredondados automaticamente, sem tocar nenhuma classe existente). Bloco `@theme inline` expõe tudo como utilitários Tailwind v4 (`bg-background`, `text-primary` etc.). `accent-color` da marca em checkbox/radio nativos; `::selection` também usa a cor primária.

### Primitives (`packages/ui/src/primitives`)

- `button.tsx`: reescrito com `cva` — variantes `default/primary/secondary/outline/ghost/link/destructive`, tamanhos `default/sm/lg/icon`, foco no padrão shadcn (`focus-visible:ring-ring/50`). `primary` foi mantido como alias de `default` para não obrigar a trocar as ~70 chamadas `variant="primary"` já espalhadas pelo app.
- Novos: `card.tsx`, `badge.tsx`, `input.tsx` (Input/Select/Textarea/Label), `table.tsx`, `separator.tsx`, `state.tsx` (`LoadingState`/`EmptyState`/`ErrorState` — ver dedup abaixo).
- `sidebar.tsx` (novo): `SidebarProvider`/`Sidebar`/`SidebarHeader`/`SidebarContent`/`SidebarGroup`/`SidebarGroupLabel`/`SidebarMenu*`/`SidebarFooter`/`SidebarTrigger`. Estado de colapso via `useSyncExternalStore` + `localStorage` (mesmo padrão já usado em `use-require-auth.ts` para evitar divergência de hidratação SSR — uma primeira tentativa com `useState`+`useEffect` foi rejeitada pelo lint `react-hooks/set-state-in-effect`).
- `app-shell.tsx`: reescrito por cima de `sidebar.tsx`. Itens de navegação agrupados (Operação / Equipe / Análise / Sistema) com ícone `lucide-react` por item. **A API pública do componente não mudou** (`activeHref`, `headerAction`, `headerEyebrow`, `headerTitle`, `userLabel`, `onLogout`), então nenhuma página precisou ser tocada para ganhar a sidebar nova — todas as ~17 páginas herdam o resultado automaticamente por já usarem `<AppShell>`.

### Retokenização em massa

- Script único (descartado após uso) trocou, em todo `apps/web/src` e `apps/mobile-web/src`, cada classe Tailwind com cor hex fixa (`bg-[#FBFCFB]`, `text-[#66736D]`, `border-[#0E5F4B]` etc. em `apps/web`; `border-zinc-200`, `bg-emerald-100` etc. em `apps/mobile-web`) pela classe de token equivalente (`bg-card`, `text-muted-foreground`, `border-primary`/`border-ring`...). 507 substituições em 16 arquivos de `apps/web` + 71 em 2 arquivos de `apps/mobile-web`. Um caso foi deixado de fora deliberadamente: o ponto de notificação não lida (`bg-[#B85C38]`) é um destaque de marca sem token correspondente.
- Verificado sem sobra: `grep` por classes `-[#...]` remanescentes em `apps/web/src` só retorna esse único caso intencional; `zinc-`/`red-`/`emerald-`/`amber-` remanescentes em `apps/mobile-web/src`: zero.

### Deduplicação

- `LoadingState`/`EmptyState`/`ErrorState` estavam copiados **byte-a-byte** em 8 páginas (`checklists`, `clientes`, `despacho`, `ordens`, `relatorios`, `tecnicos`, `mapa`, e `EmptyState` sozinho em `copilot`). Centralizados em `packages/ui/src/primitives/state.tsx` e importados de `@fieldops/ui`; as definições locais foram removidas.

## Verificação

- `pnpm verify` (lint + typecheck de 13 pacotes + 140 testes): passando.
- `pnpm e2e` (Playwright): 2/2 passando — o teste de drag-and-drop do despacho e o de offline do técnico não dependem da estrutura interna da sidebar, então a reescrita não os afetou.
- Inspeção visual via Playwright headless (API + web locais em modo demo, sem tocar no Postgres/Redis de produção) em: Início, Despacho, Ordens, Mapa, Técnicos, Clientes, Relatórios, Checklists, Copiloto, Notificações, Usuários, Perfil, Login, Esqueci senha, e mobile-web (Login, Meu dia). Sem erros de console em nenhuma. Colapso/expansão da sidebar testado manualmente (persiste após reload via `localStorage`).

## Limitações

- `apps/web` continua sem navegação em telas pequenas: a sidebar já tinha `max-lg:hidden` antes desta fase (não é uma regressão), e implementar um drawer mobile completo (overlay, foco preso, animação) ficou fora de escopo desta fatia — é um console primariamente desktop (o fluxo mobile do técnico vive em `apps/mobile-web`, que não usa `AppShell`).
- `Card`, `Table` (genérica) e `Input`/`Select`/`Textarea` (genéricos) foram criados e exportados, mas as páginas continuam com markup próprio de tabela/formulário usando as classes de token diretamente (não os componentes) — trocar cada tabela/formulário para os componentes shared é um refactor maior, de risco mais alto por tocar lógica de cada página, que não foi considerado necessário para o resultado visual pedido.
- Nenhum commit foi feito; todas as mudanças estão no working tree.
