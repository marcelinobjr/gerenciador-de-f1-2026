import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { CAREER_NAV_SECTIONS } from '@/components/Sidebar'
import { auditLegacyWeekendDependencies } from '@/services/legacyWeekendAudit'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { rookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'

describe('LEGACY-WEEKEND-AUDIT-01 — Auditoria e Desativação da Aba Fim de Semana', () => {
  // LWA01-01: Sidebar não exibe "Fim de Semana" (CAREER_NAV_SECTIONS sem o item '/race' ou nome "Fim de Semana")
  it('LWA01-01: Sidebar não exibe "Fim de Semana"', () => {
    const allItems = CAREER_NAV_SECTIONS.flatMap((s) => s.items)
    const legacyPath = allItems.find((i) => i.path === '/race')
    const legacyName = allItems.find(
      (i) => i.name.toLowerCase() === 'fim de semana' || i.name.includes('Fim de Semana'),
    )

    expect(legacyPath).toBeUndefined()
    expect(legacyName).toBeUndefined()
  })

  // LWA01-02: Corrida continua disponível ('/corrida' presente em COMPETIÇÃO)
  it('LWA01-02: Corrida continua disponível no menu COMPETIÇÃO', () => {
    const compSection = CAREER_NAV_SECTIONS.find((s) => s.title === 'COMPETIÇÃO')
    expect(compSection).toBeDefined()

    const corridaItem = compSection?.items.find((i) => i.path === '/corrida')
    expect(corridaItem).toBeDefined()
    expect(corridaItem?.name.toLowerCase()).toBe('corrida')
  })

  // LWA01-03: Acesso à rota legada redireciona para Corrida ('/race' mapeado para Navigate to '/corrida')
  it('LWA01-03: Acesso à rota legada redireciona para Corrida no App.tsx', () => {
    const appPath = resolve(process.cwd(), 'src/App.tsx')
    const appContent = readFileSync(appPath, 'utf-8')

    // Procura por rota /race com Navigate para /corrida
    const redirectPattern =
      /<Route\s+path=["']\/race["']\s+element=\{<Navigate\s+to=["']\/corrida["']\s+replace\s*\/>\}\s*\/>/
    expect(redirectPattern.test(appContent)).toBe(true)
  })

  // LWA01-04: Calendário abre Corrida (CalendarPage e regulamentos apontam '/corrida')
  it('LWA01-04: Calendário e fluxos de GP apontam para /corrida', () => {
    const calPath = resolve(process.cwd(), 'src/pages/CalendarPage.tsx')
    const calContent = readFileSync(calPath, 'utf-8')

    // CalendarPage não deve ter nenhum link ativo to="/race"
    expect(calContent.includes('to="/race"')).toBe(false)
    expect(calContent.includes("to='/race'")).toBe(false)
    expect(calContent.includes("navigate('/race')")).toBe(false)
    expect(calContent.includes('navigate("/race")')).toBe(false)
  })

  // LWA01-05: Dashboard/CTA não aponta para Fim de Semana (Index.tsx sem '/race')
  it('LWA01-05: Dashboard/CTA não aponta para Fim de Semana (Index.tsx sem /race)', () => {
    const indexPath = resolve(process.cwd(), 'src/pages/Index.tsx')
    const indexContent = readFileSync(indexPath, 'utf-8')

    expect(indexContent.includes("route: '/race'")).toBe(false)
    expect(indexContent.includes('route: "/race"')).toBe(false)
    expect(indexContent.includes("navigate('/race')")).toBe(false)
    expect(indexContent.includes('navigate("/race")')).toBe(false)
    expect(indexContent.includes('to="/race"')).toBe(false)

    // O CTA de Preparar GP aponta para /corrida
    expect(
      indexContent.includes("navigate('/corrida')") ||
        indexContent.includes('navigate("/corrida")'),
    ).toBe(true)
  })

  // LWA01-06: Histórico não depende da rota legada (History.tsx sem '/race', usa canonicalRaceResultService)
  it('LWA01-06: Histórico não depende da rota legada', () => {
    const historyPath = resolve(process.cwd(), 'src/pages/History.tsx')
    const historyContent = readFileSync(historyPath, 'utf-8')

    expect(historyContent.includes('/race"')).toBe(false)
    expect(historyContent.includes("/race'")).toBe(false)
    expect(historyContent.includes("navigate('/race')")).toBe(false)
  })

  // LWA01-07: Qualifying/race engine acessíveis pelo fluxo Corrida (WeekendV2Page referencia canonicalQualifyingRunner/canonicalRaceEngineService)
  it('LWA01-07: Qualifying e race engine acessíveis pelo fluxo Corrida', () => {
    const weekendV2Path = resolve(process.cwd(), 'src/pages/WeekendV2Page.tsx')
    const weekendV2Content = readFileSync(weekendV2Path, 'utf-8')

    expect(weekendV2Content.includes('canonicalQualifyingRunner')).toBe(true)
    expect(weekendV2Content.includes('canonicalRaceEngineService')).toBe(true)
    expect(weekendV2Content.includes('canonicalRaceResultService')).toBe(true)
  })

  // LWA01-08: Save/reload continua funcionando (canonicalRaceSaveService/persistências intactas)
  it('LWA01-08: Save/reload continua funcionando (serviços canônicos intactos)', () => {
    expect(canonicalRaceSaveService).toBeDefined()
    expect(typeof canonicalRaceSaveService.saveCanonicalRaceState).toBe('function')
    expect(typeof canonicalRaceSaveService.loadCanonicalRaceState).toBe('function')
    expect(typeof canonicalRaceSaveService.validateRaceSnapshot).toBe('function')
  })

  // LWA01-09: Rookie TL1 continua funcionando (rookiePracticeRequirementService/rookieTl1PlanningService importáveis e intactos)
  it('LWA01-09: Rookie TL1 continua funcionando com regras intactas', () => {
    expect(rookiePracticeRequirementService).toBeDefined()
    expect(typeof rookiePracticeRequirementService.getTeamRequirement).toBe('function')
    expect(typeof rookiePracticeRequirementService.checkDriverEligibility).toBe('function')
    expect(typeof rookiePracticeRequirementService.grantRookieFP1Credit).toBe('function')

    expect(RookieTl1PlanningService).toBeDefined()
    expect(typeof RookieTl1PlanningService.getPlans).toBe('function')
    expect(typeof RookieTl1PlanningService.setSeatPlan).toBe('function')
    expect(typeof RookieTl1PlanningService.getPlanningSummary).toBe('function')
  })

  // LWA01-10: Tyre inventory persiste normalmente (canonicalWeekendTyrePersistence importável, chave canônica preservada)
  it('LWA01-10: Tyre inventory persiste normalmente', () => {
    expect(canonicalWeekendTyrePersistence).toBeDefined()
    expect(typeof canonicalWeekendTyrePersistence.getOrCreateWeekendInventories).toBe('function')
    expect(typeof canonicalWeekendTyrePersistence.recordTyreUsage).toBe('function')
  })

  // LWA01-11: Nenhum link ativo visível leva à rota legada
  it('LWA01-11: Nenhum link ativo visível leva à rota legada', () => {
    const filesToCheck = [
      'src/pages/Index.tsx',
      'src/pages/SeasonEndPage.tsx',
      'src/pages/LiveRacePage.tsx',
      'src/pages/WeekendV2Page.tsx',
      'src/pages/race/raceAdvance.ts',
      'src/components/Sidebar.tsx',
    ]

    for (const file of filesToCheck) {
      const fullPath = resolve(process.cwd(), file)
      const content = readFileSync(fullPath, 'utf-8')

      expect(content.includes('to="/race"')).toBe(false)
      expect(content.includes("to='/race'")).toBe(false)
      expect(content.includes('to={"/race"}')).toBe(false)
      expect(content.includes("to={'/race'}")).toBe(false)
      expect(content.includes('navigate("/race")')).toBe(false)
      expect(content.includes("navigate('/race')")).toBe(false)
    }
  })

  // LWA01-12: Rota legada é apenas redirect (App.tsx não importa mais RaceSlim/RaceSlimWrapper)
  it('LWA01-12: Rota legada é apenas redirect e App.tsx não importa RaceSlim nem RaceSlimWrapper', () => {
    const appPath = resolve(process.cwd(), 'src/App.tsx')
    const appContent = readFileSync(appPath, 'utf-8')

    expect(appContent.includes('RaceSlim')).toBe(false)
    expect(appContent.includes('RaceSlimWrapper')).toBe(false)

    const audit = auditLegacyWeekendDependencies()
    expect(audit.routeReferences.redirectConfigured).toBe(true)
    expect(audit.sidebarReferences.hasLegacyWeekendItem).toBe(false)
    expect(audit.sidebarReferences.hasCanonicalCorridaItem).toBe(true)
  })
})
