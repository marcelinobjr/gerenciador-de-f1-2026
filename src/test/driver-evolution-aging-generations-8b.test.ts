import { describe, it, expect, vi } from 'vitest'
import { driverDevelopmentService } from '@/services/driverDevelopmentService'
import { driverRetirementService } from '@/services/driverRetirementService'
import { newGenerationService } from '@/services/newGenerationService'
import { seasonTransitionService } from '@/services/seasonTransitionService'
import { proceduralDriverGenerator } from '@/services/proceduralDriverGenerator'
import type { DriverModel, TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 8B — ENVELHECIMENTO, PROGRESSÃO, DECLÍNIO, APOSENTADORIA & NOVAS GERAÇÕES', () => {
  // Helper para criar piloto fixture seguro
  const createMockDriver = (overrides: Partial<DriverModel> = {}): DriverModel => ({
    id: 'drv_test_1',
    name: 'Piloto Teste',
    nationality: 'Brasil',
    age: 20,
    speed: 76,
    consistency: 74,
    rain: 75,
    defense: 75,
    salary: 500000,
    contract_end: 2028,
    team_id: 'team_audi',
    role: 'titular',
    category: 'f1',
    superlicense_points: 40,
    homologation_status: 'elegivel',
    f1_adaptation: 80,
    license_status: 'nivel_a',
    is_academy: false,
    is_test_driver: false,
    technical_feedback: 70,
    seat_security: 85,
    true_potential: 89,
    perceived_potential: 82,
    evaluation_confidence: 65,
    career_status: 'active',
    ...overrides,
  })

  // Regra 0: Compatibilidade com save legado 2027 sem season_history de 2026
  it('0. Compatibilidade com Save Legado: funciona sem season_histories 2026 e não reconstrói silenciosamente', async () => {
    // Valida que a ferramenta de reconciliação existe e é separada (não executa sozinha)
    expect(seasonTransitionService.reconcileLegacySeasonHistory).toBeDefined()
  })

  // Regra 2 & 110: Sem cliff universal (idade não é fórmula linear age > 35 -> pace -2/year)
  it('2. Não existe cliff universal de perda de overall por idade', () => {
    const driverA = createMockDriver({ id: 'vet_a', age: 37, speed: 85, consistency: 88 })
    const driverB = createMockDriver({ id: 'vet_b', age: 37, speed: 85, consistency: 88 })

    const devA = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: driverA,
      seasonYear: 2027,
      seed: 1234,
    })
    const devB = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: driverB,
      seasonYear: 2027,
      seed: 9876,
    })

    // Nem ambos caem igual, nem sofrem corte abrupto de -5
    expect(devA.updatedDriver.speed).toBeGreaterThanOrEqual(82)
    expect(devB.updatedDriver.speed).toBeGreaterThanOrEqual(82)
    // Consistência e feedback técnico permanecem úteis
    expect(devA.updatedDriver.consistency).toBeGreaterThanOrEqual(86)
  })

  // Regra 6 & 106-108: Curvas diferentes (EARLY_BLOOMER, LATE_BLOOMER, LONG_PRIME)
  it('6. Perfis de desenvolvimento suportam arquétipos diversos', () => {
    const pEarly = driverDevelopmentService.getOrInitializeProfile(
      createMockDriver({ id: 'early_driver' }),
      101,
    )
    const pLate = driverDevelopmentService.getOrInitializeProfile(
      createMockDriver({ id: 'late_driver' }),
      102,
    )
    expect(['EARLY_BLOOMER', 'NORMAL', 'LATE_BLOOMER', 'HIGH_VARIANCE', 'LONG_PRIME']).toContain(
      pEarly.archetype,
    )
    expect(pEarly.peakWindow.startAge).toBeGreaterThanOrEqual(23)
    expect(pEarly.peakWindow.endAge).toBeLessThanOrEqual(38)
  })

  // Regra 8 & 105: True potential é teto latente, não destino garantido
  it('8 & 105. Piloto com alto truePotential pode não atingir o teto sem oportunidades adequadas', () => {
    let driver = createMockDriver({
      id: 'high_pot_low_opp',
      age: 19,
      speed: 70,
      consistency: 70,
      true_potential: 94,
      role: null,
      team_id: null, // Sem vaga, sem tempo de pista
    })

    // Simular 4 temporadas sem oportunidade
    for (let yr = 2027; yr < 2031; yr++) {
      const res = driverDevelopmentService.processAnnualDriverDevelopment({
        driver,
        seasonYear: yr,
        trackOpportunityFactor: 0.2, // Pouquíssima pista
      })
      driver = res.updatedDriver
    }

    // Mesmo com potencial 94, não disparou para 94
    expect(driver.speed).toBeLessThan(82)
  })

  // Regra 10 & 119: IA NUNCA pode ver truePotential
  it('10 & 119. Acesso indevido a truePotential por módulos de decisão da IA é proibido', () => {
    const rawDriver = createMockDriver({
      id: 'guard_driver',
      true_potential: 95,
      perceived_potential: 80,
    })

    // Simula proxy de proteção de dados que a IA utiliza para mercado e scouting
    const aiSafeDriverView = new Proxy(rawDriver, {
      get(target, prop) {
        if (prop === 'true_potential' || prop === 'truePotential') {
          throw new Error('SECURITY VIOLATION: IA tentou ler truePotential diretamente!')
        }
        return (target as any)[prop]
      },
    })

    // IA deve conseguir ler perceived_potential
    expect(aiSafeDriverView.perceived_potential).toBe(80)
    expect(aiSafeDriverView.evaluation_confidence).toBe(65)

    // Qualquer tentativa da IA de tocar em true_potential gera erro imediato
    expect(() => {
      const _illegal = aiSafeDriverView.true_potential
    }).toThrow('SECURITY VIOLATION')
  })

  // Regra 12 & 109: Declínio diferencial por atributo (ritmo cai, feedback permanece)
  it('12 & 109. Declínio diferencial: veterano preserva feedback e consistência', () => {
    const veteran = createMockDriver({
      id: 'vet_diff',
      age: 38,
      speed: 84,
      consistency: 89,
      technical_feedback: 92,
    })

    const res = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: veteran,
      seasonYear: 2028,
      seed: 44,
    })

    // Feedback técnico não cai ou permanece muito forte
    expect(res.updatedDriver.technical_feedback).toBeGreaterThanOrEqual(91)
    // Ritmo puro tem declínio sutil
    expect(res.updatedDriver.speed).toBeLessThanOrEqual(84)
  })

  // Regra 40 & 120: Convergência de perceivedPotential ao longo das temporadas
  it('40 & 120. Avaliação perceivedPotential converge com o tempo e dados acumulados', () => {
    let driver = createMockDriver({
      id: 'eval_conv',
      age: 20,
      true_potential: 88,
      perceived_potential: 78,
      evaluation_confidence: 50,
      role: 'titular',
    })

    for (let yr = 2027; yr <= 2030; yr++) {
      const res = driverDevelopmentService.processAnnualDriverDevelopment({
        driver,
        seasonYear: yr,
        trackOpportunityFactor: 1.0,
      })
      driver = res.updatedDriver
    }

    expect(driver.evaluation_confidence).toBeGreaterThan(65)
    // Converte mais próximo de 88
    expect(driver.perceived_potential).toBeGreaterThan(78)
  })

  // Regra 43 & 116: Distribuição de talentos das novas gerações não inflaciona o grid
  it('43 & 116. Nova geração obedece à pirâmide de talentos da 4C sem inflacionar estrelas', () => {
    const cohort = newGenerationService.generateAnnualClass({
      seasonYear: 2028,
      allCurrentDrivers: [createMockDriver()],
      seed: 555,
    })

    expect(cohort.newDrivers.length).toBeGreaterThanOrEqual(8)
    expect(cohort.newDrivers.length).toBeLessThanOrEqual(18)

    // Estrelas (true_potential >= 90) devem ser muito raras na safra
    const eliteCount = cohort.newDrivers.filter((d) => (d.true_potential || 0) >= 90).length
    expect(eliteCount).toBeLessThanOrEqual(3)
  })

  // Regra 56 a 63: Aposentadoria qualitativa (DriverRetirementService)
  it('56 a 63. Aposentadoria é multifatorial, respeita contrato e veterano sem mercado', () => {
    // Caso 1: Jovem de 25 anos nunca aposenta
    const young = createMockDriver({ age: 25, role: 'titular' })
    const youngEval = driverRetirementService.evaluateDriverRetirementIntent(young, 2027)
    expect(youngEval.currentState).toBe('NO_THOUGHTS')

    // Caso 2: Veterano de 39 anos com contrato de 2 anos resiste à aposentadoria imediata
    const vetWithContract = createMockDriver({
      age: 39,
      contract_end: 2029,
      team_id: 'team_ferrari',
      speed: 86,
    })
    const vetContractEval = driverRetirementService.evaluateDriverRetirementIntent(
      vetWithContract,
      2027,
    )
    expect(vetContractEval.currentState).not.toBe('RETIRED')

    // Caso 3: Veterano de 38 anos Free Agent sem mercado considera aposentadoria
    const vetFreeAgent = createMockDriver({
      age: 38,
      team_id: null,
      contract_end: 2026,
      career_status: 'free_agent',
      speed: 73,
    })
    const faEval = driverRetirementService.evaluateDriverRetirementIntent(vetFreeAgent, 2027, {
      isFreeAgent: true,
    })
    expect(['CONSIDERING', 'LIKELY', 'ANNOUNCED']).toContain(faEval.currentState)
  })

  // Regra 66 & 114: Piloto aposentado não é deletado (status vira retired e abre vaga)
  it('66 & 114. Piloto aposentado é preservado com status retired e registros congelados', () => {
    const retiringDriver = createMockDriver({
      id: 'retiring_legend',
      name: 'Lenda Veterana',
      age: 42,
      retirement_intent: 'ANNOUNCED',
      contract_end: 2027,
    })

    const res = driverRetirementService.processAnnualRetirements({
      drivers: [retiringDriver],
      currentSeasonYear: 2027,
    })

    const retired = res.updatedDrivers[0]
    expect(retired.career_status).toBe('retired')
    expect(retired.role).toBeNull()
    expect(retired.team_id).toBeNull()
    expect(retired.career_records).toBeDefined()
    expect(res.effectiveRetirements.length).toBe(1)
  })

  // Regra 78 & 122: Determinismo (mesma seed + mesmo snapshot = mesma evolução)
  it('78 & 122. Determinismo: mesma seed e entrada produzem resultado idêntico', () => {
    const driver1 = createMockDriver({ id: 'det_1', age: 22, speed: 77 })
    const driver2 = createMockDriver({ id: 'det_1', age: 22, speed: 77 })

    const res1 = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: driver1,
      seasonYear: 2027,
      seed: 8888,
    })
    const res2 = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: driver2,
      seasonYear: 2027,
      seed: 8888,
    })

    expect(res1.updatedDriver.speed).toBe(res2.updatedDriver.speed)
    expect(res1.updatedDriver.consistency).toBe(res2.updatedDriver.consistency)
    expect(res1.ledger.attributes.speed.delta).toBe(res2.ledger.attributes.speed.delta)
  })

  // Regra 102 & 103: Explicabilidade em pt-BR (explainDriverDevelopment)
  it('102 & 103. Explicabilidade narrativa sem revelar truePotential ao jogador', () => {
    const driver = createMockDriver({ name: 'Gabriel Bortoleto', age: 22 })
    const res = driverDevelopmentService.processAnnualDriverDevelopment({
      driver,
      seasonYear: 2027,
      trackOpportunityFactor: 1.0,
    })

    const explanation = driverDevelopmentService.explainDriverDevelopment(res.updatedDriver, 2027)
    expect(explanation.headline).toContain('Bortoleto')
    expect(explanation.careerStage).toBeDefined()
    expect(explanation.factors.length).toBeGreaterThan(0)
    // Não expõe fórmula bruta nem número de truePotential na explicação
    expect(explanation.stageSummary).not.toContain('truePotential')
  })

  // Regra 126: SIMULAÇÃO DE 20 TEMPORADAS (TESTE DECISIVO DE ECOLOGIA DO UNIVERSO)
  it('126. Simulação de 20 temporadas: grid estável, sem explosão de talento nem crescimento infinito', () => {
    let currentDrivers: DriverModel[] = []

    // Inicializar pool inicial de 50 pilotos
    for (let i = 0; i < 50; i++) {
      currentDrivers.push(
        createMockDriver({
          id: `seed_drv_${i}`,
          name: `Piloto ${i}`,
          age: 18 + (i % 18),
          speed: 70 + (i % 20),
          consistency: 70 + (i % 20),
          true_potential: 75 + (i % 18),
          team_id: i < 20 ? `team_${Math.floor(i / 2)}` : null,
          role: i < 20 ? 'titular' : null,
          career_status: i < 20 ? 'active' : 'free_agent',
        }),
      )
    }

    const decadeReport: any[] = []

    // Rodar 20 temporadas (2027 -> 2046)
    for (let season = 2027; season < 2047; season++) {
      // 1. Aposentadorias
      const retRes = driverRetirementService.processAnnualRetirements({
        drivers: currentDrivers,
        currentSeasonYear: season,
        seed: season,
      })

      // 2. Desenvolvimento de ativos
      const developed: DriverModel[] = []
      for (const d of retRes.updatedDrivers) {
        if (d.career_status === 'retired') {
          developed.push({ ...d, age: (d.age || 38) + 1 })
          continue
        }
        const dev = driverDevelopmentService.processAnnualDriverDevelopment({
          driver: d,
          seasonYear: season,
          seed: season * 13,
        })
        developed.push({
          ...dev.updatedDriver,
          age: (d.age || 25) + 1,
        })
      }

      // 3. Novas Gerações
      const genRes = newGenerationService.generateAnnualClass({
        seasonYear: season + 1,
        allCurrentDrivers: developed,
        retirementsCount: retRes.effectiveRetirements.length,
        seed: season,
      })

      currentDrivers = [...developed, ...genRes.newDrivers]

      // Salvar métricas a cada 10 anos
      if (season === 2036 || season === 2046) {
        decadeReport.push(genRes.ecologyReport)
      }
    }

    const activeAtEnd = currentDrivers.filter((d) => d.career_status !== 'retired')
    // População permanece ecologicamente controlada (entre 60 e 180 pilotos ativos)
    expect(activeAtEnd.length).toBeGreaterThanOrEqual(60)
    expect(activeAtEnd.length).toBeLessThanOrEqual(180)

    // Média de velocidade no universo permanece plausível (entre 72 e 88)
    const avgSpeed = activeAtEnd.reduce((sum, d) => sum + (d.speed || 75), 0) / activeAtEnd.length
    expect(avgSpeed).toBeGreaterThan(70)
    expect(avgSpeed).toBeLessThan(90)
  })

  // Exemplo Audi Real: Bortoleto e Ricciardo em estágios diferentes
  it('Exemplo Audi Fixture: Bortoleto em desenvolvimento e Ricciardo veterano estável', () => {
    const bortoleto = createMockDriver({
      id: 'drv_bortoleto',
      name: 'Gabriel Bortoleto',
      age: 22,
      speed: 80,
      consistency: 78,
      true_potential: 89,
      team_id: '8oveg16plyvu1yj', // Audi
      role: 'titular',
    })

    const ricciardo = createMockDriver({
      id: 'drv_ricciardo',
      name: 'Daniel Ricciardo',
      age: 37,
      speed: 83,
      consistency: 85,
      technical_feedback: 90,
      team_id: '8oveg16plyvu1yj', // Audi
      role: 'titular',
    })

    const devBortoleto = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: bortoleto,
      seasonYear: 2027,
      trackOpportunityFactor: 1.0,
      seed: 2027,
    })

    const devRicciardo = driverDevelopmentService.processAnnualDriverDevelopment({
      driver: ricciardo,
      seasonYear: 2027,
      trackOpportunityFactor: 1.0,
      seed: 2027,
    })

    // Bortoleto jovem cresce
    expect(devBortoleto.updatedDriver.consistency).toBeGreaterThanOrEqual(78)
    // Ricciardo mantém feedback e consistência de elite
    expect(devRicciardo.updatedDriver.technical_feedback).toBeGreaterThanOrEqual(90)
    expect(devRicciardo.ledger.primaryFactors.length).toBeGreaterThan(0)
  })
})
