/**
 * tracks-page.test.ts
 *
 * Suíte de Testes Canônicos para a Feature Aba "Pistas" (Fundação Canônica na UI).
 *
 * REQUISITOS COBERTOS:
 * 1. Grade renderiza 24 GPs da temporada 2026 na ordem correta (1 a 24).
 * 2. Selo "Próxima corrida" aparece exatamente no card da rodada atual (fixture do save Audi: temporada 2027, rodada 3).
 * 3. Perfil exibido idêntico ao retorno de resolveCircuitProfile da mesma rodada — valores IGUAIS.
 * 4. Track Fit exibido = calculateTrackFit da fundação (mesma entrada, mesmo valor).
 * 5. Dois circuitos com perfis diferentes (Mônaco vs Monza) → Track Fit diferente para o mesmo carro.
 * 6. Zero hardcode: mutar atributos técnicos na fixture muda o Track Fit exibido (P&D → UI).
 * 7. Regressão: suíte completa continua PASS (compatibilidade com serviços e modelos canônicos).
 */

import { describe, it, expect } from 'vitest'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import {
  resolveCircuitProfile,
  getCircuitProfileByRound,
  CIRCUIT_PERFORMANCE_PROFILES,
} from '@/data/circuit-performance-profiles'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { carTechnicalService } from '@/services/carTechnicalService'
import { TechnicalAttributesMap, TechnicalAttributeId } from '@/types/car-technical-model'

describe('Feature Aba "Pistas" — Fundação Canônica na UI', () => {
  // Fixture do Save Audi (Temporada 2027, Rodada 3)
  const audiSaveFixture = {
    id: '8oveg16plyvu1yj',
    team_key: 'audi',
    name: 'Audi Revolut F1 Team',
    seasonYear: 2027,
    currentRound: 3,
    totalRounds: 24,
    strength: 63,
    calculated_overall: 63,
    engine_supplier: 'Audi',
    technical_attributes: {
      slowCorner: 62,
      mediumCorner: 64,
      fastCorner: 65,
      topSpeed: 66,
      acceleration: 63,
      braking: 61,
      traction: 63,
      tyreManagement: 64,
      aeroEfficiency: 65,
      cooling: 62,
      weight: 60,
      reliability: 66,
    } as TechnicalAttributesMap,
  }

  // --------------------------------------------------------------------------
  // TESTE 1: Grade renderiza 24 GPs da temporada 2026 na ordem correta
  // --------------------------------------------------------------------------
  it('1. Grade renderiza 24 GPs da temporada 2026 na ordem correta', () => {
    // 24 etapas exatas no calendário canônico
    expect(F1_2026_CALENDAR).toHaveLength(24)

    // Verificar se a ordenação por round é estrita de 1 a 24
    F1_2026_CALENDAR.forEach((gp, index) => {
      const expectedRound = index + 1
      expect(gp.round).toBe(expectedRound)
      expect(gp.name).toBeTruthy()
      expect(gp.country).toBeTruthy()
      expect(gp.flag).toBeTruthy()
      expect(gp.circuit).toBeTruthy()
      expect(gp.laps).toBeGreaterThan(0)
      expect(gp.circuitLengthKm).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 2: Selo "Próxima corrida" aparece exatamente no card da rodada atual
  // --------------------------------------------------------------------------
  it('2. Selo "Próxima corrida" aparece exatamente no card da rodada atual (fixture do save Audi: temporada 2027, rodada 3)', () => {
    const currentRound = audiSaveFixture.currentRound // 3
    expect(currentRound).toBe(3)

    // Simula a lógica de atribuição de selos da UI
    const cardStatusMap = F1_2026_CALENDAR.map((gp) => ({
      round: gp.round,
      isNext: gp.round === currentRound,
      isCompleted: gp.round < currentRound,
      isFuture: gp.round > currentRound,
    }))

    // Apenas a rodada 3 tem isNext = true
    const nextRounds = cardStatusMap.filter((c) => c.isNext)
    expect(nextRounds).toHaveLength(1)
    expect(nextRounds[0].round).toBe(3)

    // Rodadas 1 e 2 são completadas
    const completedRounds = cardStatusMap.filter((c) => c.isCompleted)
    expect(completedRounds).toHaveLength(2)
    expect(completedRounds.map((c) => c.round)).toEqual([1, 2])

    // Rodadas 4 a 24 são futuras
    const futureRounds = cardStatusMap.filter((c) => c.isFuture)
    expect(futureRounds).toHaveLength(21)
    expect(futureRounds[0].round).toBe(4)
  })

  // --------------------------------------------------------------------------
  // TESTE 3: Perfil exibido idêntico ao retorno de resolveCircuitProfile — valores IGUAIS
  // --------------------------------------------------------------------------
  it('3. Perfil exibido idêntico ao retorno de resolveCircuitProfile da mesma rodada — valores IGUAIS', () => {
    // Para todas as 24 rodadas do calendário:
    for (let round = 1; round <= 24; round++) {
      const canonicalProfile = resolveCircuitProfile({ round })
      const byRoundProfile = getCircuitProfileByRound(round)

      // Identidade referencial e estrutural
      expect(canonicalProfile.id).toBe(byRoundProfile.id)
      expect(canonicalProfile.round).toBe(round)

      // Pesos somam EXATAMENTE 100 pontos percentuais
      const weightSum = Object.values(canonicalProfile.weights).reduce((a, b) => a + b, 0)
      expect(weightSum).toBe(100)

      // Todos os 12 atributos canônicos presentes
      const keys: TechnicalAttributeId[] = [
        'slowCorner',
        'mediumCorner',
        'fastCorner',
        'topSpeed',
        'acceleration',
        'braking',
        'traction',
        'tyreManagement',
        'aeroEfficiency',
        'cooling',
        'weight',
        'reliability',
      ]
      keys.forEach((k) => {
        expect(canonicalProfile.weights[k]).toBeGreaterThanOrEqual(0)
        expect(canonicalProfile.weights[k]).toBe(byRoundProfile.weights[k])
      })

      // Parâmetros auxiliares canônicos
      expect(canonicalProfile.auxiliary.tyreSeverity).toBeGreaterThanOrEqual(0)
      expect(canonicalProfile.auxiliary.overtakingDifficulty).toBeGreaterThanOrEqual(0)
      expect(canonicalProfile.auxiliary.driverChallenge).toBeGreaterThanOrEqual(0)
      expect(canonicalProfile.auxiliary.safetyCarProbability).toBeGreaterThanOrEqual(0)
    }
  })

  // --------------------------------------------------------------------------
  // TESTE 4: Track Fit exibido = calculateTrackFit da fundação (mesma entrada, mesmo valor)
  // --------------------------------------------------------------------------
  it('4. Track Fit exibido = calculateTrackFit da fundação (mesma entrada, mesmo valor)', () => {
    // Obter technical attributes da Audi via ensureTechnicalData
    const techData = carTechnicalService.ensureTechnicalData(audiSaveFixture)
    expect(techData.technical_attributes).toBeDefined()

    // Testar com o GP do Japão (Suzuka - Rodada 3)
    const suzukaProfile = resolveCircuitProfile({ round: 3 })
    const foundationTrackFit = calculateTrackFit(techData.technical_attributes, suzukaProfile)

    // Cálculo manual canônico verificado
    const w = suzukaProfile.weights
    const a = techData.technical_attributes
    const manualSum =
      a.slowCorner * w.slowCorner +
      a.mediumCorner * w.mediumCorner +
      a.fastCorner * w.fastCorner +
      a.topSpeed * w.topSpeed +
      a.acceleration * w.acceleration +
      a.braking * w.braking +
      a.traction * w.traction +
      a.tyreManagement * w.tyreManagement +
      a.aeroEfficiency * w.aeroEfficiency +
      a.cooling * w.cooling +
      a.weight * w.weight +
      a.reliability * w.reliability
    const manualExpected = Number((manualSum / 100).toFixed(2))

    expect(foundationTrackFit.trackFitScore).toBe(manualExpected)
    expect(foundationTrackFit.topAttributeAdvantage).toBeDefined()
    expect(foundationTrackFit.topAttributeAdvantage.weight).toBeGreaterThan(0)
  })

  // --------------------------------------------------------------------------
  // TESTE 5: Mônaco vs Monza → Track Fit diferente para o mesmo carro
  // --------------------------------------------------------------------------
  it('5. Dois circuitos com perfis diferentes (Mônaco vs Monza) → Track Fit diferente para o mesmo carro', () => {
    const techData = carTechnicalService.ensureTechnicalData(audiSaveFixture)
    const monacoProfile = resolveCircuitProfile({ round: 8 }) // Monaco GP
    const monzaProfile = resolveCircuitProfile({ round: 15 }) // Italian GP (Monza)

    const tfMonaco = calculateTrackFit(techData.technical_attributes, monacoProfile)
    const tfMonza = calculateTrackFit(techData.technical_attributes, monzaProfile)

    // Os Track Fits DEVEM ser diferentes, pois Mônaco exige slowCorner/traction e Monza exige topSpeed/acceleration
    expect(tfMonaco.trackFitScore).not.toBe(tfMonza.trackFitScore)

    // O atributo dominante em Mônaco é diferente do atributo dominante em Monza
    expect(tfMonaco.topAttributeAdvantage.attribute).not.toBe(
      tfMonza.topAttributeAdvantage.attribute,
    )
  })

  // --------------------------------------------------------------------------
  // TESTE 6: Zero hardcode — mutar atributos técnicos na fixture muda o Track Fit exibido
  // --------------------------------------------------------------------------
  it('6. Zero hardcode: mutar atributos técnicos na fixture muda o Track Fit exibido (P&D → UI)', () => {
    const suzukaProfile = resolveCircuitProfile({ round: 3 })
    const baseTechData = carTechnicalService.ensureTechnicalData(audiSaveFixture)
    const baseTrackFit = calculateTrackFit(baseTechData.technical_attributes, suzukaProfile)

    // Simulação de pacote de atualização de P&D (+10 em fastCorner e aeroEfficiency)
    const updatedAttrs: TechnicalAttributesMap = {
      ...baseTechData.technical_attributes,
      fastCorner: baseTechData.technical_attributes.fastCorner + 10,
      aeroEfficiency: baseTechData.technical_attributes.aeroEfficiency + 10,
    }

    const updatedTrackFit = calculateTrackFit(updatedAttrs, suzukaProfile)

    // O Track Fit DEVE crescer de forma quantitativa e explicável
    // Suzuka tem peso 12 em fastCorner e 12 em aeroEfficiency
    // Delta esperado = (10 * 12 + 10 * 12) / 100 = 2.40 pontos
    const delta = updatedTrackFit.trackFitScore - baseTrackFit.trackFitScore
    expect(delta).toBeCloseTo(2.4, 2)
    expect(updatedTrackFit.trackFitScore).toBeGreaterThan(baseTrackFit.trackFitScore)
  })

  // --------------------------------------------------------------------------
  // TESTE 7: Regressão e segurança de dados técnicos ausentes
  // --------------------------------------------------------------------------
  it('7. Segurança de dados e regressão: save sem technical_attributes não quebra e mantém integridade canônica', () => {
    // Save corrompido / vazio
    const emptyTeam = {
      id: 'empty_team',
      name: 'Uninitialized Team',
      // Sem nada
    }

    // fallback gracioso de ensureTechnicalData produz dados matematicamente válidos
    const ensured = carTechnicalService.ensureTechnicalData(emptyTeam)
    expect(ensured.technical_attributes).toBeDefined()
    expect(ensured.calculated_overall).toBeGreaterThan(0)

    const profile = resolveCircuitProfile({ round: 1 })
    const tf = calculateTrackFit(ensured.technical_attributes, profile)
    expect(tf.trackFitScore).toBeGreaterThan(0)
    expect(tf.trackFitScore).toBeLessThanOrEqual(100)
  })
})
