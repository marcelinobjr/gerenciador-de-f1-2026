/**
 * legacyWeekendAudit.ts
 *
 * Serviço de auditoria estática e mapeamento das dependências da antiga aba "Fim de Semana" (/race).
 * Fornece a classificação rigorosa de rotas, componentes, navegações ativas,
 * serviços compartilhados intocáveis, dead code candidates e testes vinculados à UI legada.
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
  testsDependingOnLegacyUI: Array<{
    testFile: string
    reason: string
    actionTaken: string
  }>
  safeToRemoveFiles: string[]
  migrationRequiredFiles: string[]
}

export function auditLegacyWeekendDependencies(): LegacyWeekendAuditReport {
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
    sharedDomainDependencies: [
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
    ],
    legacyOnlyDependencies: [
      {
        name: 'RaceSlimWrapper',
        file: 'src/pages/RaceSlimWrapper.tsx',
        purpose: 'Antigo orquestrador wrapper da tela legada de fim de semana',
        status: 'dead_candidate',
      },
      {
        name: 'RaceSlim',
        file: 'src/pages/RaceSlim.tsx',
        purpose: 'Antiga tela monolítica de fim de semana de corrida',
        status: 'dead_candidate',
      },
      {
        name: 'demandingTrack',
        file: 'src/pages/race/demandingTrack.ts',
        purpose: 'Funções auxiliares antigas de avaliação de circuito de alta demanda',
        status: 'dead_candidate',
      },
      {
        name: 'raceNarratedEvents',
        file: 'src/pages/race/raceNarratedEvents.ts',
        purpose: 'Gerador antigo de narração textual descontinuado',
        status: 'dead_candidate',
      },
    ],
    deadCodeCandidates: [
      'src/pages/RaceSlimWrapper.tsx',
      'src/pages/RaceSlim.tsx',
      'src/pages/race/demandingTrack.ts',
      'src/pages/race/raceAdvance.ts',
      'src/pages/race/raceNarratedEvents.ts',
    ],
    testsDependingOnLegacyUI: [
      {
        testFile: 'src/test/bug-07b-race-callers.test.ts',
        reason:
          'Faz análise estática do arquivo RaceSlim.tsx para assegurar que ele não tem geradores paralelos',
        actionTaken:
          'Preservado integralmente; RaceSlim.tsx mantido no disco sem remoção física nesta fase',
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
      // Nenhum arquivo deletado nesta fase LEGACY-WEEKEND-AUDIT-01 conforme REGRA PRINCIPAL
    ],
    migrationRequiredFiles: [
      'src/App.tsx',
      'src/components/Sidebar.tsx',
      'src/components/Layout.tsx',
      'src/components/NotificationBell.tsx',
      'src/pages/Index.tsx',
      'src/pages/SeasonEndPage.tsx',
      'src/pages/LiveRacePage.tsx',
      'src/pages/WeekendV2Page.tsx',
      'src/pages/race/raceAdvance.ts',
    ],
  }
}
