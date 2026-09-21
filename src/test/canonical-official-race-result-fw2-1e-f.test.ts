import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import {
  canonicalRaceResultService,
  CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX,
} from '@/services/canonicalRaceResultService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'
import { OFFICIAL_RACE_RESULT_SCHEMA_VERSION } from '@/types/canonical-race-v2'

function createMockQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Player Racing F1', color: '#E10600' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#DC0000' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'mercedes', name: 'Mercedes-AMG F1', color: '#00D2BE' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8700' },
    { id: 'aston_martin', name: 'Aston Martin F1', color: '#006F62' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0090FF' },
    { id: 'williams', name: 'Williams Racing', color: '#005AFF' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'sauber_audi', name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
    const t = teams[teamIdx]
    const isPlayer = t.id === playerTeamId

    for (let carNum = 1; carNum <= 2; carNum++) {
      const driverId = `drv_${t.id}_car${carNum}`
      const driverName = `Piloto ${carNum} - ${t.name}`

      grid.push({
        gridPosition: pos,
        driverId,
        driverName,
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        isPlayer,
        carId: isPlayer ? (carNum === 1 ? 'car1' : 'car2') : undefined,
        eliminationStage: pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + pos * 0.1,
        bestLapTime: `1:20.${String(pos).padStart(3, '0')}`,
        bestLapCompound: pos <= 10 ? 'macio' : 'medio',
      })
      pos++
    }
  }

  return grid
}

function initializeStandardRace(
  playerTeamId = 'sauber_audi',
  totalLaps = 50,
  careerId?: string,
): CanonicalRaceState {
  const grid = createMockQualifyingGrid(playerTeamId)
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: careerId || `career_${playerTeamId}_test`,
    season: 2026,
    round: 1,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrein',
    totalLaps,
    playerTeamId,
    canonicalQualifyingGrid: grid,
  })
}

function completeRace(race: CanonicalRaceState, seed = 42): CanonicalRaceState {
  return canonicalRaceEngineService.advanceMultipleLaps(race, race.totalLaps, {
    seedOverride: seed,
  })
}

describe('FW2.1E-F: OFFICIAL RACE RESULT (30 TESTES OBRIGATÓRIOS + TESTE DE OURO)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // 1. Corrida não finalizada não pode ser oficializada
  it('TESTE 1: corrida não finalizada não pode ser oficializada', () => {
    const race = initializeStandardRace('sauber_audi', 50)
    // Corrida recém iniciada
    expect(race.status).toBe('not_started')
    expect(() => canonicalRaceResultService.officializeRace(race)).toThrow(/Pré-condições violadas/)

    // Corrida no meio da prova (volta 10)
    const midRace = canonicalRaceEngineService.advanceMultipleLaps(race, 10, { seedOverride: 111 })
    expect(midRace.status).toBe('running')
    expect(() => canonicalRaceResultService.officializeRace(midRace)).toThrow(
      /Corrida ainda não concluída/,
    )
  })

  // 2. Corrida finalizada gera resultado
  it('TESTE 2: corrida finalizada gera resultado oficial', () => {
    let race = initializeStandardRace('sauber_audi', 3)
    race = completeRace(race, 202)
    expect(race.status).toBe('completed')

    const result = canonicalRaceResultService.officializeRace(race)
    expect(result).toBeDefined()
    expect(result.officialResultId).toContain('official_result_')
    expect(result.totalLaps).toBe(3)
  })

  // 3. Resultado possui 24 pilotos
  it('TESTE 3: resultado possui exatamente 24 pilotos', () => {
    let race = initializeStandardRace('ferrari', 3)
    race = completeRace(race, 303)
    const result = canonicalRaceResultService.officializeRace(race)

    expect(result.entries).toHaveLength(24)
  })

  // 4. 24 driverIds únicos
  it('TESTE 4: 24 driverIds únicos sem nenhuma duplicata ou omissão', () => {
    let race = initializeStandardRace('mercedes', 3)
    race = completeRace(race, 404)
    const result = canonicalRaceResultService.officializeRace(race)

    const ids = result.entries.map((e) => e.driverId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(24)
  })

  // 5. P1–P24 coerentes
  it('TESTE 5: P1–P24 coerentes, contínuos e sem posições duplicadas ou puladas', () => {
    let race = initializeStandardRace('red_bull', 3)
    race = completeRace(race, 505)
    const result = canonicalRaceResultService.officializeRace(race)

    for (let i = 0; i < 24; i++) {
      expect(result.entries[i].finalPosition).toBe(i + 1)
    }
  })

  // 6. Vencedor correto
  it('TESTE 6: vencedor correto derivado diretamente de finalPosition = 1', () => {
    let race = initializeStandardRace('mclaren', 3)
    race = completeRace(race, 606)
    const result = canonicalRaceResultService.officializeRace(race)

    const p1 = result.entries.find((e) => e.finalPosition === 1)!
    expect(result.winnerDriverId).toBe(p1.driverId)
    expect(result.winnerTeamId).toBe(p1.teamId)
  })

  // 7. Podium correto
  it('TESTE 7: podium correto [P1, P2, P3] derivado diretamente de entries', () => {
    let race = initializeStandardRace('aston_martin', 3)
    race = completeRace(race, 707)
    const result = canonicalRaceResultService.officializeRace(race)

    expect(result.podium[0]).toBe(result.entries[0].driverId)
    expect(result.podium[1]).toBe(result.entries[1].driverId)
    expect(result.podium[2]).toBe(result.entries[2].driverId)
  })

  // 8. Pole correta
  it('TESTE 8: pole position correta referenciando o piloto que largou em P1 (gridPosition === 1)', () => {
    let race = initializeStandardRace('alpine', 3)
    const poleInGrid = race.drivers.find((d) => d.gridPosition === 1)!
    race = completeRace(race, 808)
    const result = canonicalRaceResultService.officializeRace(race)

    expect(result.poleDriverId).toBe(poleInGrid.driverId)
  })

  // 9. Fastest lap correta
  it('TESTE 9: fastest lap correta congelada com driverId, tempo e volta', () => {
    let race = initializeStandardRace('williams', 5)
    race = completeRace(race, 909)
    const result = canonicalRaceResultService.officializeRace(race)

    if (race.fastestLap) {
      expect(result.fastestLapDriverId).toBe(race.fastestLap.driverId)
      expect(result.fastestLapSec).toBe(race.fastestLap.lapTimeSec)
      expect(result.fastestLapNumber).toBe(race.fastestLap.lap)
      const flEntry = result.entries.find((e) => e.driverId === result.fastestLapDriverId)!
      expect(flEntry.fastestLap).toBe(true)
    }
  })

  // 10. gridPosition preservado
  it('TESTE 10: gridPosition original de todos os 24 pilotos preservado intacto', () => {
    let race = initializeStandardRace('haas', 3)
    const initialGrids = race.drivers.map((d) => ({ id: d.driverId, grid: d.gridPosition }))
    race = completeRace(race, 1010)
    const result = canonicalRaceResultService.officializeRace(race)

    for (const init of initialGrids) {
      const entry = result.entries.find((e) => e.driverId === init.id)!
      expect(entry.gridPosition).toBe(init.grid)
    }
  })

  // 11. finalPosition preservada
  it('TESTE 11: finalPosition preservada correspondente à classificação do Race Engine', () => {
    let race = initializeStandardRace('cadillac', 3)
    race = completeRace(race, 1111)
    const engineOrder = race.drivers.map((d) => d.driverId)
    const result = canonicalRaceResultService.officializeRace(race)

    for (let i = 0; i < 24; i++) {
      expect(result.entries[i].driverId).toBe(engineOrder[i])
      expect(result.entries[i].finalPosition).toBe(i + 1)
    }
  })

  // 12. positionsGainedLost correto
  it('TESTE 12: positionsGainedLost calculado e preservado corretamente (gridPosition - finalPosition)', () => {
    let race = initializeStandardRace('sauber_audi', 4)
    race = completeRace(race, 1212)
    const result = canonicalRaceResultService.officializeRace(race)

    for (const entry of result.entries) {
      expect(entry.positionsGainedLost).toBe(entry.gridPosition - entry.finalPosition)
    }
  })

  // 13. DNF preservado
  it('TESTE 13: DNF preservado com flag e status dnf', () => {
    let race = initializeStandardRace('ferrari', 4)
    const targetDriver = race.drivers[12]
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 1313,
      forceIncident: {
        type: 'dnf',
        driverId: targetDriver.driverId,
      },
    })
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 1313 })
    expect(race.status).toBe('completed')

    const result = canonicalRaceResultService.officializeRace(race)
    const dnfEntry = result.entries.find((e) => e.driverId === targetDriver.driverId)!

    expect(dnfEntry.dnf).toBe(true)
    expect(dnfEntry.status).toBe('dnf')
  })

  // 14. dnfReason preservado
  it('TESTE 14: dnfReason preservado com o motivo exato', () => {
    let race = initializeStandardRace('mercedes', 4)
    const targetDriver = race.drivers[5]
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 1414,
      forceIncident: {
        type: 'dnf',
        driverId: targetDriver.driverId,
      },
    })
    const engineDnfReason = race.drivers.find(
      (d) => d.driverId === targetDriver.driverId,
    )!.dnfReason
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 1414 })

    const result = canonicalRaceResultService.officializeRace(race)
    const dnfEntry = result.entries.find((e) => e.driverId === targetDriver.driverId)!

    expect(dnfEntry.dnfReason).toBe(engineDnfReason)
  })

  // 15. pitStops preservado
  it('TESTE 15: contagem de pitStops preservada por piloto', () => {
    let race = initializeStandardRace('mclaren', 5)
    race = completeRace(race, 1515)
    const result = canonicalRaceResultService.officializeRace(race)

    for (const entry of result.entries) {
      const engineDriver = race.drivers.find((d) => d.driverId === entry.driverId)!
      expect(entry.pitStops).toBe(engineDriver.pitStops)
    }
  })

  // 16. raceTime preservado
  it('TESTE 16: raceTime acumulado preservado para todos os pilotos', () => {
    let race = initializeStandardRace('red_bull', 4)
    race = completeRace(race, 1616)
    const result = canonicalRaceResultService.officializeRace(race)

    for (const entry of result.entries) {
      const engineDriver = race.drivers.find((d) => d.driverId === entry.driverId)!
      expect(entry.raceTime).toBe(engineDriver.raceTime)
    }
  })

  // 17. lapsCompleted preservado
  it('TESTE 17: lapsCompleted preservado', () => {
    let race = initializeStandardRace('aston_martin', 4)
    race = completeRace(race, 1717)
    const result = canonicalRaceResultService.officializeRace(race)

    for (const entry of result.entries) {
      const engineDriver = race.drivers.find((d) => d.driverId === entry.driverId)!
      expect(entry.lapsCompleted).toBe(engineDriver.lap)
    }
  })

  // 18. Dois carros do playerTeam preservados independentemente
  it('TESTE 18: os dois carros da playerTeamId aparecem independentemente no resultado oficial', () => {
    let race = initializeStandardRace('sauber_audi', 5)
    race = completeRace(race, 1818)
    const result = canonicalRaceResultService.officializeRace(race)

    expect(result.playerEntries).toHaveLength(2)
    expect(result.playerEntries[0].driverId).not.toBe(result.playerEntries[1].driverId)
    expect(result.playerEntries[0].isPlayer).toBe(true)
    expect(result.playerEntries[1].isPlayer).toBe(true)
  })

  // 19. Resultado não referencia objetos mutáveis da corrida
  it('TESTE 19: resultado não referencia objetos mutáveis do race state (deep clone total)', () => {
    let race = initializeStandardRace('alpine', 3)
    race = completeRace(race, 1919)
    const result = canonicalRaceResultService.officializeRace(race)

    // Referências devem ser distintas
    expect(result.entries).not.toBe(race.drivers)
    expect(result.entries[0]).not.toBe(race.drivers[0])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.entries)).toBe(true)
    expect(Object.isFrozen(result.entries[0])).toBe(true)
  })

  // 20. Alterar race state depois não altera resultado
  it('TESTE 20: alterar race state depois não altera o OfficialRaceResult já homologado', () => {
    let race = initializeStandardRace('williams', 3)
    race = completeRace(race, 2020)
    const result = canonicalRaceResultService.officializeRace(race)

    const originalWinner = result.winnerDriverId
    // Mutação maliciosa no race state em memória
    race.drivers[0].driverId = 'fake_driver_hack'
    race.drivers[0].driverName = 'Piloto Hackeado'

    // O resultado oficial permanece intocado
    expect(result.winnerDriverId).toBe(originalWinner)
    expect(result.entries[0].driverId).toBe(originalWinner)
    expect(result.entries[0].driverName).not.toBe('Piloto Hackeado')
  })

  // 21. Oficialização repetida é idempotente
  it('TESTE 21: oficialização repetida é 100% idempotente (mesmo resultado, mesmo ID, mesmo hash)', () => {
    let race = initializeStandardRace('haas', 3)
    race = completeRace(race, 2121)

    const res1 = canonicalRaceResultService.officializeRace(race)
    const res2 = canonicalRaceResultService.officializeRace(race)
    const res3 = canonicalRaceResultService.officializeRace(race)

    expect(res2.officialResultId).toBe(res1.officialResultId)
    expect(res3.officialResultId).toBe(res1.officialResultId)
    expect(res2.resultHash).toBe(res1.resultHash)
    expect(res3.resultHash).toBe(res1.resultHash)
  })

  // 22. Schema version validada
  it('TESTE 22: schemaVersion validada como "official-race-result-v1"', () => {
    let race = initializeStandardRace('cadillac', 3)
    race = completeRace(race, 2222)
    const result = canonicalRaceResultService.officializeRace(race)

    expect(result.schemaVersion).toBe(OFFICIAL_RACE_RESULT_SCHEMA_VERSION)
    expect(result.schemaVersion).toBe('official-race-result-v1')
  })

  // 23. Hash/checksum reproduzível
  it('TESTE 23: hash/checksum é estritamente determinístico e reproduzível', () => {
    let race1 = initializeStandardRace('sauber_audi', 3)
    race1 = completeRace(race1, 2323)
    const result1 = canonicalRaceResultService.createOfficialRaceResult(race1)

    // Recalcular com o mesmo payload deve gerar exatamente o mesmo checksum
    const isIntegrityOk = canonicalRaceResultService.verifyResultIntegrity(result1)
    expect(isIntegrityOk).toBe(true)
    expect(result1.resultHash).toMatch(/^sha_apex_[0-9a-f]{16}$/)
  })

  // 24. Hash muda se conteúdo esportivo for alterado artificialmente
  it('TESTE 24: hash muda se qualquer dado esportivo essencial for alterado', () => {
    let race = initializeStandardRace('ferrari', 3)
    race = completeRace(race, 2424)
    const result = canonicalRaceResultService.createOfficialRaceResult(race)

    // Clonar e adulterar P1
    const tampered = JSON.parse(JSON.stringify(result)) as OfficialRaceResult
    tampered.entries[0].finalPosition = 2
    tampered.entries[1].finalPosition = 1

    const isTamperedValid = canonicalRaceResultService.verifyResultIntegrity(tampered)
    expect(isTamperedValid).toBe(false)
  })

  // 25. Corrida oficializada não volta a RUNNING
  it('TESTE 25: corrida oficializada não pode voltar para status running', () => {
    let race = initializeStandardRace('mercedes', 3)
    race = completeRace(race, 2525)
    canonicalRaceResultService.officializeRace(race)

    // Tentativa de avançar volta no engine com corrida terminada
    const afterAttempt = canonicalRaceEngineService.advanceOneLap(race)
    expect(afterAttempt.status).toBe('completed')
    expect(afterAttempt.status).not.toBe('running')
  })

  // 26. Save ativo não é retomado como corrida normal após oficialização
  it('TESTE 26: save ativo tem isFinished = true no load e não é retomado como corrida ativa', () => {
    let race = initializeStandardRace('red_bull', 3)
    race = completeRace(race, 2626)
    canonicalRaceSaveService.saveCanonicalRaceState(race)
    canonicalRaceResultService.officializeRace(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    )
    expect(loaded.isFinished).toBe(true)
  })

  // 27. Carreira A não acessa resultado da Carreira B
  it('TESTE 27: Isolamento: Carreira A não acessa o resultado oficial da Carreira B', () => {
    let raceA = initializeStandardRace('sauber_audi', 3, 'career_A')
    let raceB = initializeStandardRace('ferrari', 3, 'career_B')

    raceA = completeRace(raceA, 2727)
    raceB = completeRace(raceB, 2727)

    const resA = canonicalRaceResultService.officializeRace(raceA)
    const resB = canonicalRaceResultService.officializeRace(raceB)

    const readA = canonicalRaceResultService.getOfficialRaceResult('career_A', 2026, 1)
    const readB = canonicalRaceResultService.getOfficialRaceResult('career_B', 2026, 1)

    expect(readA?.careerId).toBe('career_A')
    expect(readA?.playerTeamId).toBe('sauber_audi')
    expect(readB?.careerId).toBe('career_B')
    expect(readB?.playerTeamId).toBe('ferrari')
  })

  // 28. Race A não acessa resultado da Race B (rounds distintos)
  it('TESTE 28: Isolamento: Round 1 não acessa o resultado oficial do Round 2', () => {
    let raceR1 = initializeStandardRace('mclaren', 3, 'career_shared')
    raceR1.round = 1
    raceR1.raceId = 'race_s2026_r1'

    let raceR2 = initializeStandardRace('mclaren', 3, 'career_shared')
    raceR2.round = 2
    raceR2.raceId = 'race_s2026_r2'

    raceR1 = completeRace(raceR1, 2828)
    raceR2 = completeRace(raceR2, 2828)

    canonicalRaceResultService.officializeRace(raceR1)
    canonicalRaceResultService.officializeRace(raceR2)

    const resR1 = canonicalRaceResultService.getOfficialRaceResult('career_shared', 2026, 1)
    const resR2 = canonicalRaceResultService.getOfficialRaceResult('career_shared', 2026, 2)

    expect(resR1?.round).toBe(1)
    expect(resR2?.round).toBe(2)
  })

  // 29. drivers_base_2026 permanece intacta
  it('TESTE 29: drivers_base_2026 permanece rigorosamente intacta antes e depois da oficialização', () => {
    const baseBefore = driverBase2026Service.getAllBaseDrivers2026()
    const firstBefore = { ...baseBefore[0] }

    let race = initializeStandardRace('sauber_audi', 3)
    race = completeRace(race, 2929)
    canonicalRaceResultService.officializeRace(race)

    const baseAfter = driverBase2026Service.getAllBaseDrivers2026()
    expect(baseAfter).toHaveLength(baseBefore.length)
    expect(baseAfter[0].id).toBe(firstBefore.id)
    expect(baseAfter[0].speed).toBe(firstBefore.speed)
  })

  // 30. Nenhuma estatística de carreira é atualizada nesta etapa
  it('TESTE 30: nenhuma estatística de carreira é alterada ou persistida (escopo reservado à FW2.1E-G)', () => {
    // Comprovar que nem career_drivers, nem campeonatos, nem vitórias são alteradas
    let race = initializeStandardRace('sauber_audi', 3)
    race = completeRace(race, 3030)
    const result = canonicalRaceResultService.officializeRace(race)

    // O resultado oficial foi persistido em seu storage isolado
    expect(result.officialResultId).toBeDefined()
    // Mas não houve escrita em coleções de carreira/campeonato
    expect(localStorage.getItem('f1_2026_career_driver_stats')).toBeNull()
    expect(localStorage.getItem('f1_2026_career_championship')).toBeNull()
  })

  // 31. TESTE DE OURO (Golden Test: Caminho A vs Caminho B)
  it('TESTE DE OURO: Caminho A (corrida direta → oficializar) == Caminho B (corrida com save/reload no meio → concluir → oficializar)', () => {
    const SEED = 998877

    // CAMINHO A: corrida completa direta sem interrupção
    let raceA = initializeStandardRace('sauber_audi', 6, 'career_golden_A')
    raceA = completeRace(raceA, SEED)
    const resultA = canonicalRaceResultService.officializeRace(raceA)

    // CAMINHO B: mesma corrida, avança 3 voltas, salva, destrói memória, carrega, conclui restante, oficializa
    let raceB = initializeStandardRace('sauber_audi', 6, 'career_golden_B')
    raceB = canonicalRaceEngineService.advanceMultipleLaps(raceB, 3, { seedOverride: SEED })
    canonicalRaceSaveService.saveCanonicalRaceState(raceB)

    // Destrói referência
    raceB = null as any

    const loadedB = canonicalRaceSaveService.loadCanonicalRaceState(
      'career_golden_B',
      2026,
      1,
    ).state!
    const finishedB = canonicalRaceEngineService.advanceMultipleLaps(loadedB, 3, {
      seedOverride: SEED,
    })
    const resultB = canonicalRaceResultService.officializeRace(finishedB)

    // Os dois resultados devem ser estritamente equivalentes em todos os campos esportivos
    expect(resultB.winnerDriverId).toBe(resultA.winnerDriverId)
    expect(resultB.poleDriverId).toBe(resultA.poleDriverId)
    expect(resultB.fastestLapDriverId).toBe(resultA.fastestLapDriverId)
    expect(resultB.podium).toEqual(resultA.podium)

    for (let i = 0; i < 24; i++) {
      const entryA = resultA.entries[i]
      const entryB = resultB.entries[i]

      expect(entryB.driverId).toBe(entryA.driverId)
      expect(entryB.finalPosition).toBe(entryA.finalPosition)
      expect(entryB.gridPosition).toBe(entryA.gridPosition)
      expect(entryB.positionsGainedLost).toBe(entryA.positionsGainedLost)
      expect(entryB.lapsCompleted).toBe(entryA.lapsCompleted)
      expect(entryB.raceTime).toBe(entryA.raceTime)
      expect(entryB.dnf).toBe(entryA.dnf)
      expect(entryB.pitStops).toBe(entryA.pitStops)
      expect(entryB.pointsAwarded).toBe(entryA.pointsAwarded)
    }
  })
})
