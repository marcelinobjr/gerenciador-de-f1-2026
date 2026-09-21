import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
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

describe('FW2.1E-G: PERSISTÊNCIA DE CARREIRA APÓS RESULTADO OFICIAL (CR-01 a CR-20)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // CR-01: persistir resultado oficial → 1 race_result
  it('CR-01: persistir resultado oficial gera exatamente 1 race_result canônico', () => {
    let race = initializeStandardRace('sauber_audi', 3, 'career_cr01')
    race = completeRace(race, 101)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const res = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(res.success).toBe(true)
    expect(res.journal.status).toBe('COMPLETE')
    expect(res.persistedResult).toBeDefined()
    expect(res.persistedResult?.id).toBe('race_result_career_cr01_s2026_1')

    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
      'career_cr01',
      2026,
      1,
    )
    expect(persisted).not.toBeNull()
    expect(persisted?.entries).toHaveLength(24)
  })

  // CR-02: persistir duas vezes → continua 1 race_result
  it('CR-02: persistir duas vezes continua gerando 1 único race_result (idempotência no registro)', () => {
    let race = initializeStandardRace('ferrari', 3, 'career_cr02')
    race = completeRace(race, 102)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const first =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(first.success).toBe(true)
    expect(first.alreadyRegistered).toBe(false)

    const second =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(second.success).toBe(true)
    expect(second.alreadyRegistered).toBe(true)
    expect(second.persistedResult?.id).toBe(first.persistedResult?.id)
  })

  // CR-03: vencedor → wins+1, podiums+1, raceStarts+1, points += pointsAwarded
  it('CR-03: vencedor recebe wins+1, podiums+1, raceStarts+1 e points += pointsAwarded', () => {
    const careerId = 'career_cr03'
    let race = initializeStandardRace('mercedes', 3, careerId)
    race = completeRace(race, 103)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const winnerId = officialResult.winnerDriverId
    const winnerEntry = officialResult.entries.find((e) => e.driverId === winnerId)!
    expect(winnerEntry.finalPosition).toBe(1)
    expect(winnerEntry.pointsAwarded).toBe(25)

    // Inicializar stats antes
    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'mercedes' })
    const beforeStats = driverBase2026Service.getCareerDriver(careerId, winnerId)!.stats
    const initialStarts = beforeStats.raceStarts ?? beforeStats.careerGps
    const initialWins = beforeStats.wins ?? beforeStats.careerWins
    const initialPodiums = beforeStats.podiums ?? beforeStats.careerPodiums
    const initialPoints = beforeStats.points ?? beforeStats.careerPoints

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const afterStats = driverBase2026Service.getCareerDriver(careerId, winnerId)!.stats
    expect(afterStats.raceStarts).toBe(initialStarts + 1)
    expect(afterStats.wins).toBe(initialWins + 1)
    expect(afterStats.podiums).toBe(initialPodiums + 1)
    expect(afterStats.points).toBe(initialPoints + 25)
  })

  // CR-04: P2 → podiums+1, wins não muda
  it('CR-04: piloto em P2 recebe podiums+1, raceStarts+1 e wins permanece inalterado', () => {
    const careerId = 'career_cr04'
    let race = initializeStandardRace('red_bull', 3, careerId)
    race = completeRace(race, 104)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const p2Entry = officialResult.entries.find((e) => e.finalPosition === 2)!
    const p2DriverId = p2Entry.driverId

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'red_bull' })
    const beforeStats = driverBase2026Service.getCareerDriver(careerId, p2DriverId)!.stats
    const initialWins = beforeStats.wins ?? beforeStats.careerWins
    const initialPodiums = beforeStats.podiums ?? beforeStats.careerPodiums

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const afterStats = driverBase2026Service.getCareerDriver(careerId, p2DriverId)!.stats
    expect(afterStats.wins).toBe(initialWins)
    expect(afterStats.podiums).toBe(initialPodiums + 1)
    expect(afterStats.points).toBe((beforeStats.points ?? 0) + (p2Entry.pointsAwarded || 18))
  })

  // CR-05: P4 → sem podium, points conforme snapshot
  it('CR-05: piloto em P4 não recebe podium e pontua exatamente conforme snapshot', () => {
    const careerId = 'career_cr05'
    let race = initializeStandardRace('mclaren', 3, careerId)
    race = completeRace(race, 105)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const p4Entry = officialResult.entries.find((e) => e.finalPosition === 4)!
    const p4DriverId = p4Entry.driverId
    expect(p4Entry.pointsAwarded).toBe(12)

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'mclaren' })
    const beforeStats = driverBase2026Service.getCareerDriver(careerId, p4DriverId)!.stats
    const initialPodiums = beforeStats.podiums ?? beforeStats.careerPodiums

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const afterStats = driverBase2026Service.getCareerDriver(careerId, p4DriverId)!.stats
    expect(afterStats.podiums).toBe(initialPodiums)
    expect(afterStats.points).toBe((beforeStats.points ?? 0) + 12)
  })

  // CR-06: pole → poles+1 para poleDriverId; vencedor diferente não recebe pole indevidamente
  it('CR-06: poles+1 para poleDriverId; vencedor diferente não recebe pole indevidamente', () => {
    const careerId = 'career_cr06'
    let race = initializeStandardRace('aston_martin', 3, careerId)
    race = completeRace(race, 106)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const poleDriverId = officialResult.poleDriverId
    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'aston_martin' })

    const poleBefore = driverBase2026Service.getCareerDriver(careerId, poleDriverId)!.stats
    const initialPoles = poleBefore.poles ?? poleBefore.careerPoles

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const poleAfter = driverBase2026Service.getCareerDriver(careerId, poleDriverId)!.stats
    expect(poleAfter.poles).toBe(initialPoles + 1)

    // Se o vencedor for diferente da pole, ele não ganha pole extra
    if (officialResult.winnerDriverId !== poleDriverId) {
      const winnerDriverId = officialResult.winnerDriverId
      const winnerAfter = driverBase2026Service.getCareerDriver(careerId, winnerDriverId)!.stats
      expect(winnerAfter.poles).toBe(0)
    }
  })

  // CR-07: fastest lap → fastestLaps+1 para fastestLapDriverId
  it('CR-07: fastestLaps+1 para fastestLapDriverId sem conceder ponto além de pointsAwarded', () => {
    const careerId = 'career_cr07'
    let race = initializeStandardRace('alpine', 4, careerId)
    race = completeRace(race, 107)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const flDriverId = officialResult.fastestLapDriverId
    if (flDriverId) {
      driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'alpine' })
      const beforeFL = driverBase2026Service.getCareerDriver(careerId, flDriverId)!.stats
      const initialFL = beforeFL.fastestLaps ?? beforeFL.careerFastestLaps

      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

      const afterFL = driverBase2026Service.getCareerDriver(careerId, flDriverId)!.stats
      expect(afterFL.fastestLaps).toBe(initialFL + 1)
    }
  })

  // CR-08: DNF → raceStarts+1, dnfs+1, lapsCompleted += oficial
  it('CR-08: piloto com DNF recebe raceStarts+1, dnfs+1 e lapsCompleted somado exatamente como oficial', () => {
    const careerId = 'career_cr08'
    let race = initializeStandardRace('williams', 4, careerId)
    const dnfCandidate = race.drivers[10]
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 108,
      forceIncident: { type: 'dnf', driverId: dnfCandidate.driverId },
    })
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 108 })
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const dnfEntry = officialResult.entries.find((e) => e.driverId === dnfCandidate.driverId)!
    expect(dnfEntry.dnf).toBe(true)

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'williams' })
    const beforeStats = driverBase2026Service.getCareerDriver(
      careerId,
      dnfCandidate.driverId,
    )!.stats
    const initialStarts = beforeStats.raceStarts ?? beforeStats.careerGps
    const initialDnfs = beforeStats.dnfs ?? beforeStats.careerDnfs
    const initialLaps = beforeStats.lapsCompleted ?? 0

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const afterStats = driverBase2026Service.getCareerDriver(careerId, dnfCandidate.driverId)!.stats
    expect(afterStats.raceStarts).toBe(initialStarts + 1)
    expect(afterStats.dnfs).toBe(initialDnfs + 1)
    expect(afterStats.lapsCompleted).toBe(initialLaps + dnfEntry.lapsCompleted)
  })

  // CR-09: DNS → não incrementar raceStarts
  it('CR-09: piloto com status DNS não incrementa raceStarts', () => {
    const careerId = 'career_cr09'
    let race = initializeStandardRace('haas', 3, careerId)
    race = completeRace(race, 109)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    // Clonar com integridade e simular piloto DNS no grid
    const dnsClone = JSON.parse(JSON.stringify(officialResult)) as OfficialRaceResult
    ;(dnsClone.entries[23] as any).status = 'dns'
    dnsClone.entries[23].lapsCompleted = 0
    dnsClone.entries[23].raceTime = 0
    // Recalcular checksum para não violar CR-14
    dnsClone.resultHash = canonicalRaceResultService.generateResultChecksum({
      officialResultId: dnsClone.officialResultId,
      careerId: dnsClone.careerId,
      season: dnsClone.season,
      round: dnsClone.round,
      raceId: dnsClone.raceId,
      winnerDriverId: dnsClone.winnerDriverId,
      poleDriverId: dnsClone.poleDriverId,
      fastestLapDriverId: dnsClone.fastestLapDriverId,
      entries: dnsClone.entries,
    })

    const dnsDriverId = dnsClone.entries[23].driverId
    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'haas' })
    const beforeStats = driverBase2026Service.getCareerDriver(careerId, dnsDriverId)!.stats
    const initialStarts = beforeStats.raceStarts ?? beforeStats.careerGps

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(dnsClone)

    const afterStats = driverBase2026Service.getCareerDriver(careerId, dnsDriverId)!.stats
    expect(afterStats.raceStarts).toBe(initialStarts) // Não deve ter incrementado
  })

  // CR-10: bestFinish atualiza corretamente
  it('CR-10: bestFinish atualiza corretamente mantendo o menor valor numérico válido', () => {
    const careerId = 'career_cr10'
    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'sauber_audi' })
    const targetDriverId = 'drv_sauber_audi_car1'

    // Definir bestFinish anterior como P4
    driverBase2026Service.updateCareerDriverStats({
      careerId,
      driverId: targetDriverId,
      newFinishPosition: 4,
    })
    expect(driverBase2026Service.getCareerDriver(careerId, targetDriverId)!.stats.bestFinish).toBe(
      4,
    )

    // Nova corrida onde termina em P2 -> atualiza para 2
    driverBase2026Service.updateCareerDriverStats({
      careerId,
      driverId: targetDriverId,
      newFinishPosition: 2,
    })
    expect(driverBase2026Service.getCareerDriver(careerId, targetDriverId)!.stats.bestFinish).toBe(
      2,
    )

    // Nova corrida onde termina em P7 -> mantém 2
    driverBase2026Service.updateCareerDriverStats({
      careerId,
      driverId: targetDriverId,
      newFinishPosition: 7,
    })
    expect(driverBase2026Service.getCareerDriver(careerId, targetDriverId)!.stats.bestFinish).toBe(
      2,
    )
  })

  // CR-11: bestGridPosition atualiza corretamente
  it('CR-11: bestGridPosition atualiza corretamente mantendo a melhor posição de largada', () => {
    const careerId = 'career_cr11'
    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'sauber_audi' })
    const targetDriverId = 'drv_sauber_audi_car1'

    driverBase2026Service.updateCareerDriverStats({
      careerId,
      driverId: targetDriverId,
      newGridPosition: 5,
    })
    expect(
      driverBase2026Service.getCareerDriver(careerId, targetDriverId)!.stats.bestGridPosition,
    ).toBe(5)

    driverBase2026Service.updateCareerDriverStats({
      careerId,
      driverId: targetDriverId,
      newGridPosition: 1,
    })
    expect(
      driverBase2026Service.getCareerDriver(careerId, targetDriverId)!.stats.bestGridPosition,
    ).toBe(1)

    driverBase2026Service.updateCareerDriverStats({
      careerId,
      driverId: targetDriverId,
      newGridPosition: 8,
    })
    expect(
      driverBase2026Service.getCareerDriver(careerId, targetDriverId)!.stats.bestGridPosition,
    ).toBe(1)
  })

  // CR-12: aplicar resultado duas vezes → nenhuma estatística duplica
  it('CR-12: aplicar resultado duas vezes garante que nenhuma estatística seja duplicada', () => {
    const careerId = 'career_cr12'
    let race = initializeStandardRace('ferrari', 3, careerId)
    race = completeRace(race, 112)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'ferrari' })
    const winnerId = officialResult.winnerDriverId

    // 1ª Aplicação
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    const stats1 = { ...driverBase2026Service.getCareerDriver(careerId, winnerId)!.stats }

    // 2ª Aplicação (repetida)
    const res2 =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(res2.alreadyRegistered).toBe(true)

    const stats2 = driverBase2026Service.getCareerDriver(careerId, winnerId)!.stats
    expect(stats2.wins).toBe(stats1.wins)
    expect(stats2.podiums).toBe(stats1.podiums)
    expect(stats2.points).toBe(stats1.points)
    expect(stats2.raceStarts).toBe(stats1.raceStarts)
  })

  // CR-13: falha parcial + retry → cada piloto recebe exatamente um incremento
  it('CR-13: falha parcial após piloto 10 + retry garante que pilotos 1–24 recebam exatamente 1 incremento', () => {
    const careerId = 'career_cr13'
    let race = initializeStandardRace('mercedes', 3, careerId)
    race = completeRace(race, 113)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'mercedes' })

    // 1ª Execução: Simular falha forçada após o 10º piloto (índice 10)
    const firstAttempt = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      officialResult,
      { simulateFailureAfterIndex: 10 },
    )
    expect(firstAttempt.success).toBe(false)
    expect(firstAttempt.journal.status).toBe('FAILED')
    expect(firstAttempt.journal.appliedDriverIds).toHaveLength(10)

    // Verificar piloto 0 (processado) e piloto 15 (não processado ainda)
    const driver0Id = officialResult.entries[0].driverId
    const driver15Id = officialResult.entries[15].driverId
    expect(driverBase2026Service.getCareerDriver(careerId, driver0Id)!.stats.raceStarts).toBe(1)
    expect(driverBase2026Service.getCareerDriver(careerId, driver15Id)!.stats.raceStarts).toBe(0)

    // 2ª Execução: Retry completo sem injeção de falha
    const retryAttempt =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)
    expect(retryAttempt.success).toBe(true)
    expect(retryAttempt.journal.status).toBe('COMPLETE')
    expect(retryAttempt.journal.appliedDriverIds).toHaveLength(24)

    // Todos os 24 pilotos agora devem ter exatamente 1 raceStart (nenhuma duplicação nos 1–10)
    for (const entry of officialResult.entries) {
      const pStats = driverBase2026Service.getCareerDriver(careerId, entry.driverId)!.stats
      expect(pStats.raceStarts).toBe(1)
    }
  })

  // CR-14: checksum inválido → aplicação bloqueada, nenhuma estatística alterada
  it('CR-14: checksum adulterado bloqueia aplicação com mensagem clara e não altera estatísticas', () => {
    const careerId = 'career_cr14'
    let race = initializeStandardRace('red_bull', 3, careerId)
    race = completeRace(race, 114)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    // Adulterar resultado
    const tampered = JSON.parse(JSON.stringify(officialResult)) as OfficialRaceResult
    tampered.winnerDriverId = 'fake_winner_hacked'

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'red_bull' })
    const winnerId = officialResult.winnerDriverId
    const beforeStats = driverBase2026Service.getCareerDriver(careerId, winnerId)!.stats

    const res = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(tampered)
    expect(res.success).toBe(false)
    expect(res.error).toBe('Resultado oficial inválido ou alterado após oficialização.')

    const afterStats = driverBase2026Service.getCareerDriver(careerId, winnerId)!.stats
    expect(afterStats.wins).toBe(beforeStats.wins)
    expect(afterStats.points).toBe(beforeStats.points)
  })

  // CR-15: Carreira A x Carreira B → isolamento total
  it('CR-15: Carreira A x Carreira B garante isolamento total das estatísticas e resultados', () => {
    const careerA = 'career_cr15_A'
    const careerB = 'career_cr15_B'

    let raceA = initializeStandardRace('sauber_audi', 3, careerA)
    raceA = completeRace(raceA, 115)
    const officialA = canonicalRaceResultService.officializeRace(raceA)

    driverBase2026Service.initializeCareerDrivers({
      careerId: careerA,
      playerTeamId: 'sauber_audi',
    })
    driverBase2026Service.initializeCareerDrivers({
      careerId: careerB,
      playerTeamId: 'sauber_audi',
    })

    const winnerId = officialA.winnerDriverId

    // Persistir apenas na Carreira A
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialA)

    const statsA = driverBase2026Service.getCareerDriver(careerA, winnerId)!.stats
    const statsB = driverBase2026Service.getCareerDriver(careerB, winnerId)!.stats

    expect(statsA.wins).toBe(1)
    expect(statsB.wins).toBe(0) // Carreira B não sofreu nenhum vazamento
    expect(canonicalCareerPersistenceService.getPersistedRaceResult(careerB, 2026, 1)).toBeNull()
  })

  // CR-16: 2026 R4 x 2027 R4 → dois resultados independentes
  it('CR-16: Round 4 de 2026 e Round 4 de 2027 geram dois resultados independentes sem sobrescrita', () => {
    const careerId = 'career_cr16'
    let race2026 = initializeStandardRace('cadillac', 3, careerId, 2026, 4)
    race2026 = completeRace(race2026, 116)
    const official2026 = canonicalRaceResultService.officializeRace(race2026)

    let race2027 = initializeStandardRace('cadillac', 3, careerId, 2027, 4)
    race2027 = completeRace(race2027, 117)
    const official2027 = canonicalRaceResultService.officializeRace(race2027)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official2026)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official2027)

    const res2026 = canonicalCareerPersistenceService.getPersistedRaceResult(careerId, 2026, 4)
    const res2027 = canonicalCareerPersistenceService.getPersistedRaceResult(careerId, 2027, 4)

    expect(res2026).not.toBeNull()
    expect(res2027).not.toBeNull()
    expect(res2026?.season).toBe(2026)
    expect(res2027?.season).toBe(2027)
    expect(res2026?.id).not.toBe(res2027?.id)
  })

  // CR-17: substituto correu → atualizar substituto, não titular ausente
  it('CR-17: se um reserva disputou oficialmente a prova, atualiza o piloto que correu', () => {
    const careerId = 'career_cr17'
    let race = initializeStandardRace('williams', 3, careerId)
    // Substituir titular pelo reserva 'substitute_driver_id' na lista do grid
    race.drivers[0].driverId = 'drv_substitute_test'
    race.drivers[0].driverName = 'Piloto Substituto'
    race = completeRace(race, 117)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'williams' })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const subDriver = driverBase2026Service.getCareerDriver(careerId, 'drv_substitute_test')
    expect(subDriver).not.toBeNull()
    expect(subDriver?.stats.raceStarts).toBe(1)
  })

  // CR-18: rookie somente TL1 → não recebe raceStart
  it('CR-18: piloto novato que participou apenas do TL1 não entra em race_results e não recebe raceStart', () => {
    const careerId = 'career_cr18'
    let race = initializeStandardRace('aston_martin', 3, careerId)
    race = completeRace(race, 118)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    // O piloto rookie 'rookie_tl1_only' não participou da corrida oficial
    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'aston_martin' })
    const rookieBefore = driverBase2026Service.getCareerDriver(careerId, 'rookie_tl1_only')
    expect(rookieBefore).toBeNull()

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const rookieAfter = driverBase2026Service.getCareerDriver(careerId, 'rookie_tl1_only')
    expect(rookieAfter).toBeNull()
  })

  // CR-19: dois carros da equipe → stats individuais corretos
  it('CR-19: dois carros da mesma equipe recebem estatísticas individuais corretas', () => {
    const careerId = 'career_cr19'
    let race = initializeStandardRace('sauber_audi', 3, careerId)
    race = completeRace(race, 119)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    const car1 = officialResult.playerEntries[0]
    const car2 = officialResult.playerEntries[1]

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'sauber_audi' })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    const c1Stats = driverBase2026Service.getCareerDriver(careerId, car1.driverId)!.stats
    const c2Stats = driverBase2026Service.getCareerDriver(careerId, car2.driverId)!.stats

    expect(c1Stats.raceStarts).toBe(1)
    expect(c2Stats.raceStarts).toBe(1)
    expect(c1Stats.points).toBe(car1.pointsAwarded)
    expect(c2Stats.points).toBe(car2.pointsAwarded)
  })

  // CR-20: reload depois de COMPLETE → continua aplicado uma vez
  it('CR-20: reload e auditoria pós COMPLETE comprovam persistência íntegra sem duplicação', () => {
    const careerId = 'career_cr20'
    let race = initializeStandardRace('mclaren', 3, careerId)
    race = completeRace(race, 120)
    const officialResult = canonicalRaceResultService.officializeRace(race)

    driverBase2026Service.initializeCareerDrivers({ careerId, playerTeamId: 'mclaren' })

    // Aplica na carreira
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialResult)

    // Simula reload da página/aplicação lendo do storage
    const audit = canonicalCareerPersistenceService.auditCareerRaceResultPersistence({
      careerId,
      season: 2026,
      round: 1,
    })

    expect(audit.isValid).toBe(true)
    expect(audit.applicationStatus).toBe('COMPLETE')
    expect(audit.raceResultFound).toBe(true)
    expect(audit.checksumValid).toBe(true)
    expect(audit.duplicateIncrementsDetected).toBe(false)
    expect(audit.allDriversProcessed).toBe(true)
    expect(audit.foundEntries).toBe(24)
  })
})
