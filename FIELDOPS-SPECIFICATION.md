---
title: FieldOps — Plataforma de Operações de Serviços em Campo
type: product-specification
status: draft
version: 1.0
---

# 1. Visão do Produto

FieldOps é uma plataforma moderna de operações de serviços em campo para empresas que coordenam técnicos, inspeções, manutenção, instalações e chamados de serviço. Ela conecta despacho operacional, técnicos em campo, clientes, ativos e inteligência operacional em um único sistema.

O objetivo para portfólio é demonstrar engenharia frontend sênior por meio de fluxos complexos: mapas, agendamento, despacho com drag-and-drop, formulários offline-first, status em tempo real, permissões, anexos, analytics e operações assistidas por IA.

## Problema central

Equipes de campo frequentemente trabalham com planilhas, aplicativos de mensagens, telas de ERP e ferramentas móveis desconectadas. Despachantes não têm uma visão confiável e em tempo real da disponibilidade dos técnicos e do andamento dos serviços; técnicos perdem tempo com trabalho administrativo; gestores não possuem KPIs operacionais confiáveis.

## Princípios do produto

- Operações em primeiro lugar: cada tela deve ajudar alguém a decidir ou executar algo.
- Tempo real por padrão para despacho e estado das ordens.
- Capacidade offline para execução em campo.
- UX empresarial densa, mas legível.
- Auditabilidade para ações operacionais.
- A IA explica e recomenda; ações críticas exigem aprovação humana.

# 2. Personas

### Despachante
Cria ordens de serviço, atribui técnicos, reagenda visitas, monitora risco de SLA e trata exceções.

### Técnico de Campo
Visualiza serviços atribuídos, navega até os locais, executa checklists, registra medições, tira fotos, coleta assinaturas e encerra serviços offline quando necessário.

### Gestor de Operações
Monitora carga de trabalho, utilização, cumprimento de SLA, backlog, taxa de resolução na primeira visita e desempenho da equipe.

### Cliente / Gestor do Local
Visualiza agendamentos, histórico de serviços, ETA do técnico, relatórios e evidências de conclusão.

### Administrador
Gerencia usuários, equipes, tipos de serviço, territórios, ativos, workflows, formulários, integrações e permissões.

# 3. Arquitetura de Informação

- Início
- Despacho
- Ordens de Serviço
- Calendário
- Mapa
- Técnicos
- Clientes
- Locais
- Ativos
- Estoque
- Inspeções
- Relatórios
- Copiloto de IA
- Notificações
- Configurações
  - Organização
  - Usuários
  - Equipes
  - Funções
  - Territórios
  - Tipos de Serviço
  - Formulários e Checklists
  - Políticas de SLA
  - Integrações
  - Notificações
  - Logs de Auditoria

Não duplique a navegação principal dentro do conteúdo das páginas. Use breadcrumb discreto e tabs locais somente quando necessário.

# 4. UX Global

Usar React/Next.js, Tailwind e shadcn/ui. Referências visuais: Linear, Vercel, Stripe, GitHub, softwares modernos de despacho e consoles operacionais centrados em mapas.

Header: toggle da sidebar, seletor de workspace, busca global, botão Criar, notificações, ajuda e menu do usuário.

A busca global cobre ordens de serviço, clientes, locais, ativos, técnicos e incidentes. Ações do command palette incluem criar ordem de serviço, atribuir técnico, abrir despacho, criar inspeção e pesquisar cliente.

Estados importantes: carregando, vazio, erro, acesso negado, offline, sincronização pendente, conflito de sincronização e sucesso.

# 5. Dashboard Inicial

KPIs:
- Ordens de serviço abertas
- Serviços de hoje
- SLAs em risco
- Técnicos ativos
- Tempo médio de resposta
- Taxa de resolução na primeira visita

Widgets:
- Linha do tempo do despacho de hoje
- Mapa de serviços ativos
- Fila de risco de SLA
- Ordens de serviço recentes
- Utilização dos técnicos
- Insights operacionais da IA

# 6. Console de Despacho

Workspace principal com layout dividido: agenda/timeline, mapa e fila de ordens de serviço.

Funcionalidades:
- Arrastar uma ordem entre técnicos e horários.
- Disponibilidade e habilidades dos técnicos.
- Estimativa de tempo de deslocamento.
- Restrições de território.
- Detecção de conflitos.
- Contagem regressiva do SLA.
- Atribuição em massa.
- Reatribuição com confirmação.
- Atualizações do estado dos serviços em tempo real.
- Agrupamento de marcadores no mapa e visualização de rotas.

A pontuação de atribuição deve considerar compatibilidade de habilidades, distância, disponibilidade, carga de trabalho, prioridade e prazo do SLA. O mecanismo de pontuação deve ser determinístico, testável e explicável.

# 7. Ordens de Serviço

Campos: número, cliente, local, ativo, tipo de serviço, prioridade, status, técnico, janela agendada, SLA, descrição, checklist, anexos, notas e timestamps.

Status: Rascunho, Agendada, A Caminho, No Local, Pausada, Concluída, Cancelada, Requer Revisão.

Tabs do detalhe: Visão Geral, Linha do Tempo, Checklist, Peças, Fotos, Notas, Cliente, Ativo, Atividade.

Ações: atribuir, reagendar, iniciar deslocamento, iniciar serviço, pausar, concluir, cancelar, reabrir. Ações mutáveis exigem permissão e eventos de auditoria.

# 8. Experiência do Técnico

Experiência responsiva mobile-first:
- Meu Dia
- Detalhe do Serviço
- Fluxo iniciar/parar
- Encaminhamento para navegação
- Checklist offline
- Fila de captura/upload de fotos
- Medições
- Peças utilizadas
- Assinatura
- Relatório de conclusão

Modelo offline: fila local de comandos e registros; UI otimista; chaves de idempotência; resolução de conflitos baseada em regras de domínio explícitas, nunca sobrescritas silenciosas.

# 9. Clientes, Locais e Ativos

Perfil do cliente: contatos, locais, contratos, histórico de ordens, SLA e notas.

Local: endereço, geolocalização, instruções de acesso, horário de funcionamento, ativos e histórico de serviços.

Ativo: número de série, modelo, garantia, agenda de manutenção, resumo de telemetria, histórico de serviços e documentos.

# 10. Inspeções e Formulários

Construtor de formulários com seções, campos condicionais, campos obrigatórios, leituras numéricas, fotos, assinaturas e controles de aprovado/reprovado.

Templates de checklist são versionados. Uma ordem de serviço armazena a versão exata do template utilizada para que relatórios históricos permaneçam reproduzíveis.

# 11. Relatórios

Métricas operacionais:
- Cumprimento de SLA
- Tempo médio de resposta
- Tempo médio de reparo
- Taxa de resolução na primeira visita
- Utilização dos técnicos
- Serviços por técnico
- Tempo de deslocamento
- Taxa de cancelamento
- Envelhecimento do backlog

Usar ECharts para séries temporais, distribuições e análises operacionais.

# 12. Copiloto de Operações com IA

Ferramentas somente leitura:
- get_work_order
- get_customer
- get_site
- get_asset
- get_technician
- get_schedule
- get_sla_risk
- get_work_order_history
- search_knowledge

Exemplos:
- “Quais serviços têm maior probabilidade de violar o SLA hoje?”
- “Por que a utilização dos técnicos está baixa na região norte?”
- “Resuma o histórico de manutenção deste ativo.”
- “Sugira o melhor técnico para a WO-1042.”

Recomendações da IA devem expor evidências e fatores considerados. Atribuição, cancelamento e reagendamento exigem aprovação.

# 13. Notificações

Eventos: nova atribuição, reatribuição, risco de SLA, técnico atrasado, serviço concluído, falha de sincronização, solicitação de aprovação e incidente.

Canais: dentro do app, email e adaptadores opcionais para Slack/SMS.

# 14. Modelo de Domínio

User, Team, Role, TechnicianProfile, Customer, Contact, Site, Asset, Contract, ServiceType, WorkOrder, WorkOrderEvent, WorkOrderAssignment, ScheduleSlot, Territory, SLA, SLAEvent, ChecklistTemplate, ChecklistVersion, ChecklistResponse, FormField, Attachment, Signature, InventoryItem, PartUsage, Inspection, Notification, AuditLog, AIConversation, AIToolCall, SyncOperation, DeviceSession.

# 15. Arquitetura

Monorepo recomendado:

    apps/web
    apps/api
    apps/mobile-web
    packages/ui
    packages/domain
    packages/database
    packages/auth
    packages/maps
    packages/ai
    packages/sync
    packages/integrations
    packages/types
    packages/config
    tests

Frontend: Next.js, React, TypeScript strict, TanStack Query/Table, Zustand somente para estado global realmente necessário, React Hook Form, Zod, ECharts, adaptador de provedor de mapas, dnd-kit.

Backend: NestJS, PostgreSQL, Drizzle, Redis, BullMQ, WebSockets/SSE.

Offline: abstração de IndexedDB, fila de comandos, worker de sincronização e chaves de idempotência.

# 16. Tempo Real

Eventos: work_order.updated, assignment.changed, technician.location.updated, sla.risk_changed, notification.created, sync.completed.

Dados de localização devem ser limitados por throttle e controlados por permissão. Não persistir histórico de localização desnecessariamente preciso.

# 17. Integrações

Usar interfaces de adaptadores para mapas, calendário, ERP, CRM, mensageria e identidade. Incluir provedores Mock para o modo demo.

# 18. Segurança

RBAC mais autorização em nível de objeto por organização, território, equipe e recursos atribuídos. Validar todo comando no servidor. Proteger anexos com URLs assinadas. Auditar alterações de atribuição, status, dados de clientes e permissões.

# 19. Testes

Unitários: agendamento, pontuação de atribuição, cálculos de SLA, regras de conflito de sincronização e permissões.
Integração: ordens de serviço, despacho, sincronização offline, anexos e notificações.
E2E: despachante atribui serviço; técnico conclui serviço offline; conflito de sincronização; gestor visualiza KPI.

# 20. Modo Demo

Popular “Acme Field Services” com regiões, técnicos, clientes, locais, ativos e serviços realistas. Incluir simulador de despacho que altera posições dos técnicos e estados das ordens.

# 21. Roadmap

0 Fundação → 1 Banco de Dados → 2 Auth/RBAC → 3 Dados Demo → 4 Início → 5 Ordens de Serviço → 6 Despacho/Calendário/Mapa → 7 Fluxo offline do Técnico → 8 Clientes/Locais/Ativos → 9 Formulários/Inspeções → 10 Relatórios → 11 Tempo Real → 12 Integrações → 13 Copiloto de IA → 14 Notificações → 15 Segurança/Auditoria → 16 Performance/Acessibilidade → 17 Documentação/QA final.

# 22. Definition of Done

Toda funcionalidade possui estados de carregamento/vazio/erro/sucesso/offline quando aplicável, autorização no servidor, testes, telemetria, comportamento acessível de teclado/foco, layout responsivo e documentação. Não usar interações falsas apenas de UI nos fluxos principais.
