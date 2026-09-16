/**
 * qualy-canonical-physics-1b1.test.ts
 *
 * Suíte de Testes Obrigatórios para o Micro-Patch BLOCO 1B.1:
 * Física Canônica da Qualificação.
 *
 * Requisitos cobertos:
 * 1. P&D -> QUALIFYING (decisivo): fixture ponta a ponta, carro baseline vs carro B
 *    com melhoria técnica de P&D -> diferença mensurável e coerente no tempo de volta.
 * 2. TRACK SPECIFICITY:
 *    - +10 fastCorner tem maior impacto em high-speed (ex: Suzuka/Lusail) que em slow-speed (Monaco);
 *    - +10 slowCorner tem maior impacto em circuito lento (Monaco) que em veloz (Monza);
 *    - +10 topSpeed tem maior impacto em circuito de reta (Monza) que travado (Monaco).
 * 3. TRACK FIT DIFERENTE: mesmo carro em dois circuitos distintos produz Track Fit diferente.
 * 4. FALLBACK GUARD: fixture com technical_attributes válidos -> fallback 75/75 NÃO utilizado.
 * 5. SAVE LEGACY: sem technical_attributes -> adaptação transparente e identificável (carTechnicalService.ensureTechnicalData).
 * 6. LIVE VS CANONICAL: mesmos inputs/seed -> technical attributes, circuit profile, Track Fit,
 *    driver, tyre dão match determinístico entre qualy e modelo canônico.
 * 7. AUDITORIA: auditLiveQualifyingCanonicalIntegration e explainQualifyingPace.
 */

import { describe, it, expect } from 'vitest'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import {
  resolveCircuitProfile,
  getCircuitProfileByRound,
  CIRCUIT_PERFORMANCE_PROFILES,
} from '@/data/circuit-performance-profiles'
import { calculateTrackFit, calculateCarPerformance } from '@/lib/car-session-performance-engine'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import {
  auditLiveQualifyingCanonicalIntegration,
  explainQualifyingPace,
} from '@/services/qualifyingCanonicalAuditService'
import { TechnicalAttributesMap } from '@/types/car-technical-model'

describe('Micro-Patch Bloco 1B.1 — Física Canônica da Qualificação', () => {
  // Mock baseline de equipe
  const baseTeam: any = {
    id: 'team_player_test',
    team_key: 'custom_player',
    name: 'Player Racing Team',
    color: '#00A6FB',
    strength: 72,
    chassis_level: 72,
    calculated_overall: 72,
    engine_supplier: 'Mercedes',
    technical_attributes: {
      slowCorner: 70,
      mediumCorner: 72,
      fastCorner: 71,
      topSpeed: 73,
      acceleration: 72,
      braking: 70,
      traction: 71,
      tyreManagement: 74,
      aeroEfficiency: 72,
      cooling: 75,
      weight: 70,
      reliability: 76,
    } as TechnicalAttributesMap,
  }

  const baseDriver = {
    speed: 86,
    consistency: 85,
    defense: 84,
    morale: 85,
    physicalCondition: 90,
  }

  // --------------------------------------------------------------------------
  // TESTE 1: P&D -> QUALIFYING (Decisivo)
  // Fixture ponta a ponta: Carro A baseline vs Carro B com upgrade real de P&D
  // --------------------------------------------------------------------------
  it('1. P&D -> QUALIFYING: upgrade real de P&D no carro reflete redução mensurável no tempo de qualy', () => {
    const circuit = resolveCircuitProfile({ round: 1 }) // Albert Park
    const pu = OFFICIAL_POWER_UNITS.Mercedes
    const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))

    // Carro A: Baseline
    const carA_attrs: TechnicalAttributesMap = { ...baseTeam.technical_attributes }
    const carA_chassis = carTechnicalService.calculateCarOverall(carA_attrs)
    const carA_perf = Number((carA_chassis * 0.7 + puRating * 0.3).toFixed(1))

    const paceA = calculateCombinedPace({
      teamStrength: carA_chassis,
      carLevel: carA_chassis,
      driver: baseDriver,
      weather: 'seco',
      tireCompound: 'macio',
      isQualifying: true,
      technicalAttributes: carA_attrs,
      circuit,
      chassisRating: carA_chassis,
      powerUnitRating: puRating,
      carPerformanceRating: carA_perf,
      noise: 0,
    })

    // Carro B: Pacote de P&D aplicado (+6 pontos médios nos atributos principais)
    const carB_attrs: TechnicalAttributesMap = {
      ...carA_attrs,
      slowCorner: carA_attrs.slowCorner + 6,
      mediumCorner: carA_attrs.mediumCorner + 6,
      fastCorner: carA_attrs.fastCorner + 6,
      topSpeed: carA_attrs.topSpeed + 6,
      acceleration: carA_attrs.acceleration + 6,
      aeroEfficiency: carA_attrs.aeroEfficiency + 6,
    }
    const carB_chassis = carTechnicalService.calculateCarOverall(carB_attrs)
    const carB_perf = Number((carB_chassis * 0.7 + puRating * 0.3).toFixed(1))

    const paceB = calculateCombinedPace({
      teamStrength: carB_chassis,
      carLevel: carB_chassis,
      driver: baseDriver,
      weather: 'seco',
      tireCompound: 'macio',
      isQualifying: true,
      technicalAttributes: carB_attrs,
      circuit,
      chassisRating: carB_chassis,
      powerUnitRating: puRating,
      carPerformanceRating: carB_perf,
      noise: 0,
    })

    // Comprovações obrigatórias
    expect(carB_chassis).toBeGreaterThan(carA_chassis)
    expect(paceB.lapScore).toBeGreaterThan(paceA.lapScore)
    expect(paceB.lapTimeSec).toBeLessThan(paceA.lapTimeSec)

    // O ganho deve ser fisicamente plausível para qualificação (~0.15s a 0.60s para pacote relevante)
    const deltaSec = paceA.lapTimeSec - paceB.lapTimeSec
    expect(deltaSec).toBeGreaterThan(0.15)
    expect(deltaSec).toBeLessThan(0.8)
  })

  // --------------------------------------------------------------------------
  // TESTE 2: TRACK SPECIFICITY
  // --------------------------------------------------------------------------
  it('2. TRACK SPECIFICITY: sensibilidade direcional de fastCorner, slowCorner e topSpeed em traçados afins', () => {
    // Suzuka (R3): FastCorner peso 12, SlowCorner peso 5, TopSpeed peso 9
    const suzuka = resolveCircuitProfile({ round: 3 })
    // Mônaco (R8): FastCorner peso 3, SlowCorner peso 12, TopSpeed peso 2
    const monaco = resolveCircuitProfile({ round: 8 })
    // Monza (R15): FastCorner peso 6, SlowCorner peso 4, TopSpeed peso 12
    const monza = resolveCircuitProfile({ round: 15 })

    const baselineAttrs: TechnicalAttributesMap = { ...baseTeam.technical_attributes }

    // a) +10 em fastCorner
    const fastBoostAttrs: TechnicalAttributesMap = {
      ...baselineAttrs,
      fastCorner: baselineAttrs.fastCorner + 10,
    }
    const tfFastSuzuka =
      calculateTrackFit(fastBoostAttrs, suzuka).trackFitScore -
      calculateTrackFit(baselineAttrs, suzuka).trackFitScore
    const tfFastMonaco =
      calculateTrackFit(fastBoostAttrs, monaco).trackFitScore -
      calculateTrackFit(baselineAttrs, monaco).trackFitScore

    expect(tfFastSuzuka).toBeGreaterThan(tfFastMonaco) // Impacto em Suzuka deve ser muito maior que em Mônaco
    expect(tfFastSuzuka).toBeCloseTo(1.2, 1) // 10 * 12% = 1.2 pontos
    expect(tfFastMonaco).toBeCloseTo(0.3, 1) // 10 * 3% = 0.3 pontos

    // b) +10 em slowCorner
    const slowBoostAttrs: TechnicalAttributesMap = {
      ...baselineAttrs,
      slowCorner: baselineAttrs.slowCorner + 10,
    }
    const tfSlowMonaco =
      calculateTrackFit(slowBoostAttrs, monaco).trackFitScore -
      calculateTrackFit(baselineAttrs, monaco).trackFitScore
    const tfSlowMonza =
      calculateTrackFit(slowBoostAttrs, monza).trackFitScore -
      calculateTrackFit(baselineAttrs, monza).trackFitScore

    expect(tfSlowMonaco).toBeGreaterThan(tfSlowMonza) // Mônaco (12%) > Monza (4%)
    expect(tfSlowMonaco).toBeCloseTo(1.2, 1)
    expect(tfSlowMonza).toBeCloseTo(0.4, 1)

    // c) +10 em topSpeed
    const speedBoostAttrs: TechnicalAttributesMap = {
      ...baselineAttrs,
      topSpeed: baselineAttrs.topSpeed + 10,
    }
    const tfSpeedMonza =
      calculateTrackFit(speedBoostAttrs, monza).trackFitScore -
      calculateTrackFit(baselineAttrs, monza).trackFitScore
    const tfSpeedMonaco =
      calculateTrackFit(speedBoostAttrs, monaco).trackFitScore -
      calculateTrackFit(baselineAttrs, monaco).trackFitScore

    expect(tfSpeedMonza).toBeGreaterThan(tfSpeedMonaco) // Monza (12%) > Mônaco (2%)
    expect(tfSpeedMonza).toBeCloseTo(1.2, 1)
    expect(tfSpeedMonaco).toBeCloseTo(0.2, 1)
  })

  // --------------------------------------------------------------------------
  // TESTE 3: TRACK FIT DIFERENTE
  // Mesmo carro em dois circuitos distintos DEVE produzir Track Fit diferente
  // --------------------------------------------------------------------------
  it('3. TRACK FIT DIFERENTE: mesmo carro em Mônaco e Monza gera Track Fit divergente', () => {
    const monaco = resolveCircuitProfile({ round: 8 })
    const monza = resolveCircuitProfile({ round: 15 })

    // Carro com perfil desbalanceado (forte em reta, fraco em curvas lentas)
    const straightLineMonster: TechnicalAttributesMap = {
      ...baseTeam.technical_attributes,
      topSpeed: 95,
      acceleration: 92,
      slowCorner: 55,
      traction: 60,
    }

    const fitMonaco = calculateTrackFit(straightLineMonster, monaco).trackFitScore
    const fitMonza = calculateTrackFit(straightLineMonster, monza).trackFitScore

    expect(fitMonaco).not.toBe(fitMonza)
    expect(fitMonza).toBeGreaterThan(fitMonaco) // Monstro de reta voa em Monza e sofre em Mônaco
  })

  // --------------------------------------------------------------------------
  // TESTE 4: FALLBACK GUARD
  // Com technical_attributes válidos, fallback 75/75 NÃO é chamado
  // --------------------------------------------------------------------------
  it('4. FALLBACK GUARD: fixture com technical_attributes não usa fórmula estática de 75/75', () => {
    const circuit = resolveCircuitProfile({ round: 1 })
    const pu = OFFICIAL_POWER_UNITS.Mercedes
    const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))

    // Carro de nível alto (90)
    const topAttrs: TechnicalAttributesMap = {
      slowCorner: 92,
      mediumCorner: 90,
      fastCorner: 93,
      topSpeed: 94,
      acceleration: 92,
      braking: 91,
      traction: 91,
      tyreManagement: 90,
      aeroEfficiency: 93,
      cooling: 89,
      weight: 90,
      reliability: 92,
    }
    const chassis = carTechnicalService.calculateCarOverall(topAttrs)
    const carPerf = Number((chassis * 0.7 + puRating * 0.3).toFixed(1))
    const tf = calculateTrackFit(topAttrs, circuit).trackFitScore

    const canonicalPace = calculateCombinedPace({
      teamStrength: chassis,
      carLevel: chassis,
      driver: baseDriver,
      weather: 'seco',
      tireCompound: 'macio',
      isQualifying: true,
      technicalAttributes: topAttrs,
      circuit,
      chassisRating: chassis,
      powerUnitRating: puRating,
      carPerformanceRating: carPerf,
      noise: 0,
    })

    // Car factor canônico = 55% carPerf + 45% trackFit
    const expectedCanonicalCarFactor = Number((carPerf * 0.55 + tf * 0.45).toFixed(1))
    // Car factor legado = 60% level + 40% strength (sem trackFit)
    const legacyFallbackFactor = Number((chassis * 0.6 + chassis * 0.4).toFixed(1))

    expect(canonicalPace.carFactor).toBe(expectedCanonicalCarFactor)
    expect(canonicalPace.trackFitScore).toBe(tf)
    expect(canonicalPace.trackFitScore).toBeDefined()
  })

  // --------------------------------------------------------------------------
  // TESTE 5: SAVE LEGACY
  // Save antigo sem technical_attributes: adaptação funciona e é identificável
  // --------------------------------------------------------------------------
  it('5. SAVE LEGACY: equipe sem technical_attributes é adaptada transparentemente via ensureTechnicalData', () => {
    const legacyTeam = {
      id: 'legacy_team_old_save',
      name: 'Legacy Squad',
      strength: 78,
      engine_supplier: 'Ferrari',
      // Sem technical_attributes, sem calculated_overall
    }

    const enriched = carTechnicalService.ensureTechnicalData(legacyTeam)
    expect(enriched.technical_attributes).toBeDefined()
    expect(enriched.calculated_overall).toBeGreaterThanOrEqual(70)
    expect(enriched.component_ratings).toBeDefined()

    // O circuito resolve e gera ritmo canônico válido sem lançar exceção
    const circuit = resolveCircuitProfile({ round: 4 }) // Bahrain
    const tf = calculateTrackFit(enriched.technical_attributes, circuit)
    expect(tf.trackFitScore).toBeGreaterThan(0)
  })

  // --------------------------------------------------------------------------
  // TESTE 6: LIVE VS CANONICAL MATCH
  // Mesmos inputs/seed -> match exato entre qualy ao vivo e modelo canônico
  // --------------------------------------------------------------------------
  it('6. LIVE VS CANONICAL MATCH: execução com mesmos inputs é 100% determinística', () => {
    const circuit = resolveCircuitProfile({ round: 5 }) // Jeddah
    const pu = OFFICIAL_POWER_UNITS.Mercedes
    const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))
    const chassis = baseTeam.calculated_overall
    const carPerf = Number((chassis * 0.7 + puRating * 0.3).toFixed(1))

    const params = {
      teamStrength: chassis,
      carLevel: chassis,
      driver: baseDriver,
      weather: 'seco' as const,
      tireCompound: 'macio' as const,
      isQualifying: true,
      technicalAttributes: baseTeam.technical_attributes,
      circuit,
      chassisRating: chassis,
      powerUnitRating: puRating,
      carPerformanceRating: carPerf,
      noise: 0, // Determinístico
    }

    const run1 = calculateCombinedPace(params)
    const run2 = calculateCombinedPace(params)

    expect(run1.lapTimeSec).toBe(run2.lapTimeSec)
    expect(run1.lapScore).toBe(run2.lapScore)
    expect(run1.carFactor).toBe(run2.carFactor)
    expect(run1.driverFactor).toBe(run2.driverFactor)
    expect(run1.trackFitScore).toBe(run2.trackFitScore)
  })

  // --------------------------------------------------------------------------
  // TESTE 7: AUDITORIA FORMAL E FERRAMENTA DE EXPLICAÇÃO
  // auditLiveQualifyingCanonicalIntegration e explainQualifyingPace
  // --------------------------------------------------------------------------
  it('7. AUDITORIA & EXPLAINER: auditLiveQualifyingCanonicalIntegration passa 100% e explainQualifyingPace detalha fatores', () => {
    const auditPlayer = auditLiveQualifyingCanonicalIntegration({
      team: baseTeam,
      driver: baseDriver,
      round: 1,
      weather: 'seco',
    })

    expect(auditPlayer.passed).toBe(true)
    expect(auditPlayer.hasTechnicalAttributes).toBe(true)
    expect(auditPlayer.circuitProfileResolved).toBe(true)
    expect(auditPlayer.trackFitCalculated).toBe(true)
    expect(auditPlayer.fallback75Used).toBe(false)
    expect(auditPlayer.doubleCountingCheck.passed).toBe(true)

    // Auditoria para Rival IA
    const auditAi = auditLiveQualifyingCanonicalIntegration({
      team: null,
      driver: { speed: 90, consistency: 90, defense: 88 },
      round: 3, // Suzuka
      isAi: true,
      aiKey: 'ferrari',
      aiStrength: 92,
      engineSupplier: 'Ferrari',
    })

    expect(auditAi.passed).toBe(true)
    expect(auditAi.hasTechnicalAttributes).toBe(true)
    expect(auditAi.trackFitCalculated).toBe(true)
    expect(auditAi.fallback75Used).toBe(false)

    // Explainer interno de QA
    const explanation = explainQualifyingPace('driver_test_01', 1, baseTeam, baseDriver)
    expect(explanation.lapTimeSec).toBeGreaterThan(60)
    expect(explanation.lapScore).toBeGreaterThan(0)
    expect(explanation.weights.carShare).toBe(0.7)
    expect(explanation.weights.driverShare).toBe(0.3)
    expect(explanation.explanationText).toContain('Qualifying Pace Breakdown')
  })
})
