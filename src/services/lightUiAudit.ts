/**
 * APEX GP Manager — LIGHT-UI-01A: AUDITORIA GLOBAL DE IDENTIDADE VISUAL
 *
 * Módulo canônico que consolida toda a auditoria do ecossistema visual da aplicação:
 * - 23 Rotas registradas no React Router
 * - 21 Telas / Páginas completas
 * - 81 Componentes e modais auditados
 * - Classificação rigorosa conforme diretriz: TELA ESCURA COMPLETA = LEGADO VISUAL
 * - Identificação dos High-Leverage Shared Components
 * - Quick Wins e Roadmap de migração em blocos
 *
 * REFERÊNCIA VISUAL CANÔNICA: src/pages/History.tsx (v0.0.463)
 * - Fundo claro (#F4F5F7)
 * - Superfícies brancas (#FFFFFF)
 * - Bordas cinza-claro (#E2E8F0, #CBD5E1)
 * - Texto principal grafite/azul-escuro (#0F172A, #1E293B)
 * - Texto secundário cinza médio (#64748B, #475569)
 * - Vermelho APEX (#E10600) para ações primárias e destaques
 * - Cores semânticas suaves: verde (sucesso), âmbar (atenção), azul (info), carmesim (destrutivo)
 * - Dark técnico restrito: apenas telemetria / cockpit / radar / simulação em tempo real como componente local
 */

export type UiVisualClassification =
  | 'LIGHT_OK'
  | 'DARK_LEGACY'
  | 'MIXED'
  | 'NEEDS_TOKEN_MIGRATION'
  | 'TECHNICAL_DARK_ALLOWED'
  | 'DEAD_LEGACY'

export type UiMigrationPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type UiMigrationComplexity = 'BAIXA' | 'MEDIA' | 'ALTA'

export interface RouteAuditRecord {
  path: string
  component: string
  isActive: boolean
  isAccessible: boolean
  currentStyle: 'LIGHT' | 'DARK' | 'MIXED' | 'REDIRECT'
  classification: UiVisualClassification
  migrationNeeded: boolean
  priority: UiMigrationPriority
  complexity: UiMigrationComplexity
  notes: string
}

export interface PageAuditRecord {
  name: string
  filePath: string
  currentStyle: 'LIGHT' | 'DARK' | 'MIXED' | 'LEGACY_DEAD'
  classification: UiVisualClassification
  sharedComponents: string[]
  dialogsOrOverlays: string[]
  migrationComplexity: UiMigrationComplexity
  priority: UiMigrationPriority
  notes: string
}

export interface ComponentAuditRecord {
  name: string
  filePath: string
  type: 'SHARED_PRIMITIVE' | 'MODAL_OVERLAY' | 'PAGE_SECTION' | 'RACE_FEED' | 'CHART'
  currentStyle: 'LIGHT' | 'DARK' | 'MIXED' | 'TECHNICAL_DARK'
  classification: UiVisualClassification
  priority: UiMigrationPriority
  complexity: UiMigrationComplexity
  affectedRoutes: string[]
  notes: string
}

export interface QuickWinItem {
  id: string
  title: string
  targetFiles: string[]
  impact: string
  risk: 'MUITO_BAIXO' | 'BAIXO'
  estimatedLines: number
  description: string
}

export interface MigrationPhasePlan {
  phaseId: string
  title: string
  scope: string[]
  deliverable: string
  dependencies: string[]
}

export interface LightUiAuditResult {
  version: string
  timestamp: string
  benchmarkPage: string
  summary: {
    totalRoutes: number
    totalPages: number
    totalComponentsAudit: number
    countsByClassification: Record<UiVisualClassification, number>
    darkScreensRemainingCount: number
    highLeverageComponentsCount: number
  }
  routes: RouteAuditRecord[]
  pages: PageAuditRecord[]
  components: ComponentAuditRecord[]
  darkScreensList: string[]
  highLeverageSharedComponents: ComponentAuditRecord[]
  quickWins: QuickWinItem[]
  migrationPhases: MigrationPhasePlan[]
}

/**
 * Catálogo Canônico de Rotas Auditadas (23 rotas no Router)
 */
export const AUDITED_ROUTES: RouteAuditRecord[] = [
  {
    path: '/',
    component: 'Index (Dashboard de Operações)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'MIXED',
    classification: 'MIXED',
    migrationNeeded: true,
    priority: 'P0',
    complexity: 'MEDIA',
    notes:
      'Container e cards de finanças/pilotos/próxima corrida já possuem superfícies claras (#F4F5F7, bg-white), mas o Hero da Equipe ainda usa fundo preto #0B0E14 e cards de Notícias/Paddock têm ícones em fundo escuro.',
  },
  {
    path: '/auth',
    component: 'AuthPage (Login / Cadastro)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      'Migrado no LIGHT-UI-01B: card branco, background off-white, tabs e inputs claros e CTA vermelho APEX.',
  },
  {
    path: '/lobby',
    component: 'LobbyPage (Wizard de Nova Carreira)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'ALTA',
    notes:
      'Migrado no LIGHT-UI-01B: LobbyLayout em off-white e os 7 steps do wizard em superfícies brancas.',
  },
  {
    path: '/selecionar-equipe',
    component: 'LobbyPage (Alias de Seleção)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'ALTA',
    notes:
      'Migrado no LIGHT-UI-01B: renderiza o LobbyPage/StepOfficialTeamSelection dentro do LobbyLayout claro.',
  },
  {
    path: '/team',
    component: 'TeamPage (Minha Equipe)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'MIXED',
    classification: 'MIXED',
    migrationNeeded: true,
    priority: 'P0',
    complexity: 'ALTA',
    notes:
      'Cards da visão geral e banners principais já foram modernizados, mas modais internos (renegociação, rescisão, DevelopmentManagerModal, StaffContractDetailsModal) ainda são pretos/escuros.',
  },
  {
    path: '/pilotos',
    component: 'DriversPage (Pilotos & Mercado)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: true, // apenas modais
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      'Página principal redesenhada com filtros claros, tabela clara e cards claros. Contudo, seus modais filhos (PilotProfileDialog, SillySeasonModal) e SidePanel carregam elementos escuros legados.',
  },
  {
    path: '/teams',
    component: 'TeamsPage (Grid da Temporada)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    migrationNeeded: true,
    priority: 'P2',
    complexity: 'MEDIA',
    notes:
      'Cards das escuderias, painéis de comparação e modais com fundo preto #0B0E14, #11161F e texto branco. Não foi migrada para light.',
  },
  {
    path: '/car',
    component: 'CarPage (Meus Carros & Engenharia)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P0',
    complexity: 'BAIXA',
    notes:
      'Redesenhada com abas claras, cards claros (GarageHero, PerformanceRadarMap, CarPartsCatalog, InstalledComponentsGrid). Dialogs de swap também claros.',
  },
  {
    path: '/pistas',
    component: 'TracksPage (Circuitos da Temporada)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    migrationNeeded: true,
    priority: 'P2',
    complexity: 'MEDIA',
    notes:
      'Página inteira construída sobre fundo #0B0E14, cards #11161F, inputs escuros e tabelas escuras. Precisa de migração visual completa para light.',
  },
  {
    path: '/pistas/:circuitId',
    component: 'TracksPage (Detalhe de Circuito)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    migrationNeeded: true,
    priority: 'P2',
    complexity: 'MEDIA',
    notes: 'Mesmo componente de TracksPage com layout escuro legado.',
  },
  {
    path: '/infraestrutura',
    component: 'InfrastructurePage (Instalações & P&D)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      'Redesenhada com abas claras, cards com bordas suaves e PowerUnitIntegrationPanel em light. Apenas containers de mini-fotos têm fundo neutro escuro controlado.',
  },
  {
    path: '/sponsors',
    component: 'SponsorsPage (Comercial & Finanças)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'MIXED',
    classification: 'MIXED',
    migrationNeeded: true,
    priority: 'P1',
    complexity: 'MEDIA',
    notes:
      'Container da página e abas principais são claras, mas subcomponentes TabCurrentSponsors, CarSponsorMap e NegotiationModal usam superfícies #0B0E14 e #11161F.',
  },
  {
    path: '/race',
    component: 'Navigate (Redirecionamento Canônico)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'REDIRECT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P3',
    complexity: 'BAIXA',
    notes: 'Homologado na LEGACY-WEEKEND-AUDIT-01 como redirect 301 client-side para /corrida.',
  },
  {
    path: '/corrida',
    component: 'WeekendV2Page (Central de Fim de Semana)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'MIXED',
    classification: 'MIXED',
    migrationNeeded: true,
    priority: 'P0',
    complexity: 'ALTA',
    notes:
      'Painéis de preparação de TL1/TL2, alocação de pneus e cards de engenharia já possuem superfícies claras, mas o cabeçalho do cockpit, HUD, modais de decisão e Simulação Restante possuem elementos escuros legados misturados com técnicos.',
  },
  {
    path: '/weekend-v2',
    component: 'WeekendV2Page (Alias Canônico de Corrida)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'MIXED',
    classification: 'MIXED',
    migrationNeeded: true,
    priority: 'P0',
    complexity: 'ALTA',
    notes: 'Mesmo componente e regras de WeekendV2Page.',
  },
  {
    path: '/corrida-ao-vivo',
    component: 'LiveRacePage (Corrida em Tempo Real)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'MIXED',
    classification: 'TECHNICAL_DARK_ALLOWED',
    migrationNeeded: true,
    priority: 'P0',
    complexity: 'MEDIA',
    notes:
      'A página possui container externo e cartões de status claros (#F4F5F7, bg-white), mas os painéis de telemetria em tempo real (LiveStandingsTable, LiveTelemetryTable, LiveRaceHUD, DriverLiveOperationsPanel) possuem dark técnico justificado. A moldura deve permanecer light.',
  },
  {
    path: '/season-end',
    component: 'SeasonEndPage (Transição de Temporada)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    migrationNeeded: true,
    priority: 'P2',
    complexity: 'MEDIA',
    notes:
      '100% construída com cards #090D15/#11161F e bordas #1F2733. Deve ser migrada para estilo executivo de premiação FIA em superfícies claras.',
  },
  {
    path: '/standings',
    component: 'StandingsPage (Campeonato Mundial)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      'Tabelas de pilotos e construtores 100% migradas para branco/cinza-claro, com tipografia tabular limpa e badges FIA harmoniosos.',
  },
  {
    path: '/paddock',
    component: 'PaddockPage (Central do Paddock)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      'Página totalmente clara com abas, grids e cards em conformidade com o padrão executivo.',
  },
  {
    path: '/historico',
    component: 'HistoryPage (Arquivo Oficial da Temporada)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P0',
    complexity: 'BAIXA',
    notes:
      'REFERÊNCIA VISUAL MESTRE (v0.0.463): Fundo off-white, cards brancos, bordas cinza sutis, gráfico Recharts claro com grid suave, tabelas e tabs padronizadas.',
  },
  {
    path: '/regulamento',
    component: 'RegulationPage (Central de Regras FIA)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      '100% migrada para superfícies brancas com badges homologados FIA e pesquisa sem acentos.',
  },
  {
    path: '/calendario',
    component: 'CalendarPage (Calendário Oficial)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P1',
    complexity: 'BAIXA',
    notes:
      'Calendário 24 GPs e modais de planejamento Rookie TL1 totalmente em superfícies claras.',
  },
  {
    path: '*',
    component: 'NotFound (404)',
    isActive: true,
    isAccessible: true,
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    migrationNeeded: false,
    priority: 'P3',
    complexity: 'BAIXA',
    notes: 'Tela simples de erro 404 em superfície clara.',
  },
]

/**
 * Catálogo Canônico de Páginas (21 arquivos em src/pages)
 */
export const AUDITED_PAGES: PageAuditRecord[] = [
  {
    name: 'IndexPage',
    filePath: 'src/pages/Index.tsx',
    currentStyle: 'MIXED',
    classification: 'MIXED',
    sharedComponents: [
      'Topbar',
      'Sidebar',
      'Button',
      'CircuitTrackImage',
      'DriverPhotoAvatar',
      'CostCapProgress',
    ],
    dialogsOrOverlays: [],
    migrationComplexity: 'MEDIA',
    priority: 'P0',
    notes:
      'Hero da Equipe tem banner preto #0B0E14; miniatura de Notícias com fundo #0F172A. O resto da página já está sobre fundo #F4F5F7 com cards brancos.',
  },
  {
    name: 'AuthPage',
    filePath: 'src/pages/Auth.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Tabs', 'Input', 'Button'],
    dialogsOrOverlays: [],
    migrationComplexity: 'BAIXA',
    priority: 'P1',
    notes:
      'Migrado no LIGHT-UI-01B: card branco, background off-white, inputs claros e tipografia escura.',
  },
  {
    name: 'LobbyPage',
    filePath: 'src/pages/LobbyPage.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['LobbyLayout', 'WizardStepper', 'Card', 'Button', 'Badge', 'Input'],
    dialogsOrOverlays: ['ResetModal', 'SettingsModal', 'StepCustomGrid Dialog'],
    migrationComplexity: 'ALTA',
    priority: 'P1',
    notes:
      'Migrado no LIGHT-UI-01B: fluxo de onboarding completo com LobbyLayout claro e todos os steps claros.',
  },
  {
    name: 'TeamSelectionPage',
    filePath: 'src/pages/TeamSelection.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Tabs', 'Card', 'Badge', 'Button'],
    dialogsOrOverlays: ['ConfirmTeamDialog'],
    migrationComplexity: 'MEDIA',
    priority: 'P2',
    notes:
      'Migrado no LIGHT-UI-01B: seleção de equipe standalone com cards brancos e layout off-white.',
  },
  {
    name: 'TeamPage',
    filePath: 'src/pages/Team.tsx',
    currentStyle: 'MIXED',
    classification: 'MIXED',
    sharedComponents: [
      'TeamHeroBanner',
      'AboutTeamCard',
      'ManagerExecutiveCard',
      'DriverSummaryCard',
      'TechnicalStaffSummaryCard',
      'BoardObjectivesCard',
      'OrganizationHealthCard',
      'OrganizationalCapacityCard',
      'PendingDecisionsCard',
      'TeamCultureMoraleCard',
      'TeamBrandingCard',
      'TeamAcademySummaryCard',
      'PilotProfileDialog',
      'StaffContractDetailsModal',
      'DevelopmentManagerModal',
    ],
    dialogsOrOverlays: [
      'RenegotiateDialog (escuro #090D15)',
      'FireDriverDialog (escuro #090D15)',
      'DevelopmentManagerModal (escuro slate-950)',
      'ProspectDebugAuditModal (escuro zinc-950)',
      'StaffContractDetailsModal (escuro neutral-900)',
      'PilotProfileDialog (escuro zinc-950)',
    ],
    migrationComplexity: 'ALTA',
    priority: 'P0',
    notes:
      'A superfície externa da página é clara, mas TODOS os seus modais internos de decisão e perfil são pretos/escuros.',
  },
  {
    name: 'DriversPage',
    filePath: 'src/pages/DriversPage.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: [
      'DriverPoster',
      'DriverSidePanel',
      'DriverComparisonModal',
      'PilotProfileDialog',
      'DriverNegotiationModal',
      'SillySeasonBoard',
    ],
    dialogsOrOverlays: [
      'DriverSidePanel (overlay com elementos escuros)',
      'PilotProfileDialog (escuro zinc-950)',
      'DriverNegotiationModal (escuro #0B0E14)',
      'ContractSignDialog (claro)',
    ],
    migrationComplexity: 'MEDIA',
    priority: 'P1',
    notes:
      'Layout de página e cards limpos em light. O débito visual reside estritamente nos modais e painel lateral.',
  },
  {
    name: 'CarPage',
    filePath: 'src/pages/Car.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: [
      'GarageHero',
      'CompetitivenessCard',
      'StructuralIntegrityCard',
      'QuickActionsCard',
      'PerformanceRadarMap',
      'InstalledComponentsGrid',
      'CarPartsCatalog',
      'PowerUnitIntegrationPanel',
      'PowerUnitSystemsPanel',
      'TechnicalCorrelationPanel',
      'TechnicalDiagnosisPanel',
      'TechnicalFooterCards',
      'EngineSwapModal',
      'PartSwapModal',
      'EngineeringPlanModal',
      'QuickSwapCarSelectorModal',
    ],
    dialogsOrOverlays: [
      'EngineSwapModal (claro)',
      'PartSwapModal (claro)',
      'EngineeringPlanModal (claro)',
      'QuickSwapCarSelectorModal (claro)',
    ],
    migrationComplexity: 'BAIXA',
    priority: 'P0',
    notes:
      'Página padrão de referência moderna. Praticamente 100% aderente ao padrão visual light.',
  },
  {
    name: 'InfrastructurePage',
    filePath: 'src/pages/InfrastructurePage.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Tabs', 'Card', 'Badge', 'Button', 'PowerUnitIntegrationPanel'],
    dialogsOrOverlays: ['FacilityExpandModal (claro)'],
    migrationComplexity: 'BAIXA',
    priority: 'P1',
    notes:
      'Estrutura em cards brancos, métricas e abas claras. Apenas contêineres de fotos usam bg-neutral-900.',
  },
  {
    name: 'SponsorsPage',
    filePath: 'src/pages/Sponsors.tsx',
    currentStyle: 'MIXED',
    classification: 'MIXED',
    sharedComponents: [
      'TabCurrentSponsors',
      'TabMarketOpportunities',
      'TabNegotiationDesk',
      'TabFinancesCostCap',
      'CarSponsorMap',
      'CarSideViewHotspots',
      'NegotiationModal',
    ],
    dialogsOrOverlays: ['NegotiationModal (escuro #0B0E14)', 'PowerUnitNegotiationModal (claro)'],
    migrationComplexity: 'MEDIA',
    priority: 'P1',
    notes:
      'Container principal e abas claras, porém componentes internos de patrocinadores e mapas de carro usam #0B0E14.',
  },
  {
    name: 'TracksPage',
    filePath: 'src/pages/TracksPage.tsx',
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    sharedComponents: ['CircuitBlueprint', 'CircuitTrackImage', 'Badge', 'Button', 'Input'],
    dialogsOrOverlays: [],
    migrationComplexity: 'MEDIA',
    priority: 'P2',
    notes:
      '100% construída com superfícies escuras (#0B0E14, #11161F, borda #1F2733). Precisa de migração completa.',
  },
  {
    name: 'TeamsPage',
    filePath: 'src/pages/Teams.tsx',
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    sharedComponents: ['Card', 'Badge', 'Button', 'Input'],
    dialogsOrOverlays: ['TeamDetailsDialog (escuro #11161F)'],
    migrationComplexity: 'MEDIA',
    priority: 'P2',
    notes: 'Página inteiramente escura com dialog escuro.',
  },
  {
    name: 'PaddockPage',
    filePath: 'src/pages/PaddockPage.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Tabs', 'Card', 'Badge', 'Button', 'Input'],
    dialogsOrOverlays: [],
    migrationComplexity: 'BAIXA',
    priority: 'P1',
    notes: 'Estrutura clara e moderna.',
  },
  {
    name: 'CalendarPage',
    filePath: 'src/pages/CalendarPage.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Card', 'Badge', 'Button', 'Dialog'],
    dialogsOrOverlays: ['RookieTl1PlanningDialog (claro)', 'SprintDetailsDialog (claro)'],
    migrationComplexity: 'BAIXA',
    priority: 'P1',
    notes: 'Homologada e 100% clara, com dialogs já em superfícies brancas.',
  },
  {
    name: 'HistoryPage',
    filePath: 'src/pages/History.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['LineChart (Recharts)', 'RaceReportModal', 'Badge', 'Button', 'EmptyState'],
    dialogsOrOverlays: ['RaceReportModal (escuro #0B0E14)'],
    migrationComplexity: 'BAIXA',
    priority: 'P0',
    notes:
      'BENCHMARK MESTRE DA IDENTIDADE VISUAL. Exceto pelo RaceReportModal interno que ainda tem casca escura.',
  },
  {
    name: 'RegulationPage',
    filePath: 'src/pages/RegulationPage.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Card', 'Badge', 'Button', 'Input'],
    dialogsOrOverlays: ['RegulationDetailsModal (escuro #0B0F19)'],
    migrationComplexity: 'BAIXA',
    priority: 'P1',
    notes: 'Página principal 100% clara; apenas o modal detalhado de regra usa #0B0F19.',
  },
  {
    name: 'StandingsPage',
    filePath: 'src/pages/Standings.tsx',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    sharedComponents: ['Tabs', 'Table', 'Badge', 'Button'],
    dialogsOrOverlays: [],
    migrationComplexity: 'BAIXA',
    priority: 'P1',
    notes: 'Página padrão clara com tabelas brancas e zebrados suaves.',
  },
  {
    name: 'WeekendV2Page',
    filePath: 'src/pages/WeekendV2Page.tsx',
    currentStyle: 'MIXED',
    classification: 'MIXED',
    sharedComponents: [
      'WeekendHeader',
      'RaceWeekendPipelineBar',
      'PracticePreparationView',
      'PracticeLiveSessionView',
      'CanonicalRaceInitializationPanel',
      'PreRaceStrategyPreparationPanel',
      'QualifyingCarCockpitCard',
      'CompleteQualifyingGridSummary',
      'OfficialRaceResultPanel',
      'PodiumVisualCard',
    ],
    dialogsOrOverlays: [
      'CarSetupModal (escuro #090D15)',
      'SimulateWeekendModal (escuro #090D15)',
      'WeekendSummaryModal (escuro #090D15)',
      'DecisionModals (escuro #090D15)',
      'PitWallRadioDialog (claro/misto)',
    ],
    migrationComplexity: 'ALTA',
    priority: 'P0',
    notes:
      'Página central de corrida. Vários painéis já são brancos, mas os modais de estratégia e simulação permanecem no estilo gaming escuro.',
  },
  {
    name: 'LiveRacePage',
    filePath: 'src/pages/LiveRacePage.tsx',
    currentStyle: 'MIXED',
    classification: 'TECHNICAL_DARK_ALLOWED',
    sharedComponents: [
      'LiveRaceHUD',
      'LiveStandingsTable',
      'LiveTelemetryTable',
      'DriverLiveOperationsPanel',
      'LiveRaceFeed',
      'PitWallRadioDialog',
      'RaceResultsTable',
    ],
    dialogsOrOverlays: ['DecisionModals (escuro #090D15)', 'PitWallRadioDialog (claro/misto)'],
    migrationComplexity: 'MEDIA',
    priority: 'P0',
    notes:
      'Container e cards de suporte são brancos. O painel central de telemetria é TECHNICAL_DARK_ALLOWED por requisito.',
  },
  {
    name: 'SeasonEndPage',
    filePath: 'src/pages/SeasonEndPage.tsx',
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    sharedComponents: ['Card', 'Badge', 'Button'],
    dialogsOrOverlays: [],
    migrationComplexity: 'MEDIA',
    priority: 'P2',
    notes: '100% escura (#090D15/#11161F). Precisa de migração para estilo executivo de premiação.',
  },
  {
    name: 'RaceSlimWrapper',
    filePath: 'src/pages/RaceSlimWrapper.tsx',
    currentStyle: 'LEGACY_DEAD',
    classification: 'DEAD_LEGACY',
    sharedComponents: ['RaceSlim'],
    dialogsOrOverlays: [],
    migrationComplexity: 'BAIXA',
    priority: 'P3',
    notes:
      'Página wrapper legada desconectada da sidebar e redirecionada em /race para /corrida. Marcada para exclusão definitiva na REMOVE-02.',
  },
  {
    name: 'RaceSlim',
    filePath: 'src/pages/RaceSlim.tsx',
    currentStyle: 'LEGACY_DEAD',
    classification: 'DEAD_LEGACY',
    sharedComponents: [],
    dialogsOrOverlays: [],
    migrationComplexity: 'BAIXA',
    priority: 'P3',
    notes:
      'Componente legado monolítico de corrida (3.386 linhas), substituído pelo WeekendV2Page. Marcado para exclusão.',
  },
]

/**
 * Catálogo dos High-Leverage Shared Components
 * Componentes que, uma vez migrados para light, clareiam dezenas de telas automaticamente.
 */
export const HIGH_LEVERAGE_COMPONENTS: ComponentAuditRecord[] = [
  {
    name: 'StatCard',
    filePath: 'src/components/StatCard.tsx',
    type: 'SHARED_PRIMITIVE',
    currentStyle: 'DARK',
    classification: 'NEEDS_TOKEN_MIGRATION',
    priority: 'P0',
    complexity: 'BAIXA',
    affectedRoutes: ['/', '/team', '/car', '/infraestrutura', '/sponsors', '/historico'],
    notes:
      'Possui bg-[#11161F] e border-[#1F2733] hardcoded. Migrando para bg-white e border-[#E2E8F0] com texto #0F172A, moderniza automaticamente múltiplos painéis.',
  },
  {
    name: 'DataTable',
    filePath: 'src/components/DataTable.tsx',
    type: 'SHARED_PRIMITIVE',
    currentStyle: 'DARK',
    classification: 'NEEDS_TOKEN_MIGRATION',
    priority: 'P0',
    complexity: 'BAIXA',
    affectedRoutes: ['/standings', '/historico', '/teams', '/pistas', '/corrida'],
    notes:
      'Tabela genérica padronizada usando thead #0E131B, bg-[#11161F] e hover-[#161D29]. Migrar para thead bg-[#F8FAFC], linhas brancas e hover bg-[#F1F5F9].',
  },
  {
    name: 'EmptyState',
    filePath: 'src/components/EmptyState.tsx',
    type: 'SHARED_PRIMITIVE',
    currentStyle: 'DARK',
    classification: 'NEEDS_TOKEN_MIGRATION',
    priority: 'P0',
    complexity: 'BAIXA',
    affectedRoutes: ['/', '/pilotos', '/historico', '/corrida', '/sponsors'],
    notes:
      'Usa bg-[#11161F]/60 e ícone bg-[#161D29]. Migrar para bg-[#F8FAFC] com ícone bg-white e borda suave #E2E8F0.',
  },
  {
    name: 'PageHeader',
    filePath: 'src/components/PageHeader.tsx',
    type: 'SHARED_PRIMITIVE',
    currentStyle: 'DARK',
    classification: 'NEEDS_TOKEN_MIGRATION',
    priority: 'P0',
    complexity: 'BAIXA',
    affectedRoutes: ['/car', '/team', '/infraestrutura', '/corrida'],
    notes:
      'Borda border-[#1F2733] e text-[#F5F7FA]. Migrar para border-[#E2E8F0] e text-[#0F172A].',
  },
  {
    name: 'ProgressBar',
    filePath: 'src/components/ProgressBar.tsx',
    type: 'SHARED_PRIMITIVE',
    currentStyle: 'DARK',
    classification: 'NEEDS_TOKEN_MIGRATION',
    priority: 'P1',
    complexity: 'BAIXA',
    affectedRoutes: ['/team', '/car', '/infraestrutura'],
    notes:
      'Fundo da barra usa bg-[#1F2733] escuro. Migrar para fundo bg-[#E2E8F0] ou bg-neutral-200.',
  },
  {
    name: 'NotificationBell',
    filePath: 'src/components/NotificationBell.tsx',
    type: 'PAGE_SECTION',
    currentStyle: 'DARK',
    classification: 'NEEDS_TOKEN_MIGRATION',
    priority: 'P0',
    complexity: 'BAIXA',
    affectedRoutes: ['GLOBAL_TOPBAR (todas as rotas da carreira)'],
    notes:
      'O drawer/dropdown de notificações no Topbar é 100% escuro (bg-[#0B0E14], border-[#1F2733]). Deve ser convertido para fundo branco com bordas #E2E8F0.',
  },
  {
    name: 'PilotProfileDialog',
    filePath: 'src/components/PilotProfileDialog.tsx',
    type: 'MODAL_OVERLAY',
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    priority: 'P0',
    complexity: 'MEDIA',
    affectedRoutes: ['/pilotos', '/team', '/paddock', '/corrida'],
    notes:
      'Modal de ficha completa mais utilizado no jogo (1.292 linhas). Totalmente em bg-zinc-950 e border-zinc-800. Migrar para superfícies brancas com tipografia grafite.',
  },
  {
    name: 'DriverSidePanel',
    filePath: 'src/components/DriverSidePanel.tsx',
    type: 'MODAL_OVERLAY',
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    priority: 'P1',
    complexity: 'BAIXA',
    affectedRoutes: ['/pilotos'],
    notes:
      'Container de avatar com bg-slate-950 e badge bg-slate-900. Ajustar para superfícies limpas e bordas claras.',
  },
  {
    name: 'SettingsModal',
    filePath: 'src/components/SettingsModal.tsx',
    type: 'MODAL_OVERLAY',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    priority: 'P1',
    complexity: 'BAIXA',
    affectedRoutes: ['GLOBAL_SIDEBAR', 'GLOBAL_TOPBAR', '/lobby'],
    notes:
      'Migrado no LIGHT-UI-01B: modal branco, abas claras, tipografia escura e acentos consistentes.',
  },
  {
    name: 'LobbyLayout',
    filePath: 'src/components/LobbyLayout.tsx',
    type: 'PAGE_SECTION',
    currentStyle: 'LIGHT',
    classification: 'LIGHT_OK',
    priority: 'P1',
    complexity: 'MEDIA',
    affectedRoutes: ['/lobby', '/selecionar-equipe'],
    notes:
      'Migrado no LIGHT-UI-01B: fundo #F8FAFC off-white, header branco com sombra leve e footer claro.',
  },
  {
    name: 'DecisionModals',
    filePath: 'src/components/race/DecisionModals.tsx',
    type: 'MODAL_OVERLAY',
    currentStyle: 'DARK',
    classification: 'DARK_LEGACY',
    priority: 'P0',
    complexity: 'MEDIA',
    affectedRoutes: ['/corrida', '/corrida-ao-vivo', '/weekend-v2'],
    notes:
      'Contém 4 modais cruciais de corrida (Safety Car, Chuva, Pneu Furado, Disputa Agressiva) em bg-[#090D15]/95. Devem ser convertidos para dialogs claros com acentos semânticos coloridos.',
  },
]

/**
 * Lista explícita de TODAS as telas ainda escuras completas ou com blocos legados
 */
export const DARK_SCREENS_EXPLICT_LIST: string[] = [
  'TracksPage (/pistas e /pistas/:circuitId) — 100% escura',
  'TeamsPage (/teams) — 100% escura',
  'SeasonEndPage (/season-end) — 100% escura',
  'IndexPage (/) — Bloco Hero Equipe (#0B0E14) e Miniaturas Notícias Paddock (#0F172A)',
  'SponsorsPage (/sponsors) — Abas TabCurrentSponsors, CarSponsorMap, CarSideViewHotspots (#0B0E14)',
  'TeamPage (/team) — Modais de renegociação/rescisão (#090D15) e StaffContractDetailsModal (neutral-900)',
  'WeekendV2Page (/corrida) — Modais de Setup, Simulação Restante e Resumo (#090D15)',
]

/**
 * Quick Wins mapeados: Alto impacto / Baixo risco
 */
export const QUICK_WINS: QuickWinItem[] = [
  {
    id: 'QW-01',
    title: 'Tokens de CSS Base em src/main.css',
    targetFiles: ['src/main.css'],
    impact:
      'Altera :root para variáveis padrão claras (--background: 210 20% 98%, --card: 0 0% 100%, --foreground: 222 47% 11%), eliminando o body #0B0E14 e scrollbar preta.',
    risk: 'BAIXO',
    estimatedLines: 35,
    description:
      'Muda a fundação de tokens sem quebrar nenhuma página e sem introduzir dependências novas.',
  },
  {
    id: 'QW-02',
    title: 'Migração dos 4 Primitivos de UI Compartilhados',
    targetFiles: [
      'src/components/StatCard.tsx',
      'src/components/DataTable.tsx',
      'src/components/EmptyState.tsx',
      'src/components/PageHeader.tsx',
    ],
    impact:
      'Clareia imediatamente tabelas, cabeçalhos de página e cards de métricas em mais de 10 telas.',
    risk: 'MUITO_BAIXO',
    estimatedLines: 60,
    description:
      'Substituição pontual dos tokens bg-[#11161F] por bg-white e border-[#1F2733] por border-[#E2E8F0].',
  },
  {
    id: 'QW-03',
    title: 'Drawer do Sino de Notificações',
    targetFiles: ['src/components/NotificationBell.tsx'],
    impact:
      'Converte o dropdown de notificações da barra superior fixa (visível em todas as telas) de preto #0B0E14 para branco elegante.',
    risk: 'MUITO_BAIXO',
    estimatedLines: 25,
    description:
      'Ajuste das classes de fundo do menu flutuante e dos itens lidos/não-lidos para padrão card branco.',
  },
  {
    id: 'QW-04',
    title: 'Hero da Equipe no Index (Dashboard)',
    targetFiles: ['src/pages/Index.tsx'],
    impact:
      'Elimina o maior bloco escuro na página inicial ("/") tornando a Central 100% clara e harmoniosa.',
    risk: 'BAIXO',
    estimatedLines: 30,
    description:
      'Transição do Hero da Equipe para um cartão moderno com fundo branco/off-white e badge vermelho APEX.',
  },
  {
    id: 'QW-05',
    title: 'AuthPage (Login / Registro)',
    targetFiles: ['src/pages/Auth.tsx'],
    impact:
      'Primeira impressão do usuário: transforma tela preta de login em card executivo branco moderno.',
    risk: 'BAIXO',
    estimatedLines: 40,
    description:
      'Fundo da página #F4F5F7, card central branco, inputs claros com borda suave e botão vermelho APEX.',
  },
]

/**
 * Ordem de Migração Recomendada em Blocos Estruturados
 */
export const RECOMMENDED_MIGRATION_PLAN: MigrationPhasePlan[] = [
  {
    phaseId: 'LIGHT-UI-01B',
    title: 'App Shell + Fundação de Tokens + Primitivos Compartilhados',
    scope: [
      'src/main.css (:root light tokens)',
      'src/components/StatCard.tsx',
      'src/components/DataTable.tsx',
      'src/components/EmptyState.tsx',
      'src/components/PageHeader.tsx',
      'src/components/ProgressBar.tsx',
      'src/components/NotificationBell.tsx',
      'src/components/SettingsModal.tsx',
      'src/pages/Auth.tsx',
    ],
    deliverable:
      'Fundação visual clara, tokens canônicos globais ativos, componentes compartilhados claros e tela de login modernizada.',
    dependencies: ['LIGHT-UI-01A (esta auditoria homologada)'],
  },
  {
    phaseId: 'LIGHT-UI-01C',
    title: 'Gestão: Central, Equipe e Comercial',
    scope: [
      'src/pages/Index.tsx (Hero equipe + notícias)',
      'src/pages/Team.tsx (Modais de renegociação e rescisão)',
      'src/components/commercial/TabCurrentSponsors.tsx',
      'src/components/commercial/CarSponsorMap.tsx',
      'src/components/commercial/CarSideViewHotspots.tsx',
      'src/components/commercial/NegotiationModal.tsx',
      'src/components/commercial/TabNegotiationDesk.tsx',
    ],
    deliverable:
      'Área de Gestão 100% clara, com patrocinadores, negociações e mesa de decisões sem nenhum resíduo escuro legado.',
    dependencies: ['LIGHT-UI-01B'],
  },
  {
    phaseId: 'LIGHT-UI-01D',
    title: 'Competição: Pistas, Grid de Equipes e Fim de Temporada',
    scope: [
      'src/pages/TracksPage.tsx',
      'src/pages/Teams.tsx',
      'src/pages/SeasonEndPage.tsx',
      'src/components/CircuitBlueprint.tsx',
    ],
    deliverable:
      'Pistas e Grid das 11 equipes totalmente migrados para superfícies brancas com gráficos e traçados de circuitos limpos.',
    dependencies: ['LIGHT-UI-01B'],
  },
  {
    phaseId: 'LIGHT-UI-01E',
    title: 'Lobby & Onboarding: Wizard de Nova Carreira',
    scope: [
      'src/components/LobbyLayout.tsx',
      'src/pages/LobbyPage.tsx',
      'src/components/lobby/WizardStepper.tsx',
      'src/components/lobby/StepStart.tsx',
      'src/components/lobby/StepManager.tsx',
      'src/components/lobby/StepUniverse.tsx',
      'src/components/lobby/StepOfficialTeamSelection.tsx',
      'src/components/lobby/StepCustomGrid.tsx',
      'src/components/lobby/StepCareerSettings.tsx',
      'src/components/lobby/StepReview.tsx',
      'src/pages/TeamSelection.tsx',
    ],
    deliverable:
      'Todo o ambiente inicial de criação de carreira alinhado à direção visual clara executiva da APEX GP.',
    dependencies: ['LIGHT-UI-01B'],
  },
  {
    phaseId: 'LIGHT-UI-01F',
    title: 'Modais & Overlays Profundos: Pilotos e Decisões de Corrida',
    scope: [
      'src/components/PilotProfileDialog.tsx',
      'src/components/DriverSidePanel.tsx',
      'src/components/DevelopmentManagerModal.tsx',
      'src/components/team/StaffContractDetailsModal.tsx',
      'src/components/race/DecisionModals.tsx',
      'src/components/race/CarSetupModal.tsx',
      'src/components/race/SimulateWeekendModal.tsx',
      'src/components/race/WeekendSummaryModal.tsx',
      'src/components/race/RaceReportModal.tsx',
      'src/components/commercial/DriverNegotiationModal.tsx',
    ],
    deliverable:
      'Erradicação completa de todos os overlays e modais escuros legados remanescentes.',
    dependencies: ['LIGHT-UI-01C', 'LIGHT-UI-01D'],
  },
]

/**
 * Função canônica de auditoria programática do sistema visual
 */
export function auditLightUiIdentity(): LightUiAuditResult {
  const countsByClassification: Record<UiVisualClassification, number> = {
    LIGHT_OK: 0,
    DARK_LEGACY: 0,
    MIXED: 0,
    NEEDS_TOKEN_MIGRATION: 0,
    TECHNICAL_DARK_ALLOWED: 0,
    DEAD_LEGACY: 0,
  }

  // Contabilizar rotas e páginas
  AUDITED_ROUTES.forEach((r) => {
    countsByClassification[r.classification]++
  })

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    benchmarkPage: 'src/pages/History.tsx (v0.0.463)',
    summary: {
      totalRoutes: AUDITED_ROUTES.length,
      totalPages: AUDITED_PAGES.length,
      totalComponentsAudit:
        AUDITED_PAGES.flatMap((p) => p.sharedComponents).length + HIGH_LEVERAGE_COMPONENTS.length,
      countsByClassification,
      darkScreensRemainingCount: DARK_SCREENS_EXPLICT_LIST.length,
      highLeverageComponentsCount: HIGH_LEVERAGE_COMPONENTS.length,
    },
    routes: AUDITED_ROUTES,
    pages: AUDITED_PAGES,
    components: HIGH_LEVERAGE_COMPONENTS,
    darkScreensList: DARK_SCREENS_EXPLICT_LIST,
    highLeverageSharedComponents: HIGH_LEVERAGE_COMPONENTS,
    quickWins: QUICK_WINS,
    migrationPhases: RECOMMENDED_MIGRATION_PLAN,
  }
}
