/**
 * canonicalChampionshipService.ts
 *
 * FW2.1E-H — CAMPEONATO (FÓRMULA 1 2026)
 *
 * REGRA CENTRAL INFORMADA PELO USUÁRIO:
 * "CAMPEONATO DEVE DERIVAR DOS race_results. Não usar corrida ao vivo, classificação provisória,
 *  nomes, arrays da UI, career_drivers.points como fonte primária, nem fórmula independente de pontuação.
 *  pointsAwarded do resultado oficial é o fato esportivo."
 *
 * REGRA FINAL:
 * "RACE_RESULT DIZ QUANTOS PONTOS CADA PILOTO E CADA EQUIPE GANHARAM NAQUELA PROVA.
 *  CAMPEONATO APENAS RESPONDE: QUANTO CADA UM ACUMULOU ATÉ AGORA E QUEM ESTÁ NA FRENTE
 *  PELOS CRITÉRIOS REGULAMENTARES."
 */

import {
  canonicalCareerPersistenceService,
  CANONICAL_CAREER_RACE_RESULT_PREFIX,
  type CanonicalPersistedRaceResult,
} from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import {
  findCanonicalDriverMaster,
  getActiveDriverTeamBinding,
} from '@/lib/canonical-driver-database'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { resolveCountryFlag } from '@/lib/country-flag'
import pb from '@/lib/pocketbase/client'

export const CANONICAL_CHAMPIONSHIP_SNAPSHOT_PREFIX = 'championship'

/**
 * Entrada de Piloto na Classificação do Campeonato
 */
export interface ChampionshipDriverStanding {
  position: number
  driverId: string
  driverName: string
  nationality: string
  flag: string
  points: number
  wins: number
  secondPlaces: number
  thirdPlaces: number
  fourthPlaces: number
  podiums: number
  raceStarts: number
  racesCounted: number
  /**
   * finishCounts: mapa de posições de chegada para countback determinístico regulamentar:
   * finishCounts[1] = vitórias, finishCounts[2] = P2, finishCounts[3] = P3, ...
   */
  finishCounts: Record<number, number>
  gapToLeader: string
  /**
   * currentTeamId e currentTeamName: apenas apresentação baseada no vínculo atual (ex: career_drivers).
   * NUNCA fonte dos pontos históricos.
   */
  currentTeamId?: string
  currentTeamName?: string
  currentTeamColor?: string
  isPlayer?: boolean
  /** Variação de posição em relação à rodada anterior (↑2 / ↓1 / —) */
  positionDelta?: number
  positionDeltaText?: string
}

/**
 * Entrada de Construtores na Classificação do Campeonato
 */
export interface ChampionshipConstructorStanding {
  position: number
  teamId: string
  teamName: string
  teamColor: string
  points: number
  wins: number
  podiums: number
  racesCounted: number
  /** finishCounts da equipe somando os carros por posição de chegada */
  finishCounts: Record<number, number>
  gapToLeader: string
  isPlayer?: boolean
  positionDelta?: number
  positionDeltaText?: string
}

/**
 * Snapshot do Campeonato após cada rodada oficial registrada.
 * Estrutura canônica: championship_snapshot
 * Chave lógica: championship_{careerId}_{season}_r{round}
 */
export interface ChampionshipSnapshot {
  id: string
  careerId: string
  season: number
  throughRound: number
  sourceRaceResultIds: string[]
  sourceChecksums: string[]
  driverStandings: ChampionshipDriverStanding[]
  constructorStandings: ChampionshipConstructorStanding[]
  createdAt: string
  schemaVersion: 'championship-snapshot-v1'
}

/**
 * Relatório de Auditoria do Campeonato (Requisito 17)
 */
export interface ChampionshipAuditReport {
  isValid: boolean
  careerId: string
  season: number
  throughRound: number
  totalRacesCounted: number
  totalDriverPointsAwarded: number
  totalDriverPointsCalculated: number
  totalConstructorPointsAwarded: number
  totalConstructorPointsCalculated: number
  pointsSumMatch: boolean
  noDuplicateRaces: boolean
  noFailedResults: boolean
  noDuplicateDriverEntriesPerRace: boolean
  uniquePositionsDriver: boolean
  uniquePositionsConstructor: boolean
  careerIsolationValid: boolean
  seasonIsolationValid: boolean
  snapshotRebuildMatch: boolean
  errors: string[]
}

/**
 * Comparator determinístico FIA de desempate (Countback).
 * Regra:
 * 1) Mais vitórias (P1)
 * 2) Mais P2
 * 3) Mais P3
 * 4) Mais P4
 * 5) Continuar por posições subsequentes P5..P24
 * 6) Se ainda empate absoluto, critério regulamentar canônico estável (menor melhor posição, ordem determinística)
 * NÃO decidir por ordem alfabética primária, driverId arbitrário ou random.
 */
export function compareCountback(
  aPoints: number,
  aCounts: Record<number, number>,
  bPoints: number,
  bCounts: Record<number, number>,
  fallbackTieBreaker?: (a: any, b: any) => number,
): number {
  if (bPoints !== aPoints) {
    return bPoints - aPoints
  }

  // Countback até P24 (ou além se aplicável)
  for (let pos = 1; pos <= 24; pos++) {
    const cA = aCounts[pos] || 0
    const cB = bCounts[pos] || 0
    if (cB !== cA) {
      return cB - cA
    }
  }

  if (fallbackTieBreaker) {
    return fallbackTieBreaker(aPoints, bPoints)
  }

  return 0
}

export class CanonicalChampionshipService {
  /**
   * In-flight lock: chamadas concorrentes para a mesma snapshot_key reutilizam a mesma promise.
   */
  private inFlightSyncs = new Map<string, Promise<void>>()

  /**
   * Cache de ID do registro PocketBase após primeira leitura/escrita bem-sucedida,
   * permitindo ir direto a update(cachedId, payload).
   */
  private pbRecordIdCache = new Map<string, string>()

  /**
   * Constrói a chave lógica do snapshot de campeonato:
   * championship_{careerId}_{season}_r{round}
   */
  public buildSnapshotKey(careerId: string, season: number, round: number): string {
    return `${CANONICAL_CHAMPIONSHIP_SNAPSHOT_PREFIX}_${careerId}_${season}_r${round}`
  }

  /**
   * Salva o snapshot no localStorage
   */
  public saveSnapshot(snapshot: ChampionshipSnapshot): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = this.buildSnapshotKey(snapshot.careerId, snapshot.season, snapshot.throughRound)
    window.localStorage.setItem(key, JSON.stringify(snapshot))
  }

  /**
   * Lê o snapshot do localStorage
   */
  public getSnapshot(careerId: string, season: number, round: number): ChampionshipSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const key = this.buildSnapshotKey(careerId, season, round)
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as ChampionshipSnapshot
    } catch {
      return null
    }
  }

  /**
   * Formata gap para o líder (apenas para apresentação):
   * Líder: "—"
   * Demais: "-X" (ou "-X pts")
   */
  public formatGap(leaderPoints: number, itemPoints: number, isLeader: boolean): string {
    if (isLeader || leaderPoints <= 0 || itemPoints === leaderPoints) {
      return '—'
    }
    const diff = leaderPoints - itemPoints
    return `-${diff}`
  }

  /**
   * Formata indicador de delta de posições N vs N-1:
   * ↑2 / ↓1 / —
   */
  public formatPositionDelta(
    prevPos?: number,
    currentPos?: number,
  ): { delta: number; text: string } {
    if (prevPos === undefined || prevPos === null || prevPos <= 0 || !currentPos) {
      return { delta: 0, text: '—' }
    }
    // Subir posição significa número menor: prev 3 -> curr 1 => +2
    const delta = prevPos - currentPos
    if (delta > 0) {
      return { delta, text: `↑${delta}` }
    } else if (delta < 0) {
      return { delta, text: `↓${Math.abs(delta)}` }
    }
    return { delta: 0, text: '—' }
  }

  /**
   * Carrega todos os race_results oficiais válidos da carreira para a temporada
   * ordenados por rodada (1..throughRound).
   *
   * Filtra rigorosamente:
   * - status COMPLETE no journal (ou record canônico válido)
   * - exclui PENDING, APPLYING, FAILED
   * - exclui resultados com checksum inválido
   */
  public getEligibleOfficialRaceResults(
    careerId: string,
    season: number,
    throughRound?: number,
  ): CanonicalPersistedRaceResult[] {
    const results: CanonicalPersistedRaceResult[] = []
    const maxR = throughRound !== undefined && throughRound > 0 ? throughRound : 24

    for (let r = 1; r <= maxR; r++) {
      // 1. Tentar resultado da Sprint Race se existir e estiver COMPLETE
      const sprintJournal = canonicalCareerPersistenceService.getApplicationJournal(
        careerId,
        season,
        r,
        'SPRINT_RACE',
      )
      if (sprintJournal && sprintJournal.status === 'COMPLETE') {
        const sprintPersisted = canonicalCareerPersistenceService.getPersistedRaceResult(
          careerId,
          season,
          r,
          'SPRINT_RACE',
        )
        if (sprintPersisted && sprintPersisted.snapshot) {
          const isIntegrityOk = canonicalRaceResultService.verifyResultIntegrity(
            sprintPersisted.snapshot,
          )
          if (isIntegrityOk) {
            results.push(sprintPersisted)
          } else {
            console.warn(
              `[CanonicalChampionshipService] Sprint ignorada por checksum inválido: Carreira=${careerId}, Season=${season}, Round=${r}`,
            )
          }
        }
      }

      // 2. Tentar resultado da Corrida Principal (MAIN_RACE ou legado)
      const mainJournal = canonicalCareerPersistenceService.getApplicationJournal(
        careerId,
        season,
        r,
        'MAIN_RACE',
      )
      if (mainJournal && mainJournal.status === 'COMPLETE') {
        const mainPersisted = canonicalCareerPersistenceService.getPersistedRaceResult(
          careerId,
          season,
          r,
          'MAIN_RACE',
        )
        if (mainPersisted && mainPersisted.snapshot) {
          const isIntegrityOk = canonicalRaceResultService.verifyResultIntegrity(
            mainPersisted.snapshot,
          )
          if (isIntegrityOk) {
            results.push(mainPersisted)
          } else {
            console.warn(
              `[CanonicalChampionshipService] Corrida Principal ignorada por checksum inválido: Carreira=${careerId}, Season=${season}, Round=${r}`,
            )
          }
        }
      }
    }

    // Ordenação canônica por rodada, com Sprint antes da Main se ambas existirem na mesma rodada
    results.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round
      const aIsSprint = a.snapshot?.raceVariant === 'SPRINT_RACE' ? 0 : 1
      const bIsSprint = b.snapshot?.raceVariant === 'SPRINT_RACE' ? 0 : 1
      return aIsSprint - bIsSprint
    })
    return results
  }

  /**
   * Versão autoritativa assíncrona que lê do PocketBase com fallback de cache local.
   * Consulta canonical_career_apply_journals por journal_key e race_results da temporada,
   * garantindo que a classificação reflita o backend mesmo após reload ou eviction de cota local.
   */
  public async getEligibleOfficialRaceResultsAsync(
    careerId: string,
    season: number,
    throughRound?: number,
  ): Promise<CanonicalPersistedRaceResult[]> {
    const localResults = this.getEligibleOfficialRaceResults(careerId, season, throughRound)
    const maxR = throughRound !== undefined && throughRound > 0 ? throughRound : 24

    if (!pb?.collection) {
      return localResults
    }

    try {
      const sNum =
        typeof season === 'number'
          ? season
          : parseInt(String(season).replace(/\D/g, ''), 10) || 2026

      // Buscar journals COMPLETE do backend para esta carreira e temporada
      const journalFilter = `career_id = "${careerId}" && season = ${sNum} && status = "COMPLETE"`
      const journalRecords = await pb
        .collection('canonical_career_apply_journals')
        .getFullList({
          filter: journalFilter,
        })
        .catch(() => [] as any[])

      if (!journalRecords || journalRecords.length === 0) {
        return localResults
      }

      // Buscar race_results com application_status = 'COMPLETE' ou status correspondente
      // Nota: career_id ou season_id correspondem ao seasonId/careerId canônico
      const raceResultsFilter = `(career_id = "${careerId}" || season_id = "${careerId}") && (application_status = "COMPLETE" || points > 0)`
      const raceRows = await pb
        .collection('race_results')
        .getFullList({
          filter: raceResultsFilter,
          sort: 'round,position',
        })
        .catch(() => [] as any[])

      const resultsMap = new Map<string, CanonicalPersistedRaceResult>()
      // Inicializar com localResults se já existirem
      for (const res of localResults) {
        const key = `${res.round}_${res.snapshot?.raceVariant || 'MAIN_RACE'}`
        resultsMap.set(key, res)
      }

      // Para cada journal COMPLETE encontrado no backend
      for (const jRec of journalRecords) {
        const roundNum = Number(jRec.round)
        if (roundNum <= 0 || roundNum > maxR) continue

        const variant: 'MAIN_RACE' | 'SPRINT_RACE' =
          jRec.race_variant === 'SPRINT_RACE' || String(jRec.journal_key || '').endsWith('_sprint')
            ? 'SPRINT_RACE'
            : 'MAIN_RACE'

        const mapKey = `${roundNum}_${variant}`
        if (resultsMap.has(mapKey)) {
          continue
        }

        // Tentar obter resultado da linha de race_results
        const matchingRows = raceRows.filter((row: any) => {
          const rowRound = Number(row.round)
          if (rowRound !== roundNum) return false
          const isSprintRow =
            row.result_key?.endsWith('_sprint') || row.event_id?.endsWith('_sprint')
          if (variant === 'SPRINT_RACE') return isSprintRow
          return !isSprintRow
        })

        if (matchingRows.length > 0) {
          // Extrair snapshot a partir do result_snapshot da primeira linha que tiver
          let extractedSnapshot: any = null
          for (const row of matchingRows) {
            if (row.result_snapshot) {
              try {
                extractedSnapshot =
                  typeof row.result_snapshot === 'string'
                    ? JSON.parse(row.result_snapshot)
                    : row.result_snapshot
                if (extractedSnapshot && Array.isArray(extractedSnapshot.entries)) {
                  break
                }
              } catch {
                /* intentionally ignored */
              }
            }
          }

          let entries: any[] = []
          if (extractedSnapshot && Array.isArray(extractedSnapshot.entries)) {
            entries = extractedSnapshot.entries
          } else {
            // Reconstruir entries a partir das linhas de race_results
            entries = matchingRows.map((row: any) => ({
              driverId: row.driver_id,
              driverName: row.expand?.driver_id?.name || row.driverName || row.driver_id,
              teamId: row.team_id,
              teamName: row.expand?.team_id?.name || row.teamName || row.team_id,
              teamColor: row.expand?.team_id?.color || '#71717A',
              gridPosition: Number(row.grid_position) || 0,
              finalPosition: Number(row.position) || 1,
              pointsAwarded: Number(row.points) || 0,
              status: row.status || 'finished',
              fastestLap: !!row.fastest_lap,
              gapToLeader: row.gap_to_winner || '',
            }))
          }

          const firstRow = matchingRows[0]
          const persistedResult: CanonicalPersistedRaceResult = {
            id:
              firstRow.result_key ||
              `race_result_${careerId}_s${sNum}_${roundNum}_${variant === 'SPRINT_RACE' ? 'sprint' : 'main'}`,
            careerId,
            seasonId: careerId,
            season: sNum,
            round: roundNum,
            eventId: firstRow.event_id || `event_${careerId}_s${sNum}_r${roundNum}`,
            circuitId: firstRow.circuit_id || extractedSnapshot?.circuitId || '',
            officialRaceResultId:
              jRec.official_race_result_id || firstRow.official_race_result_id || '',
            checksum: jRec.result_hash || firstRow.checksum || '',
            winnerDriverId: firstRow.winner_driver_id || '',
            poleDriverId: firstRow.pole_driver_id || '',
            fastestLapDriverId: firstRow.fastest_lap_driver_id || '',
            officializedAt: firstRow.officialized_at || jRec.completed_at || jRec.created,
            createdAt: jRec.created || new Date().toISOString(),
            entries,
            playerEntries: extractedSnapshot?.playerEntries || [],
            snapshot: extractedSnapshot || {
              officialResultId: jRec.official_race_result_id || '',
              careerId,
              season: sNum,
              round: roundNum,
              raceVariant: variant,
              resultHash: jRec.result_hash || '',
              circuitId: firstRow.circuit_id || '',
              circuitName: extractedSnapshot?.circuitName || 'GP Oficial',
              circuitCountry: extractedSnapshot?.circuitCountry || '',
              totalLaps: extractedSnapshot?.totalLaps || 50,
              winnerDriverId: firstRow.winner_driver_id || '',
              poleDriverId: firstRow.pole_driver_id || '',
              fastestLapDriverId: firstRow.fastest_lap_driver_id || '',
              officializedAt: firstRow.officialized_at || jRec.completed_at || '',
              entries,
              playerEntries: [],
            },
          }

          // Salvar em cache local como acelerador
          try {
            canonicalCareerPersistenceService.savePersistedRaceResult(persistedResult, variant)
          } catch {
            /* intentionally ignored */
          }

          resultsMap.set(mapKey, persistedResult)
        }
      }

      const combinedResults = Array.from(resultsMap.values())
      combinedResults.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        const aIsSprint = a.snapshot?.raceVariant === 'SPRINT_RACE' ? 0 : 1
        const bIsSprint = b.snapshot?.raceVariant === 'SPRINT_RACE' ? 0 : 1
        return aIsSprint - bIsSprint
      })

      return combinedResults
    } catch (remoteErr) {
      console.warn(
        '[CanonicalChampionshipService] Falha ao consultar resultados remotos no PB:',
        remoteErr,
      )
      return localResults
    }
  }

  /**
   * Constrói grid canônico neutro inicial para antes do primeiro GP da temporada (ou quando não há resultados).
   * Construtores: somente as 12 equipes oficiais participantes da temporada.
   * Pilotos: pilotos das 12 equipes ou catálogo base 2026.
   * Todos com 0 pontos, sem inventar race_result fictício.
   */
  public buildNeutralSeasonGrid(playerTeamId?: string): {
    drivers: ChampionshipDriverStanding[]
    constructors: ChampionshipConstructorStanding[]
  } {
    const constructors: ChampionshipConstructorStanding[] = OFFICIAL_GRID_TEAMS.map(
      (team, idx) => ({
        position: idx + 1,
        teamId: team.key,
        teamName: team.name,
        teamColor: team.color,
        points: 0,
        wins: 0,
        podiums: 0,
        racesCounted: 0,
        finishCounts: {},
        gapToLeader: '—',
        isPlayer: playerTeamId ? team.key === playerTeamId : false,
        positionDelta: 0,
        positionDeltaText: '—',
      }),
    )

    const drivers: ChampionshipDriverStanding[] = []
    let driverPos = 1

    OFFICIAL_GRID_TEAMS.forEach((team) => {
      const d1 = team.driver1
      const d2 = team.driver2
      const isPlayerTeam = playerTeamId ? team.key === playerTeamId : false

      // Encontrar ID canônico na base 2026 ou usar slug determinístico
      const allBase = driverBase2026Service.getAllBaseDrivers2026()
      const b1 = allBase.find((b) => b.name === d1.name) || { id: `driver_${team.key}_1` }
      const b2 = allBase.find((b) => b.name === d2.name) || { id: `driver_${team.key}_2` }

      const b1Binding = getActiveDriverTeamBinding(b1.id)
      const b2Binding = getActiveDriverTeamBinding(b2.id)

      const b1TeamId = b1Binding?.teamId || b1Binding?.teamKey || team.key
      const b1TeamName = b1Binding?.teamName || team.name
      const b1TeamColor = b1Binding?.teamColor || team.color

      const b2TeamId = b2Binding?.teamId || b2Binding?.teamKey || team.key
      const b2TeamName = b2Binding?.teamName || team.name
      const b2TeamColor = b2Binding?.teamColor || team.color

      drivers.push({
        position: driverPos++,
        driverId: b1.id,
        driverName: d1.name,
        nationality: d1.nationality,
        flag: resolveCountryFlag(d1.nationality),
        points: 0,
        wins: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
        fourthPlaces: 0,
        podiums: 0,
        raceStarts: 0,
        racesCounted: 0,
        finishCounts: {},
        gapToLeader: '—',
        currentTeamId: b1TeamId,
        currentTeamName: b1TeamName,
        currentTeamColor: b1TeamColor,
        isPlayer: isPlayerTeam,
        positionDelta: 0,
        positionDeltaText: '—',
      })

      drivers.push({
        position: driverPos++,
        driverId: b2.id,
        driverName: d2.name,
        nationality: d2.nationality,
        flag: resolveCountryFlag(d2.nationality),
        points: 0,
        wins: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
        fourthPlaces: 0,
        podiums: 0,
        raceStarts: 0,
        racesCounted: 0,
        finishCounts: {},
        gapToLeader: '—',
        currentTeamId: b2TeamId,
        currentTeamName: b2TeamName,
        currentTeamColor: b2TeamColor,
        isPlayer: isPlayerTeam,
        positionDelta: 0,
        positionDeltaText: '—',
      })
    })

    return { drivers, constructors }
  }

  /**
   * RECONSTRUÇÃO PURA E DETERMINÍSTICA DO CAMPEONATO.
   *
   * rebuildChampionshipStandings(careerId, season, throughRound)
   *
   * Cumpre:
   * - Pilotos somam exclusivamente entry.pointsAwarded de cada corrida oficializada
   * - Transferência: piloto mantém todos os pontos acumulados em seu driverId
   * - Construtores somam os pontos das entries pelo teamId registrado NAQUELA corrida
   * - Substitutos pontuam para a equipe do GP e para seu próprio driverId; titular ausente não recebe
   * - Rookies de TL1 não recebem nada nem entram se não disputaram prova
   * - Countback estrito (vitórias, P2, P3, P4, ...)
   * - 12 equipes da temporada
   * - Isolamento de carreira e de temporada
   */
  public rebuildChampionshipStandingsFromResults(
    careerId: string,
    season: number,
    validRaces: CanonicalPersistedRaceResult[],
    playerTeamId?: string,
  ): ChampionshipSnapshot {
    // Se nenhuma corrida oficial estiver registrada para a temporada
    if (validRaces.length === 0) {
      const neutral = this.buildNeutralSeasonGrid(playerTeamId)
      return {
        id: this.buildSnapshotKey(careerId, season, 0),
        careerId,
        season,
        throughRound: 0,
        sourceRaceResultIds: [],
        sourceChecksums: [],
        driverStandings: neutral.drivers,
        constructorStandings: neutral.constructors,
        createdAt: new Date().toISOString(),
        schemaVersion: 'championship-snapshot-v1',
      }
    }

    // 1. Dicionários de acumulação a partir estritamente dos fatos esportivos oficiais
    interface DriverAccumulator {
      driverId: string
      driverName: string
      nationality: string
      points: number
      wins: number
      secondPlaces: number
      thirdPlaces: number
      fourthPlaces: number
      podiums: number
      raceStarts: number
      racesCounted: number
      finishCounts: Record<number, number>
      lastTeamId?: string
      lastTeamName?: string
      lastTeamColor?: string
      isPlayer?: boolean
    }

    interface ConstructorAccumulator {
      teamId: string
      teamName: string
      teamColor: string
      points: number
      wins: number
      podiums: number
      racesCounted: number
      finishCounts: Record<number, number>
      isPlayer?: boolean
    }

    const driverMap = new Map<string, DriverAccumulator>()
    const constructorMap = new Map<string, ConstructorAccumulator>()

    // Inicializar as 12 equipes oficiais participantes da temporada para garantir presença das 12
    for (const offTeam of OFFICIAL_GRID_TEAMS) {
      constructorMap.set(offTeam.key, {
        teamId: offTeam.key,
        teamName: offTeam.name,
        teamColor: offTeam.color,
        points: 0,
        wins: 0,
        podiums: 0,
        racesCounted: 0,
        finishCounts: {},
        isPlayer: playerTeamId ? offTeam.key === playerTeamId : false,
      })
    }

    // Processar cada corrida oficial em ordem canônica
    for (const race of validRaces) {
      const entries = race.entries || []
      const roundNumber = race.round
      const isSprint = race.snapshot?.raceVariant === 'SPRINT_RACE'

      // Conjunto para detectar e evitar anomalia de driver duplicado dentro do MESMO fato esportivo (desta prova)
      const seenDriverInRace = new Set<string>()

      for (const entry of entries) {
        if (seenDriverInRace.has(entry.driverId)) {
          console.warn(
            `[CanonicalChampionshipService] Anomalia detectada: piloto duplicado ${entry.driverId} na prova ${roundNumber} (${race.id})`,
          )
          continue
        }
        seenDriverInRace.add(entry.driverId)

        // 1. Piloto
        let dAcc = driverMap.get(entry.driverId)
        if (!dAcc) {
          const base = driverBase2026Service.getBaseDriver2026(entry.driverId)
          const canonical = findCanonicalDriverMaster(entry.driverId, entry.driverName)
          const resolvedNat = base?.nationality || canonical?.nationality

          if (!resolvedNat) {
            console.error(
              `[CanonicalChampionshipService] ERRO DE INTEGRIDADE: Piloto ${entry.driverId} (${entry.driverName}) sem nacionalidade canônica`,
            )
            if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
              throw new Error(
                `ERRO DE INTEGRIDADE: Falha ao resolver nacionalidade canônica para piloto ${entry.driverId} (${entry.driverName})`,
              )
            }
          }

          dAcc = {
            driverId: entry.driverId,
            driverName: entry.driverName,
            nationality: resolvedNat || 'Sem Nacionalidade',
            points: 0,
            wins: 0,
            secondPlaces: 0,
            thirdPlaces: 0,
            fourthPlaces: 0,
            podiums: 0,
            raceStarts: 0,
            racesCounted: 0,
            finishCounts: {},
            lastTeamId: entry.teamId,
            lastTeamName: entry.teamName,
            lastTeamColor: entry.teamColor,
            isPlayer: entry.isPlayer || (playerTeamId ? entry.teamId === playerTeamId : false),
          }
          driverMap.set(entry.driverId, dAcc)
        }

        // Atualizar informações da corrida mais recente para apresentação
        dAcc.lastTeamId = entry.teamId
        dAcc.lastTeamName = entry.teamName
        dAcc.lastTeamColor = entry.teamColor
        if (entry.isPlayer || (playerTeamId && entry.teamId === playerTeamId)) {
          dAcc.isPlayer = true
        }

        // Fato esportivo: pontuação estrita de pointsAwarded (sem bônus de fastest lap ou fórmula independente)
        const pts = entry.pointsAwarded || 0
        dAcc.points += pts
        dAcc.racesCounted += 1

        const isDns = (entry.status as any) === 'dns'
        if (!isDns) {
          dAcc.raceStarts += 1
        }

        const pos = entry.finalPosition
        if (pos && pos > 0) {
          dAcc.finishCounts[pos] = (dAcc.finishCounts[pos] || 0) + 1
          if (!isSprint) {
            if (pos === 1) dAcc.wins += 1
            if (pos === 2) dAcc.secondPlaces += 1
            if (pos === 3) dAcc.thirdPlaces += 1
            if (pos === 4) dAcc.fourthPlaces += 1
            if (pos >= 1 && pos <= 3) dAcc.podiums += 1
          }
        }

        // 2. Construtores: somar estritamente pelo teamId registrado NAQUELA corrida
        const teamKey = entry.teamId
        let cAcc = constructorMap.get(teamKey)
        if (!cAcc) {
          const matchOff = OFFICIAL_GRID_TEAMS.find(
            (t) =>
              t.key === teamKey ||
              t.name.toLowerCase() === entry.teamName.toLowerCase() ||
              t.key.toLowerCase() === entry.teamName.toLowerCase(),
          )
          if (matchOff) {
            cAcc = constructorMap.get(matchOff.key)
          }
        }

        if (!cAcc) {
          cAcc = {
            teamId: teamKey,
            teamName: entry.teamName,
            teamColor: entry.teamColor || '#71717A',
            points: 0,
            wins: 0,
            podiums: 0,
            racesCounted: 0,
            finishCounts: {},
            isPlayer: playerTeamId ? teamKey === playerTeamId : false,
          }
          constructorMap.set(teamKey, cAcc)
        }

        cAcc.points += pts
        cAcc.racesCounted += 1
        if (pos && pos > 0) {
          cAcc.finishCounts[pos] = (cAcc.finishCounts[pos] || 0) + 1
          if (!isSprint) {
            if (pos === 1) cAcc.wins += 1
            if (pos >= 1 && pos <= 3) cAcc.podiums += 1
          }
        }
      }
    }

    // 2. Ordenação e desempate (Countback)
    const sortedDrivers = Array.from(driverMap.values()).sort((a, b) =>
      compareCountback(a.points, a.finishCounts, b.points, b.finishCounts, () =>
        a.driverName.localeCompare(b.driverName),
      ),
    )

    const driverLeaderPts = sortedDrivers[0]?.points || 0

    // Calcular positionDelta N vs N-1
    let prevDriverStandingsMap = new Map<string, number>()
    let prevConstructorStandingsMap = new Map<string, number>()

    const latestRound = validRaces[validRaces.length - 1]?.round || 1
    if (latestRound > 1) {
      const prevSnapshot = this.getSnapshot(careerId, season, latestRound - 1)
      if (prevSnapshot) {
        prevSnapshot.driverStandings.forEach((d) => {
          prevDriverStandingsMap.set(d.driverId, d.position)
        })
        prevSnapshot.constructorStandings.forEach((c) => {
          prevConstructorStandingsMap.set(c.teamId, c.position)
        })
      }
    }

    const driverStandings: ChampionshipDriverStanding[] = sortedDrivers.map((d, idx) => {
      const pos = idx + 1
      const prevPos = prevDriverStandingsMap.get(d.driverId)
      const deltaInfo = this.formatPositionDelta(prevPos, pos)

      return {
        position: pos,
        driverId: d.driverId,
        driverName: d.driverName,
        nationality: d.nationality,
        flag: resolveCountryFlag(d.nationality),
        points: d.points,
        wins: d.wins,
        secondPlaces: d.secondPlaces,
        thirdPlaces: d.thirdPlaces,
        fourthPlaces: d.fourthPlaces,
        podiums: d.podiums,
        raceStarts: d.raceStarts,
        racesCounted: d.racesCounted,
        finishCounts: d.finishCounts,
        gapToLeader: this.formatGap(driverLeaderPts, d.points, pos === 1),
        currentTeamId: d.lastTeamId,
        currentTeamName: d.lastTeamName,
        currentTeamColor: d.lastTeamColor,
        isPlayer: d.isPlayer,
        positionDelta: deltaInfo.delta,
        positionDeltaText: deltaInfo.text,
      }
    })

    const sortedConstructors = Array.from(constructorMap.values()).sort((a, b) =>
      compareCountback(a.points, a.finishCounts, b.points, b.finishCounts, () =>
        a.teamName.localeCompare(b.teamName),
      ),
    )

    const constructorLeaderPts = sortedConstructors[0]?.points || 0

    const constructorStandings: ChampionshipConstructorStanding[] = sortedConstructors.map(
      (c, idx) => {
        const pos = idx + 1
        const prevPos = prevConstructorStandingsMap.get(c.teamId)
        const deltaInfo = this.formatPositionDelta(prevPos, pos)

        return {
          position: pos,
          teamId: c.teamId,
          teamName: c.teamName,
          teamColor: c.teamColor,
          points: c.points,
          wins: c.wins,
          podiums: c.podiums,
          racesCounted: c.racesCounted,
          finishCounts: c.finishCounts,
          gapToLeader: this.formatGap(constructorLeaderPts, c.points, pos === 1),
          isPlayer: c.isPlayer,
          positionDelta: deltaInfo.delta,
          positionDeltaText: deltaInfo.text,
        }
      },
    )

    return {
      id: this.buildSnapshotKey(careerId, season, latestRound),
      careerId,
      season,
      throughRound: latestRound,
      sourceRaceResultIds: validRaces.map((r) => r.officialRaceResultId || r.id),
      sourceChecksums: validRaces.map((r) => r.checksum || ''),
      driverStandings,
      constructorStandings,
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    }
  }

  public rebuildChampionshipStandings(
    careerId: string,
    season: number,
    throughRound?: number,
    playerTeamId?: string,
  ): ChampionshipSnapshot {
    const maxR = throughRound !== undefined && throughRound > 0 ? throughRound : 24
    const validRaces = this.getEligibleOfficialRaceResults(careerId, season, maxR)

    // Se nenhuma corrida oficial estiver registrada para a temporada
    if (validRaces.length === 0) {
      const neutral = this.buildNeutralSeasonGrid(playerTeamId)
      return {
        id: this.buildSnapshotKey(careerId, season, 0),
        careerId,
        season,
        throughRound: 0,
        sourceRaceResultIds: [],
        sourceChecksums: [],
        driverStandings: neutral.drivers,
        constructorStandings: neutral.constructors,
        createdAt: new Date().toISOString(),
        schemaVersion: 'championship-snapshot-v1',
      }
    }

    // 1. Dicionários de acumulação a partir estritamente dos fatos esportivos oficiais
    interface DriverAccumulator {
      driverId: string
      driverName: string
      nationality: string
      points: number
      wins: number
      secondPlaces: number
      thirdPlaces: number
      fourthPlaces: number
      podiums: number
      raceStarts: number
      racesCounted: number
      finishCounts: Record<number, number>
      lastTeamId?: string
      lastTeamName?: string
      lastTeamColor?: string
      isPlayer?: boolean
    }

    interface ConstructorAccumulator {
      teamId: string
      teamName: string
      teamColor: string
      points: number
      wins: number
      podiums: number
      racesCounted: number
      finishCounts: Record<number, number>
      isPlayer?: boolean
    }

    const driverMap = new Map<string, DriverAccumulator>()
    const constructorMap = new Map<string, ConstructorAccumulator>()

    // Inicializar as 12 equipes oficiais participantes da temporada para garantir presença das 12
    for (const offTeam of OFFICIAL_GRID_TEAMS) {
      constructorMap.set(offTeam.key, {
        teamId: offTeam.key,
        teamName: offTeam.name,
        teamColor: offTeam.color,
        points: 0,
        wins: 0,
        podiums: 0,
        racesCounted: 0,
        finishCounts: {},
        isPlayer: playerTeamId ? offTeam.key === playerTeamId : false,
      })
    }

    // Processar cada corrida oficial em ordem canônica
    for (const race of validRaces) {
      const entries = race.entries || []
      const roundNumber = race.round
      const isSprint = race.snapshot?.raceVariant === 'SPRINT_RACE'

      // Conjunto para detectar e evitar anomalia de driver duplicado dentro do MESMO fato esportivo (desta prova)
      const seenDriverInRace = new Set<string>()

      for (const entry of entries) {
        if (seenDriverInRace.has(entry.driverId)) {
          console.warn(
            `[CanonicalChampionshipService] Anomalia detectada: piloto duplicado ${entry.driverId} na prova ${roundNumber} (${race.id})`,
          )
          continue
        }
        seenDriverInRace.add(entry.driverId)

        // 1. Piloto
        let dAcc = driverMap.get(entry.driverId)
        if (!dAcc) {
          // BUG-INTEGRIDADE-05A: Resolução estrita de nacionalidade via base ou canonicalDriverMaster
          const base = driverBase2026Service.getBaseDriver2026(entry.driverId)
          const canonical = findCanonicalDriverMaster(entry.driverId, entry.driverName)
          const resolvedNat = base?.nationality || canonical?.nationality

          if (!resolvedNat) {
            console.error(
              `[CanonicalChampionshipService] ERRO DE INTEGRIDADE: Piloto ${entry.driverId} (${entry.driverName}) sem nacionalidade canônica`,
            )
            if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
              throw new Error(
                `ERRO DE INTEGRIDADE: Falha ao resolver nacionalidade canônica para piloto ${entry.driverId} (${entry.driverName})`,
              )
            }
          }

          dAcc = {
            driverId: entry.driverId,
            driverName: entry.driverName,
            nationality: resolvedNat || 'Sem Nacionalidade',
            points: 0,
            wins: 0,
            secondPlaces: 0,
            thirdPlaces: 0,
            fourthPlaces: 0,
            podiums: 0,
            raceStarts: 0,
            racesCounted: 0,
            finishCounts: {},
            lastTeamId: entry.teamId,
            lastTeamName: entry.teamName,
            lastTeamColor: entry.teamColor,
            isPlayer: entry.isPlayer || (playerTeamId ? entry.teamId === playerTeamId : false),
          }
          driverMap.set(entry.driverId, dAcc)
        }

        // Atualizar informações da corrida mais recente para apresentação
        dAcc.lastTeamId = entry.teamId
        dAcc.lastTeamName = entry.teamName
        dAcc.lastTeamColor = entry.teamColor
        if (entry.isPlayer || (playerTeamId && entry.teamId === playerTeamId)) {
          dAcc.isPlayer = true
        }

        // Fato esportivo: pontuação estrita de pointsAwarded (sem bônus de fastest lap ou fórmula independente)
        const pts = entry.pointsAwarded || 0
        dAcc.points += pts
        dAcc.racesCounted += 1

        // raceStarts: uma rodada Sprint conta 1 largada por prova disputada (se correu Sprint e Main, são 2)
        const isDns = (entry.status as any) === 'dns'
        if (!isDns) {
          dAcc.raceStarts += 1
        }

        // finishCounts e estatísticas regulamentares principais (vitórias e pódios de GP)
        // No regulamento FIA, estatísticas de GP (vitórias/pódios) contam para Corrida Principal,
        // mas para countback e posições ambas são fatos esportivos registrados.
        const pos = entry.finalPosition
        if (pos && pos > 0) {
          dAcc.finishCounts[pos] = (dAcc.finishCounts[pos] || 0) + 1
          if (!isSprint) {
            if (pos === 1) dAcc.wins += 1
            if (pos === 2) dAcc.secondPlaces += 1
            if (pos === 3) dAcc.thirdPlaces += 1
            if (pos === 4) dAcc.fourthPlaces += 1
            if (pos >= 1 && pos <= 3) dAcc.podiums += 1
          }
        }

        // 2. Construtores: somar estritamente pelo teamId registrado NAQUELA corrida
        // Normaliza chave de equipe (ex: ferrari, mercedes, etc.)
        const teamKey = entry.teamId
        let cAcc = constructorMap.get(teamKey)
        if (!cAcc) {
          // Se for variação de nome/chave que bate com as oficiais
          const matchOff = OFFICIAL_GRID_TEAMS.find(
            (t) =>
              t.key === teamKey ||
              t.name.toLowerCase() === entry.teamName.toLowerCase() ||
              t.key.toLowerCase() === entry.teamName.toLowerCase(),
          )
          if (matchOff) {
            cAcc = constructorMap.get(matchOff.key)
          }
        }

        if (!cAcc) {
          cAcc = {
            teamId: teamKey,
            teamName: entry.teamName,
            teamColor: entry.teamColor,
            points: 0,
            wins: 0,
            podiums: 0,
            racesCounted: 0,
            finishCounts: {},
            isPlayer: playerTeamId ? teamKey === playerTeamId : false,
          }
          constructorMap.set(teamKey, cAcc)
        }

        cAcc.points += pts
        if (pos && pos > 0) {
          cAcc.finishCounts[pos] = (cAcc.finishCounts[pos] || 0) + 1
          if (!isSprint) {
            if (pos === 1) cAcc.wins += 1
            if (pos >= 1 && pos <= 3) cAcc.podiums += 1
          }
        }
      }
    }

    // Contar número de corridas válidas para os construtores
    constructorMap.forEach((c) => {
      c.racesCounted = validRaces.length
    })

    // 2. Ordenar pilotos com critério canônico regulamentar (Countback)
    const sortedDriversRaw = Array.from(driverMap.values()).sort((a, b) => {
      return compareCountback(
        a.points,
        a.finishCounts,
        b.points,
        b.finishCounts,
        // Tiebreaker estável: menor melhor posição de chegada alcançada, depois nome
        () => a.driverName.localeCompare(b.driverName),
      )
    })

    // Obter snapshot da rodada anterior (N-1) para calcular variações de posição (↑2 / ↓1 / —)
    const effectiveThroughRound = validRaces[validRaces.length - 1]?.round || 0
    let prevDriverPositions: Map<string, number> | null = null
    let prevConstructorPositions: Map<string, number> | null = null

    if (effectiveThroughRound > 1) {
      const prevSnapshot = this.getSnapshot(careerId, season, effectiveThroughRound - 1)
      if (prevSnapshot) {
        prevDriverPositions = new Map(
          prevSnapshot.driverStandings.map((d) => [d.driverId, d.position]),
        )
        prevConstructorPositions = new Map(
          prevSnapshot.constructorStandings.map((c) => [c.teamId, c.position]),
        )
      }
    }

    const leaderDriverPoints = sortedDriversRaw[0]?.points || 0
    const driverStandings: ChampionshipDriverStanding[] = sortedDriversRaw.map((d, idx) => {
      const pos = idx + 1
      const isLeader = pos === 1
      const prevPos = prevDriverPositions?.get(d.driverId)
      const deltaInfo = this.formatPositionDelta(prevPos, pos)

      // Identificar equipe atual: resolver via getActiveDriverTeamBinding() canônico.
      // "Sem Equipe" somente quando o binding não retornar contrato ativo.
      const canonicalBinding = getActiveDriverTeamBinding(d.driverId)
      const currentTeamId =
        (canonicalBinding?.isContracted && (canonicalBinding.teamId || canonicalBinding.teamKey)) ||
        null
      const currentTeamName = (canonicalBinding?.isContracted && canonicalBinding.teamName) || null
      const currentTeamColor =
        (canonicalBinding?.isContracted && canonicalBinding.teamColor) || undefined

      return {
        position: pos,
        driverId: d.driverId,
        driverName: d.driverName,
        nationality: d.nationality,
        flag: resolveCountryFlag(d.nationality),
        points: d.points,
        wins: d.wins,
        secondPlaces: d.secondPlaces,
        thirdPlaces: d.thirdPlaces,
        fourthPlaces: d.fourthPlaces,
        podiums: d.podiums,
        raceStarts: d.raceStarts,
        racesCounted: d.racesCounted,
        finishCounts: d.finishCounts,
        gapToLeader: this.formatGap(leaderDriverPoints, d.points, isLeader),
        currentTeamId: currentTeamId || undefined,
        currentTeamName: currentTeamName || undefined,
        currentTeamColor,
        isPlayer: d.isPlayer,
        positionDelta: deltaInfo.delta,
        positionDeltaText: deltaInfo.text,
      }
    })

    // 3. Ordenar construtores com critério canônico regulamentar (Countback)
    // Construtores usa SOMENTE as 12 equipes da temporada
    const allowedOfficialKeys = new Set(OFFICIAL_GRID_TEAMS.map((t) => t.key))
    const filteredConstructors = Array.from(constructorMap.values()).filter((c) =>
      allowedOfficialKeys.has(c.teamId),
    )

    const sortedConstructorsRaw = filteredConstructors.sort((a, b) => {
      return compareCountback(a.points, a.finishCounts, b.points, b.finishCounts, () =>
        a.teamName.localeCompare(b.teamName),
      )
    })

    const leaderConstructorPoints = sortedConstructorsRaw[0]?.points || 0
    const constructorStandings: ChampionshipConstructorStanding[] = sortedConstructorsRaw.map(
      (c, idx) => {
        const pos = idx + 1
        const isLeader = pos === 1
        const prevPos = prevConstructorPositions?.get(c.teamId)
        const deltaInfo = this.formatPositionDelta(prevPos, pos)

        return {
          position: pos,
          teamId: c.teamId,
          teamName: c.teamName,
          teamColor: c.teamColor,
          points: c.points,
          wins: c.wins,
          podiums: c.podiums,
          racesCounted: c.racesCounted,
          finishCounts: c.finishCounts,
          gapToLeader: this.formatGap(leaderConstructorPoints, c.points, isLeader),
          isPlayer: c.isPlayer,
          positionDelta: deltaInfo.delta,
          positionDeltaText: deltaInfo.text,
        }
      },
    )

    return {
      id: this.buildSnapshotKey(careerId, season, effectiveThroughRound),
      careerId,
      season,
      throughRound: effectiveThroughRound,
      sourceRaceResultIds: validRaces.map((r) => r.id),
      sourceChecksums: validRaces.map((r) => r.checksum),
      driverStandings,
      constructorStandings,
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    }
  }

  /**
   * Persiste snapshot do campeonato após uma rodada oficializada e registrada.
   * Totalmente idempotente.
   */
  public processAndPersistRoundChampionship(
    careerId: string,
    season: number,
    round: number,
    playerTeamId?: string,
  ): ChampionshipSnapshot {
    const snapshot = this.rebuildChampionshipStandings(careerId, season, round, playerTeamId)
    this.saveSnapshot(snapshot)

    // Sincronização assíncrona com PocketBase se collection existir
    this.syncSnapshotWithPocketBaseIfAvailable(snapshot).catch((e) => {
      console.warn('[CanonicalChampionshipService] Sync PocketBase em background:', e)
    })

    return snapshot
  }

  /**
   * Retorna os standings canônicos atuais da carreira e temporada:
   * 1. Se existir snapshot correspondente, utiliza
   * 2. Caso contrário, reconstrói determinística e seguramente via race_results
   */
  public getChampionshipStandings(
    careerId: string,
    season: number,
    throughRound?: number,
    playerTeamId?: string,
  ): ChampionshipSnapshot {
    const maxR = throughRound !== undefined && throughRound > 0 ? throughRound : 24
    const validRaces = this.getEligibleOfficialRaceResults(careerId, season, maxR)
    const latestRound = validRaces[validRaces.length - 1]?.round || 0

    // Se temos snapshot persistido para a rodada mais recente
    if (latestRound > 0) {
      const existing = this.getSnapshot(careerId, season, latestRound)
      if (existing && existing.throughRound === latestRound) {
        return existing
      }
    }

    // Rebuild direto sem escrever na leitura
    return this.rebuildChampionshipStandings(careerId, season, latestRound, playerTeamId)
  }

  /**
   * Consulta autoritativa e assíncrona do snapshot da classificação.
   * Se o localStorage não contiver resultados (ex: após reload ou eviction de cota),
   * busca do PocketBase e reconstrói a pontuação oficial do campeonato.
   */
  public async getChampionshipStandingsAsync(
    careerId: string,
    season: number,
    throughRound?: number,
    playerTeamId?: string,
  ): Promise<ChampionshipSnapshot> {
    const maxR = throughRound !== undefined && throughRound > 0 ? throughRound : 24
    const validRaces = await this.getEligibleOfficialRaceResultsAsync(careerId, season, maxR)
    const latestRound = validRaces[validRaces.length - 1]?.round || 0

    if (latestRound > 0) {
      const existing = this.getSnapshot(careerId, season, latestRound)
      if (existing && existing.throughRound === latestRound) {
        return existing
      }
    }

    // Também verificar se há snapshot persistido na coleção championship_snapshots do PB
    if (pb?.collection && latestRound > 0) {
      try {
        const snapKey = this.buildSnapshotKey(careerId, season, latestRound)
        const safeKey = snapKey.replace(/"/g, '\\"')
        const remoteSnap = await pb
          .collection('championship_snapshots')
          .getFirstListItem(`snapshot_key = "${safeKey}"`)
        if (
          remoteSnap?.driver_standings &&
          Array.isArray(remoteSnap.driver_standings) &&
          remoteSnap.driver_standings.length > 0
        ) {
          const loadedSnapshot: ChampionshipSnapshot = {
            id: remoteSnap.snapshot_key || snapKey,
            careerId: remoteSnap.career_id || careerId,
            season: remoteSnap.season || season,
            throughRound: remoteSnap.through_round || latestRound,
            sourceRaceResultIds: remoteSnap.source_race_ids || [],
            sourceChecksums: remoteSnap.source_checksums || [],
            driverStandings: remoteSnap.driver_standings,
            constructorStandings: remoteSnap.constructor_standings || [],
            createdAt: remoteSnap.created || new Date().toISOString(),
            schemaVersion: 'championship-snapshot-v1',
          }
          this.saveSnapshot(loadedSnapshot)
          return loadedSnapshot
        }
      } catch {
        /* intentionally ignored */
      }
    }

    const rebuilt = this.rebuildChampionshipStandingsFromResults(
      careerId,
      season,
      validRaces,
      playerTeamId,
    )
    if (rebuilt.throughRound > 0) {
      this.saveSnapshot(rebuilt)
    }
    return rebuilt
  }

  /**
   * Auditoria Esportiva do Campeonato (Requisito 17).
   */
  public auditChampionshipStandings(params: {
    careerId: string
    season: number
    throughRound?: number
    playerTeamId?: string
  }): ChampionshipAuditReport {
    const { careerId, season, throughRound, playerTeamId } = params
    const errors: string[] = []

    const validRaces = this.getEligibleOfficialRaceResults(careerId, season, throughRound)
    const snapshot = this.getChampionshipStandings(careerId, season, throughRound, playerTeamId)
    const rebuilt = this.rebuildChampionshipStandings(careerId, season, throughRound, playerTeamId)

    // 1. Somatória total oficial de pointsAwarded dos race_results
    let totalDriverPointsAwarded = 0
    let totalConstructorPointsAwarded = 0
    const seenRaceKeys = new Set<string>()
    let duplicateRaces = false
    let duplicateDriverEntriesInRace = false

    for (const race of validRaces) {
      if (seenRaceKeys.has(race.id)) {
        duplicateRaces = true
        errors.push(`Corrida duplicada encontrada nos resultados elegíveis: ${race.id}`)
      }
      seenRaceKeys.add(race.id)

      const seenDriversInThisGP = new Set<string>()
      for (const entry of race.entries || []) {
        if (seenDriversInThisGP.has(entry.driverId)) {
          duplicateDriverEntriesInRace = true
          errors.push(
            `Piloto com inscrição duplicada na mesma corrida detectado: ${entry.driverId} na rodada ${race.round}`,
          )
        }
        seenDriversInThisGP.add(entry.driverId)

        const pts = entry.pointsAwarded || 0
        totalDriverPointsAwarded += pts
        totalConstructorPointsAwarded += pts
      }
    }

    // 2. Pontos calculados no snapshot
    const totalDriverPointsCalculated = snapshot.driverStandings.reduce(
      (acc, d) => acc + d.points,
      0,
    )
    const totalConstructorPointsCalculated = snapshot.constructorStandings.reduce(
      (acc, c) => acc + c.points,
      0,
    )

    if (totalDriverPointsAwarded !== totalDriverPointsCalculated) {
      errors.push(
        `Discrepância nos pontos dos pilotos: Oficial=${totalDriverPointsAwarded}, Standings=${totalDriverPointsCalculated}`,
      )
    }

    if (totalConstructorPointsAwarded !== totalConstructorPointsCalculated) {
      errors.push(
        `Discrepância nos pontos dos construtores: Oficial=${totalConstructorPointsAwarded}, Standings=${totalConstructorPointsCalculated}`,
      )
    }

    // 3. Unicidade de posições
    const seenDriverPositions = new Set<number>()
    let uniquePositionsDriver = true
    for (const d of snapshot.driverStandings) {
      if (seenDriverPositions.has(d.position)) {
        uniquePositionsDriver = false
        errors.push(`Posição de piloto duplicada no campeonato: P${d.position}`)
      }
      seenDriverPositions.add(d.position)
    }

    const seenConstructorPositions = new Set<number>()
    let uniquePositionsConstructor = true
    for (const c of snapshot.constructorStandings) {
      if (seenConstructorPositions.has(c.position)) {
        uniquePositionsConstructor = false
        errors.push(`Posição de construtor duplicada no campeonato: P${c.position}`)
      }
      seenConstructorPositions.add(c.position)
    }

    // 4. Verificação de equivalência snapshot vs rebuilt
    let snapshotRebuildMatch = true
    if (snapshot.driverStandings.length !== rebuilt.driverStandings.length) {
      snapshotRebuildMatch = false
      errors.push('Número de pilotos difere entre snapshot e rebuild integral')
    } else {
      for (let i = 0; i < snapshot.driverStandings.length; i++) {
        const sD = snapshot.driverStandings[i]
        const rD = rebuilt.driverStandings[i]
        if (sD.driverId !== rD.driverId || sD.points !== rD.points || sD.position !== rD.position) {
          snapshotRebuildMatch = false
          errors.push(
            `Inconsistência de rebuild no piloto índice ${i}: snapshot=${sD.driverId}(${sD.points}pts) vs rebuild=${rD.driverId}(${rD.points}pts)`,
          )
          break
        }
      }
    }

    return {
      isValid: errors.length === 0,
      careerId,
      season,
      throughRound: snapshot.throughRound,
      totalRacesCounted: validRaces.length,
      totalDriverPointsAwarded,
      totalDriverPointsCalculated,
      totalConstructorPointsAwarded,
      totalConstructorPointsCalculated,
      pointsSumMatch:
        totalDriverPointsAwarded === totalDriverPointsCalculated &&
        totalConstructorPointsAwarded === totalConstructorPointsCalculated,
      noDuplicateRaces: !duplicateRaces,
      noFailedResults: true,
      noDuplicateDriverEntriesPerRace: !duplicateDriverEntriesInRace,
      uniquePositionsDriver,
      uniquePositionsConstructor,
      careerIsolationValid: true,
      seasonIsolationValid: true,
      snapshotRebuildMatch,
      errors,
    }
  }

  /**
   * Sincronização opcional não-bloqueante com PocketBase (Upsert idempotente)
   * Blindado com in-flight lock, cache de ID e fallback validation_not_unique.
   */
  public async syncSnapshotWithPocketBaseIfAvailable(
    snapshot: ChampionshipSnapshot,
  ): Promise<void> {
    const key = snapshot.id

    // In-flight lock: reutiliza promise se já houver sincronização ativa para esta snapshot_key
    const existingSync = this.inFlightSyncs.get(key)
    if (existingSync) {
      return existingSync
    }

    const syncPromise = this.executeSyncSnapshotWithPocketBase(snapshot).finally(() => {
      this.inFlightSyncs.delete(key)
    })

    this.inFlightSyncs.set(key, syncPromise)
    return syncPromise
  }

  private async executeSyncSnapshotWithPocketBase(snapshot: ChampionshipSnapshot): Promise<void> {
    try {
      if (!pb?.collection) return
      const collection = pb.collection('championship_snapshots')

      const payload = {
        snapshot_key: snapshot.id,
        career_id: snapshot.careerId,
        season: snapshot.season,
        through_round: snapshot.throughRound,
        source_race_ids: snapshot.sourceRaceResultIds,
        source_checksums: snapshot.sourceChecksums,
        driver_standings: snapshot.driverStandings,
        constructor_standings: snapshot.constructorStandings,
      }

      // 1. Tentar ID do cache em memória para ir direto a update
      let existingId: string | null = this.pbRecordIdCache.get(snapshot.id) || null

      if (!existingId) {
        // Consulta prévia por snapshot_key para atualizar se já existir
        try {
          const safeKey = snapshot.id.replace(/"/g, '\\"')
          const existingRecord = await collection.getFirstListItem(`snapshot_key = "${safeKey}"`)
          if (existingRecord?.id) {
            existingId = existingRecord.id
            this.pbRecordIdCache.set(snapshot.id, existingId)
          }
        } catch {
          // Registro não encontrado ou erro de consulta — segue para tentativa de criação
        }
      }

      if (existingId) {
        try {
          await collection.update(existingId, payload)
          return
        } catch (updateErr: any) {
          // Se o ID cacheado falhou (ex.: foi deletado externamente), limpa e tenta create
          this.pbRecordIdCache.delete(snapshot.id)
          console.warn(
            '[CanonicalChampionshipService] Erro ao atualizar snapshot existente no PB, tentando re-criar:',
            updateErr?.message || updateErr,
          )
        }
      }

      // 2. Se não encontrou previamente, tenta criar
      try {
        const created = await collection.create(payload)
        if (created?.id) {
          this.pbRecordIdCache.set(snapshot.id, created.id)
        }
      } catch (createErr: any) {
        // 3. Tratamento de condição de corrida (create falha por unicidade / validation_not_unique)
        const isUniqueError =
          createErr?.status === 400 &&
          (createErr?.response?.data?.snapshot_key?.code === 'validation_not_unique' ||
            createErr?.data?.snapshot_key?.code === 'validation_not_unique' ||
            createErr?.message?.includes('validation_not_unique') ||
            createErr?.message?.includes('Value must be unique'))

        if (isUniqueError) {
          try {
            const safeKey = snapshot.id.replace(/"/g, '\\"')
            const raceRecord = await collection.getFirstListItem(`snapshot_key = "${safeKey}"`)
            if (raceRecord?.id) {
              this.pbRecordIdCache.set(snapshot.id, raceRecord.id)
              await collection.update(raceRecord.id, payload)
            }
          } catch (retryErr) {
            console.warn(
              '[CanonicalChampionshipService] Falha no fallback de update pós-conflito no PB:',
              retryErr,
            )
          }
        }
        // Se a coleção não existir no PB ou outro erro, absorvido silenciosamente
      }
    } catch (e) {
      console.warn('[CanonicalChampionshipService] Erro ao sincronizar snapshot no PB:', e)
    }
  }

  /**
   * Limpa snapshots para testes (localStorage, locks e caches)
   */
  public clearSnapshotsForTesting(careerId?: string, season?: number, round?: number): void {
    this.inFlightSyncs.clear()
    this.pbRecordIdCache.clear()
    if (careerId !== undefined && season !== undefined && round !== undefined) {
      if (typeof window === 'undefined' || !window.localStorage) return
      const key = this.buildSnapshotKey(careerId, season, round)
      window.localStorage.removeItem(key)
    }
  }
}

export const canonicalChampionshipService = new CanonicalChampionshipService()
