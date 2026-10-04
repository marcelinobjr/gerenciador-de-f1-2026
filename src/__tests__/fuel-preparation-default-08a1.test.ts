import { describe, it, expect } from 'vitest'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import {
  TANK_CAPACITY_KG,
  calculateRequiredStartingFuelKg,
  calculateLapFuelBurnKg,
} from '@/services/canonicalFuelModel'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { PreparedCarState } from '@/types/canonical-race-preparation'
import type { TireSetItem } from '@/types/f1'

function build24Grid(playerTeamId: string = 'team_audi'): FinalQualifyingGridEntry[] {
  const teams = [
    'team_audi',
    'team_mercedes',
    'team_ferrari',
    'team_mclaren',
    'team_redbull',
    'team_rb',
    'team_alpine',
    'team_haas',
    'team_williams',
    'team_aston',
    'team_cadillac',
    'team_andretti',
  ]
  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (const t of teams) {
    for (let c = 1; c <= 2; c++) {
      grid.push({
        driverId: `drv_${t}_${c}`,
        driverName: `Driver ${t} ${c}`,
        teamId: t,
        teamName: t.replace('team_', '').toUpperCase(),
        teamColor: '#ffffff',
        eliminationStage: 'Q3',
        bestLapSec: 80.0,
        bestLapTime: '1:20.000',
        gridPosition: pos,
        bestLapCompound: 'medio',
        tyreSetId: `set_${t}_${c}`,
        isPlayer: t === playerTeamId,
      } as FinalQualifyingGridEntry)
      pos++
    }
  }
  return grid
}

function buildInventories(grid: FinalQualifyingGridEntry[]): Record<string, TireSetItem[]> {
  const inv: Record<string, TireSetItem[]> = {}
  for (const entry of grid) {
    inv[entry.driverId] = [
      {
        id: `set_${entry.driverId}_1`,
        compound: 'medio',
        wear: 0,
        lapsUsed: 0,
        isFitted: true,
        status: 'instalado',
      },
    ]
  }
  return inv
}

describe('FUEL-AUTONOMY-08A1 — Provar e Validar Default da Preparação e Encadeamento Real', () => {
  /**
   * PROVA INICIAL DO PASSO 1:
   * Exercita o encadeamento REAL: criar preparação padrão para Madri (sem escolha manual de combustível)
   * -> confirmar preparação -> inicializar a corrida pelo caminho oficial usado por /corrida/live
   * -> verificar a carga que chega aos dois carros.
   */
  it('PASSO 1: Encadeamento real Madri — prova se o default de 100 kg chega ao inicializador como override ou se deriva a carga canônica', () => {
    const madridRound = 16
    const madridGp = F1_2026_CALENDAR.find((g) => g.round === madridRound)!
    expect(madridGp).toBeDefined()
    const totalLaps = madridGp.laps // 66

    const requiredFuel = calculateRequiredStartingFuelKg(totalLaps, madridGp.circuitLengthKm, 1.0)
    // Madri: 66 voltas * 5.474 km = 361.284 km -> * 0.30 kg/km = 108.3852 + 1.0 reserva = 109.3852 kg
    expect(requiredFuel).toBeCloseTo(109.3852, 2)

    const playerTeamId = 'team_audi'
    const grid = build24Grid(playerTeamId)
    const inventories = buildInventories(grid)

    // 1. Criar preparação padrão para Madri (sem escolha manual de combustível)
    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_madrid_p1',
      seasonYear: 2026,
      round: madridRound,
      teamId: playerTeamId,
      totalLaps,
      grid,
      inventories,
    })

    const car1Prep = prepSnapshot.cars[0]
    const car2Prep = prepSnapshot.cars[1]

    // 2. Confirmar preparação (como na UI de preparação /corrida)
    car1Prep.confirmed = true
    car2Prep.confirmed = true
    prepSnapshot.allConfirmed = true

    // Map de preparações confirmado repassado ao inicializador
    const carPreparations: Record<string, PreparedCarState> = {
      [car1Prep.driverId]: car1Prep,
      [car2Prep.driverId]: car2Prep,
      [car1Prep.carId]: car1Prep,
      [car2Prep.carId]: car2Prep,
    }

    // 3. Inicializar a corrida pelo caminho oficial
    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_madrid_p1',
      season: 2026,
      round: madridRound,
      circuitName: madridGp.circuit,
      circuitCountry: madridGp.country,
      circuitLengthKm: madridGp.circuitLengthKm,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid: grid,
      carPreparations,
      persistState: false,
    })

    const pCar1 = raceState.drivers.find((d) => d.driverId === car1Prep.driverId)!
    const pCar2 = raceState.drivers.find((d) => d.driverId === car2Prep.driverId)!

    expect(pCar1).toBeDefined()
    expect(pCar2).toBeDefined()

    // EVIDÊNCIA DO CENÁRIO:
    // A preparação padrão deriva startingFuelKg via calculateRequiredStartingFuelKg (~109.39 kg)
    // e NÃO 100 kg. Ambos os carros do jogador recebem a carga calculada de forma idêntica.
    expect(car1Prep.startingFuelKg).toBeCloseTo(requiredFuel, 2)
    expect(car2Prep.startingFuelKg).toBeCloseTo(requiredFuel, 2)
    expect(car1Prep.startingFuelKg).toBeGreaterThan(100.0)
    expect(car2Prep.startingFuelKg).toBeGreaterThan(100.0)

    expect(pCar1.fuel).toBeCloseTo(requiredFuel, 2)
    expect(pCar2.fuel).toBeCloseTo(requiredFuel, 2)
    expect(pCar1.fuel).toBeGreaterThan(100.0)
    expect(pCar2.fuel).toBeGreaterThan(100.0)
  })

  /**
   * TESTE A: Fluxo padrão de Madri até a bandeirada em NORMAL, fixture determinística
   * sem abandonos alheios a combustível; registrar carga preparada, inicializada, consumo e final;
   * sem OUT_OF_FUEL por subdimensionamento.
   */
  it('TESTE A: Fluxo padrão de Madri até a bandeirada em NORMAL — sem OUT_OF_FUEL por subdimensionamento', () => {
    const madridRound = 16
    const madridGp = F1_2026_CALENDAR.find((g) => g.round === madridRound)!
    const totalLaps = madridGp.laps // 66
    const requiredFuel = calculateRequiredStartingFuelKg(totalLaps, madridGp.circuitLengthKm, 1.0)
    expect(requiredFuel).toBeCloseTo(109.3852, 2)

    const playerTeamId = 'team_audi'
    const grid = build24Grid(playerTeamId)
    const inventories = buildInventories(grid)

    // Criação da preparação padrão
    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_madrid_flow',
      seasonYear: 2026,
      round: madridRound,
      teamId: playerTeamId,
      totalLaps,
      grid,
      inventories,
    })

    const car1Prep = prepSnapshot.cars[0]
    const car2Prep = prepSnapshot.cars[1]
    car1Prep.confirmed = true
    car2Prep.confirmed = true

    const carPreparations: Record<string, PreparedCarState> = {
      [car1Prep.driverId]: car1Prep,
      [car2Prep.driverId]: car2Prep,
      [car1Prep.carId]: car1Prep,
      [car2Prep.carId]: car2Prep,
    }

    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_madrid_flow',
      season: 2026,
      round: madridRound,
      circuitName: madridGp.circuit,
      circuitCountry: madridGp.country,
      circuitLengthKm: madridGp.circuitLengthKm,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid: grid,
      carPreparations,
      persistState: false,
    })

    const pCar1Init = raceState.drivers.find((d) => d.driverId === car1Prep.driverId)!
    const pCar2Init = raceState.drivers.find((d) => d.driverId === car2Prep.driverId)!

    const preparedFuelCar1 = car1Prep.startingFuelKg
    const preparedFuelCar2 = car2Prep.startingFuelKg
    const initialFuelCar1 = pCar1Init.fuel
    const initialFuelCar2 = pCar2Init.fuel

    expect(preparedFuelCar1).toBeCloseTo(requiredFuel, 2)
    expect(preparedFuelCar2).toBeCloseTo(requiredFuel, 2)
    expect(initialFuelCar1).toBeCloseTo(requiredFuel, 2)
    expect(initialFuelCar2).toBeCloseTo(requiredFuel, 2)

    // Simula a corrida inteira até a bandeirada (66 voltas) em ritmo NORMAL
    for (let lap = 1; lap <= totalLaps; lap++) {
      raceState = canonicalRaceEngineService.advanceOneLap(raceState)
    }

    const pCar1Final = raceState.drivers.find((d) => d.driverId === car1Prep.driverId)!
    const pCar2Final = raceState.drivers.find((d) => d.driverId === car2Prep.driverId)!

    const consumedCar1 = initialFuelCar1 - pCar1Final.fuel
    const consumedCar2 = initialFuelCar2 - pCar2Final.fuel

    // Registro das cargas e consumos para relatório
    console.log('MADRI RESULTADO TESTE A:', {
      preparedFuelCar1,
      preparedFuelCar2,
      initialFuelCar1,
      initialFuelCar2,
      consumedCar1,
      consumedCar2,
      finalFuelCar1: pCar1Final.fuel,
      finalFuelCar2: pCar2Final.fuel,
      statusCar1: pCar1Final.raceStatus,
      statusCar2: pCar2Final.raceStatus,
    })

    // Nenhum carro do jogador nem da IA deve ter sofrido OUT_OF_FUEL
    for (const d of raceState.drivers) {
      expect(d.raceStatus).not.toBe('OUT_OF_FUEL')
      expect(d.dnfReason).toBeUndefined()
      expect(d.fuel).toBeGreaterThan(0)
    }

    // Carros do jogador completaram todas as 66 voltas
    expect(pCar1Final.lap).toBe(totalLaps)
    expect(pCar2Final.lap).toBe(totalLaps)
    expect(pCar1Final.fuel).toBeGreaterThan(0.5) // Reserva intocada
    expect(pCar2Final.fuel).toBeGreaterThan(0.5)
  })

  /**
   * TESTE B: Outra prova do calendário — carga deriva dos dados da prova, não de constante de Madri.
   * Testa Spa-Francorchamps (Round 14: 44 voltas × 7.004 km = 308.176 km -> ~93.45 kg)
   * e Mônaco (Round 8: 78 voltas × 3.337 km = 260.286 km -> ~79.09 kg).
   */
  it('TESTE B: Provas distintas do calendário — carga deriva estritamente dos dados da prova', () => {
    // Prova 1: Spa-Francorchamps (Round 14)
    const spaGp = F1_2026_CALENDAR.find((g) => g.round === 14)!
    expect(spaGp).toBeDefined()
    const spaLaps = spaGp.laps // 44 voltas
    const spaExpectedFuel = calculateRequiredStartingFuelKg(spaLaps, spaGp.circuitLengthKm, 1.0)
    expect(spaExpectedFuel).toBeCloseTo(93.4528, 2)

    const grid = build24Grid('team_audi')
    const inv = buildInventories(grid)

    const spaPrep = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_spa',
      seasonYear: 2026,
      round: 14,
      teamId: 'team_audi',
      totalLaps: spaLaps,
      grid,
      inventories: inv,
    })

    expect(spaPrep.cars[0].startingFuelKg).toBeCloseTo(spaExpectedFuel, 2)
    expect(spaPrep.cars[1].startingFuelKg).toBeCloseTo(spaExpectedFuel, 2)
    // Não é constante de Madri nem 100 kg
    expect(spaPrep.cars[0].startingFuelKg).not.toBeCloseTo(109.3852, 1)
    expect(spaPrep.cars[0].startingFuelKg).not.toBe(100)

    // Prova 2: Mônaco (Round 8)
    const monacoGp = F1_2026_CALENDAR.find((g) => g.round === 8)!
    expect(monacoGp).toBeDefined()
    const monacoLaps = monacoGp.laps // 78 voltas
    const monacoExpectedFuel = calculateRequiredStartingFuelKg(
      monacoLaps,
      monacoGp.circuitLengthKm,
      1.0,
    )
    expect(monacoExpectedFuel).toBeCloseTo(79.0858, 2)

    const monacoPrep = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_monaco',
      seasonYear: 2026,
      round: 8,
      teamId: 'team_audi',
      totalLaps: monacoLaps,
      grid,
      inventories: inv,
    })

    expect(monacoPrep.cars[0].startingFuelKg).toBeCloseTo(monacoExpectedFuel, 2)
    expect(monacoPrep.cars[1].startingFuelKg).toBeCloseTo(monacoExpectedFuel, 2)
    expect(monacoPrep.cars[0].startingFuelKg).not.toBeCloseTo(109.3852, 1)
    expect(monacoPrep.cars[0].startingFuelKg).not.toBe(100)
  })

  /**
   * TESTE C: Escolha MANUAL de 100 kg em Madri é preservada (com aviso FUEL12 existente)
   * — impede a correção errada "se valor == 100, substituir".
   * Não inferir origem pelo valor numérico; reutilizar representação de origem existente se houver.
   */
  it('TESTE C: Escolha MANUAL de 100 kg em Madri é preservada sem substituição indevida', () => {
    const madridRound = 16
    const madridGp = F1_2026_CALENDAR.find((g) => g.round === madridRound)!
    const totalLaps = madridGp.laps // 66
    const playerTeamId = 'team_audi'
    const grid = build24Grid(playerTeamId)
    const inventories = buildInventories(grid)

    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_madrid_manual_100',
      seasonYear: 2026,
      round: madridRound,
      teamId: playerTeamId,
      totalLaps,
      grid,
      inventories,
    })

    // O jogador seleciona manualmente 100 kg (subdimensionado para Madri, que requer ~109.39 kg)
    const manualFuel = 100.0
    prepSnapshot.cars[0].startingFuelKg = manualFuel
    prepSnapshot.cars[0].confirmed = true
    prepSnapshot.cars[1].confirmed = true

    const carPreparations: Record<string, PreparedCarState> = {
      [prepSnapshot.cars[0].driverId]: prepSnapshot.cars[0],
      [prepSnapshot.cars[1].driverId]: prepSnapshot.cars[1],
      [prepSnapshot.cars[0].carId]: prepSnapshot.cars[0],
      [prepSnapshot.cars[1].carId]: prepSnapshot.cars[1],
    }

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_madrid_manual_100',
      season: 2026,
      round: madridRound,
      circuitName: madridGp.circuit,
      circuitCountry: madridGp.country,
      circuitLengthKm: madridGp.circuitLengthKm,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid: grid,
      carPreparations,
      persistState: false,
    })

    const pCar1 = raceState.drivers.find((d) => d.driverId === prepSnapshot.cars[0].driverId)!
    const pCar2 = raceState.drivers.find((d) => d.driverId === prepSnapshot.cars[1].driverId)!

    // A escolha MANUAL de 100 kg do carro 1 deve ser estritamente respeitada (NÃO sobrescrita para 109.39 kg)
    expect(pCar1.fuel).toBe(100.0)
    // O carro 2 manteve o default derivado canônico (~109.39 kg)
    const requiredFuel = calculateRequiredStartingFuelKg(totalLaps, madridGp.circuitLengthKm, 1.0)
    expect(pCar2.fuel).toBeCloseTo(requiredFuel, 2)
  })

  /**
   * TESTE D: Após consumo, salvar/retomar preserva combustível remanescente
   * — sem reabastecer nem voltar à carga inicial.
   * Não recalcular ao abrir a página, navegar, carregar corrida em andamento ou atualizar checkpoint.
   * Sem migração de preparações antigas.
   */
  it('TESTE D: Após consumo, salvar/retomar preserva combustível remanescente sem reabastecer nem voltar à carga inicial', () => {
    const madridRound = 16
    const madridGp = F1_2026_CALENDAR.find((g) => g.round === madridRound)!
    const totalLaps = madridGp.laps
    const playerTeamId = 'team_audi'
    const grid = build24Grid(playerTeamId)
    const inventories = buildInventories(grid)

    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_save_resume',
      seasonYear: 2026,
      round: madridRound,
      teamId: playerTeamId,
      totalLaps,
      grid,
      inventories,
    })

    const car1Prep = prepSnapshot.cars[0]
    const car2Prep = prepSnapshot.cars[1]
    car1Prep.confirmed = true
    car2Prep.confirmed = true

    const carPreparations: Record<string, PreparedCarState> = {
      [car1Prep.driverId]: car1Prep,
      [car2Prep.driverId]: car2Prep,
      [car1Prep.carId]: car1Prep,
      [car2Prep.carId]: car2Prep,
    }

    // Inicializa corrida com persistência ativada
    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_save_resume',
      season: 2026,
      round: madridRound,
      circuitName: madridGp.circuit,
      circuitCountry: madridGp.country,
      circuitLengthKm: madridGp.circuitLengthKm,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid: grid,
      carPreparations,
      persistState: true,
    })

    const initialFuelCar1 = raceState.drivers.find((d) => d.driverId === car1Prep.driverId)!.fuel
    expect(initialFuelCar1).toBeCloseTo(109.3852, 2)

    // Avança 15 voltas
    const lapsToAdvance = 15
    for (let l = 1; l <= lapsToAdvance; l++) {
      raceState = canonicalRaceEngineService.advanceOneLap(raceState)
    }

    const lapBurn = calculateLapFuelBurnKg(madridGp.circuitLengthKm, 1.0)
    const midFuelCar1 = raceState.drivers.find((d) => d.driverId === car1Prep.driverId)!.fuel
    const expectedMidFuel = initialFuelCar1 - lapsToAdvance * lapBurn
    expect(midFuelCar1).toBeCloseTo(expectedMidFuel, 1)
    expect(midFuelCar1).toBeLessThan(initialFuelCar1)

    // Salva o checkpoint em andamento via canonicalRaceSaveService
    canonicalRaceSaveService.saveCanonicalRaceState(raceState)

    // Simula retomada (como ao navegar ou recarregar /corrida/live)
    const loadResult = canonicalRaceSaveService.loadCanonicalRaceState(
      'test_career_save_resume',
      2026,
      madridRound,
      'MAIN_RACE',
    )
    expect(loadResult).not.toBeNull()
    const resumedState = loadResult!.state
    expect(resumedState).toBeDefined()

    const resumedCar1 = resumedState.drivers.find((d) => d.driverId === car1Prep.driverId)!
    const resumedCar2 = resumedState.drivers.find((d) => d.driverId === car2Prep.driverId)!

    // Combustível remanescente é preservado exatamente:
    // Sem reabastecer, sem voltar ao startingFuelKg da preparação (109.39 kg), sem reset para 100 kg
    expect(resumedCar1.fuel).toBeCloseTo(midFuelCar1, 4)
    expect(resumedCar1.fuel).toBeLessThan(initialFuelCar1)
    expect(resumedCar1.fuel).not.toBe(100.0)
    expect(resumedCar1.fuel).not.toBeCloseTo(initialFuelCar1, 1)

    // Continua avançando mais 1 volta após retomada
    const nextState = canonicalRaceEngineService.advanceOneLap(resumedState)
    const afterNextCar1 = nextState.drivers.find((d) => d.driverId === car1Prep.driverId)!
    expect(afterNextCar1.fuel).toBeCloseTo(midFuelCar1 - lapBurn, 2)
  })
})
