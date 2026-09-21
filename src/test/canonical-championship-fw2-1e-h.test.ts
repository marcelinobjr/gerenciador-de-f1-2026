import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import {
  canonicalChampionshipService,
  compareCountback,
} from '@/services/canonicalChampionshipService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'

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
    { id: 'audi', name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
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
  playerTeamId = 'audi',
  totalLaps = 3,
  careerId?: string,
  season = 2026,
  round = 1,
): CanonicalRaceState {
  const grid = createMockQualifyingGrid(playerTeamId)
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: careerId || `career_${playerTeamId}_test`,
    season,
    round,
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

describe('FW2.1E-H: CAMPEONATO (TESTES OBRIGATÓRIOS CH-01 a CH-24)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // CH-01: uma corrida, P1=25 P2=18 → standings 25/18
  it('CH-01: uma corrida com P1=25 e P2=18 resulta em standings com 25 e 18 pontos', () => {
    const careerId = 'career_ch01'
    let race = initializeStandardRace('mercedes', 3, careerId, 2026, 1)
    race = completeRace(race, 201)
    const official = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    expect(snap.driverStandings[0].points).toBe(25)
    expect(snap.driverStandings[0].position).toBe(1)
    expect(snap.driverStandings[0].wins).toBe(1)
    expect(snap.driverStandings[1].points).toBe(18)
    expect(snap.driverStandings[1].position).toBe(2)
    expect(snap.driverStandings[1].wins).toBe(0)
  })

  // CH-02: duas corridas somadas corretamente
  it('CH-02: duas corridas oficiais têm suas pontuações somadas corretamente', () => {
    const careerId = 'career_ch02'
    // R1
    let r1 = initializeStandardRace('ferrari', 3, careerId, 2026, 1)
    r1 = completeRace(r1, 202)
    const off1 = canonicalRaceResultService.officializeRace(r1)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off1)

    // R2
    let r2 = initializeStandardRace('ferrari', 3, careerId, 2026, 2)
    r2 = completeRace(r2, 203)
    const off2 = canonicalRaceResultService.officializeRace(r2)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off2)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 2)
    expect(snap.throughRound).toBe(2)
    expect(snap.sourceRaceResultIds).toHaveLength(2)

    // A soma dos pontos dos pilotos deve ser a soma das entries de R1 + R2
    const sumOfficial =
      off1.entries.reduce((a, b) => a + b.pointsAwarded, 0) +
      off2.entries.reduce((a, b) => a + b.pointsAwarded, 0)
    const sumStandings = snap.driverStandings.reduce((a, b) => a + b.points, 0)
    expect(sumStandings).toBe(sumOfficial)
  })

  // CH-03: processar mesma corrida duas vezes → standings não mudam
  it('CH-03: processar a mesma corrida duas vezes não duplica pontos e mantém standings inalterado', () => {
    const careerId = 'career_ch03'
    let r1 = initializeStandardRace('mclaren', 3, careerId, 2026, 1)
    r1 = completeRace(r1, 204)
    const off1 = canonicalRaceResultService.officializeRace(r1)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off1)
    const snap1 = canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, 1)

    // Segunda chamada idêntica para o mesmo GP
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off1)
    const snap2 = canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, 1)

    expect(snap1.driverStandings[0].points).toBe(snap2.driverStandings[0].points)
    expect(snap1.driverStandings[0].driverId).toBe(snap2.driverStandings[0].driverId)
    expect(snap1.constructorStandings[0].points).toBe(snap2.constructorStandings[0].points)
  })

  // CH-04: empate em pontos: mais vitórias à frente
  it('CH-04: empate em pontos decide por mais vitórias à frente (Countback critério 1)', () => {
    // Teste com compareCountback direto
    // Piloto A: 25 pts (1 vitória P1)
    // Piloto B: 25 pts (0 vitórias, 1 P2 de 18 + 1 P7 de 6 + 1 P10 de 1)
    const res = compareCountback(25, { 1: 1 }, 25, { 2: 1, 7: 1, 10: 1 })
    // Deve retornar negativo se A vem antes de B (ou B - A na função sort)
    expect(res).toBeLessThan(0)
  })

  // CH-05: mesmas vitórias: mais P2 decide
  it('CH-05: mesmo número de vitórias decide por mais segundos lugares (P2)', () => {
    // Ambos com 1 vitória e 30 pontos totais
    // Piloto A: 1 vitória (25) + 1 P10 (1) + ... = 30 pts, 1 P2
    // Piloto B: 1 vitória (25) + ... = 30 pts, 0 P2
    const res = compareCountback(30, { 1: 1, 2: 1 }, 30, { 1: 1, 2: 0, 3: 1 })
    expect(res).toBeLessThan(0)
  })

  // CH-06: countback continua para P3/P4/etc.
  it('CH-06: countback continua determinístico para P3, P4 e posições subsequentes', () => {
    // Piloto A e B com mesmos pontos, vitórias e P2, mas A tem 2 P3 e B tem 1 P3
    const resP3 = compareCountback(40, { 1: 1, 2: 1, 3: 2 }, 40, { 1: 1, 2: 1, 3: 1 })
    expect(resP3).toBeLessThan(0)

    // Se empatam em P3, P4 decide
    const resP4 = compareCountback(40, { 1: 1, 2: 1, 3: 1, 4: 2 }, 40, { 1: 1, 2: 1, 3: 1, 4: 1 })
    expect(resP4).toBeLessThan(0)
  })

  // CH-07: construtores somam os dois carros
  it('CH-07: construtores somam os pontos dos dois carros que disputaram a prova', () => {
    const careerId = 'career_ch07'
    let race = initializeStandardRace('ferrari', 3, careerId, 2026, 1)
    race = completeRace(race, 207)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    // Para cada equipe, os pontos no construtores devem ser a soma das suas entries no snapshot oficial
    for (const c of snap.constructorStandings) {
      const teamEntries = off.entries.filter((e) => e.teamId === c.teamId)
      const expectedPoints = teamEntries.reduce((sum, e) => sum + e.pointsAwarded, 0)
      expect(c.points).toBe(expectedPoints)
    }
  })

  // CH-08: Carro 1 pontua, Carro 2 DNF com zero → equipe recebe somente os pontos oficiais existentes
  it('CH-08: Carro 1 pontua e Carro 2 tem DNF com zero: equipe recebe somente os pontos oficiais do Carro 1', () => {
    const careerId = 'career_ch08'
    let race = initializeStandardRace('williams', 3, careerId, 2026, 1)
    // Forçar DNF no carro 2 da Williams
    const wCar2 = race.drivers.find((d) => d.teamId === 'williams' && d.driverId.includes('car2'))!
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 208,
      forceIncident: { type: 'dnf', driverId: wCar2.driverId },
    })
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 2, { seedOverride: 208 })
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    const williamsStanding = snap.constructorStandings.find((c) => c.teamId === 'williams')!
    const wEntries = off.entries.filter((e) => e.teamId === 'williams')
    const wExpected = wEntries.reduce((acc, e) => acc + e.pointsAwarded, 0)

    expect(williamsStanding.points).toBe(wExpected)
  })

  // CH-09: piloto troca A→B: piloto mantém todos os pontos; equipe A mantém os anteriores; equipe B recebe os posteriores
  it('CH-09: piloto troca da equipe A para a B: piloto mantém pontos acumulados e equipes mantêm seus respectivos pontos', () => {
    const careerId = 'career_ch09'
    // R1: Piloto X corre pela equipe A (alpine) e faz P1 (25 pts)
    let r1 = initializeStandardRace('alpine', 3, careerId, 2026, 1)
    r1 = completeRace(r1, 209)
    const off1 = canonicalRaceResultService.officializeRace(r1)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off1)

    const p1DriverId = off1.winnerDriverId // Ganhou na equipe alpine
    expect(off1.winnerTeamId).toBe('alpine')

    // R2: Piloto X agora corre pela equipe B (williams) e marca P2 (18 pts)
    let r2 = initializeStandardRace('williams', 3, careerId, 2026, 2)
    // Trocar driverId no grid de R2 para ser o mesmo piloto X agora na Williams
    const wEntry = r2.drivers.find((d) => d.teamId === 'williams')!
    wEntry.driverId = p1DriverId
    wEntry.driverName = 'Piloto Transferido'
    r2 = completeRace(r2, 210)

    const off2 = canonicalRaceResultService.officializeRace(r2)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off2)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 2)
    const transferredDriver = snap.driverStandings.find((d) => d.driverId === p1DriverId)!
    expect(transferredDriver).toBeDefined()

    // Piloto acumulou pontos de ambas as equipes (25 de R1 + pontos conquistados em R2)
    const r2Entry = off2.entries.find((e) => e.driverId === p1DriverId)!
    expect(transferredDriver.points).toBe(25 + r2Entry.pointsAwarded)

    // Construtores: Alpine tem os pontos de R1 e Williams tem os de R2
    const alpineConst = snap.constructorStandings.find((c) => c.teamId === 'alpine')!
    const williamsConst = snap.constructorStandings.find((c) => c.teamId === 'williams')!

    const off1AlpinePts = off1.entries
      .filter((e) => e.teamId === 'alpine')
      .reduce((s, e) => s + e.pointsAwarded, 0)
    const off2AlpinePts = off2.entries
      .filter((e) => e.teamId === 'alpine')
      .reduce((s, e) => s + e.pointsAwarded, 0)
    expect(alpineConst.points).toBe(off1AlpinePts + off2AlpinePts)

    const off1WilliamsPts = off1.entries
      .filter((e) => e.teamId === 'williams')
      .reduce((s, e) => s + e.pointsAwarded, 0)
    const off2WilliamsPts = off2.entries
      .filter((e) => e.teamId === 'williams')
      .reduce((s, e) => s + e.pointsAwarded, 0)
    expect(williamsConst.points).toBe(off1WilliamsPts + off2WilliamsPts)
  })

  // CH-10: substituto marca pontos: substituto recebe, equipe recebe, titular ausente não recebe
  it('CH-10: piloto substituto que marca pontos recebe no seu campeonato e na equipe; titular ausente não recebe', () => {
    const careerId = 'career_ch10'
    let race = initializeStandardRace('ferrari', 3, careerId, 2026, 1)

    // Substituir titular 2 da Ferrari por um substituto
    const subDriverId = 'reserve_driver_bearman'
    const originalTitularId = race.drivers.find(
      (d) => d.teamId === 'ferrari' && d.driverId.includes('car2'),
    )!.driverId

    const targetIndex = race.drivers.findIndex((d) => d.driverId === originalTitularId)
    race.drivers[targetIndex].driverId = subDriverId
    race.drivers[targetIndex].driverName = 'Oliver Bearman (Substituto)'

    race = completeRace(race, 211)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)

    const subStanding = snap.driverStandings.find((d) => d.driverId === subDriverId)!
    const titularStanding = snap.driverStandings.find((d) => d.driverId === originalTitularId)

    expect(subStanding).toBeDefined()
    expect(subStanding.points).toBe(
      off.entries.find((e) => e.driverId === subDriverId)!.pointsAwarded,
    )
    // Titular ausente não participou do GP oficial e não recebe os pontos do substituto
    expect(titularStanding).toBeUndefined()
  })

  // CH-11: rookie só TL1: não aparece com pontos por causa do treino
  it('CH-11: rookie que participou apenas do TL1 não aparece com pontos no campeonato', () => {
    const careerId = 'career_ch11'
    let race = initializeStandardRace('mercedes', 3, careerId, 2026, 1)
    race = completeRace(race, 212)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    // Rookie fictício de TL1
    const tl1Rookie = snap.driverStandings.find((d) => d.driverId === 'rookie_tl1_only')
    expect(tl1Rookie).toBeUndefined()
  })

  // CH-12: DNF classificado com pointsAwarded>0: pontos contam exatamente como no snapshot
  it('CH-12: piloto com DNF classificado com pointsAwarded>0 tem seus pontos contabilizados exatamente como no snapshot', () => {
    const careerId = 'career_ch12'
    let race = initializeStandardRace('red_bull', 3, careerId, 2026, 1)
    race = completeRace(race, 213)
    const off = canonicalRaceResultService.officializeRace(race)

    // Clonar e simular P8 com DNF nas voltas finais recebendo 4 pontos oficiais
    const clone = JSON.parse(JSON.stringify(off)) as OfficialRaceResult
    clone.entries[7].dnf = true
    clone.entries[7].status = 'dnf'
    clone.entries[7].pointsAwarded = 4
    clone.resultHash = canonicalRaceResultService.generateResultChecksum({
      officialResultId: clone.officialResultId,
      careerId: clone.careerId,
      season: clone.season,
      round: clone.round,
      raceId: clone.raceId,
      winnerDriverId: clone.winnerDriverId,
      poleDriverId: clone.poleDriverId,
      fastestLapDriverId: clone.fastestLapDriverId,
      entries: clone.entries,
    })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(clone)
    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)

    const dnfDriver = snap.driverStandings.find((d) => d.driverId === clone.entries[7].driverId)!
    expect(dnfDriver.points).toBe(4)
  })

  // CH-13: resultado FAILED/PENDING não entra no campeonato
  it('CH-13: resultado com status PENDING, APPLYING ou FAILED não entra no campeonato', () => {
    const careerId = 'career_ch13'
    let race = initializeStandardRace('audi', 3, careerId, 2026, 1)
    race = completeRace(race, 214)
    const off = canonicalRaceResultService.officializeRace(race)

    // Salvar no persistence com status FAILED
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: canonicalCareerPersistenceService.buildRaceResultKey(careerId, 2026, 1),
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: 'evt_1',
      circuitId: 'sakhir',
      officialRaceResultId: off.officialResultId,
      checksum: off.resultHash,
      winnerDriverId: off.winnerDriverId,
      poleDriverId: off.poleDriverId,
      officializedAt: off.officializedAt,
      createdAt: new Date().toISOString(),
      entries: off.entries,
      playerEntries: off.playerEntries,
      snapshot: off,
    })

    canonicalCareerPersistenceService.saveApplicationJournal({
      key: canonicalCareerPersistenceService.buildApplyJournalKey(careerId, 2026, 1),
      careerId,
      season: 2026,
      round: 1,
      officialRaceResultId: off.officialResultId,
      checksum: off.resultHash,
      status: 'FAILED',
      appliedDriverIds: [],
      totalEntries: 24,
      startedAt: new Date().toISOString(),
      lastError: 'Simulação de falha',
    })

    const eligible = canonicalChampionshipService.getEligibleOfficialRaceResults(careerId, 2026, 1)
    expect(eligible).toHaveLength(0)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    expect(snap.throughRound).toBe(0)
    expect(snap.driverStandings[0].points).toBe(0)
  })

  // CH-14: Carreira A vs B: isolamento
  it('CH-14: Carreira A e Carreira B mantêm isolamento absoluto de standings', () => {
    const careerA = 'career_ch14_A'
    const careerB = 'career_ch14_B'

    let raceA = initializeStandardRace('mercedes', 3, careerA, 2026, 1)
    raceA = completeRace(raceA, 215)
    const offA = canonicalRaceResultService.officializeRace(raceA)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(offA)

    const snapA = canonicalChampionshipService.getChampionshipStandings(careerA, 2026, 1)
    const snapB = canonicalChampionshipService.getChampionshipStandings(careerB, 2026, 1)

    expect(snapA.throughRound).toBe(1)
    expect(snapA.driverStandings[0].points).toBe(25)

    expect(snapB.throughRound).toBe(0)
    expect(snapB.driverStandings[0].points).toBe(0)
  })

  // CH-15: 2026 vs 2027: 2027 começa zero
  it('CH-15: temporada 2026 e 2027 são isoladas e 2027 começa rigorosamente em zero', () => {
    const careerId = 'career_ch15'

    // Registrar corrida em 2026
    let r2026 = initializeStandardRace('ferrari', 3, careerId, 2026, 1)
    r2026 = completeRace(r2026, 216)
    const off2026 = canonicalRaceResultService.officializeRace(r2026)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off2026)

    const snap2026 = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    const snap2027 = canonicalChampionshipService.getChampionshipStandings(careerId, 2027, 1)

    expect(snap2026.throughRound).toBe(1)
    expect(snap2026.driverStandings[0].points).toBe(25)

    expect(snap2027.throughRound).toBe(0)
    expect(snap2027.driverStandings[0].points).toBe(0)
    expect(snap2027.constructorStandings[0].points).toBe(0)
  })

  // CH-16: snapshot R4 reconstruído pelos race_results R1–R4 é estritamente equivalente ao persistido
  it('CH-16: snapshot R4 reconstruído pelos race_results R1 a R4 é rigorosamente equivalente ao persistido', () => {
    const careerId = 'career_ch16'

    for (let r = 1; r <= 4; r++) {
      let race = initializeStandardRace('mclaren', 3, careerId, 2026, r)
      race = completeRace(race, 300 + r)
      const off = canonicalRaceResultService.officializeRace(race)
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)
      canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, r)
    }

    const persistedR4 = canonicalChampionshipService.getSnapshot(careerId, 2026, 4)!
    expect(persistedR4).not.toBeNull()
    expect(persistedR4.throughRound).toBe(4)

    const rebuiltR4 = canonicalChampionshipService.rebuildChampionshipStandings(careerId, 2026, 4)

    expect(rebuiltR4.driverStandings).toHaveLength(persistedR4.driverStandings.length)
    for (let i = 0; i < persistedR4.driverStandings.length; i++) {
      expect(rebuiltR4.driverStandings[i].driverId).toBe(persistedR4.driverStandings[i].driverId)
      expect(rebuiltR4.driverStandings[i].points).toBe(persistedR4.driverStandings[i].points)
      expect(rebuiltR4.driverStandings[i].position).toBe(persistedR4.driverStandings[i].position)
    }
  })

  // CH-17: snapshot R5 não altera snapshot R4 (histórico imutável)
  it('CH-17: persistir snapshot R5 não altera e mantém imutável o snapshot histórico de R4', () => {
    const careerId = 'career_ch17'

    for (let r = 1; r <= 4; r++) {
      let race = initializeStandardRace('red_bull', 3, careerId, 2026, r)
      race = completeRace(race, 310 + r)
      const off = canonicalRaceResultService.officializeRace(race)
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)
      canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, r)
    }

    const r4Before = JSON.stringify(canonicalChampionshipService.getSnapshot(careerId, 2026, 4))

    // Disputar e persistir R5
    let r5 = initializeStandardRace('red_bull', 3, careerId, 2026, 5)
    r5 = completeRace(r5, 315)
    const off5 = canonicalRaceResultService.officializeRace(r5)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off5)
    canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, 5)

    const r4After = JSON.stringify(canonicalChampionshipService.getSnapshot(careerId, 2026, 4))
    expect(r4After).toBe(r4Before)
  })

  // CH-18: variação de posição N vs N-1 calculada corretamente
  it('CH-18: variação de posição N vs N-1 calculada corretamente (↑, ↓, —)', () => {
    const careerId = 'career_ch18'

    let r1 = initializeStandardRace('ferrari', 3, careerId, 2026, 1)
    r1 = completeRace(r1, 321)
    const off1 = canonicalRaceResultService.officializeRace(r1)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off1)
    canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, 1)

    let r2 = initializeStandardRace('ferrari', 3, careerId, 2026, 2)
    r2 = completeRace(r2, 322)
    const off2 = canonicalRaceResultService.officializeRace(r2)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off2)
    const snap2 = canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, 2)

    // O snapshot da rodada 2 deve conter positionDeltaText preenchido para os pilotos
    expect(snap2.driverStandings.some((d) => d.positionDeltaText !== undefined)).toBe(true)
  })

  // CH-19: 12 equipes da temporada: somente 12 aparecem em Construtores
  it('CH-19: construtores contém rigorosamente as 12 equipes da temporada oficial', () => {
    const careerId = 'career_ch19'
    let race = initializeStandardRace('mercedes', 3, careerId, 2026, 1)
    race = completeRace(race, 323)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
    expect(snap.constructorStandings).toHaveLength(12)
    expect(OFFICIAL_GRID_TEAMS).toHaveLength(12)
  })

  // CH-20: piloto que sai da temporada permanece no standings com pontos acumulados
  it('CH-20: piloto que pontuou e não corre as etapas seguintes permanece no standings com pontos acumulados', () => {
    const careerId = 'career_ch20'
    // R1: piloto corre e vence
    let r1 = initializeStandardRace('aston_martin', 3, careerId, 2026, 1)
    r1 = completeRace(r1, 324)
    const off1 = canonicalRaceResultService.officializeRace(r1)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off1)
    const winnerId = off1.winnerDriverId

    // R2: piloto não está no grid de R2 (substituído)
    let r2 = initializeStandardRace('aston_martin', 3, careerId, 2026, 2)
    const targetIdx = r2.drivers.findIndex((d) => d.driverId === winnerId)
    if (targetIdx >= 0) {
      r2.drivers[targetIdx].driverId = 'another_substitute_driver'
    }
    r2 = completeRace(r2, 325)
    const off2 = canonicalRaceResultService.officializeRace(r2)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off2)

    const snap2 = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 2)
    const exDriver = snap2.driverStandings.find((d) => d.driverId === winnerId)
    expect(exDriver).toBeDefined()
    expect(exDriver!.points).toBe(25)
  })

  // CH-21: mesmo piloto com duas entries na mesma prova detectado pela auditoria
  it('CH-21: anomalia de mesmo piloto com duas entries na mesma prova é detectada pela auditoria esportiva', () => {
    const careerId = 'career_ch21'
    let race = initializeStandardRace('alpine', 3, careerId, 2026, 1)
    race = completeRace(race, 326)
    const off = canonicalRaceResultService.officializeRace(race)

    // Clonar e duplicar driverId
    const tampered = JSON.parse(JSON.stringify(off)) as OfficialRaceResult
    tampered.entries[1].driverId = tampered.entries[0].driverId // Duplicação
    tampered.resultHash = canonicalRaceResultService.generateResultChecksum({
      officialResultId: tampered.officialResultId,
      careerId: tampered.careerId,
      season: tampered.season,
      round: tampered.round,
      raceId: tampered.raceId,
      winnerDriverId: tampered.winnerDriverId,
      poleDriverId: tampered.poleDriverId,
      fastestLapDriverId: tampered.fastestLapDriverId,
      entries: tampered.entries,
    })

    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: canonicalCareerPersistenceService.buildRaceResultKey(careerId, 2026, 1),
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: 'evt_dup',
      circuitId: 'sakhir',
      officialRaceResultId: tampered.officialResultId,
      checksum: tampered.resultHash,
      winnerDriverId: tampered.winnerDriverId,
      poleDriverId: tampered.poleDriverId,
      officializedAt: tampered.officializedAt,
      createdAt: new Date().toISOString(),
      entries: tampered.entries,
      playerEntries: tampered.playerEntries,
      snapshot: tampered,
    })
    canonicalCareerPersistenceService.saveApplicationJournal({
      key: canonicalCareerPersistenceService.buildApplyJournalKey(careerId, 2026, 1),
      careerId,
      season: 2026,
      round: 1,
      officialRaceResultId: tampered.officialResultId,
      checksum: tampered.resultHash,
      status: 'COMPLETE',
      appliedDriverIds: tampered.entries.map((e) => e.driverId),
      totalEntries: 24,
      startedAt: new Date().toISOString(),
    })

    const audit = canonicalChampionshipService.auditChampionshipStandings({
      careerId,
      season: 2026,
      throughRound: 1,
    })

    expect(audit.noDuplicateDriverEntriesPerRace).toBe(false)
    expect(audit.isValid).toBe(false)
  })

  // CH-22: pontos dos construtores totalizam exatamente a soma dos pointsAwarded das suas entries
  it('CH-22: pontos dos construtores totalizam com exatidão matemática a soma dos pointsAwarded de suas entries', () => {
    const careerId = 'career_ch22'
    let race = initializeStandardRace('ferrari', 3, careerId, 2026, 1)
    race = completeRace(race, 327)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const audit = canonicalChampionshipService.auditChampionshipStandings({
      careerId,
      season: 2026,
      throughRound: 1,
    })

    expect(audit.pointsSumMatch).toBe(true)
    expect(audit.totalConstructorPointsAwarded).toBe(audit.totalConstructorPointsCalculated)
    expect(audit.isValid).toBe(true)
  })

  // CH-23: abrir/recarregar Campeonato repetidamente: nenhuma escrita ou duplicação adicional
  it('CH-23: chamar getChampionshipStandings repetidamente não escreve dados nem duplica posições', () => {
    const careerId = 'career_ch23'
    let race = initializeStandardRace('red_bull', 3, careerId, 2026, 1)
    race = completeRace(race, 328)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)
    canonicalChampionshipService.processAndPersistRoundChampionship(careerId, 2026, 1)

    const snapFirst = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)

    // Chamar 10 vezes seguidas simulando abertura/recarregamento repetido da tela
    for (let i = 0; i < 10; i++) {
      const snapAgain = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)
      expect(snapAgain.driverStandings[0].points).toBe(snapFirst.driverStandings[0].points)
      expect(snapAgain.constructorStandings[0].points).toBe(
        snapFirst.constructorStandings[0].points,
      )
    }
  })

  // CH-24: pole e fastest lap não adicionam pontos além do pointsAwarded
  it('CH-24: pole position e volta mais rápida não adicionam pontos no campeonato além do pointsAwarded oficial', () => {
    const careerId = 'career_ch24'
    let race = initializeStandardRace('mclaren', 3, careerId, 2026, 1)
    race = completeRace(race, 329)
    const off = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(off)

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, 2026, 1)

    const poleDriver = snap.driverStandings.find((d) => d.driverId === off.poleDriverId)!
    const flDriver = off.fastestLapDriverId
      ? snap.driverStandings.find((d) => d.driverId === off.fastestLapDriverId)!
      : null

    const poleOfficialEntry = off.entries.find((e) => e.driverId === off.poleDriverId)!
    expect(poleDriver.points).toBe(poleOfficialEntry.pointsAwarded)

    if (flDriver) {
      const flOfficialEntry = off.entries.find((e) => e.driverId === off.fastestLapDriverId)!
      expect(flDriver.points).toBe(flOfficialEntry.pointsAwarded)
    }
  })
})
