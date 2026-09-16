/**
 * race-canonical-physics-1b2.test.ts
 *
 * Suíte de Testes Obrigatórios para o Micro-Patch BLOCO 1B.2:
 * Física Canônica da Corrida ao Vivo (Live Race Pace & Track Fit).
 *
 * Requisitos cobertos:
 * 1. P&D -> LIVE RACE PACE (decisivo): fixture ponta a ponta, carro baseline vs carro B
 *    com upgrade real de P&D -> diferença mensurável e coerente no tempo de volta livre (calculateFreeLapPaceSec).
 * 2. TRACK SPECIFICITY NO RITMO DE CORRIDA:
 *    - +10 fastCorner tem maior impacto em high-speed (Suzuka) que em slow-speed (Monaco);
 *    - +10 slowCorner tem maior impacto em circuito lento (Monaco) que em veloz (Monza);
 *    - +10 topSpeed tem maior impacto em circuito de reta (Monza) que travado (Monaco).
 * 3. TRACK FIT DIFERENTE EM CORRIDA: mesmo carro em dois circuitos distintos produz Track Fit diferente no ritmo livre.
 * 4. FALLBACK GUARD (SAVE CANÔNICO): com technical_attributes válidos -> fallback 75/75 NÃO utilizado no live race pace.
 * 5. SAVE LEGACY: sem technical_attributes -> carTechnicalService.ensureTechnicalData resolve e calcula ritmo normalmente.
 * 6. AUDITORIA: auditLiveRaceCanonicalIntegration valida presença de dados canônicos e ausência de fallback.
 */

import { describe, it, expect } from 'vitest'
import { calculateFreeLapPaceSec } from '@/lib/f1-race-sim-engine'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { TechnicalAttributesMap } from '@/types/car-technical-model'

/**
 * Função de auditoria formal de integração canônica da corrida ao vivo
 */
export function auditLiveRaceCanonicalIntegration(params: {
  team: any
  driver: {
    speed: number
    morale?: number
    physicalCondition?: number
    consistency?: number
    defense?: number
    rain?: number
  }
  round: number
  isAi?: boolean
  aiKey?: string
  aiStrength?: number
  engineSupplier?: string
}) {
  const circuitProfile = resolveCircuitProfile({ round: params.round })

  let techAttrs: TechnicalAttributesMap | undefined
  let chassisRating = 75
  let supplier = params.engineSupplier || params.team?.engine_supplier || 'Audi'

  if (params.isAi) {
    const aiCleanKey = (params.aiKey || 'ferrari').replace('team_ai_', '').replace('ai_', '')
    const aiTech = carTechnicalService.getOrCreateTeamTechnicalData(
      aiCleanKey,
      params.aiStrength || 75,
      params.engineSupplier || 'Ferrari',
    )
    techAttrs = aiTech.attributes
    chassisRating = aiTech.calculatedOverall
    supplier = params.engineSupplier || 'Ferrari'
  } else {
    const enriched = carTechnicalService.ensureTechnicalData(params.team)
    techAttrs = enriched.technical_attributes
    chassisRating = enriched.calculated_overall
  }

  const pu = OFFICIAL_POWER_UNITS[supplier] || OFFICIAL_POWER_UNITS.Ferrari
  const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))
  const carPerfRating = Number((chassisRating * 0.7 + puRating * 0.3).toFixed(1))

  const hasTechAttrs = !!(
    techAttrs &&
    typeof techAttrs.slowCorner === 'number' &&
    typeof techAttrs.topSpeed === 'number'
  )

  const freeLapResult = calculateFreeLapPaceSec({
    teamStrength: chassisRating,
    carLevel: chassisRating,
    driver: params.driver,
    weather: 'seco',
    tireCompound: 'medio',
    lapsOnTire: 5,
    wearPercent: 15,
    wearMultiplier: 1.0,
    trackAbrasiveness: 6,
    trackTemp: 35,
    technicalAttributes: techAttrs,
    circuit: circuitProfile,
    chassisRating,
    powerUnitRating: puRating,
    carPerformanceRating: carPerfRating,
    noise: 0,
  })

  // Fallback 75/75 check: se dados canônicos existem, trackFitScore DEVE estar definido no resultado
  const fallback75Used = !freeLapResult.trackFitScore || freeLapResult.trackFitScore === 0

  return {
    passed: hasTechAttrs && !fallback75Used && freeLapResult.freeLapSec > 0,
    hasTechnicalAttributes: hasTechAttrs,
    circuitProfileResolved: !!circuitProfile,
    trackFitCalculated: !!freeLapResult.trackFitScore,
    trackFitScore: freeLapResult.trackFitScore,
    fallback75Used,
    freeLapSec: freeLapResult.freeLapSec,
  }
}

describe('Micro-Patch Bloco 1B.2 — Física Canônica da Corrida ao Vivo (Live Race Pace)', () => {
  const baseTeam: any = {
    id: 'team_player_race_test',
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
    morale: 85,
    physicalCondition: 90,
  }

  // --------------------------------------------------------------------------
  // TESTE 1: P&D -> LIVE RACE PACE (Decisivo)
  // Carro A baseline vs Carro B com upgrade real de P&D no live race loop
  // --------------------------------------------------------------------------
  it('1. P&D -> LIVE RACE PACE: upgrade real de P&D produz ritmo livre sensivelmente mais rápido na corrida', () => {
    const circuit = resolveCircuitProfile({ round: 1 }) // Albert Park
    const pu = OFFICIAL_POWER_UNITS.Mercedes
    const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))

    // Carro A: Baseline
    const carA_attrs: TechnicalAttributesMap = { ...baseTeam.technical_attributes }
    const carA_chassis = carTechnicalService.calculateCarOverall(carA_attrs)
    const carA_perf = Number((carA_chassis * 0.7 + puRating * 0.3).toFixed(1))

    const paceA = calculateFreeLapPaceSec({
      teamStrength: carA_chassis,
      carLevel: carA_chassis,
      driver: baseDriver,
      weather: 'seco',
      tireCompound: 'medio',
      lapsOnTire: 5,
      wearPercent: 15,
      wearMultiplier: 1.0,
      trackAbrasiveness: 6,
      trackTemp: 35,
      technicalAttributes: carA_attrs,
      circuit,
      chassisRating: carA_chassis,
      powerUnitRating: puRating,
      carPerformanceRating: carA_perf,
      noise: 0,
    })

    // Carro B: Pacote de P&D aplicado (+8 pontos médios nos atributos principais)
    const carB_attrs: TechnicalAttributesMap = {
      ...carA_attrs,
      slowCorner: carA_attrs.slowCorner + 8,
      mediumCorner: carA_attrs.mediumCorner + 8,
      fastCorner: carA_attrs.fastCorner + 8,
      topSpeed: carA_attrs.topSpeed + 8,
      acceleration: carA_attrs.acceleration + 8,
      aeroEfficiency: carA_attrs.aeroEfficiency + 8,
    }
    const carB_chassis = carTechnicalService.calculateCarOverall(carB_attrs)
    const carB_perf = Number((carB_chassis * 0.7 + puRating * 0.3).toFixed(1))

    const paceB = calculateFreeLapPaceSec({
      teamStrength: carB_chassis,
      carLevel: carB_chassis,
      driver: baseDriver,
      weather: 'seco',
      tireCompound: 'medio',
      lapsOnTire: 5,
      wearPercent: 15,
      wearMultiplier: 1.0,
      trackAbrasiveness: 6,
      trackTemp: 35,
      technicalAttributes: carB_attrs,
      circuit,
      chassisRating: carB_chassis,
      powerUnitRating: puRating,
      carPerformanceRating: carB_perf,
      noise: 0,
    })

    // Comprovações obrigatórias
    expect(carB_chassis).toBeGreaterThan(carA_chassis)
    expect(paceB.freeLapSec).toBeLessThan(paceA.freeLapSec)

    // Ganho de ritmo livre mensurável (~0.20s a 0.75s por volta)
    const deltaSec = paceA.freeLapSec - paceB.freeLapSec
    expect(deltaSec).toBeGreaterThan(0.2)
    expect(deltaSec).toBeLessThan(0.8)
    expect(paceA.trackFitScore).toBeDefined()
    expect(paceB.trackFitScore).toBeDefined()
  })

  // --------------------------------------------------------------------------
  // TESTE 2: TRACK SPECIFICITY NO LIVE PACE
  // --------------------------------------------------------------------------
  it('2. TRACK SPECIFICITY: sensibilidade direcional no ritmo livre em traçados com perfis distintos', () => {
    const suzuka = resolveCircuitProfile({ round: 3 })
    const monaco = resolveCircuitProfile({ round: 8 })
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

    expect(tfFastSuzuka).toBeGreaterThan(tfFastMonaco)

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

    expect(tfSlowMonaco).toBeGreaterThan(tfSlowMonza)

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

    expect(tfSpeedMonza).toBeGreaterThan(tfSpeedMonaco)
  })

  // --------------------------------------------------------------------------
  // TESTE 3: TRACK FIT DIFERENTE
  // --------------------------------------------------------------------------
  it('3. TRACK FIT DIFERENTE: carro focado em reta pontua melhor em Monza do que em Mônaco no ritmo de corrida', () => {
    const monaco = resolveCircuitProfile({ round: 8 })
    const monza = resolveCircuitProfile({ round: 15 })

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
    expect(fitMonza).toBeGreaterThan(fitMonaco)
  })

  // --------------------------------------------------------------------------
  // TESTE 4: FALLBACK GUARD
  // --------------------------------------------------------------------------
  it('4. FALLBACK GUARD: save canônico com technical_attributes computa trackFitScore e não usa fallback 75/75', () => {
    const audit = auditLiveRaceCanonicalIntegration({
      team: baseTeam,
      driver: baseDriver,
      round: 1,
    })

    expect(audit.passed).toBe(true)
    expect(audit.hasTechnicalAttributes).toBe(true)
    expect(audit.circuitProfileResolved).toBe(true)
    expect(audit.trackFitCalculated).toBe(true)
    expect(audit.fallback75Used).toBe(false)
    expect(audit.trackFitScore).toBeGreaterThan(0)
  })

  // --------------------------------------------------------------------------
  // TESTE 5: SAVE LEGACY
  // --------------------------------------------------------------------------
  it('5. SAVE LEGACY: equipe sem technical_attributes é enriquecida e roda corrida canônica normalmente', () => {
    const legacyTeam = {
      id: 'legacy_team_old_save_race',
      name: 'Legacy Squad',
      strength: 78,
      engine_supplier: 'Ferrari',
    }

    const audit = auditLiveRaceCanonicalIntegration({
      team: legacyTeam,
      driver: baseDriver,
      round: 2,
    })

    expect(audit.passed).toBe(true)
    expect(audit.hasTechnicalAttributes).toBe(true)
    expect(audit.fallback75Used).toBe(false)
    expect(audit.freeLapSec).toBeGreaterThan(60)
  })

  // --------------------------------------------------------------------------
  // TESTE 6: RIVAIS IA CANÔNICOS NA CORRIDA AO VIVO
  // --------------------------------------------------------------------------
  it('6. RIVAIS IA: participantes da IA calculam ritmo com seus atributos de fábrica e fornecedor de PU', () => {
    const auditFerrari = auditLiveRaceCanonicalIntegration({
      team: null,
      driver: { speed: 92, morale: 88, physicalCondition: 90 },
      round: 15, // Monza
      isAi: true,
      aiKey: 'ferrari',
      aiStrength: 91,
      engineSupplier: 'Ferrari',
    })

    expect(auditFerrari.passed).toBe(true)
    expect(auditFerrari.hasTechnicalAttributes).toBe(true)
    expect(auditFerrari.trackFitCalculated).toBe(true)
    expect(auditFerrari.fallback75Used).toBe(false)
  })
})
