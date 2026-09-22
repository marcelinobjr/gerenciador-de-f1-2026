import { describe, it, expect, beforeEach } from 'vitest'
import { resolveCanonicalDriverId, auditStartingGrid } from '@/lib/canonical-driver-database'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { SessionTimeResult } from '@/pages/race/types'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

describe('BUG-04B — STARTING GRID PERSISTENCE & OFFICIAL RACE RESULT', () => {
  const careerId = 'career_bug04b_test'
  const season = 2026
  const round = 1
  const playerTeamId = 'team_player'

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // Fixture canônica: 22 rivais + 2 carros do jogador (P23 e P24)
  const createQualyGrid24 = (): FinalQualifyingGridEntry[] => {
    const list: FinalQualifyingGridEntry[] = []
    for (let i = 1; i <= 22; i++) {
      const teamIdx = Math.ceil(i / 2)
      const slot = i % 2 === 1 ? 1 : 2
      list.push({
        driverId: `ai_team_${teamIdx}_d${slot}`,
        teamId: `team_rival_${teamIdx}`,
        driverName: `Driver ${String(i).padStart(2, '0')}`,
        teamName: `Team Rival ${teamIdx}`,
        teamColor: '#334155',
        gridPosition: i,
        bestLapTime: `1:20.${String(i).padStart(3, '0')}`,
        bestLapSec: 80.0 + i * 0.1,
        bestLapCompound: 'macio',
        eliminationStage: i <= 10 ? 'Q3' : i <= 18 ? 'Q2' : 'Q1',
        isPlayer: false,
      })
    }
    // P23 e P24 do jogador
    list.push({
      driverId: 'player_drv_1',
      teamId: playerTeamId,
      driverName: 'Player Alpha',
      teamName: 'Escuderia Brasil',
      teamColor: '#E10600',
      gridPosition: 23,
      bestLapTime: '1:22.500',
      bestLapSec: 82.5,
      bestLapCompound: 'macio',
      eliminationStage: 'Q1',
      isPlayer: true,
      carId: 'car1',
    })
    list.push({
      driverId: 'player_drv_2',
      teamId: playerTeamId,
      driverName: 'Player Beta',
      teamName: 'Escuderia Brasil',
      teamColor: '#E10600',
      gridPosition: 24,
      bestLapTime: '1:22.800',
      bestLapSec: 82.8,
      bestLapCompound: 'macio',
      eliminationStage: 'Q1',
      isPlayer: true,
      carId: 'car2',
    })
    return list
  }

  // BUG4-16: Save antes da largada preserva grid
  it('BUG4-16: save antes da largada preserva gridPosition canônico de todos os 24 carros', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    expect(state.status).toBe('not_started')
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(state)
    expect(saveRes.success).toBe(true)

    // O save preservou exatamente as 24 gridPositions
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, season, round)
    expect(loaded.state).not.toBeNull()
    const loadedDrivers = loaded.state!.drivers
    expect(loadedDrivers.length).toBe(24)

    for (const q of qualyGrid) {
      const d = loadedDrivers.find((ld) => ld.driverId === q.driverId)
      expect(d).toBeDefined()
      expect(d!.gridPosition).toBe(q.gridPosition)
      expect(d!.currentPosition).toBe(q.gridPosition) // na largada P_atual = P_grid
    }
  })

  // BUG4-17: Reload antes da largada preserva P1–P24
  it('BUG4-17: reload antes da largada preserva P1–P24 sem reordenar ou alterar', () => {
    const qualyGrid = createQualyGrid24()
    canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, season, round)
    expect(loaded.state).not.toBeNull()

    const pA = loaded.state!.drivers.find((d) => d.driverId === 'player_drv_1')!
    const pB = loaded.state!.drivers.find((d) => d.driverId === 'player_drv_2')!

    expect(pA.gridPosition).toBe(23)
    expect(pB.gridPosition).toBe(24)
    expect(pA.currentPosition).toBe(23)
    expect(pB.currentPosition).toBe(24)

    // Posições P1 a P24 contínuas
    const gridPositions = loaded.state!.drivers.map((d) => d.gridPosition).sort((a, b) => a - b)
    expect(gridPositions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
  })

  // BUG4-18: gridPosition não muda durante a corrida
  it('BUG4-18: gridPosition não muda durante a corrida enquanto currentPosition evolui', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    // Simular ultrapassagens e avanço de voltas via motor
    state.status = 'running'
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    pA.lap = 10
    pA.currentPosition = 15 // escalou de P23 para P15

    expect(pA.gridPosition).toBe(23)
    expect(pA.currentPosition).toBe(15)
    expect(pA.gridPosition).not.toBe(pA.currentPosition)
  })

  // BUG4-19: save no meio da corrida preserva gridPosition e currentPosition separadamente
  it('BUG4-19: save no meio da corrida preserva gridPosition e currentPosition separadamente', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    state.status = 'running'
    state.currentLap = 15

    // Ajustar piloto Alpha: larga P23, agora P15
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    pA.gridPosition = 23
    pA.currentPosition = 15
    pA.lap = 15

    // Ajustar piloto Beta: larga P24, agora P18
    const pB = state.drivers.find((d) => d.driverId === 'player_drv_2')!
    pB.gridPosition = 24
    pB.currentPosition = 18
    pB.lap = 15

    // Ajustar quem caiu para P23 e P24
    const d15 = state.drivers.find((d) => d.currentPosition === 15 && d.driverId !== 'player_drv_1')
    if (d15) d15.currentPosition = 23
    const d18 = state.drivers.find((d) => d.currentPosition === 18 && d.driverId !== 'player_drv_2')
    if (d18) d18.currentPosition = 24

    // Salvar no meio da corrida
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(state)
    expect(saveRes.success).toBe(true)

    // Reload
    const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, season, round)
    expect(reloaded.state).not.toBeNull()

    const rA = reloaded.state!.drivers.find((d) => d.driverId === 'player_drv_1')!
    const rB = reloaded.state!.drivers.find((d) => d.driverId === 'player_drv_2')!

    expect(rA.gridPosition).toBe(23)
    expect(rA.currentPosition).toBe(15)

    expect(rB.gridPosition).toBe(24)
    expect(rB.currentPosition).toBe(18)
  })

  // BUG4-20: OfficialRaceResult preserva gridPosition original
  it('BUG4-20: OfficialRaceResult preserva gridPosition original após bandeirada', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    // Finalizar a corrida: todos completam 58 voltas
    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()
    state.drivers.forEach((d) => {
      d.lap = 58
      d.raceStatus = 'racing'
    })

    // Player A termina em P9 (largou P23)
    // Reordenar drivers colocando Player A em index 8 (P9)
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    const driversWithoutA = state.drivers.filter((d) => d.driverId !== 'player_drv_1')
    driversWithoutA.splice(8, 0, pA) // insere na 9ª posição (índice 8)
    state.drivers = driversWithoutA
    state.drivers.forEach((d, idx) => {
      d.currentPosition = idx + 1
    })

    const officialResult = canonicalRaceResultService.createOfficialRaceResult(state)
    const officialPlayerA = officialResult.entries.find((e) => e.driverId === 'player_drv_1')!

    expect(officialPlayerA).toBeDefined()
    expect(officialPlayerA.gridPosition).toBe(23)
    expect(officialPlayerA.finalPosition).toBe(9)
  })

  // BUG4-21: grid→finish delta positivo correto (grid P23 finish P9 → +14)
  it('BUG4-21: grid→finish delta positivo correto (grid P23 finish P9 → +14)', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()
    state.drivers.forEach((d) => {
      d.lap = 58
    })

    // Player A larga P23 e termina P9
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    const list = state.drivers.filter((d) => d.driverId !== 'player_drv_1')
    list.splice(8, 0, pA) // P9
    state.drivers = list

    const officialResult = canonicalRaceResultService.createOfficialRaceResult(state)
    const entryA = officialResult.entries.find((e) => e.driverId === 'player_drv_1')!

    expect(entryA.gridPosition).toBe(23)
    expect(entryA.finalPosition).toBe(9)
    expect(entryA.positionsGainedLost).toBe(14)
    expect(entryA.positionsGainedLost).toBe(entryA.gridPosition - entryA.finalPosition)
  })

  // BUG4-22: grid→finish delta negativo correto (grid P4 finish P10 → -6)
  it('BUG4-22: grid→finish delta negativo correto (grid P4 finish P10 → -6)', () => {
    const qualyGrid = createQualyGrid24()
    // Configurar Player Alpha para largar em P4
    const p4Qualy = qualyGrid.find((q) => q.gridPosition === 4)!
    const p23Qualy = qualyGrid.find((q) => q.gridPosition === 23)!

    p4Qualy.driverId = 'player_drv_1'
    p4Qualy.driverName = 'Player Alpha'
    p4Qualy.teamId = playerTeamId
    p4Qualy.isPlayer = true
    p4Qualy.carId = 'car1'

    p23Qualy.driverId = 'ai_team_2_d2'
    p23Qualy.driverName = 'Rival Repositioned'
    p23Qualy.teamId = 'team_rival_2'
    p23Qualy.isPlayer = false
    delete p23Qualy.carId

    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()
    state.drivers.forEach((d) => {
      d.lap = 58
    })

    // Player Alpha larga P4 e termina P10
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    expect(pA.gridPosition).toBe(4)

    const list = state.drivers.filter((d) => d.driverId !== 'player_drv_1')
    list.splice(9, 0, pA) // P10 (índice 9)
    state.drivers = list

    const officialResult = canonicalRaceResultService.createOfficialRaceResult(state)
    const entryA = officialResult.entries.find((e) => e.driverId === 'player_drv_1')!

    expect(entryA.gridPosition).toBe(4)
    expect(entryA.finalPosition).toBe(10)
    expect(entryA.positionsGainedLost).toBe(-6)
    expect(entryA.positionsGainedLost).toBe(entryA.gridPosition - entryA.finalPosition)
  })

  // BUG4-23: DNF preserva gridPosition
  it('BUG4-23: DNF preserva gridPosition intacta no snapshot e no OfficialRaceResult', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()

    // Piloto Alpha larga P23 e abandona na volta 12 por falha de suspensão
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    pA.raceStatus = 'dnf'
    pA.isDnf = true
    pA.dnfReason = 'Falha Mecânica - Suspensão'
    pA.dnfLap = 12
    pA.lap = 12

    // Os outros 23 completam
    state.drivers.forEach((d) => {
      if (d.driverId !== 'player_drv_1') {
        d.lap = 58
        d.raceStatus = 'racing'
      }
    })

    // DNFs vão para o final
    state.drivers = [
      ...state.drivers.filter((d) => d.raceStatus !== 'dnf'),
      ...state.drivers.filter((d) => d.raceStatus === 'dnf'),
    ]

    const officialResult = canonicalRaceResultService.createOfficialRaceResult(state)
    const entryA = officialResult.entries.find((e) => e.driverId === 'player_drv_1')!

    expect(entryA).toBeDefined()
    expect(entryA.dnf).toBe(true)
    expect(entryA.gridPosition).toBe(23)
    expect(entryA.finalPosition).toBe(24) // DNF foi classificado em P24
    expect(entryA.dnfReason).toBe('Falha Mecânica - Suspensão')
    expect(entryA.dnfLap).toBe(12)
  })

  // BUG4-24: race_results histórico preserva gridPosition
  it('BUG4-24: race_results persistido no histórico de carreira preserva gridPosition e delta', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()
    state.drivers.forEach((d) => {
      d.lap = 58
    })

    // Player A larga P23 e termina P9
    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    const list = state.drivers.filter((d) => d.driverId !== 'player_drv_1')
    list.splice(8, 0, pA) // P9
    state.drivers = list

    const officialResult = canonicalRaceResultService.officializeRace(state)
    const registerRes =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(registerRes.success).toBe(true)

    // Consultar histórico da carreira depois
    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
    )
    expect(persisted).not.toBeNull()

    const historicalEntryA = persisted!.entries.find((e) => e.driverId === 'player_drv_1')!
    expect(historicalEntryA.gridPosition).toBe(23)
    expect(historicalEntryA.finalPosition).toBe(9)
    expect(historicalEntryA.positionsGainedLost).toBe(14)
  })

  // BUG4-25: reload nunca usa fallback de força/posição média
  it('BUG4-25: reload de corrida salva restaura exatamente o grid gravado sem recorrer a teamStrength ou posições médias', () => {
    const qualyGrid = createQualyGrid24()
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    // Salvar estado
    canonicalRaceSaveService.saveCanonicalRaceState(state)

    // Fazer load múltiplas vezes
    const load1 = canonicalRaceSaveService.loadCanonicalRaceState(careerId, season, round)
    const load2 = canonicalRaceSaveService.loadCanonicalRaceState(careerId, season, round)

    expect(load1.state).not.toBeNull()
    expect(load2.state).not.toBeNull()

    const pA1 = load1.state!.drivers.find((d) => d.driverId === 'player_drv_1')!
    const pA2 = load2.state!.drivers.find((d) => d.driverId === 'player_drv_1')!

    expect(pA1.gridPosition).toBe(23)
    expect(pA2.gridPosition).toBe(23)
    expect(pA1.gridPosition).not.toBe(8) // Nunca fallback médio
    expect(pA1.gridPosition).not.toBe(14) // Nunca fallback médio

    const pB1 = load1.state!.drivers.find((d) => d.driverId === 'player_drv_2')!
    expect(pB1.gridPosition).toBe(24)
    expect(pB1.gridPosition).not.toBe(8)
    expect(pB1.gridPosition).not.toBe(14)
  })

  // GOLDEN TEST B:
  // QUALIFYING: Player A = P23, Player B = P24
  // STARTING GRID: A=P23, B=P24
  // SAVE, RELOAD: A=P23, B=P24
  // CORRIDA: A sobe para P9, B termina P18
  // DURANTE CORRIDA: A grid=23/current=9, B grid=24/current=18
  // OFICIALIZAR: OfficialRaceResult: A grid=23 finish=9 delta=+14; B grid=24 finish=18 delta=+6
  // SAVE, RELOAD RESULT: exatamente os mesmos valores.
  it('GOLDEN TEST B: Fluxo Completo de Ponta a Ponta: Qualificação P23/P24 -> Grid -> Save/Reload -> Corrida -> Oficialização -> Persistência de Carreira', () => {
    // 1. QUALIFYING
    const qualyGrid = createQualyGrid24()
    const qA = qualyGrid.find((q) => q.driverId === 'player_drv_1')!
    const qB = qualyGrid.find((q) => q.driverId === 'player_drv_2')!
    expect(qA.gridPosition).toBe(23)
    expect(qB.gridPosition).toBe(24)

    // 2. STARTING GRID INITIALIZATION
    const initialState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    const initA = initialState.drivers.find((d) => d.driverId === 'player_drv_1')!
    const initB = initialState.drivers.find((d) => d.driverId === 'player_drv_2')!
    expect(initA.gridPosition).toBe(23)
    expect(initB.gridPosition).toBe(24)

    // Auditoria pré-largada
    const auditBeforeStart = auditStartingGrid({
      qualifyingGrid: qualyGrid.map((q) => ({
        driverId: q.driverId,
        position: q.gridPosition,
        driverName: q.driverName,
      })),
      startingGrid: initialState.drivers.map((d) => ({
        driverId: d.driverId,
        gridPosition: d.gridPosition,
        driverName: d.driverName,
      })),
      snapshotDrivers: initialState.drivers.map((d) => ({
        driverId: d.driverId,
        gridPosition: d.gridPosition,
        currentPosition: d.currentPosition,
      })),
    })
    expect(auditBeforeStart.isValid).toBe(true)
    expect(auditBeforeStart.unresolvedIdentities).toHaveLength(0)

    // 3. SAVE, RELOAD ANTES DA LARGADA
    canonicalRaceSaveService.saveCanonicalRaceState(initialState)
    const reloadedBeforeStart = canonicalRaceSaveService.loadCanonicalRaceState(
      careerId,
      season,
      round,
    )
    expect(reloadedBeforeStart.state).not.toBeNull()
    const rA = reloadedBeforeStart.state!.drivers.find((d) => d.driverId === 'player_drv_1')!
    const rB = reloadedBeforeStart.state!.drivers.find((d) => d.driverId === 'player_drv_2')!
    expect(rA.gridPosition).toBe(23)
    expect(rB.gridPosition).toBe(24)

    // 4. CORRIDA: A sobe para P9, B termina P18
    const liveState = reloadedBeforeStart.state!
    liveState.status = 'running'
    liveState.currentLap = 58
    liveState.completedAt = new Date().toISOString()
    liveState.drivers.forEach((d) => {
      d.lap = 58
    })

    // Reordenar grid final:
    // P9: Player Alpha, P18: Player Beta
    const withoutPlayers = liveState.drivers.filter(
      (d) => d.driverId !== 'player_drv_1' && d.driverId !== 'player_drv_2',
    )
    withoutPlayers.splice(8, 0, rA) // insere Player Alpha em P9 (index 8)
    withoutPlayers.splice(17, 0, rB) // insere Player Beta em P18 (index 17)
    liveState.drivers = withoutPlayers

    liveState.drivers.forEach((d, idx) => {
      d.currentPosition = idx + 1
    })

    // Durante a corrida:
    expect(rA.gridPosition).toBe(23)
    expect(rA.currentPosition).toBe(9)
    expect(rB.gridPosition).toBe(24)
    expect(rB.currentPosition).toBe(18)

    // 5. OFICIALIZAR
    liveState.status = 'completed'
    const officialResult = canonicalRaceResultService.officializeRace(liveState)
    expect(officialResult).toBeDefined()

    const offA = officialResult.entries.find((e) => e.driverId === 'player_drv_1')!
    const offB = officialResult.entries.find((e) => e.driverId === 'player_drv_2')!

    expect(offA.gridPosition).toBe(23)
    expect(offA.finalPosition).toBe(9)
    expect(offA.positionsGainedLost).toBe(14) // +14

    expect(offB.gridPosition).toBe(24)
    expect(offB.finalPosition).toBe(18)
    expect(offB.positionsGainedLost).toBe(6) // +6

    // 6. SAVE, RELOAD RESULT NA CARREIRA
    const careerResult =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(careerResult.success).toBe(true)

    const historical = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
    )
    expect(historical).not.toBeNull()

    const histA = historical!.entries.find((e) => e.driverId === 'player_drv_1')!
    const histB = historical!.entries.find((e) => e.driverId === 'player_drv_2')!

    expect(histA.gridPosition).toBe(23)
    expect(histA.finalPosition).toBe(9)
    expect(histA.positionsGainedLost).toBe(14)

    expect(histB.gridPosition).toBe(24)
    expect(histB.finalPosition).toBe(18)
    expect(histB.positionsGainedLost).toBe(6)

    // Auditoria final pós-oficialização
    const auditFinal = auditStartingGrid({
      qualifyingGrid: qualyGrid.map((q) => ({
        driverId: q.driverId,
        position: q.gridPosition,
        driverName: q.driverName,
      })),
      startingGrid: initialState.drivers.map((d) => ({
        driverId: d.driverId,
        gridPosition: d.gridPosition,
        driverName: d.driverName,
      })),
      snapshotDrivers: liveState.drivers.map((d) => ({
        driverId: d.driverId,
        gridPosition: d.gridPosition,
        currentPosition: d.currentPosition,
      })),
      officialResultEntries: historical!.entries.map((e) => ({
        driverId: e.driverId,
        gridPosition: e.gridPosition,
        finalPosition: e.finalPosition,
      })),
    })

    expect(auditFinal.isValid).toBe(true)
    expect(auditFinal.qualifyingMatchesGrid).toBe(true)
    expect(auditFinal.snapshotMatchesGrid).toBe(true)
    expect(auditFinal.officialResultMatchesGrid).toBe(true)
  })

  // TESTE COM PILOTO NO TOPO (P4 -> P10)
  it('TESTE PILOTO NO TOPO: Player A qualifying P4, grid P4, finish P10 -> gridPosition=4, finalPosition=10, delta=-6 (sem lógica especial no fundo)', () => {
    const qualyGrid = createQualyGrid24()
    // Configura Player A em P4
    const p4 = qualyGrid.find((q) => q.gridPosition === 4)!
    const p23 = qualyGrid.find((q) => q.gridPosition === 23)!

    p4.driverId = 'player_drv_1'
    p4.driverName = 'Player Alpha'
    p4.teamId = playerTeamId
    p4.isPlayer = true
    p4.carId = 'car1'

    p23.driverId = 'ai_rival_swap'
    p23.driverName = 'Rival Swap'
    p23.teamId = 'team_rival_swap'
    p23.isPlayer = false
    delete p23.carId

    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    const pA = state.drivers.find((d) => d.driverId === 'player_drv_1')!
    expect(pA.gridPosition).toBe(4)

    // Finalizar em P10
    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()
    state.drivers.forEach((d) => {
      d.lap = 58
    })

    const withoutA = state.drivers.filter((d) => d.driverId !== 'player_drv_1')
    withoutA.splice(9, 0, pA) // index 9 = P10
    state.drivers = withoutA
    state.drivers.forEach((d, idx) => {
      d.currentPosition = idx + 1
    })

    const officialResult = canonicalRaceResultService.createOfficialRaceResult(state)
    const entryA = officialResult.entries.find((e) => e.driverId === 'player_drv_1')!

    expect(entryA.gridPosition).toBe(4)
    expect(entryA.finalPosition).toBe(10)
    expect(entryA.positionsGainedLost).toBe(-6)
  })

  // TESTE COM RIVAL IA (P17 -> P11)
  it('TESTE COM RIVAL: AI driver qualifying P17, grid P17, finish P11 -> mesma regra; player e IA idênticos esportivamente', () => {
    const qualyGrid = createQualyGrid24()
    const rivalP17 = qualyGrid.find((q) => q.gridPosition === 17)!

    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season,
      round,
      circuitName: 'Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: qualyGrid,
    })

    const rivalDriver = state.drivers.find((d) => d.driverId === rivalP17.driverId)!
    expect(rivalDriver.gridPosition).toBe(17)

    // Finalizar em P11
    state.status = 'completed'
    state.currentLap = 58
    state.completedAt = new Date().toISOString()
    state.drivers.forEach((d) => {
      d.lap = 58
    })

    const withoutRival = state.drivers.filter((d) => d.driverId !== rivalP17.driverId)
    withoutRival.splice(10, 0, rivalDriver) // index 10 = P11
    state.drivers = withoutRival
    state.drivers.forEach((d, idx) => {
      d.currentPosition = idx + 1
    })

    const officialResult = canonicalRaceResultService.createOfficialRaceResult(state)
    const entryRival = officialResult.entries.find((e) => e.driverId === rivalP17.driverId)!

    expect(entryRival.gridPosition).toBe(17)
    expect(entryRival.finalPosition).toBe(11)
    expect(entryRival.positionsGainedLost).toBe(6) // 17 - 11 = +6
  })
})
