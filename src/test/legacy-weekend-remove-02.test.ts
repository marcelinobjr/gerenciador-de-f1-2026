import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { CAREER_NAV_SECTIONS } from '@/components/Sidebar'
import {
  auditLegacyWeekendDependencies,
  type LegacyWeekendAuditReport,
} from '@/services/legacyWeekendAudit'

// Imports estáticos dos domínios canônicos para comprovação de presença e integridade (LWR02-09..15)
import {
  CanonicalQualifyingRunner,
  canonicalQualifyingRunner,
} from '@/services/canonicalQualifyingRunner'
import {
  CanonicalRaceEngineService,
  canonicalRaceEngineService,
} from '@/services/canonicalRaceEngineService'
import {
  CanonicalCareerPersistenceService,
  canonicalCareerPersistenceService,
} from '@/services/canonicalCareerPersistenceService'
import {
  RookiePracticeRequirementService,
  rookiePracticeRequirementService,
} from '@/services/rookiePracticeRequirementService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import {
  CanonicalRaceResultService,
  canonicalRaceResultService,
} from '@/services/canonicalRaceResultService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import {
  CanonicalChampionshipService,
  canonicalChampionshipService,
} from '@/services/canonicalChampionshipService'

// Componentes e utilitários preservados em src/pages/race/
import { GPRegistrationScreen } from '@/pages/race/GPRegistrationScreen'
import { RaceOperationsCockpit } from '@/pages/race/RaceOperationsCockpit'
import { advanceRound } from '@/pages/race/raceAdvance'
import type { SimDriverEntry, SessionTimeResult } from '@/pages/race/types'

describe('LEGACY-WEEKEND-REMOVE-02 — Fechamento da Remoção do Legado de Corrida', () => {
  const rootDir = process.cwd()
  const srcDir = resolve(rootDir, 'src')

  // Helper recursivo para listar todos os arquivos de código dentro de src/
  function getAllSourceFiles(dir: string): string[] {
    const entries = readdirSync(dir)
    let files: string[] = []
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        files = files.concat(getAllSourceFiles(fullPath))
      } else if (/\.(tsx?|jsx?)$/.test(entry)) {
        files.push(fullPath)
      }
    }
    return files
  }

  // =========================================================================
  // LWR02-01: RaceSlim não existe mais / não é importável
  // =========================================================================
  it('LWR02-01: RaceSlim não existe no disco e não é importável', async () => {
    const raceSlimPath = resolve(srcDir, 'pages/RaceSlim.tsx')
    expect(existsSync(raceSlimPath)).toBe(false)

    // Tentativa de import dinâmico deve falhar
    let importFailed = false
    try {
      // @ts-expect-error módulo foi deletado fisicamente
      await import('@/pages/RaceSlim')
    } catch {
      importFailed = true
    }
    expect(importFailed).toBe(true)
  })

  // =========================================================================
  // LWR02-02: RaceSlimWrapper não existe mais / não é importável
  // =========================================================================
  it('LWR02-02: RaceSlimWrapper não existe no disco e não é importável', async () => {
    const wrapperPath = resolve(srcDir, 'pages/RaceSlimWrapper.tsx')
    expect(existsSync(wrapperPath)).toBe(false)

    // Tentativa de import dinâmico deve falhar
    let importFailed = false
    try {
      // @ts-expect-error módulo foi deletado fisicamente
      await import('@/pages/RaceSlimWrapper')
    } catch {
      importFailed = true
    }
    expect(importFailed).toBe(true)
  })

  // =========================================================================
  // LWR02-03: Zero import ativo de RaceSlim ou RaceSlimWrapper em qualquer arquivo de src/
  // =========================================================================
  it('LWR02-03: Zero import ativo de RaceSlim ou RaceSlimWrapper em qualquer arquivo do src/', () => {
    const allSources = getAllSourceFiles(srcDir)
    expect(allSources.length).toBeGreaterThan(50)

    const importPattern = /import\s+.*(?:RaceSlim|RaceSlimWrapper).*from/i
    const requirePattern = /require\s*\(['"].*(?:RaceSlim|RaceSlimWrapper)/i

    const violations: { file: string; line: string }[] = []

    for (const filePath of allSources) {
      // Pular esta própria suíte de testes que valida a ausência
      if (filePath.endsWith('legacy-weekend-remove-02.test.ts')) continue

      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line) => {
        if (importPattern.test(line) || requirePattern.test(line)) {
          violations.push({ file: filePath.replace(rootDir, ''), line: line.trim() })
        }
      })
    }

    expect(violations).toEqual([])
  })

  // =========================================================================
  // LWR02-04: Rota /corrida aponta para WeekendV2Page (fluxo canônico)
  // =========================================================================
  it('LWR02-04: Rota /corrida aponta para WeekendV2Page (fluxo canônico)', () => {
    const appPath = resolve(srcDir, 'App.tsx')
    const appContent = readFileSync(appPath, 'utf-8')

    // Verifica que WeekendV2Page é importado
    expect(appContent).toMatch(/import\s+WeekendV2Page\s+from\s+['"]\.\/pages\/WeekendV2Page['"]/)

    // Verifica que a rota /corrida usa WeekendV2Page como element
    const corridaRouteRegex =
      /<Route\s+path=["']\/corrida["']\s+element=\{<WeekendV2Page\s*\/>\}\s*\/>/
    expect(corridaRouteRegex.test(appContent)).toBe(true)
  })

  // =========================================================================
  // LWR02-05: /race redireciona para /corrida (Navigate replace, sem carregar UI legada)
  // =========================================================================
  it('LWR02-05: /race redireciona para /corrida (Navigate replace, sem carregar UI legada)', () => {
    const appPath = resolve(srcDir, 'App.tsx')
    const appContent = readFileSync(appPath, 'utf-8')

    const redirectRegex =
      /<Route\s+path=["']\/race["']\s+element=\{<Navigate\s+to=["']\/corrida["']\s+replace\s*\/>\}\s*\/>/
    expect(redirectRegex.test(appContent)).toBe(true)

    // Nenhum componente legado deve ser renderizado para /race
    expect(appContent).not.toMatch(/path=["']\/race["']\s+element=\{<(?:RaceSlim|RaceSlimWrapper)/)
  })

  // =========================================================================
  // LWR02-06: /weekend-v2 usa fluxo canônico/alias válido (aponta para WeekendV2Page)
  // =========================================================================
  it('LWR02-06: /weekend-v2 usa fluxo canônico / alias válido apontando para WeekendV2Page', () => {
    const appPath = resolve(srcDir, 'App.tsx')
    const appContent = readFileSync(appPath, 'utf-8')

    const aliasRouteRegex =
      /<Route\s+path=["']\/weekend-v2["']\s+element=\{<WeekendV2Page\s*\/>\}\s*\/>/
    expect(aliasRouteRegex.test(appContent)).toBe(true)
  })

  // =========================================================================
  // LWR02-07: Sidebar não contém o item "Fim de Semana"
  // =========================================================================
  it('LWR02-07: Sidebar não contém o item "Fim de Semana"', () => {
    const allItems = CAREER_NAV_SECTIONS.flatMap((s) => s.items)

    const legacyPath = allItems.find((i) => i.path === '/race')
    const legacyName = allItems.find(
      (i) => i.name.toLowerCase() === 'fim de semana' || i.name.includes('Fim de Semana'),
    )

    expect(legacyPath).toBeUndefined()
    expect(legacyName).toBeUndefined()

    // O item canônico é "Corrida" em /corrida na seção COMPETIÇÃO
    const compSection = CAREER_NAV_SECTIONS.find((s) => s.title === 'COMPETIÇÃO')
    expect(compSection).toBeDefined()
    const corridaItem = compSection?.items.find((i) => i.path === '/corrida')
    expect(corridaItem).toBeDefined()
    expect(corridaItem?.name).toBe('Corrida')
  })

  // =========================================================================
  // LWR02-08: Fluxo do calendário aponta para /corrida
  // =========================================================================
  it('LWR02-08: Fluxo do calendário aponta para /corrida sem referências legadas a /race', () => {
    const calendarPath = resolve(srcDir, 'pages/CalendarPage.tsx')
    const calendarContent = readFileSync(calendarPath, 'utf-8')

    // CalendarPage não possui links ou rotas ativas para /race
    expect(calendarContent.includes('to="/race"')).toBe(false)
    expect(calendarContent.includes("to='/race'")).toBe(false)
    expect(calendarContent.includes("navigate('/race')")).toBe(false)
    expect(calendarContent.includes('navigate("/race")')).toBe(false)

    // O serviço de auditoria confirma ausência de links ativos para a rota legada
    const audit = auditLegacyWeekendDependencies()
    const linksToLegacy = audit.activeNavigationLinks.filter((l) => l.targetPath === '/race')
    expect(linksToLegacy).toHaveLength(0)
    expect(audit.counters.activeNavigationLinksToLegacy).toBe(0)
  })

  // =========================================================================
  // LWR02-09: Qualifying canônico (canonicalQualifyingRunner) presente e íntegro
  // =========================================================================
  it('LWR02-09: Qualifying canônico (canonicalQualifyingRunner) presente, importável e operacional', () => {
    expect(canonicalQualifyingRunner).toBeDefined()
    expect(CanonicalQualifyingRunner).toBeDefined()
    expect(typeof canonicalQualifyingRunner.simulateStage).toBe('function')
    expect(typeof canonicalQualifyingRunner.tickSession).toBe('function')
    expect(typeof canonicalQualifyingRunner.advanceStep).toBe('function')
  })

  // =========================================================================
  // LWR02-10: Race Engine canônica (canonicalRaceEngineService) presente e íntegra
  // =========================================================================
  it('LWR02-10: Race Engine canônica (canonicalRaceEngineService) presente, importável e operacional', () => {
    expect(canonicalRaceEngineService).toBeDefined()
    expect(CanonicalRaceEngineService).toBeDefined()
    expect(typeof canonicalRaceEngineService.advanceLap).toBe('function')
    expect(typeof canonicalRaceEngineService.advanceMultipleLaps).toBe('function')
    expect(typeof canonicalRaceEngineService.calculateCanonicalLapPace).toBe('function')
  })

  // =========================================================================
  // LWR02-11: Save/Reload e persistência de carreira (canonicalCareerPersistenceService) presentes
  // =========================================================================
  it('LWR02-11: Persistência de carreira (canonicalCareerPersistenceService) presente e operacional', () => {
    expect(canonicalCareerPersistenceService).toBeDefined()
    expect(CanonicalCareerPersistenceService).toBeDefined()
    expect(typeof canonicalCareerPersistenceService.registerOfficialRaceResultInCareer).toBe(
      'function',
    )
    expect(typeof canonicalCareerPersistenceService.getPersistedRaceResult).toBe('function')
    expect(typeof canonicalCareerPersistenceService.getApplicationJournal).toBe('function')
    expect(typeof canonicalCareerPersistenceService.savePersistedRaceResult).toBe('function')
  })

  // =========================================================================
  // LWR02-12: Rookie TL1 (rookiePracticeRequirementService e rookieTl1PlanningService) presentes
  // =========================================================================
  it('LWR02-12: Rookie TL1 (rookiePracticeRequirementService / rookieTl1PlanningService) presentes e íntegros', () => {
    expect(rookiePracticeRequirementService).toBeDefined()
    expect(RookiePracticeRequirementService).toBeDefined()
    expect(typeof rookiePracticeRequirementService.getTeamRequirement).toBe('function')
    expect(typeof rookiePracticeRequirementService.checkDriverEligibility).toBe('function')
    expect(typeof rookiePracticeRequirementService.grantRookieFP1Credit).toBe('function')

    expect(RookieTl1PlanningService).toBeDefined()
    expect(typeof RookieTl1PlanningService.getPlans).toBe('function')
    expect(typeof RookieTl1PlanningService.setSeatPlan).toBe('function')
    expect(typeof RookieTl1PlanningService.getPlanningSummary).toBe('function')
  })

  // =========================================================================
  // LWR02-13: Tyre inventory (canonicalWeekendTyrePersistence) presente e operacional
  // =========================================================================
  it('LWR02-13: Tyre inventory (canonicalWeekendTyrePersistence) presente e operacional', () => {
    expect(canonicalWeekendTyrePersistence).toBeDefined()
    expect(typeof canonicalWeekendTyrePersistence.getOrCreateWeekendInventories).toBe('function')
    expect(typeof canonicalWeekendTyrePersistence.recordTyreUsage).toBe('function')
    expect(typeof canonicalWeekendTyrePersistence.getTyreStorageKey).toBe('function')
  })

  // =========================================================================
  // LWR02-14: Official results (canonicalRaceResultService / OfficialRaceResult) presentes
  // =========================================================================
  it('LWR02-14: Official results (canonicalRaceResultService / OfficialRaceResult) presentes e íntegros', () => {
    expect(canonicalRaceResultService).toBeDefined()
    expect(CanonicalRaceResultService).toBeDefined()
    expect(typeof canonicalRaceResultService.officializeRace).toBe('function')
    expect(typeof canonicalRaceResultService.auditOfficialRaceResult).toBe('function')
    expect(typeof canonicalRaceResultService.getPersistedOfficialResult).toBe('function')

    // Validação estática da tipagem OfficialRaceResult
    const typeCheck: Partial<OfficialRaceResult> = {
      officialResultId: 'offres_test',
      status: 'official',
      totalLaps: 50,
    }
    expect(typeCheck.officialResultId).toBe('offres_test')
  })

  // =========================================================================
  // LWR02-15: Campeonato canônico (canonicalChampionshipService) e ativos preservados
  // =========================================================================
  it('LWR02-15: Campeonato canônico (canonicalChampionshipService) e dependências compartilhadas preservados', () => {
    expect(canonicalChampionshipService).toBeDefined()
    expect(CanonicalChampionshipService).toBeDefined()
    expect(typeof canonicalChampionshipService.computeChampionshipSnapshot).toBe('function')
    expect(typeof canonicalChampionshipService.applyOfficialRaceResult).toBe('function')
    expect(typeof canonicalChampionshipService.auditChampionshipIntegrity).toBe('function')

    // Confirmação dos componentes e utilitários preservados em src/pages/race/
    expect(GPRegistrationScreen).toBeDefined()
    expect(RaceOperationsCockpit).toBeDefined()
    expect(advanceRound).toBeDefined()
    expect(typeof advanceRound).toBe('function')

    const sampleEntry: Partial<SimDriverEntry> = { driverId: 'drv_test', isPlayer: false }
    const sampleResult: Partial<SessionTimeResult> = { driverId: 'drv_test', position: 1 }
    expect(sampleEntry.driverId).toBe('drv_test')
    expect(sampleResult.position).toBe(1)
  })

  // =========================================================================
  // LWR02-AUDIT: Auditoria pós-REMOVE-02 — contadores rigorosos
  // =========================================================================
  it('LWR02-AUDIT: auditLegacyWeekendDependencies() reflete o estado pós-REMOVE-02', () => {
    const audit: LegacyWeekendAuditReport = auditLegacyWeekendDependencies()

    // 1. legacyOnlyDependencies = 0
    expect(audit.legacyOnlyDependencies.length).toBe(0)
    expect(audit.counters.legacyOnlyDependencies).toBe(0)

    // 2. deadCodeCandidates = 0
    expect(audit.deadCodeCandidates.length).toBe(0)
    expect(audit.counters.deadCodeCandidates).toBe(0)

    // 3. activeNavigationLinksToLegacy = 0
    expect(audit.counters.activeNavigationLinksToLegacy).toBe(0)
    const linksToRace = audit.activeNavigationLinks.filter((l) => l.targetPath === '/race')
    expect(linksToRace).toHaveLength(0)

    // 4. sharedDomainDependencies > 0 (todas as preservadas ativas)
    expect(audit.sharedDomainDependencies.length).toBeGreaterThan(0)
    expect(audit.counters.sharedDomainDependencies).toBeGreaterThan(0)
    const names = audit.sharedDomainDependencies.map((d) => d.name)
    expect(names).toContain('GPRegistrationScreen')
    expect(names).toContain('RaceOperationsCockpit')
    expect(names).toContain('raceAdvance')
    expect(names).toContain('raceTypes')
    expect(names).toContain('canonicalRaceEngineService')
    expect(names).toContain('canonicalQualifyingRunner')
    expect(names).toContain('canonicalCareerPersistenceService')
    expect(names).toContain('canonicalWeekendTyrePersistence')
    expect(names).toContain('canonicalRaceResultService')
    expect(names).toContain('canonicalChampionshipService')

    // 5. compatibilityRedirects = somente os aliases intencionais (/race e /weekend-v2)
    expect(audit.compatibilityRedirects.length).toBe(2)
    expect(audit.counters.compatibilityRedirects).toBe(2)
    const routes = audit.compatibilityRedirects.map((r) => r.route)
    expect(routes).toContain('/race')
    expect(routes).toContain('/weekend-v2')
  })
})
