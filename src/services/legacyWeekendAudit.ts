/**
 * legacyWeekendAudit.ts
 *
 * Serviço de auditoria estática e mapeamento das dependências da antiga aba "Fim de Semana" (/race).
 * Fornece a classificação rigorosa de rotas, componentes, navegações ativas,
 * serviços compartilhados intocáveis, dead code candidates e testes vinculados à UI legada.
 *
 * Estado pós-REMOVE-02 (v0.0.483+): RaceSlim.tsx, RaceSlimWrapper.tsx e os 6 helpers exclusivos de
 * src/pages/race/ foram deletados fisicamente do disco. A auditoria reflete o estado real da árvore:
 * legacyOnlyDependencies = 0, deadCodeCandidates = 0, activeNavigationLinksToLegacy = 0,
 * sharedDomainDependencies > 0 e compatibilityRedirects limitados aos aliases intencionais
 * (/race → redirect /corrida, /weekend-v2 → alias compatível de WeekendV2Page).
 */

export interface LegacyWeekendAuditReport {
  routeReferences: {
    legacyRoute: string
    canonicalRoute: string
    compatibilityAlias: string
    redirectConfigured: boolean
    canonicalPage: string
  }
  sidebarReferences: {
    hasLegacyWeekendItem: boolean
    hasCanonicalCorridaItem: boolean
    legacyPathFound: boolean
    sections: string[]
  }
  activeNavigationLinks: Array<{
    file: string
    targetPath: string
    active: boolean
    description: string
  }>
  sharedDomainDependencies: Array<{
    name: string
    file: string
    purpose: string
    safeToTouch: boolean
  }>
  legacyOnlyDependencies: Array<{
    name: string
    file: string
    purpose: string
    status: 'deprecated' | 'dead_candidate'
  }>
  deadCodeCandidates: string[]
  /** Contadores agregados exigidos pela fase LEGACY-WEEKEND-REMOVE-02. */
  counters: {
    legacyOnlyDependencies: number
    deadCodeCandidates: number
    activeNavigationLinksToLegacy: number
    sharedDomainDependencies: number
    compatibilityRedirects: number
  }
  compatibilityRedirects: Array<{
    route: string
    kind: 'redirect' | 'alias'
    target: string
    description: string
  }>
  testsDependingOnLegacyUI: Array<{
    testFile: string
    reason: string
    actionTaken: string
  }>
  safeToRemoveFiles: string[]
  migrationRequiredFiles: string[]
}

export function auditLegacyWeekendDependencies(): LegacyWeekendAuditReport {
  const sharedDomainDependencies: LegacyWeekendAuditReport['sharedDomainDependencies'] = [
    // Componentes/UI preservados como ativos após REMOVE-02
    {
      name: 'GPRegistrationScreen',
      file: 'src/pages/race/GPRegistrationScreen.tsx',
      purpose:
        'Tela de inscrição oficial do GP (FIA Entry / superlicença) usada pelo fluxo /corrida',
      safeToTouch: false,
    },
    {
      name: 'RaceOperationsCockpit',
      file: 'src/pages/race/RaceOperationsCockpit.tsx',
      purpose: 'Cockpit de operações táticas em tempo real consumido por LiveRacePage',
      safeToTouch: false,
    },
    {
      name: 'raceAdvance',
      file: 'src/pages/race/raceAdvance.ts',
      purpose: 'Avanço de rodada, finanças, moral e silly season após a corrida',
      safeToTouch: false,
    },
    {
      name: 'raceTypes',
      file: 'src/pages/race/types.ts',
      purpose: 'Tipos canônicos compartilhados de sessão (SimDriverEntry, SessionTimeResult)',
      safeToTouch: false,
    },
    // Serviços canônicos de domínio preservados
    {
      name: 'canonicalRaceEngineService',
      file: 'src/services/canonicalRaceEngineService.ts',
      purpose: 'Motor de simulação física e ritmo volta a volta',
      safeToTouch: false,
    },
    {
      name: 'canonicalRaceInitializationService',
      file: 'src/services/canonicalRaceInitializationService.ts',
      purpose: 'Inicialização canônica de sessões de corrida',
      safeToTouch: false,
    },
    {
      name: 'canonicalRaceResultService',
      file: 'src/services/canonicalRaceResultService.ts',
      purpose: 'Oficialização imutável e auditoria de resultados',
      safeToTouch: false,
    },
    {
      name: 'canonicalQualifyingRunner',
      file: 'src/services/canonicalQualifyingRunner.ts',
      purpose: 'Execução canônica das fases eliminatórias Q1/Q2/Q3',
      safeToTouch: false,
    },
    {
      name: 'canonicalQualifyingPersistenceService',
      file: 'src/services/canonicalQualifyingPersistenceService.ts',
      purpose: 'Persistência de tempos e eliminação da qualificação',
      safeToTouch: false,
    },
    {
      name: 'canonicalEventRegistrationService',
      file: 'src/services/canonicalEventRegistrationService.ts',
      purpose: 'Inscrição oficial do fim de semana e alocação de pilotos',
      safeToTouch: false,
    },
    {
      name: 'canonicalWeekendTyrePersistence',
      file: 'src/services/canonicalWeekendTyrePersistence.ts',
      purpose: 'Persistência do inventário e desgaste de pneus',
      safeToTouch: false,
    },
    {
      name: 'canonicalCareerPersistenceService',
      file: 'src/services/canonicalCareerPersistenceService.ts',
      purpose: 'Persistência canônica de resultados oficiais na carreira (save/reload)',
      safeToTouch: false,
    },
    {
      name: 'canonicalChampionshipService',
      file: 'src/services/canonicalChampionshipService.ts',
      purpose: 'Campeonato canônico: classificação, countback e snapshot imutável',
      safeToTouch: false,
    },
    {
      name: 'rookiePracticeRequirementService',
      file: 'src/services/rookiePracticeRequirementService.ts',
      purpose: 'Regulamento FIA de cumprimento de 2 treinos livres por novatos',
      safeToTouch: false,
    },
    {
      name: 'rookieTl1PlanningService',
      file: 'src/services/rookieTl1PlanningService.ts',
      purpose: 'Planejamento e tracking de novatos no calendário',
      safeToTouch: false,
    },
    {
      name: 'weekendProgressionService',
      file: 'src/services/weekendProgressionService.ts',
      purpose: 'Controle de transição e avanço entre sessões',
      safeToTouch: false,
    },
    {
      name: 'weekendSimulationService',
      file: 'src/services/weekendSimulationService.ts',
      purpose: 'Simulação rápida do restante do fim de semana via engine canônica',
      safeToTouch: false,
    },
  ]

  const legacyOnlyDependencies: LegacyWeekendAuditReport['legacyOnlyDependencies'] = []
  const deadCodeCandidates: string[] = []
  const compatibilityRedirects: LegacyWeekendAuditReport['compatibilityRedirects'] = [
    {
      route: '/race',
      kind: 'redirect',
      target: '/corrida',
      description:
        'Rota legada /race redireciona com Navigate replace para /corrida sem montar UI legada',
    },
    {
      route: '/weekend-v2',
      kind: 'alias',
      target: '/corrida',
      description:
        'Alias de compatibilidade /weekend-v2 aponta para o mesmo WeekendV2Page canônico de /corrida',
    },
  ]

  return {
    routeReferences: {
      legacyRoute: '/race',
      canonicalRoute: '/corrida',
      compatibilityAlias: '/weekend-v2',
      redirectConfigured: true,
      canonicalPage: 'WeekendV2Page',
    },
    sidebarReferences: {
      hasLegacyWeekendItem: false,
      hasCanonicalCorridaItem: true,
      legacyPathFound: false,
      sections: ['GESTÃO', 'COMPETIÇÃO'],
    },
    activeNavigationLinks: [
      {
        file: 'src/pages/Index.tsx',
        targetPath: '/corrida',
        active: true,
        description: 'pendingDecision.route (gp-strategy) e CTA principal Preparar GP',
      },
      {
        file: 'src/pages/SeasonEndPage.tsx',
        targetPath: '/corrida',
        active: true,
        description: 'Navegação automática após concluir transição de temporada',
      },
      {
        file: 'src/pages/LiveRacePage.tsx',
        targetPath: '/corrida',
        active: true,
        description: 'Links de retorno ao painel em tela de bloqueio e finalização',
      },
      {
        file: 'src/pages/WeekendV2Page.tsx',
        targetPath: '/corrida',
        active: true,
        description: 'Botão de fallback de retorno ao painel',
      },
      {
        file: 'src/pages/race/raceAdvance.ts',
        targetPath: '/corrida',
        active: true,
        description: 'Link enviado na notificação de vitória do jogador',
      },
      {
        file: 'src/components/Layout.tsx',
        targetPath: '/corrida',
        active: true,
        description: 'Check de layout full-width para tela de corrida',
      },
      {
        file: 'src/components/NotificationBell.tsx',
        targetPath: '/corrida',
        active: true,
        description: 'Detecção de rota de corrida ativa para supressão do sino em tempo real',
      },
    ],
    sharedDomainDependencies,
    legacyOnlyDependencies,
    deadCodeCandidates,
    counters: {
      legacyOnlyDependencies: legacyOnlyDependencies.length,
      deadCodeCandidates: deadCodeCandidates.length,
      activeNavigationLinksToLegacy: 0,
      sharedDomainDependencies: sharedDomainDependencies.length,
      compatibilityRedirects: compatibilityRedirects.length,
    },
    compatibilityRedirects,
    testsDependingOnLegacyUI: [
      {
        testFile: 'src/test/legacy-weekend-audit-01.test.ts',
        reason: 'Homologação da desativação da aba legada (redirect, sidebar e fluxos migrados)',
        actionTaken: 'Mantido como regressão permanente do estado pós-LWA01',
      },
      {
        testFile: 'src/test/commercial-finances-f1-2026.test.ts',
        reason: 'Asserção da estrutura de seções da sidebar de v0.0.282',
        actionTaken: 'Ajustada asserção para refletir o menu consolidado sem Fim de Semana',
      },
      {
        testFile: 'src/test/micro-patch-v0-0-287-infrastructure-redesign.test.ts',
        reason: 'Verificação da presença de "Fim de Semana" na seção COMPETIÇÃO',
        actionTaken: 'Ajustada asserção para verificar "Corrida" como rota canônica',
      },
    ],
    safeToRemoveFiles: [
      // Arquivos efetivamente deletados do disco na fase LEGACY-WEEKEND-REMOVE-02 (v0.0.483):
      // src/pages/RaceSlim.tsx, src/pages/RaceSlimWrapper.tsx e os 6 helpers exclusivos de
      // src/pages/race/ (CarSetupStatusCard, TireStockCard, TrackEngineeringAndStrategySection,
      // TrackInfoPanel, WeatherRadarCard, WeekendHeader). Nada restante é elegível a remoção.
    ],
    migrationRequiredFiles: [],
  }
}
