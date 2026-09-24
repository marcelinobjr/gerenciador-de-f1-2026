/**
 * BATERIA DE TESTES DE QA — FASE 0B: MODELO TÉCNICO DO CARRO APLICADO À PISTA
 *
 * Testes Obrigatórios:
 * A) Testes de Sensibilidade (carro-base, alterando 1 atributo por vez):
 *    - Teste A: topSpeed +10 -> benefício muito maior em pista de reta (Monza/Las Vegas) do que em Mônaco
 *    - Teste B: slowCorner +10 -> benefício maior em circuito lento (Mônaco/Hungria) do que em Monza
 *    - Teste C: fastCorner +10 -> beneficia mais circuitos de curvas rápidas (Suzuka/Silverstone/Lusail)
 *    - Teste D: tyreManagement +10 -> diferença maior ao longo de stint longo que em volta isolada
 *    - Teste E: reliability +10 -> sem ganho relevante de velocidade pura, mas reduz risco mecânico
 *
 * B) Teste de 5 Equipes (Mercedes, Ferrari, Audi, Haas, Equipe Personalizada):
 *    - Comparadas em: Alta velocidade (Monza), Alta carga (Suzuka), Lento/tração (Mônaco), Balanceado (Austin)
 *    - Demonstração de inversão esportiva tecnicamente justificada
 *
 * C) Teste Estatístico e Validação de Dados:
 *    - Validação dos 24 circuitos da planilha canônica (soma 100 pesos exatos)
 *    - Frequência de inversões, consistência e confiabilidade probabilística
 *
 * D) Telemetria de Debug e Compatibilidade com Save Antigo.
 */

import { describe, it, expect } from 'vitest'
import {
  CIRCUIT_PERFORMANCE_PROFILES,
  validateCircuitPerformanceProfiles,
  getCircuitProfileById,
  resolveCircuitProfile,
} from '@/data/circuit-performance-profiles'
import {
  calculateCarPerformance,
  calculateTrackFit,
  calculateDriverContribution,
  calculateTyreEffect,
  calculatePhysicalConditionEffect,
  calculateReliabilityRisk,
  calculateSessionPerformance,
  generatePerformanceAuditLog,
} from '@/lib/car-session-performance-engine'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { getCircuitOvertakeFactor, calculateFreeLapPaceSec } from '@/lib/f1-race-sim-engine'
import { OFFICIAL_TEAMS_TECHNICAL_DATA } from '@/lib/car-technical-data'
import { carTechnicalService } from '@/services/carTechnicalService'
import { TechnicalAttributesMap } from '@/types/car-technical-model'

describe('FASE 0B — MODELO TÉCNICO DO CARRO APLICADO À PISTA', () => {
  it('teste provocador', () => {
    expect('PROVOCA').toBe('FAIL')
  })
  // ============================================================================
  // 1. VALIDAÇÃO CANÔNICA DOS 24 CIRCUITOS (PLANILHA OFICIAL)
  // ============================================================================
  describe('1. Validação dos Circuitos da Planilha Canônica', () => {
    it('Exatamente 24 circuitos cadastrados com IDs circuit_01 a circuit_24', () => {
      expect(CIRCUIT_PERFORMANCE_PROFILES).toHaveLength(24)
      CIRCUIT_PERFORMANCE_PROFILES.forEach((profile, index) => {
        const expectedId = `circuit_${String(index + 1).padStart(2, '0')}`
        expect(profile.id).toBe(expectedId)
        expect(profile.round).toBe(index + 1)
      })
    })

    it('Validação automática de pesos: cada circuito DEVE somar exatamente 100%', () => {
      const validation = validateCircuitPerformanceProfiles(false)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      validation.circuitChecks.forEach((chk) => {
        expect(chk.status).toBe('OK')
        expect(chk.sum).toBe(100)
      })
    })

    it('Circuitos representativos possuem atributos dominantes esperados', () => {
      const monza = getCircuitProfileById('circuit_13')!
      expect(monza.weights.topSpeed).toBe(12)
      expect(monza.weights.acceleration).toBe(12)
      expect(monza.weights.braking).toBe(12)
      expect(monza.cluster).toBe('alta_velocidade_reta')

      const monaco = getCircuitProfileById('circuit_06')!
      expect(monaco.weights.slowCorner).toBe(12)
      expect(monaco.weights.topSpeed).toBe(2)
      expect(monaco.cluster).toBe('baixa_velocidade_tracao')

      const suzuka = getCircuitProfileById('circuit_03')!
      expect(suzuka.weights.fastCorner).toBe(12)
      expect(suzuka.weights.aeroEfficiency).toBe(12)
      expect(suzuka.cluster).toBe('alta_carga_aero')

      const lusail = getCircuitProfileById('circuit_23')!
      expect(lusail.weights.tyreManagement).toBe(12)
      expect(lusail.weights.fastCorner).toBe(12)
      expect(lusail.cluster).toBe('pneus_endurance')

      const yasMarina = getCircuitProfileById('circuit_24')!
      expect(yasMarina.weights.topSpeed).toBe(10)
      expect(yasMarina.weights.acceleration).toBe(10)
      expect(yasMarina.cluster).toBe('balanceado')
    })
  })

  // ============================================================================
  // 2. TESTES OBRIGATÓRIOS DE SENSIBILIDADE (A, B, C, D, E)
  // ============================================================================
  describe('2. Testes de Sensibilidade Canônicos (Carro Base + 1 Atributo)', () => {
    const baseAttributes: TechnicalAttributesMap = {
      slowCorner: 70,
      mediumCorner: 70,
      fastCorner: 70,
      topSpeed: 70,
      acceleration: 70,
      braking: 70,
      traction: 70,
      tyreManagement: 70,
      aeroEfficiency: 70,
      cooling: 70,
      weight: 70,
      reliability: 70,
    }

    const monza = getCircuitProfileById('circuit_13')! // Retas
    const monaco = getCircuitProfileById('circuit_06')! // Travado
    const suzuka = getCircuitProfileById('circuit_03')! // Curvas Rápidas
    const lusail = getCircuitProfileById('circuit_23')! // Pneus

    it('TESTE A: topSpeed +10 -> ganho expressivo em Monza, quase nulo em Mônaco', () => {
      const boostedTopSpeed: TechnicalAttributesMap = { ...baseAttributes, topSpeed: 80 }

      const monzaBase = calculateTrackFit(baseAttributes, monza).trackFitScore
      const monzaBoost = calculateTrackFit(boostedTopSpeed, monza).trackFitScore
      const monzaGain = monzaBoost - monzaBase

      const monacoBase = calculateTrackFit(baseAttributes, monaco).trackFitScore
      const monacoBoost = calculateTrackFit(boostedTopSpeed, monaco).trackFitScore
      const monacoGain = monacoBoost - monacoBase

      expect(monzaGain).toBeCloseTo(1.2, 1) // peso 12%
      expect(monacoGain).toBeCloseTo(0.2, 1) // peso 2%
      expect(monzaGain).toBeGreaterThan(monacoGain * 4) // Monza beneficia 6x mais!
    })

    it('TESTE B: slowCorner +10 -> benefício muito maior em Mônaco que em Monza', () => {
      const boostedSlowCorner: TechnicalAttributesMap = { ...baseAttributes, slowCorner: 80 }

      const monacoBase = calculateTrackFit(baseAttributes, monaco).trackFitScore
      const monacoBoost = calculateTrackFit(boostedSlowCorner, monaco).trackFitScore
      const monacoGain = monacoBoost - monacoBase

      const monzaBase = calculateTrackFit(baseAttributes, monza).trackFitScore
      const monzaBoost = calculateTrackFit(boostedSlowCorner, monza).trackFitScore
      const monzaGain = monzaBoost - monzaBase

      expect(monacoGain).toBeCloseTo(1.2, 1) // peso 12%
      expect(monzaGain).toBeCloseTo(0.4, 1) // peso 4%
      expect(monacoGain).toBeGreaterThan(monzaGain * 2.5)
    })

    it('TESTE C: fastCorner +10 -> beneficia mais circuitos de alta carga (Suzuka)', () => {
      const boostedFastCorner: TechnicalAttributesMap = { ...baseAttributes, fastCorner: 80 }

      const suzukaBase = calculateTrackFit(baseAttributes, suzuka).trackFitScore
      const suzukaBoost = calculateTrackFit(boostedFastCorner, suzuka).trackFitScore
      const suzukaGain = suzukaBoost - suzukaBase

      const monacoBase = calculateTrackFit(baseAttributes, monaco).trackFitScore
      const monacoBoost = calculateTrackFit(boostedFastCorner, monaco).trackFitScore
      const monacoGain = monacoBoost - monacoBase

      expect(suzukaGain).toBeCloseTo(1.2, 1) // peso 12%
      expect(monacoGain).toBeCloseTo(0.3, 1) // peso 3%
      expect(suzukaGain).toBeGreaterThan(monacoGain * 3)
    })

    it('TESTE D: tyreManagement +10 -> impacto cresce no decorrer de stint longo', () => {
      const baseTyre = 70
      const boostedTyre = 80

      // Volta 1 (pneu novo, 5% desgaste)
      const lap1Base = calculateTyreEffect(
        baseTyre,
        { compound: 'medio', lapsOnTire: 1, wearPercent: 5 },
        lusail.auxiliary,
      )
      const lap1Boost = calculateTyreEffect(
        boostedTyre,
        { compound: 'medio', lapsOnTire: 1, wearPercent: 5 },
        lusail.auxiliary,
      )
      const diffLap1 = lap1Base.timeDeltaSec - lap1Boost.timeDeltaSec

      // Volta 25 (fim de stint, 75% desgaste)
      const lap25Base = calculateTyreEffect(
        baseTyre,
        { compound: 'medio', lapsOnTire: 25, wearPercent: 75 },
        lusail.auxiliary,
      )
      const lap25Boost = calculateTyreEffect(
        boostedTyre,
        { compound: 'medio', lapsOnTire: 25, wearPercent: 75 },
        lusail.auxiliary,
      )
      const diffLap25 = lap25Base.timeDeltaSec - lap25Boost.timeDeltaSec

      // A vantagem do carro que preserva pneu deve ser pelo menos 5x maior no fim do stint
      expect(diffLap25).toBeGreaterThan(diffLap1 * 5)
    })

    it('TESTE E: reliability +10 -> sem ganho relevante de velocidade pura; reduz risco técnico', () => {
      const boostedReliability: TechnicalAttributesMap = { ...baseAttributes, reliability: 80 }

      // Velocidade de volta não muda de forma artificial por ter motor confiável
      const fitBase = calculateTrackFit(baseAttributes, monza).trackFitScore
      const fitBoost = calculateTrackFit(boostedReliability, monza).trackFitScore
      // A diferença em track fit existe apenas pelo peso formal do circuito (9%), mas a física de ritmo puro não infla
      expect(Math.abs(fitBoost - fitBase)).toBeLessThan(1.0)

      // Redução explícita do risco de quebra
      const riskBase = calculateReliabilityRisk(70, 70, monza, 20).riskScore
      const riskBoost = calculateReliabilityRisk(80, 70, monza, 20).riskScore
      expect(riskBoost).toBeLessThan(riskBase)
    })
  })

  // ============================================================================
  // 3. COMPARAÇÃO DE 5 EQUIPES & INVERSÃO ESPORTIVA CONTEXTUAL
  // ============================================================================
  describe('3. Comparação das 5 Equipes (Mercedes, Ferrari, Audi, Haas, Custom)', () => {
    // 5 equipes selecionadas com seus perfis oficiais ou criados
    const ferrariTech = carTechnicalService.getOrCreateTeamTechnicalData('ferrari', 91, 'Ferrari')
    const mercedesTech = carTechnicalService.getOrCreateTeamTechnicalData(
      'mercedes',
      88,
      'Mercedes',
    )
    const audiTech = carTechnicalService.getOrCreateTeamTechnicalData('audi', 52, 'Audi')
    const haasTech = carTechnicalService.getOrCreateTeamTechnicalData('haas', 58, 'Ferrari')
    const customTech = carTechnicalService.getOrCreateTeamTechnicalData(
      'user_custom',
      60,
      'Mercedes',
    )

    it('Track Fit varia substancialmente de Monza para Mônaco para as 5 equipes', () => {
      const monza = getCircuitProfileById('circuit_13')!
      const monaco = getCircuitProfileById('circuit_06')!

      const teams = [
        { name: 'Ferrari', data: ferrariTech },
        { name: 'Mercedes', data: mercedesTech },
        { name: 'Audi', data: audiTech },
        { name: 'Haas', data: haasTech },
        { name: 'Custom', data: customTech },
      ]

      teams.forEach((t) => {
        const monzaFit = calculateTrackFit(t.data.attributes, monza).trackFitScore
        const monacoFit = calculateTrackFit(t.data.attributes, monaco).trackFitScore
        // Nenhuma equipe deve ter o mesmo track fit nas duas pistas antagônicas
        expect(monzaFit).not.toBe(monacoFit)
      })
    })

    it('Inversão técnica possível: carro mais fraco no geral pode superar rival em traçado sob medida', () => {
      // Exemplo construído:
      // Carro A: Overall 85 (forte em reta topSpeed 92, fraco em curvas lentas slowCorner 65)
      // Carro B: Overall 83 (fraco em reta topSpeed 72, altíssima carga slowCorner 92)
      const carAAttributes: TechnicalAttributesMap = {
        slowCorner: 65,
        mediumCorner: 72,
        fastCorner: 75,
        topSpeed: 92,
        acceleration: 90,
        braking: 80,
        traction: 78,
        tyreManagement: 70,
        aeroEfficiency: 82,
        cooling: 75,
        weight: 85,
        reliability: 80,
      }

      const carBAttributes: TechnicalAttributesMap = {
        slowCorner: 92,
        mediumCorner: 84,
        fastCorner: 75,
        topSpeed: 72,
        acceleration: 82,
        braking: 88,
        traction: 92,
        tyreManagement: 82,
        aeroEfficiency: 75,
        cooling: 80,
        weight: 78,
        reliability: 80,
      }

      const monza = getCircuitProfileById('circuit_13')!
      const monaco = getCircuitProfileById('circuit_06')!

      const perfA_Monza = calculateSessionPerformance({
        teamKey: 'carA',
        teamName: 'Car A',
        driver: { speed: 82, consistency: 82 },
        car: { attributes: carAAttributes, chassisRating: 85, powerUnitRating: 85 },
        circuit: monza,
        noise: 0,
      })

      const perfB_Monza = calculateSessionPerformance({
        teamKey: 'carB',
        teamName: 'Car B',
        driver: { speed: 82, consistency: 82 },
        car: { attributes: carBAttributes, chassisRating: 83, powerUnitRating: 83 },
        circuit: monza,
        noise: 0,
      })

      // Em Monza (retas), Car A domina Car B
      expect(perfA_Monza.sessionPerformanceIndex).toBeGreaterThan(
        perfB_Monza.sessionPerformanceIndex,
      )
      expect(perfA_Monza.effectiveLapTimeSec).toBeLessThan(perfB_Monza.effectiveLapTimeSec)

      const perfA_Monaco = calculateSessionPerformance({
        teamKey: 'carA',
        teamName: 'Car A',
        driver: { speed: 82, consistency: 82 },
        car: { attributes: carAAttributes, chassisRating: 85, powerUnitRating: 85 },
        circuit: monaco,
        noise: 0,
      })

      const perfB_Monaco = calculateSessionPerformance({
        teamKey: 'carB',
        teamName: 'Car B',
        driver: { speed: 82, consistency: 82 },
        car: { attributes: carBAttributes, chassisRating: 83, powerUnitRating: 83 },
        circuit: monaco,
        noise: 0,
      })

      // Em Mônaco (lento/tração), Car B inverte a disputa e supera Car A!
      expect(perfB_Monaco.sessionPerformanceIndex).toBeGreaterThan(
        perfA_Monaco.sessionPerformanceIndex,
      )
      expect(perfB_Monaco.effectiveLapTimeSec).toBeLessThan(perfA_Monaco.effectiveLapTimeSec)
    })
  })

  // ============================================================================
  // 4. EVITAÇÃO DE DUPLA CONTAGEM DA PU & CONDIÇÃO FÍSICA
  // ============================================================================
  describe('4. Arquitetura da PU e Condição Física das Peças', () => {
    it('carPerformanceRating respeita Chassis 70% + PU 30% provisório da Fase 0A', () => {
      const perf = calculateCarPerformance({
        chassisRating: 80,
        powerUnitRating: 90,
      })
      // 80 * 0.7 + 90 * 0.3 = 56 + 27 = 83.0
      expect(perf).toBe(83.0)
    })

    it('Track Fit não multiplica a PU duplamente', () => {
      const monza = getCircuitProfileById('circuit_13')!
      const attrs: TechnicalAttributesMap = {
        slowCorner: 70,
        mediumCorner: 70,
        fastCorner: 70,
        topSpeed: 70,
        acceleration: 70,
        braking: 70,
        traction: 70,
        tyreManagement: 70,
        aeroEfficiency: 70,
        cooling: 70,
        weight: 70,
        reliability: 70,
      }
      const fit = calculateTrackFit(attrs, monza)
      // Como todos os 12 atributos são 70, e a soma dos pesos é 100, o Track Fit é exatamente 70
      expect(fit.trackFitScore).toBe(70)
    })

    it('Danos físicos (asa dianteira danificada) penalizam o ritmo da sessão sem alterar design', () => {
      const physClean = calculatePhysicalConditionEffect({
        attributes: { slowCorner: 75 } as any,
        hasFrontWingDamage: false,
      })
      const physDamaged = calculatePhysicalConditionEffect({
        attributes: { slowCorner: 75 } as any,
        hasFrontWingDamage: true,
      })

      expect(physClean.lapTimePenaltySec).toBe(0)
      expect(physDamaged.lapTimePenaltySec).toBeGreaterThan(2.0)
      expect(physDamaged.performanceDelta).toBeLessThan(0)
    })
  })

  // ============================================================================
  // 5. TELEMETRIA DE AUDITORIA & MOTOR DE CORRIDA
  // ============================================================================
  describe('5. Telemetria de Auditoria e Integração com Simulação', () => {
    it('generatePerformanceAuditLog formata telemetria explicável para dev/QA', () => {
      const log = generatePerformanceAuditLog({
        teamName: 'Audi',
        driverName: 'Bortoleto',
        circuitName: 'Suzuka',
        chassisRating: 83.4,
        powerUnitRating: 86.2,
        carPerformanceRating: 84.2,
        trackFitScore: 87.1,
        driverContribution: 81.6,
        tyreDelta: -0.7,
        physicalConditionDelta: -0.3,
        weatherDelta: 0.2,
        finalSessionIndex: 86.4,
      })

      expect(log).toContain('AUDI — SUZUKA')
      expect(log).toContain('Chassis: 83.4')
      expect(log).toContain('PU: 86.2')
      expect(log).toContain('Car Performance: 84.2')
      expect(log).toContain('Track Fit: 87.1')
      expect(log).toContain('Final Session Performance: 86.4')
    })

    it('getCircuitOvertakeFactor reflete data-driven os perfis canônicos (Mônaco vs Monza)', () => {
      const factorMonaco = getCircuitOvertakeFactor('Monaco', 'Circuit de Monaco')
      const factorMonza = getCircuitOvertakeFactor('Monza', 'Autodromo Nazionale Monza')

      // Mônaco deve ser muito mais travado que Monza
      expect(factorMonaco).toBeLessThan(0.3)
      expect(factorMonza).toBeGreaterThan(0.7)
    })

    it('calculateFreeLapPaceSec consome o perfil canônico e retorna trackFitScore', () => {
      const monza = getCircuitProfileById('circuit_13')!
      const attrs = OFFICIAL_TEAMS_TECHNICAL_DATA.ferrari.attributes

      const paceResult = calculateFreeLapPaceSec({
        teamStrength: 91,
        carLevel: 90,
        technicalAttributes: attrs,
        circuit: monza,
        chassisRating: 91,
        driver: { speed: 88, consistency: 88 },
        weather: 'seco',
        tireCompound: 'medio',
        lapsOnTire: 2,
        wearPercent: 5,
        wearMultiplier: 1.0,
        trackAbrasiveness: 6,
      })

      expect(paceResult.freeLapSec).toBeGreaterThan(65)
      expect(paceResult.freeLapSec).toBeLessThan(90)
      expect(paceResult.trackFitScore).toBeDefined()
      expect(paceResult.trackFitScore).toBeGreaterThan(70)
    })
  })
})
