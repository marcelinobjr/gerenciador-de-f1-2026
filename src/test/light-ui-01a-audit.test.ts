import { describe, it, expect } from 'vitest'
import {
  auditLightUiIdentity,
  AUDITED_ROUTES,
  AUDITED_PAGES,
  HIGH_LEVERAGE_COMPONENTS,
  DARK_SCREENS_EXPLICT_LIST,
  QUICK_WINS,
  RECOMMENDED_MIGRATION_PLAN,
} from '@/services/lightUiAudit'

describe('LIGHT-UI-01A — Auditoria Global de Identidade Visual', () => {
  it('LUI01A-01: auditLightUiIdentity() executa e retorna estrutura válida de auditoria', () => {
    const audit = auditLightUiIdentity()
    expect(audit).toBeDefined()
    expect(audit.version).toBe('1.0.0')
    expect(audit.benchmarkPage).toContain('History.tsx')
    expect(audit.summary.totalRoutes).toBe(23)
    expect(audit.summary.totalPages).toBe(21)
  })

  it('LUI01A-02: Todas as 23 rotas do React Router estão mapeadas e classificadas', () => {
    expect(AUDITED_ROUTES.length).toBe(23)
    const paths = AUDITED_ROUTES.map((r) => r.path)

    // Rotas obrigatórias
    expect(paths).toContain('/')
    expect(paths).toContain('/auth')
    expect(paths).toContain('/lobby')
    expect(paths).toContain('/selecionar-equipe')
    expect(paths).toContain('/team')
    expect(paths).toContain('/pilotos')
    expect(paths).toContain('/car')
    expect(paths).toContain('/infraestrutura')
    expect(paths).toContain('/sponsors')
    expect(paths).toContain('/corrida')
    expect(paths).toContain('/corrida-ao-vivo')
    expect(paths).toContain('/standings')
    expect(paths).toContain('/paddock')
    expect(paths).toContain('/historico')
    expect(paths).toContain('/regulamento')
    expect(paths).toContain('/calendario')
    expect(paths).toContain('/race')
    expect(paths).toContain('*')

    // Todas devem ter prioridade, classificação e complexidade
    AUDITED_ROUTES.forEach((r) => {
      expect([
        'LIGHT_OK',
        'DARK_LEGACY',
        'MIXED',
        'NEEDS_TOKEN_MIGRATION',
        'TECHNICAL_DARK_ALLOWED',
        'DEAD_LEGACY',
      ]).toContain(r.classification)
      expect(['P0', 'P1', 'P2', 'P3']).toContain(r.priority)
      expect(['BAIXA', 'MEDIA', 'ALTA']).toContain(r.complexity)
    })
  })

  it('LUI01A-03: Mapeamento de páginas cobre todos os 21 arquivos em src/pages', () => {
    expect(AUDITED_PAGES.length).toBe(21)
    const pageFiles = AUDITED_PAGES.map((p) => p.filePath)

    expect(pageFiles).toContain('src/pages/Index.tsx')
    expect(pageFiles).toContain('src/pages/Auth.tsx')
    expect(pageFiles).toContain('src/pages/LobbyPage.tsx')
    expect(pageFiles).toContain('src/pages/Team.tsx')
    expect(pageFiles).toContain('src/pages/DriversPage.tsx')
    expect(pageFiles).toContain('src/pages/Car.tsx')
    expect(pageFiles).toContain('src/pages/InfrastructurePage.tsx')
    expect(pageFiles).toContain('src/pages/Sponsors.tsx')
    expect(pageFiles).toContain('src/pages/History.tsx')
    expect(pageFiles).toContain('src/pages/WeekendV2Page.tsx')
    expect(pageFiles).toContain('src/pages/LiveRacePage.tsx')

    // Histórico é LIGHT_OK como referência
    const historyPage = AUDITED_PAGES.find((p) => p.name === 'HistoryPage')
    expect(historyPage?.classification).toBe('LIGHT_OK')

    // Páginas legadas mortas
    const raceSlim = AUDITED_PAGES.find((p) => p.name === 'RaceSlim')
    expect(raceSlim?.classification).toBe('DEAD_LEGACY')
  })

  it('LUI01A-04: Componentes de alto impacto (high-leverage) estão mapeados com rotas afetadas', () => {
    expect(HIGH_LEVERAGE_COMPONENTS.length).toBeGreaterThanOrEqual(10)

    const componentNames = HIGH_LEVERAGE_COMPONENTS.map((c) => c.name)
    expect(componentNames).toContain('StatCard')
    expect(componentNames).toContain('DataTable')
    expect(componentNames).toContain('EmptyState')
    expect(componentNames).toContain('PageHeader')
    expect(componentNames).toContain('NotificationBell')
    expect(componentNames).toContain('PilotProfileDialog')
    expect(componentNames).toContain('DecisionModals')

    HIGH_LEVERAGE_COMPONENTS.forEach((c) => {
      expect(c.affectedRoutes.length).toBeGreaterThan(0)
    })
  })

  it('LUI01A-05: Lista explícita de telas escuras remanescentes contém os alvos corretos pós LUI-01B', () => {
    expect(DARK_SCREENS_EXPLICT_LIST.length).toBe(7)
    const combined = DARK_SCREENS_EXPLICT_LIST.join(' ')

    expect(combined).not.toContain('/auth')
    expect(combined).not.toContain('/lobby')
    expect(combined).toContain('/pistas')
    expect(combined).toContain('/teams')
    expect(combined).toContain('/season-end')
  })

  it('LUI01A-06: Quick Wins e Plano de Migração em Fases estão definidos', () => {
    expect(QUICK_WINS.length).toBe(5)
    expect(QUICK_WINS.map((q) => q.id)).toEqual(['QW-01', 'QW-02', 'QW-03', 'QW-04', 'QW-05'])

    expect(RECOMMENDED_MIGRATION_PLAN.length).toBe(5)
    const phaseIds = RECOMMENDED_MIGRATION_PLAN.map((p) => p.phaseId)
    expect(phaseIds).toEqual([
      'LIGHT-UI-01B',
      'LIGHT-UI-01C',
      'LIGHT-UI-01D',
      'LIGHT-UI-01E',
      'LIGHT-UI-01F',
    ])
  })
})
