import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createInitialPracticePreparation,
  createDefaultCarPreparation,
  validateCarPreparation,
  validateOverallPractice,
  copyCarSetup,
  calculateEstimatedLaps,
  calculateKgFromLaps,
  practicePreparationService,
} from '@/services/practicePreparationService'
import { createInitialTireInventory } from '@/lib/f1-tire-system'
import type { PracticePreparation, PracticeCarPreparation } from '@/types/practice-preparation'
import pb from '@/lib/pocketbase/client'

describe('Etapa 4A — Preparação TL1/TL2/TL3 (Canonical Tests)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // Teste 1: Criação da preparação
  it('1) deve criar a estrutura de preparação canônica com dois carros independentes', () => {
    const prep = createInitialPracticePreparation({
      careerId: 'team_audi_2026',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      driver1Id: 'driver_hulkenberg',
      driver2Id: 'driver_bortoleto',
    })

    expect(prep.careerId).toBe('team_audi_2026')
    expect(prep.seasonId).toBe('season_2026')
    expect(prep.round).toBe(1)
    expect(prep.sessionType).toBe('tp1')
    expect(prep.status).toBe('not_started')
    expect(prep.cars).toHaveLength(2)
    expect(prep.cars[0].carId).toBe('car1')
    expect(prep.cars[0].driverId).toBe('driver_hulkenberg')
    expect(prep.cars[1].carId).toBe('car2')
    expect(prep.cars[1].driverId).toBe('driver_bortoleto')

    // Valores padrão de setup
    expect(prep.cars[0].setup.frontWing).toBe(6)
    expect(prep.cars[0].setup.rearWing).toBe(6)
    expect(prep.cars[0].setup.suspension).toBe(6)
    expect(prep.cars[0].setup.differential).toBe(50)

    // Programa padrão e combustível
    expect(prep.cars[0].program).toBe('car_setup')
    expect(prep.cars[0].fuelLoad.kg).toBe(25)
    expect(prep.cars[0].fuelLoad.estimatedLaps).toBeGreaterThan(10)
  })

  // Teste 2: Independência dos dois carros (mudar Carro 1 não altera Carro 2)
  it('2) deve garantir independência total entre Carro 1 e Carro 2', () => {
    const prep = createInitialPracticePreparation({
      careerId: 'team_ferrari',
      seasonId: 'season_2026',
      round: 1,
      driver1Id: 'driver_hamilton',
      driver2Id: 'driver_leclerc',
    })

    // Modifica apenas Carro 1
    prep.cars[0].program = 'qualifying_sim'
    prep.cars[0].fuelLoad = { kg: 10, estimatedLaps: calculateEstimatedLaps(10) }
    prep.cars[0].setup.frontWing = 9
    prep.cars[0].setup.differential = 75

    // Carro 2 deve permanecer intacto
    expect(prep.cars[1].program).toBe('car_setup')
    expect(prep.cars[1].fuelLoad.kg).toBe(25)
    expect(prep.cars[1].setup.frontWing).toBe(6)
    expect(prep.cars[1].setup.differential).toBe(50)
  })

  // Teste 3: Persistência (configurar → persistir → reidratar → mesma config)
  it('3) deve persistir e reidratar a preparação completa com os mesmos dados', async () => {
    const prep = createInitialPracticePreparation({
      careerId: 'team_redbull',
      seasonId: 'season_2026',
      round: 3,
      sessionType: 'tp1',
      driver1Id: 'driver_verstappen',
      driver2Id: 'driver_tsunoda',
    })

    prep.cars[0].setup.frontWing = 8
    prep.cars[0].setup.rearWing = 7
    prep.cars[0].fuelLoad = { kg: 45, estimatedLaps: calculateEstimatedLaps(45) }
    prep.cars[0].tyreSelection = {
      setId: 'driver_verstappen_macio_1',
      compound: 'macio',
      isReserved: true,
    }

    // Salva usando o serviço
    await practicePreparationService.savePreparation(prep)

    // Reidrata
    const loaded = await practicePreparationService.loadPreparation({
      careerId: 'team_redbull',
      seasonId: 'season_2026',
      round: 3,
      sessionType: 'tp1',
    })

    expect(loaded.careerId).toBe('team_redbull')
    expect(loaded.round).toBe(3)
    expect(loaded.cars[0].setup.frontWing).toBe(8)
    expect(loaded.cars[0].setup.rearWing).toBe(7)
    expect(loaded.cars[0].fuelLoad.kg).toBe(45)
    expect(loaded.cars[0].tyreSelection?.compound).toBe('macio')
    expect(loaded.cars[0].tyreSelection?.setId).toBe('driver_verstappen_macio_1')
  })

  // Teste 4: Reload / Resiliência local (nenhuma escolha perdida)
  it('4) deve sobreviver a reload via fallback local preservando todas as opções', async () => {
    const prep = createInitialPracticePreparation({
      careerId: 'team_mclaren',
      seasonId: 'season_2026',
      round: 5,
      sessionType: 'tp1',
      driver1Id: 'driver_norris',
      driver2Id: 'driver_piastri',
    })

    prep.cars[0].program = 'race_pace'
    prep.cars[1].program = 'tyre_knowledge'
    prep.cars[0].setup.differential = 65
    prep.cars[1].setup.suspension = 4

    await practicePreparationService.savePreparation(prep)

    // Simula reload da página carregando do cache
    const reloaded = await practicePreparationService.loadPreparation({
      careerId: 'team_mclaren',
      seasonId: 'season_2026',
      round: 5,
      sessionType: 'tp1',
      driver1Id: 'driver_norris',
      driver2Id: 'driver_piastri',
    })

    expect(reloaded.cars[0].program).toBe('race_pace')
    expect(reloaded.cars[1].program).toBe('tyre_knowledge')
    expect(reloaded.cars[0].setup.differential).toBe(65)
    expect(reloaded.cars[1].setup.suspension).toBe(4)
  })

  // Teste 5: Copiar setup (copia só os 4 parâmetros)
  it('5) deve copiar estritamente os 4 parâmetros de setup sem alterar piloto, programa, combustível ou pneus', () => {
    const car1: PracticeCarPreparation = {
      carId: 'car1',
      driverId: 'driver_c1',
      program: 'qualifying_sim',
      tyreSelection: { setId: 'c1_macio', compound: 'macio', isReserved: true },
      fuelLoad: { kg: 12, estimatedLaps: 7 },
      setup: { frontWing: 3, rearWing: 4, suspension: 8, differential: 70 },
      objective: 'Qualy test',
      status: 'preparing',
    }

    const car2: PracticeCarPreparation = {
      carId: 'car2',
      driverId: 'driver_c2',
      program: 'race_pace',
      tyreSelection: { setId: 'c2_duro', compound: 'duro', isReserved: true },
      fuelLoad: { kg: 55, estimatedLaps: 33 },
      setup: { frontWing: 7, rearWing: 8, suspension: 2, differential: 35 },
      objective: 'Race pace test',
      status: 'preparing',
    }

    const car2AfterCopy = copyCarSetup(car1, car2)

    // Setup copiado com exatidão
    expect(car2AfterCopy.setup.frontWing).toBe(3)
    expect(car2AfterCopy.setup.rearWing).toBe(4)
    expect(car2AfterCopy.setup.suspension).toBe(8)
    expect(car2AfterCopy.setup.differential).toBe(70)

    // Demais propriedades do Carro 2 PRESERVADAS
    expect(car2AfterCopy.driverId).toBe('driver_c2')
    expect(car2AfterCopy.program).toBe('race_pace')
    expect(car2AfterCopy.fuelLoad.kg).toBe(55)
    expect(car2AfterCopy.tyreSelection?.compound).toBe('duro')
  })

  // Teste 6: Pneu indisponível (operação rejeitada na validação)
  it('6) deve rejeitar validação se o jogo de pneus selecionado não existir no estoque', () => {
    const realInventory = createInitialTireInventory('driver_alonso') // 13 jogos

    const car = createDefaultCarPreparation('car1', 'driver_alonso')
    car.tyreSelection = {
      setId: 'jogo_fantasma_nao_existente',
      compound: 'macio',
      isReserved: true,
    }

    const validation = validateCarPreparation(car, realInventory)
    expect(validation.valid).toBe(false)
    expect(validation.errors.tyres).toContain('não está disponível no inventário')
  })

  // Teste 7: Configuração inválida (não inicia, mensagem clara)
  it('7) deve impedir inicialização se parâmetros obrigatórios estiverem ausentes ou inválidos', () => {
    const prep = createInitialPracticePreparation({
      careerId: 'team_aston',
      seasonId: 'season_2026',
      round: 1,
    })

    // Carro 1 sem pneu e sem piloto
    prep.cars[0].driverId = ''
    prep.cars[0].tyreSelection = null

    // Carro 2 com asa fora do range FIA (ex: 15)
    prep.cars[1].setup.frontWing = 15

    const overall = validateOverallPractice(prep)
    expect(overall.canStart).toBe(false)
    expect(overall.car1.errors.driver).toBeDefined()
    expect(overall.car1.errors.tyres).toBeDefined()
    expect(overall.car2.errors.setup).toBeDefined()
  })

  // Teste 8: Configuração válida (marca ready, handoff consistente)
  it('8) deve validar com sucesso e habilitar status ready quando ambos os carros estiverem homologados', () => {
    const t1 = createInitialTireInventory('d1')
    const t2 = createInitialTireInventory('d2')

    const prep = createInitialPracticePreparation({
      careerId: 'team_williams',
      seasonId: 'season_2026',
      round: 2,
      driver1Id: 'd1',
      driver2Id: 'd2',
    })

    prep.cars[0].tyreSelection = { setId: t1[0].id, compound: t1[0].compound, isReserved: true }
    prep.cars[1].tyreSelection = { setId: t2[0].id, compound: t2[0].compound, isReserved: true }

    const overall = validateOverallPractice(prep, t1, t2)
    expect(overall.canStart).toBe(true)
    expect(overall.car1.valid).toBe(true)
    expect(overall.car2.valid).toBe(true)
  })

  // Teste 9: Isolamento entre TL1/TL2/TL3
  it('9) deve isolar preparações entre TL1, TL2 e TL3 para a mesma rodada', async () => {
    const prepTL1 = createInitialPracticePreparation({
      careerId: 'team_audi',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      driver1Id: 'd1',
      driver2Id: 'd2',
    })
    prepTL1.cars[0].program = 'car_setup'
    await practicePreparationService.savePreparation(prepTL1)

    const prepTL2 = createInitialPracticePreparation({
      careerId: 'team_audi',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp2',
      driver1Id: 'd1',
      driver2Id: 'd2',
    })
    prepTL2.cars[0].program = 'race_pace'
    await practicePreparationService.savePreparation(prepTL2)

    const loadedTL1 = await practicePreparationService.loadPreparation({
      careerId: 'team_audi',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
    })

    const loadedTL2 = await practicePreparationService.loadPreparation({
      careerId: 'team_audi',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp2',
    })

    expect(loadedTL1.sessionType).toBe('tp1')
    expect(loadedTL1.cars[0].program).toBe('car_setup')

    expect(loadedTL2.sessionType).toBe('tp2')
    expect(loadedTL2.cars[0].program).toBe('race_pace')
  })

  // Teste 10: Regra canônica de combustível e estimativa de voltas
  it('10) deve calcular voltas estimadas e kg de forma canônica (~1,65 kg/volta)', () => {
    expect(calculateEstimatedLaps(16.5)).toBe(10)
    expect(calculateEstimatedLaps(33)).toBe(20)
    expect(calculateKgFromLaps(10)).toBe(16.5)
    expect(calculateKgFromLaps(20)).toBe(33.0)
  })
})
