# Relatório da Fase 21

## Implementado

- Login real substituindo os headers `x-fieldops-*` como única ponte de desenvolvimento.
- `packages/auth`: `hashPassword`/`verifyPassword` (bcryptjs, 12 rounds).
- Coluna `password_hash` em `users` (migração `0001_safe_true_believers.sql`).
- `AuthService`/`AuthController` (`POST /auth/login`): autentica contra o Postgres quando configurado (resolve permissões via `user_roles`/`roles`, equipes via `team_members`, territórios via `teams`/`technician_profiles`); cai num fallback demo determinístico (mesmos três usuários do seed, mesmo hash de senha) quando não há banco configurado ou a consulta falha tecnicamente — nunca como alternativa a uma senha incorreta.
- Seed demo (`packages/database/src/seeds/demo.ts`) passa a gravar `password_hash` para os três usuários (`admin@acmefield.example`, `ana@acmefield.example`, `bruno@acmefield.example`), todos com a senha demo `demo1234`.
- Papel "Administrador" do seed ganhou o conjunto completo de permissões (antes só tinha as administrativas; a UI usava `ai:read`/`work_order:assign` etc. via headers arbitrários que não refletiam nenhum papel real — com login real isso quebraria para o usuário admin).
- Telas `/login` em `apps/web` e `apps/mobile-web`.
- `apps/web/src/lib/api-client.ts` e `apps/mobile-web/src/lib/api-client.ts`: wrapper de `fetch` que injeta `Authorization: Bearer <token>` a partir da sessão salva em `localStorage` e redireciona para `/login` em qualquer 401.
- `use-require-auth.ts` (via `useSyncExternalStore`, não `useState`+`useEffect`, para não divergir entre SSR e o primeiro render no navegador) protegendo todas as páginas autenticadas.
- Todas as 7 páginas de `apps/web` (Início, Ordens, Despacho, Clientes, Relatórios, Notificações, Copiloto) e a página do técnico em `apps/mobile-web` migradas de headers `x-fieldops-*` hardcoded para o client autenticado; `AppShell` (`packages/ui`) ganhou `userLabel`/`onLogout` para exibir o usuário atual e permitir sair.
- Corrigido um bug de lint pré-existente (não introduzido nesta fase): `eslint-config-next` tentava aplicar o parser Babel do pacote `next` aos arquivos de configuração da raiz do workspace (`eslint.config.mjs`, `vitest.config.mts`, `postcss.config.mjs`), que falhava por `next` não ser dependência direta da raiz. Esses arquivos foram adicionados aos `ignores` do ESLint.

## Testes

- `packages/auth`: testes de `hashPassword`/`verifyPassword`.
- `apps/api/src/modules/auth/auth.service.test.ts`: caminho demo (sucesso, senha errada, email desconhecido), caminho com Postgres mockado (sucesso resolvendo permissões/equipes/territórios, senha errada sem cair no fallback demo, fallback demo quando a query falha tecnicamente).
- `pnpm verify` (lint + typecheck de 13 pacotes + testes): **93 testes passando**.
- `pnpm build`: build de produção dos 13 pacotes com sucesso, incluindo as rotas `/login` novas em ambos os apps Next.js.

## Decisões

- Senha com bcryptjs (puro JS, sem binário nativo) em vez de argon2, para não depender de toolchain de compilação nativa no Windows/Render.
- Sessão do cliente em `localStorage` (não cookie httpOnly) para manter a arquitetura simples de SPA-com-Next.js já existente; aceitável para um projeto de portfólio, mas é uma limitação de segurança real para produção (ver Limitações).
- O endpoint de login busca o usuário só por email (sem exigir slug de organização antecipadamente), pegando o primeiro cadastro encontrado — aceitável para o modo demo com uma única organização; um produto multi-tenant real precisaria de um seletor de organização ou subdomínio.
- A rota `GET /realtime/stream` (Server-Sent Events) continua fora do `AuthGuard` baseado em Bearer token, como já documentado no próprio controller: `EventSource` do navegador não permite cabeçalhos customizados, então essa rota resolve o ator via query string. Não foi alterada nesta fase.

## Limitações

- Sessão em `localStorage` é vulnerável a XSS (qualquer script injetado pode ler o token); um cookie `httpOnly`/`Secure` seria mais seguro, mas exigiria repensar a arquitetura de client-side fetch direto à API (hoje `apps/web`/`apps/mobile-web` chamam a API NestJS diretamente do navegador, sem proxy via rotas do Next.js).
- Não há endpoint de logout no backend nem revogação de token — o token HMAC assinado continua válido até expirar (ele não tem expiração embutida hoje); "sair" só apaga o token do lado do cliente.
- Não há fluxo de cadastro/convite de usuário nem recuperação de senha — só os três usuários demo têm senha definida.
- A URL da API em `useRealtimeStream` (`apps/web/src/lib/use-realtime-stream.ts`) continua hardcoded para `http://localhost:4000`, não usa `NEXT_PUBLIC_API_BASE_URL`; fica para a fatia de configuração de deploy.
