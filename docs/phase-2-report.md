# Relatório da Fase 2

## Implementado

- Modelo tipado de ator autenticado em `packages/auth`.
- Catálogo inicial de permissões para ordens de serviço, agenda, clientes, ativos, técnicos, relatórios, administração, auditoria e IA.
- Policy pura para autorização por organização, equipe, território e atribuição.
- Guard global da API com decorator `RequirePermissions`.
- Parser temporário de ator via headers `x-fieldops-*` para permitir testes e endpoints protegidos até a implementação completa de sessão.

## Testes

- Testes unitários para autorização por objeto.
- Testes unitários para parsing de ator autenticado na API.

## Decisões

- A autorização de objeto mora no pacote `auth`, fora de controllers.
- O guard global só exige autenticação quando um handler declara permissões.
- Headers são uma ponte de desenvolvimento e não substituem autenticação/sessões definitivas.

## Limitações

- Login, hash de senha, OAuth/SSO e persistência de sessão ainda não foram implementados.
- Próximos endpoints mutáveis devem combinar `RequirePermissions` com checagem explícita de objeto antes de escrever no banco.
