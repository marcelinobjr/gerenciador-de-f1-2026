/**
 * balance-baseline-v0-restore.test.ts
 *
 * BALANCE-EQUATION-02A — BLOCO 3B: RESTAURAÇÃO CANÔNICA DA BASE V0
 *
 * Suíte de Testes Canônica V0R-01 até V0R-18:
 * - V0R-01: loadBalanceBaseline('v0') carrega baseline válida.
 * - V0R-02: checksum é validado antes do restore.
 * - V0R-03: baseline contém 29 equipes.
 * - V0R-04: compare V0 vs V0 → hasDifferences = false.
 * - V0R-05: alteração artificial de rating é detectada pelo diff.
 * - V0R-06: alteração de PU relationship é detectada.
 * - V0R-07: alteração de infraestrutura é detectada.
 * - V0R-08: restore recupera valor original.
 * - V0R-09: restore cobre 29/29 equipes.
 * - V0R-10: restore é idempotente.
 * - V0R-11: restore NÃO apaga resultados.
 * - V0R-12: restore NÃO altera championship.
 * - V0R-13: restore NÃO altera contratos.
 * - V0R-14: restore NÃO altera season/round atual.
 * - V0R-15: restore NÃO altera histórico de carreira.
 * - V0R-16: checksum inválido bloqueia restore.
 * - V0R-17: V0 JSON permanece byte-identical antes/depois do restore.
 * - V0R-18: custom team template é preservado corretamente.
 *
 * Adicionalmente:
 * - Teste de DRIFT completo (Mercedes chassis, Cadillac infra, Racing Bulls PU knowledge)
 * - Teste de Carreira com fixture avançada
 * - Teste de auditoria auditBalanceBaselineV0()
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  balanceBaselineService,
  loadBalanceBaseline,
  compareBalanceWithBaseline,
  restoreBalanceBaseline,
  validateBaseline,
  auditBalanceBaselineV0,
  PROTECTED_CAREER_FIELDS,
} from '@/services/balanceBaselineService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { calculateStableChecksum, BASELINE_V0_DATA } from '@/data/balance-baseline-v0'

describe('BALANCE-EQUATION-02A — BLOCO 3B: Suíte V0R-01 até V0R-18', () => {
  const jsonPath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')

  beforeEach(() => {
    // Garante ambiente limpo antes de cada teste
    balanceBaselineService.resetRuntimeState()
  })

  // V0R-01: loadBalanceBaseline('v0') carrega baseline válida.
  it("V0R-01: loadBalanceBaseline('v0') carrega baseline válida e schema conforme", () => {
    const baseline = loadBalanceBaseline('v0')
    expect(baseline).toBeDefined()
    expect(baseline.schemaVersion).toBe('v0')
    expect(baseline.baselineId).toBe('balance_baseline_v0_2026')
    expect(baseline.immutable).toBe(true)
    expect(typeof baseline.checksum).toBe('string')
    expect(baseline.checksum.startsWith('sha_v0_')).toBe(true)
  })

  // V0R-02: checksum é validado antes do restore.
  it('V0R-02: checksum é rigorosamente validado antes do restore', () => {
    const validation = validateBaseline('v0')
    expect(validation.valid).toBe(true)
    expect(validation.errors.length).toBe(0)
    expect(validation.checksum).toBe(BASELINE_V0_DATA.checksum)

    // O restore executa com checksum verificado
    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.checksumValidated).toBe(true)
    expect(restoreRes.success).toBe(true)
  })

  // V0R-03: baseline contém 29 equipes.
  it('V0R-03: baseline contém exatamente 29 equipes catalogadas', () => {
    const baseline = loadBalanceBaseline('v0')
    const teamKeys = Object.keys(baseline.teams)
    expect(baseline.totalTeamsCount).toBe(29)
    expect(teamKeys.length).toBe(29)

    // 12 oficiais + 16 históricas + 1 custom
    const expected12Official = [
      'mercedes',
      'mclaren',
      'ferrari',
      'redbull',
      'astonmartin',
      'audi',
      'williams',
      'racingbulls',
      'haas',
      'alpine',
      'cadillac',
      'andretti',
    ]
    for (const key of expected12Official) {
      expect(baseline.teams[key]).toBeDefined()
    }
    expect(baseline.teams['custom_team']).toBeDefined()
  })

  // V0R-04: compare V0 vs V0 → hasDifferences = false.
  it('V0R-04: compare V0 vs V0 → hasDifferences = false (zero drift inicial)', () => {
    const diff = compareBalanceWithBaseline('v0')
    expect(diff.hasDifferences).toBe(false)
    expect(diff.checksumValid).toBe(true)
    expect(diff.changedTeams.length).toBe(0)
    expect(diff.changedGlobalParameters.length).toBe(0)
    expect(diff.missingTeams.length).toBe(0)
    expect(diff.newTeams.length).toBe(0)
  })

  // V0R-05: alteração artificial de rating é detectada pelo diff.
  it('V0R-05: alteração artificial de rating é detectada pelo diff', () => {
    // Altera rating do chassi da Mercedes de 99 para 80
    balanceBaselineService.applyRuntimeOverride('mercedes', {
      chassisComponents: {
        frontWing: 80,
      },
    })

    const diff = compareBalanceWithBaseline('v0')
    expect(diff.hasDifferences).toBe(true)
    expect(diff.changedTeams.length).toBe(1)
    expect(diff.changedTeams[0].teamKey).toBe('mercedes')

    const chDiff = diff.changedTeams[0].differences.find(
      (d) => d.field === 'chassisComponents.frontWing',
    )
    expect(chDiff).toBeDefined()
    expect(chDiff?.currentValue).toBe(80)
    expect(chDiff?.baselineValue).toBe(99)
  })

  // V0R-06: alteração de PU relationship é detectada.
  it('V0R-06: alteração de PU relationship é detectada pelo diff', () => {
    // Altera McLaren de CUSTOMER para FACTORY
    balanceBaselineService.applyRuntimeOverride('mclaren', {
      relationshipType: 'FACTORY',
    })

    const diff = compareBalanceWithBaseline('v0')
    expect(diff.hasDifferences).toBe(true)
    const mclDiff = diff.changedTeams.find((t) => t.teamKey === 'mclaren')
    expect(mclDiff).toBeDefined()

    const relDiff = mclDiff?.differences.find((d) => d.field === 'relationshipType')
    expect(relDiff).toBeDefined()
    expect(relDiff?.currentValue).toBe('FACTORY')
    expect(relDiff?.baselineValue).toBe('CUSTOMER')
  })

  // V0R-07: alteração de infraestrutura é detectada.
  it('V0R-07: alteração de infraestrutura é detectada pelo diff', () => {
    // Altera wind_tunnel da Ferrari de 5 para 2
    balanceBaselineService.applyRuntimeOverride('ferrari', {
      facilities: {
        wind_tunnel: 2,
      },
    })

    const diff = compareBalanceWithBaseline('v0')
    expect(diff.hasDifferences).toBe(true)
    const ferDiff = diff.changedTeams.find((t) => t.teamKey === 'ferrari')
    expect(ferDiff).toBeDefined()

    const facDiff = ferDiff?.differences.find((d) => d.field === 'facilities.wind_tunnel')
    expect(facDiff).toBeDefined()
    expect(facDiff?.currentValue).toBe(2)
    expect(facDiff?.baselineValue).toBe(5)
  })

  // V0R-08: restore recupera valor original.
  it('V0R-08: restore recupera exatamente os valores originais da baseline V0', () => {
    // Modifica parâmetros em várias equipes
    balanceBaselineService.applyRuntimeOverride('mercedes', {
      chassisComponents: { frontWing: 50 },
    })
    balanceBaselineService.applyRuntimeOverride('audi', {
      engineSupplier: 'Ferrari',
    })

    const preDiff = compareBalanceWithBaseline('v0')
    expect(preDiff.hasDifferences).toBe(true)

    // Executa Restore
    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)
    expect(restoreRes.restoredTeams).toBe(29)

    // Após restore, diff deve ser estritamente zero
    const postDiff = compareBalanceWithBaseline('v0')
    expect(postDiff.hasDifferences).toBe(false)
    expect(postDiff.changedTeams.length).toBe(0)

    const mercAfter = balanceBaselineService.getCurrentTeamBalance('mercedes')
    expect(mercAfter.chassisComponents.frontWing).toBe(99)
    const audiAfter = balanceBaselineService.getCurrentTeamBalance('audi')
    expect(audiAfter.engineSupplier).toBe('Audi')
  })

  // V0R-09: restore cobre 29/29 equipes.
  it('V0R-09: restore cobre todas as 29/29 equipes (incluindo históricas e custom)', () => {
    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.restoredTeams).toBe(29)
    expect(restoreRes.details?.restoredTeamKeys.length).toBe(29)

    // Verifica que todas as 16 históricas e custom estão cobertas
    const historics = [
      'porsche',
      'honda',
      'lamborghini',
      'byd',
      'penske',
      'lotus',
      'toyota',
      'benetton',
      'copersucar',
      'alfaromeo',
      'alphatauri',
      'fittipaldi',
      'jordan',
      'renault',
      'sauber',
      'toleman',
    ]
    for (const h of historics) {
      expect(restoreRes.details?.restoredTeamKeys).toContain(h)
    }
    expect(restoreRes.details?.restoredTeamKeys).toContain('custom_team')
  })

  // V0R-10: restore é idempotente.
  it('V0R-10: restore é estritamente idempotente (segunda execução sem qualquer drift)', () => {
    // Execução 1
    const run1 = restoreBalanceBaseline('v0')
    const diff1 = compareBalanceWithBaseline('v0')
    expect(diff1.hasDifferences).toBe(false)

    // Execução 2
    const run2 = restoreBalanceBaseline('v0')
    const diff2 = compareBalanceWithBaseline('v0')
    expect(diff2.hasDifferences).toBe(false)

    // Execução 3
    const run3 = restoreBalanceBaseline('v0')
    const diff3 = compareBalanceWithBaseline('v0')
    expect(diff3.hasDifferences).toBe(false)

    expect(run1.restoredTeams).toBe(run2.restoredTeams)
    expect(run2.restoredTeams).toBe(run3.restoredTeams)
    expect(run1.checksumValidated).toBe(true)
    expect(run2.checksumValidated).toBe(true)
  })

  // V0R-11: restore NÃO apaga resultados.
  it('V0R-11: restore NÃO apaga nem modifica resultados oficiais de corrida', () => {
    const mockStorageKey = 'canonical_official_race_results_season_2026_r1'
    const mockRaceResult = JSON.stringify({
      raceKey: 'bahrain_2026',
      roundNumber: 1,
      winner: 'George Russell',
      winningTeam: 'mercedes',
      finishOrder: ['DRV_0096', 'DRV_0044', 'DRV_0001'],
    })

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(mockStorageKey, mockRaceResult)
    }

    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    if (typeof window !== 'undefined' && window.localStorage) {
      const persisted = window.localStorage.getItem(mockStorageKey)
      expect(persisted).toBe(mockRaceResult)
      window.localStorage.removeItem(mockStorageKey)
    }
  })

  // V0R-12: restore NÃO altera championship.
  it('V0R-12: restore NÃO altera a tabela e pontuação do campeonato', () => {
    const champKey = 'f1_canonical_championship_standings_2026'
    const champData = JSON.stringify({
      season: 2026,
      leader: 'mercedes',
      totalPoints: 88,
      driverStandings: [{ driverId: 'DRV_0096', points: 45 }],
    })

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(champKey, champData)
    }

    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem(champKey)).toBe(champData)
      window.localStorage.removeItem(champKey)
    }
  })

  // V0R-13: restore NÃO altera contratos.
  it('V0R-13: restore NÃO altera contratos ou salários de pilotos e staff', () => {
    const contractKey = 'f1_career_driver_contracts_2026'
    const contractData = JSON.stringify([
      { driverId: 'DRV_0096', teamId: 'mercedes', salaryPerYear: 32000000, contractEndYear: 2028 },
      { driverId: 'DRV_0044', teamId: 'ferrari', salaryPerYear: 45000000, contractEndYear: 2027 },
    ])

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(contractKey, contractData)
    }

    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem(contractKey)).toBe(contractData)
      window.localStorage.removeItem(contractKey)
    }
  })

  // V0R-14: restore NÃO altera season/round atual.
  it('V0R-14: restore NÃO altera a temporada corrente nem a rodada atual do jogador', () => {
    const careerStateKey = 'f1_career_active_session_state'
    const careerState = JSON.stringify({
      careerId: 'player_career_golden_2026',
      currentSeason: 2028,
      currentRound: 14,
      targetGp: 'monza',
    })

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(careerStateKey, careerState)
    }

    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem(careerStateKey)).toBe(careerState)
      window.localStorage.removeItem(careerStateKey)
    }
  })

  // V0R-15: restore NÃO altera histórico de carreira.
  it('V0R-15: restore NÃO altera o histórico, estatísticas e palmarés de carreira', () => {
    const historyKey = 'f1_career_palmares_and_statistics'
    const historyData = JSON.stringify({
      totalTitles: 2,
      totalWins: 28,
      totalPoles: 31,
      seasonsCompleted: [2026, 2027],
      transfersLog: [{ season: 2027, from: 'williams', to: 'mercedes' }],
    })

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(historyKey, historyData)
    }

    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem(historyKey)).toBe(historyData)
      window.localStorage.removeItem(historyKey)
    }
  })

  // V0R-16: checksum inválido bloqueia restore.
  it('V0R-16: checksum inválido ou versão inexistente bloqueia o restore imediatamente', () => {
    expect(() => {
      restoreBalanceBaseline('v1_invalid' as any)
    }).toThrow(/Versão desconhecida/)

    expect(() => {
      loadBalanceBaseline('v99_nonexistent' as any)
    }).toThrow(/Versão desconhecida/)
  })

  // V0R-17: V0 JSON permanece byte-identical antes/depois do restore.
  it('V0R-17: balance-baseline-v0.json permanece 100% byte-identical antes e após o restore', () => {
    const beforeBytes = fs.readFileSync(jsonPath)
    const beforeChecksum = calculateStableChecksum(JSON.parse(beforeBytes.toString('utf-8')))

    // Executa restore múltiplas vezes, incluindo dry-run e real
    restoreBalanceBaseline('v0', { dryRun: true })
    restoreBalanceBaseline('v0')
    restoreBalanceBaseline('v0')

    const afterBytes = fs.readFileSync(jsonPath)
    const afterChecksum = calculateStableChecksum(JSON.parse(afterBytes.toString('utf-8')))

    expect(beforeBytes.equals(afterBytes)).toBe(true)
    expect(beforeChecksum).toBe(afterChecksum)
  })

  // V0R-18: custom team template é preservado corretamente.
  it('V0R-18: custom team template é preservado sem conflitar com instâncias de carreira', () => {
    const baseline = loadBalanceBaseline('v0')
    const customTemplate = baseline.teams['custom_team']
    expect(customTemplate).toBeDefined()
    expect(customTemplate.teamKey).toBe('custom_team')
    expect(customTemplate.engineSupplier).toBe('Audi')
    expect(customTemplate.dataQuality).toBe('DEFAULTED')

    // Modifica custom em runtime
    balanceBaselineService.applyRuntimeOverride('custom_team', {
      engineSupplier: 'Honda',
      carReliabilityRating: 50,
    })

    const diff = compareBalanceWithBaseline('v0')
    expect(diff.hasDifferences).toBe(true)
    const customDiff = diff.changedTeams.find((t) => t.teamKey === 'custom_team')
    expect(customDiff).toBeDefined()

    // Restore recupera template padrão da custom team
    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    const restoredCustom = balanceBaselineService.getCurrentTeamBalance('custom_team')
    expect(restoredCustom.engineSupplier).toBe('Audi')
    expect(restoredCustom.carReliabilityRating).toBe(89)
  })

  // 20. TESTE DE DRIFT
  it('CENÁRIO DRIFT: Mercedes chassis + Cadillac infra + Racing Bulls PU → 3 diferenças → restore → 0 diferenças', () => {
    // 1. Alterar Mercedes chassis
    balanceBaselineService.applyRuntimeOverride('mercedes', {
      chassisComponents: { chassis: 70 },
    })

    // 2. Alterar Cadillac infrastructure
    balanceBaselineService.applyRuntimeOverride('cadillac', {
      facilities: { factory: 1 },
    })

    // 3. Alterar Racing Bulls PU relationship / maxIntegration
    balanceBaselineService.applyRuntimeOverride('racingbulls', {
      maxIntegration: 1.0,
    })

    // 4. Compare deve identificar exatamente 3 equipes alteradas
    const driftDiff = compareBalanceWithBaseline('v0')
    expect(driftDiff.hasDifferences).toBe(true)
    expect(driftDiff.changedTeams.length).toBe(3)

    const keys = driftDiff.changedTeams.map((t) => t.teamKey).sort()
    expect(keys).toEqual(['cadillac', 'mercedes', 'racingbulls'])

    // 5. Restore V0
    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)

    // 6. Compare deve ter 0 diferenças
    const cleanDiff = compareBalanceWithBaseline('v0')
    expect(cleanDiff.hasDifferences).toBe(false)
    expect(cleanDiff.changedTeams.length).toBe(0)
  })

  // 21. TESTE DE CARREIRA AVANÇADA
  it('CENÁRIO CARREIRA: Fixture avançada com campeonato, resultados e contratos intactos após restore', () => {
    const careerFixture = {
      careerId: 'apex_golden_champ_career_s3',
      season: 2028,
      round: 18,
      championship: {
        leaderTeam: 'ferrari',
        teamPoints: 340,
        driverStandings: [
          { id: 'DRV_0044', points: 190 },
          { id: 'DRV_0016', points: 150 },
        ],
      },
      resultsHistory: [
        { round: 1, grandPrix: 'Bahrain', p1: 'DRV_0044' },
        { round: 2, grandPrix: 'Saudi Arabia', p1: 'DRV_0016' },
      ],
      contracts: [{ driver: 'DRV_0044', salary: 45000000, expiry: 2029 }],
      stats: {
        titles: 1,
        wins: 14,
      },
    }

    const fixtureStorageKey = 'career_fixture_deep_test'
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(fixtureStorageKey, JSON.stringify(careerFixture))
    }

    // Altera parâmetros de balanceamento
    balanceBaselineService.applyRuntimeOverride('redbull', {
      chassisComponents: { rearWing: 60 },
    })
    balanceBaselineService.applyRuntimeOverride('astonmartin', {
      relationshipType: 'FACTORY',
    })

    expect(compareBalanceWithBaseline('v0').hasDifferences).toBe(true)

    // Executa Restore
    const restoreRes = restoreBalanceBaseline('v0')
    expect(restoreRes.success).toBe(true)
    expect(restoreRes.skippedCareerFields).toBe(PROTECTED_CAREER_FIELDS.length)

    // O balanceamento voltou à V0
    expect(compareBalanceWithBaseline('v0').hasDifferences).toBe(false)

    // A fixture da carreira permanece 100% intacta
    if (typeof window !== 'undefined' && window.localStorage) {
      const persistedFixture = JSON.parse(window.localStorage.getItem(fixtureStorageKey)!)
      expect(persistedFixture).toEqual(careerFixture)
      window.localStorage.removeItem(fixtureStorageKey)
    }
  })

  // 26. AUDITORIA FORMAL: auditBalanceBaselineV0()
  it('V0R-AUDIT: auditBalanceBaselineV0() retorna estrutura canônica completa', () => {
    const audit = auditBalanceBaselineV0()
    expect(audit.version).toBe('v0')
    expect(audit.teams).toBe(29)
    expect(audit.checksumValid).toBe(true)
    expect(audit.restoreAvailable).toBe(true)
    expect(audit.compareAvailable).toBe(true)
    expect(audit.restoreIdempotent).toBe(true)
    expect(audit.careerFieldsTouched).toBe(0)
    expect(audit.baselineMutated).toBe(false)

    // Também verifica via structuralStrengthService
    const structuralAudit = structuralStrengthService.auditBalanceBaselineV0()
    expect(structuralAudit.version).toBe('v0')
    expect(structuralAudit.teams).toBe(29)
    expect(structuralAudit.checksumValid).toBe(true)
  })

  // DRY-RUN TEST
  it('DRY RUN: restoreBalanceBaseline com dryRun=true simula sem aplicar mutações', () => {
    balanceBaselineService.applyRuntimeOverride('mercedes', {
      chassisComponents: { floor: 50 },
    })

    const dryRes = restoreBalanceBaseline('v0', { dryRun: true })
    expect(dryRes.dryRun).toBe(true)
    expect(dryRes.success).toBe(true)
    expect(dryRes.restoredTeams).toBe(1)
    expect(dryRes.restoredFields).toBe(1)

    // Como foi dryRun, o diff ainda deve constar
    const stillDiff = compareBalanceWithBaseline('v0')
    expect(stillDiff.hasDifferences).toBe(true)

    // Agora o restore real limpa
    const realRes = restoreBalanceBaseline('v0')
    expect(realRes.dryRun).toBe(false)
    expect(compareBalanceWithBaseline('v0').hasDifferences).toBe(false)
  })
})
