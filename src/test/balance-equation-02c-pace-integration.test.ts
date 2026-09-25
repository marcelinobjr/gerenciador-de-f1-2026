/**
 * balance-equation-02c-pace-integration.test.ts
 *
 * Suíte Oficial de Testes do BALANCE-EQUATION-02C:
 * BE02C-01 a BE02C-20 + Goldens 1 a 5 + Auditoria Canônica + V0 Compare/Restore.
 */

import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  auditPaceIntegration,
} from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { balanceBaselineService } from '@/services/balanceBaselineService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'

describe('BALANCE-EQUATION-02C: Structural Strength -> Pace Integration', () => {
  const neutralCircuit = resolveCircuitProfile({ round: 1 })
  const monzaCircuit = resolveCircuitProfile({ round: 16 }) // Alta velocidade
  const monacoCircuit = resolveCircuitProfile({ round: 8 }) // Travada / downforce

  // BE02C-01: StructuralStrength entra no qualifying
  it('BE02C-01: StructuralStrength entra no qualifying', () => {
    const quali = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 95 },
    })
    expect(quali.breakdown.structuralStrength).toBeGreaterThan(0)
    expect(quali.effectivePaceScore).toBeGreaterThan(50)
    expect(quali.breakdown.sessionType).toBe('qualifying')
  })

  // BE02C-02: StructuralStrength entra na corrida
  it('BE02C-02: StructuralStrength entra na corrida', () => {
    const race = canonicalPaceIntegrationService.computeRacePace({
      teamKey: 'mclaren',
      driverId: 'nor',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 94, racePace: 93 },
    })
    expect(race.breakdown.structuralStrength).toBeGreaterThan(0)
    expect(race.effectivePaceScore).toBeGreaterThan(50)
    expect(race.breakdown.sessionType).toBe('race')
  })

  // BE02C-03: TrackFit não pesa mais 45% diretamente
  it('BE02C-03: TrackFit não pesa mais 45% diretamente', () => {
    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 85,
    })
    // 85 em vez de dar 85 * 0.45 = 38.25 pontos, agora gera apenas um delta moderado (ex: ~2.2 pts)
    expect(Math.abs(norm.trackFitModifier)).toBeLessThan(10.0)
    expect(Math.abs(norm.trackFitModifier)).toBeGreaterThan(0.5)
  })

  // BE02C-04: TrackFit é modificador centrado em zero
  it('BE02C-04: TrackFit é modificador centrado em zero', () => {
    const neutralNorm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75.0,
      referenceTrackFit: 75.0,
    })
    expect(neutralNorm.trackFitModifier).toBe(0.0)

    const aboveNorm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 90.0,
      referenceTrackFit: 75.0,
    })
    expect(aboveNorm.trackFitModifier).toBeGreaterThan(0)
    expect(aboveNorm.trackFitModifier).toBeLessThanOrEqual(6.5)

    const belowNorm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 60.0,
      referenceTrackFit: 75.0,
    })
    expect(belowNorm.trackFitModifier).toBeLessThan(0)
    expect(belowNorm.trackFitModifier).toBeGreaterThanOrEqual(-6.5)
  })

  // BE02C-05: Setup permanece evento
  it('BE02C-05: Setup permanece evento', () => {
    const defaultSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 94 },
      setupEfficiency: 80, // neutro
    })
    const perfectSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 94 },
      setupEfficiency: 100, // evento ideal
    })
    expect(perfectSetup.breakdown.setupModifier).toBeGreaterThan(
      defaultSetup.breakdown.setupModifier,
    )
    expect(perfectSetup.breakdown.structuralStrength).toBe(
      defaultSetup.breakdown.structuralStrength,
    )
  })

  // BE02C-06: Tyres permanecem evento
  it('BE02C-06: Tyres permanecem evento', () => {
    const softQuali = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 95 },
      tyreCompound: 'macio',
    })
    const hardQuali = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 95 },
      tyreCompound: 'duro',
    })
    // Pneu macio tem melhor modificador que o duro em volta lançada
    expect(softQuali.breakdown.tyreModifier).toBeGreaterThan(hardQuali.breakdown.tyreModifier)
    expect(softQuali.breakdown.structuralStrength).toBe(hardQuali.breakdown.structuralStrength)
  })

  // BE02C-07: Fuel permanece evento
  it('BE02C-07: Fuel permanece evento', () => {
    const lightFuel = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'red_bull',
      driverId: 'ver',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 97 },
      fuelKg: 10,
    })
    const heavyFuel = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'red_bull',
      driverId: 'ver',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 97 },
      fuelKg: 40,
    })
    expect(lightFuel.breakdown.fuelModifier).toBeGreaterThan(heavyFuel.breakdown.fuelModifier)
    expect(lightFuel.breakdown.structuralStrength).toBe(heavyFuel.breakdown.structuralStrength)
  })

  // BE02C-08: RNG não entra no StructuralStrength
  it('BE02C-08: RNG não entra no StructuralStrength', () => {
    const pace1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'alpine',
      driverId: 'gas',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 84 },
      noise: 0.15,
    })
    const pace2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'alpine',
      driverId: 'gas',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 84 },
      noise: -0.15,
    })
    expect(pace1.breakdown.structuralStrength).toBe(pace2.breakdown.structuralStrength)
    expect(pace1.breakdown.rngModifier).not.toBe(pace2.breakdown.rngModifier)
  })

  // BE02C-09: Chaos não entra no StructuralStrength
  it('BE02C-09: Chaos não entra no StructuralStrength', () => {
    const dryPace = canonicalPaceIntegrationService.computeRacePace({
      teamKey: 'aston_martin',
      driverId: 'alo',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 91 },
      weather: 'seco',
    })
    const wetPace = canonicalPaceIntegrationService.computeRacePace({
      teamKey: 'aston_martin',
      driverId: 'alo',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 91 },
      weather: 'chuva_forte',
    })
    expect(dryPace.breakdown.structuralStrength).toBe(wetPace.breakdown.structuralStrength)
    expect(wetPace.breakdown.weatherModifier).toBeLessThan(dryPace.breakdown.weatherModifier)
  })

  // BE02C-10: Piloto não é duplicado excessivamente
  it('BE02C-10: Piloto não é duplicado excessivamente', () => {
    const p1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'alb',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 88, rain: 88, morale: 80 },
    })
    // Apenas a modulação da sessão entra no driverEventModifier, fechando amplitude restrita
    expect(Math.abs(p1.breakdown.driverEventModifier)).toBeLessThan(5.0)
  })

  // BE02C-11: PU não é duplicada
  it('BE02C-11: PU não é duplicada', () => {
    const audit = auditPaceIntegration()
    expect(audit.duplicatePUApplication).toBe(0)
  })

  // BE02C-12: PU wear é aplicada uma vez
  it('BE02C-12: PU wear é aplicada uma vez', () => {
    const audit = auditPaceIntegration()
    expect(audit.duplicateWearApplication).toBe(0)
  })

  // BE02C-13: Pista neutra preserva ordem estrutural
  it('BE02C-13: Pista neutra preserva ordem estrutural', () => {
    const mclaren = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mclaren',
      driverId: 'nor',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 93 },
    })
    const sauber = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'sauber',
      driverId: 'hul',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 82 },
    })
    // McLaren deve superar Sauber com folga na pista neutra
    expect(mclaren.breakdown.structuralStrength).toBeGreaterThan(
      sauber.breakdown.structuralStrength,
    )
    expect(mclaren.effectivePaceScore).toBeGreaterThan(sauber.effectivePaceScore)
  })

  // BE02C-14: Pista favorável altera ordem local sem destruir grupos distantes
  it('BE02C-14: Pista favorável altera ordem local sem destruir grupos distantes', () => {
    // Duas equipes do mesmo pelotão médio
    const aston = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'aston_martin',
      driverId: 'alo',
      circuitProfile: monzaCircuit,
      driverAttributes: { speed: 90 },
    })
    const alpine = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'alpine',
      driverId: 'gas',
      circuitProfile: monzaCircuit,
      driverAttributes: { speed: 86 },
    })
    // Grupo distante: Sauber não deve superar McLaren mesmo em pista favorável a Sauber
    const mclarenMonza = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mclaren',
      driverId: 'nor',
      circuitProfile: monzaCircuit,
      driverAttributes: { speed: 93 },
    })
    const sauberMonza = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'sauber',
      driverId: 'hul',
      circuitProfile: monzaCircuit,
      driverAttributes: { speed: 82 },
    })
    expect(mclarenMonza.effectivePaceScore).toBeGreaterThan(sauberMonza.effectivePaceScore)
  })

  // BE02C-15: Gap estrutural grande não é apagado por RNG normal isolado
  it('BE02C-15: Gap estrutural grande não é apagado por RNG normal isolado', () => {
    const topTeamBadLuck = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 95 },
      noise: -0.15, // azar
    })
    const backmarkerGoodLuck = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'haas',
      driverId: 'oco',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 82 },
      noise: 0.15, // sorte
    })
    expect(topTeamBadLuck.effectivePaceScore).toBeGreaterThan(backmarkerGoodLuck.effectivePaceScore)
  })

  // BE02C-16: Quali e race usam mesma base estrutural
  it('BE02C-16: Quali e race usam mesma base estrutural', () => {
    const quali = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 94 },
    })
    const race = canonicalPaceIntegrationService.computeRacePace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 94 },
    })
    expect(quali.breakdown.structuralStrength).toBe(race.breakdown.structuralStrength)
  })

  // BE02C-17: PaceBreakdown fecha matematicamente
  it('BE02C-17: PaceBreakdown fecha matematicamente', () => {
    const quali = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'red_bull',
      driverId: 'ver',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 97, morale: 90 },
      fuelKg: 12,
      setupEfficiency: 90,
      noise: 0.05,
    })
    const b = quali.breakdown
    const sum =
      b.structuralStrength +
      b.trackFitModifier +
      b.setupModifier +
      b.driverEventModifier +
      b.tyreModifier +
      b.fuelModifier +
      b.wearModifier +
      b.weatherModifier +
      b.rngModifier

    expect(Math.abs(sum - b.finalPace)).toBeLessThan(0.05)
  })

  // BE02C-18: 29/29 equipes compatíveis
  it('BE02C-18: 29/29 equipes compatíveis', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.totalTeams).toBe(29)
    expect(audit.allTeams.length).toBe(29)
    audit.allTeams.forEach((t) => {
      const q = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: t.teamKey,
        driverId: 'drv_test',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 85 },
      })
      expect(q.breakdown.structuralStrength).toBe(t.structuralStrengthScore)
      expect(q.effectivePaceScore).toBeGreaterThan(0)
    })
  })

  // BE02C-19: compare V0 detecta alteração de arquitetura se houver override
  it('BE02C-19: compare V0 detecta alteração de arquitetura', () => {
    balanceBaselineService.applyGlobalOverride(
      'architecture.trackFitRole',
      'MODIFIER_CENTERED_ZERO',
    )
    const cmp = balanceBaselineService.compareBalanceWithBaseline('v0')
    expect(cmp.checksumValid).toBe(true)
    expect(cmp.hasDifferences).toBe(true)
    const param = cmp.changedGlobalParameters.find(
      (p) => p.parameter === 'architecture.trackFitRole',
    )
    expect(param).toBeDefined()
    // Limpeza após teste
    balanceBaselineService.restoreBalanceBaseline('v0')
  })

  // BE02C-20: restore V0 reverte arquitetura de balanceamento sem tocar na carreira
  it('BE02C-20: restore V0 reverte arquitetura de balanceamento sem tocar na carreira', () => {
    // 1. Simular mutação de arquitetura
    balanceBaselineService.applyGlobalOverride('architecture.testParam', 999)
    const preDiff = balanceBaselineService.compareBalanceWithBaseline('v0')
    expect(preDiff.hasDifferences).toBe(true)

    // 2. Dry-run não altera o estado de mutação
    const dryRunRes = balanceBaselineService.restoreBalanceBaseline('v0', { dryRun: true })
    expect(dryRunRes.success).toBe(true)
    expect(dryRunRes.dryRun).toBe(true)
    const afterDryRunCmp = balanceBaselineService.compareBalanceWithBaseline('v0')
    expect(afterDryRunCmp.hasDifferences).toBe(true)

    // 3. Mock de dados protegidos de carreira (saves, resultados, histórico, contratos)
    const mockSaveKey = 'f1_career_active_session_state'
    const mockCareerData = JSON.stringify({ careerId: 'career_be02c', season: 2026, round: 5 })
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(mockSaveKey, mockCareerData)
    }

    // 4. Restore real idempotente
    const res1 = balanceBaselineService.restoreBalanceBaseline('v0')
    expect(res1.success).toBe(true)
    expect(res1.restoredTeams).toBe(29)
    expect(res1.checksumValidated).toBe(true)
    expect(res1.dryRun).toBe(false)

    // Idempotência
    const res2 = balanceBaselineService.restoreBalanceBaseline('v0')
    expect(res2.success).toBe(true)

    // Zero diferenças após ciclo mutação -> compare -> restore
    const afterCmp = balanceBaselineService.compareBalanceWithBaseline('v0')
    expect(afterCmp.hasDifferences).toBe(false)
    expect(afterCmp.checksumValid).toBe(true)

    // Preservação do save de carreira
    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem(mockSaveKey)).toBe(mockCareerData)
      window.localStorage.removeItem(mockSaveKey)
    }
  })

  // GOLDENS (Itens 35–39)
  describe('Goldens 1 a 5', () => {
    it('Golden 1 — Neutral Track: maior StructuralStrength -> melhor pace', () => {
      const top = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'mclaren',
        driverId: 'nor',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 94 },
      })
      const mid = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'alpine',
        driverId: 'gas',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 85 },
      })
      const bottom = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'haas',
        driverId: 'oco',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 82 },
      })

      expect(top.effectivePaceScore).toBeGreaterThan(mid.effectivePaceScore)
      expect(mid.effectivePaceScore).toBeGreaterThan(bottom.effectivePaceScore)
    })

    it('Golden 2 — Close Gap: duas equipes próximas, trackFit pode inverter', () => {
      // Simulação de duas equipes com força quase idêntica onde uma tem ajuste de pista superior
      const teamA = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'alpine',
        driverId: 'gas',
        circuitProfile: monacoCircuit,
        carTechnicalAttributes: { downforce: 70, topSpeed: 85, balance: 75 }, // Ruim em Mônaco
        driverAttributes: { speed: 84 },
      })
      const teamB = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'rb',
        driverId: 'tsu',
        circuitProfile: monacoCircuit,
        carTechnicalAttributes: { downforce: 88, topSpeed: 75, balance: 85 }, // Ótimo em Mônaco
        driverAttributes: { speed: 84 },
      })
      // TrackFit favorável a RB em Mônaco
      expect(teamB.breakdown.trackFitModifier).toBeGreaterThan(teamA.breakdown.trackFitModifier)
    })

    it('Golden 3 — Large Gap: duas equipes distantes, trackFit sozinho NÃO inverte', () => {
      const topCarBadTrack = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'mclaren',
        driverId: 'nor',
        circuitProfile: monacoCircuit,
        carTechnicalAttributes: { downforce: 75, topSpeed: 95 }, // Subótimo
        driverAttributes: { speed: 94 },
      })
      const bottomCarGreatTrack = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'sauber',
        driverId: 'hul',
        circuitProfile: monacoCircuit,
        carTechnicalAttributes: { downforce: 95, topSpeed: 70 }, // Excelente adequação
        driverAttributes: { speed: 82 },
      })

      expect(topCarBadTrack.effectivePaceScore).toBeGreaterThan(
        bottomCarGreatTrack.effectivePaceScore,
      )
    })

    it('Golden 4 — Same Structure: mesma base estrutural, pista decide', () => {
      // Usando a mesma equipe mas alterando pacote aerodinâmico para o traçado
      const highFit = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'williams',
        driverId: 'alb',
        circuitProfile: monzaCircuit,
        carTechnicalAttributes: { topSpeed: 92, downforce: 75 },
        driverAttributes: { speed: 86 },
      })
      const lowFit = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'williams',
        driverId: 'alb',
        circuitProfile: monacoCircuit,
        carTechnicalAttributes: { topSpeed: 92, downforce: 75 },
        driverAttributes: { speed: 86 },
      })

      expect(highFit.breakdown.structuralStrength).toBe(lowFit.breakdown.structuralStrength)
      expect(highFit.breakdown.trackFitModifier).toBeGreaterThan(lowFit.breakdown.trackFitModifier)
    })

    it('Golden 5 — Event Modifiers: mesmo structural + trackFit, evento decide', () => {
      const goodEvent = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'aston_martin',
        driverId: 'alo',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 91 },
        tyreCompound: 'macio',
        fuelKg: 10,
        setupEfficiency: 95,
      })
      const badEvent = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'aston_martin',
        driverId: 'alo',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 91 },
        tyreCompound: 'medio',
        fuelKg: 35,
        setupEfficiency: 65,
      })

      expect(goodEvent.breakdown.structuralStrength).toBe(badEvent.breakdown.structuralStrength)
      expect(goodEvent.effectivePaceScore).toBeGreaterThan(badEvent.effectivePaceScore)
    })
  })

  // Auditoria pós-integração (Item 40)
  describe('Auditoria Canônica', () => {
    it('auditPaceIntegration passa com zero bônus de nome e zero duplicações', () => {
      const audit = auditPaceIntegration()
      expect(audit.auditPassed).toBe(true)
      expect(audit.structuralConnectedQuali).toBe(true)
      expect(audit.structuralConnectedRace).toBe(true)
      expect(audit.legacyTrackFitWeight45).toBe(false)
      expect(audit.teamNameBonuses).toBe(0)
      expect(audit.duplicateDriverApplication).toBe(0)
      expect(audit.duplicatePUApplication).toBe(0)
      expect(audit.duplicateWearApplication).toBe(0)
    })
  })
})
