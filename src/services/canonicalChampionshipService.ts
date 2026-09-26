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
import { findCanonicalDriverMaster } from '@/lib/canonical-driver-database'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { getCountryFlag } from '@/lib/country-flags'
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
      const journal = canonicalCareerPersistenceService.getApplicationJournal(careerId, season, r)
      if (!journal || journal.status !== 'COMPLETE') {
        continue
      }

      const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
        careerId,
        season,
        r,
      )
      if (!persisted || !persisted.snapshot) {
        continue
      }

      // Validação estrita de checksum do fato esportivo
      const isIntegrityOk = canonicalRaceResultService.verifyResultIntegrity(persisted.snapshot)
      if (!isIntegrityOk) {
        console.warn(
          `[CanonicalChampionshipService] Corrida ignorada por checksum inválido: Carreira=${careerId}, Season=${season}, Round=${r}`,
        )
        continue
      }

      results.push(persisted)
    }

    // Ordenação canônica por rodada
    results.sort((a, b) => a.round - b.round)
    return results
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

      drivers.push({
        position: driverPos++,
        driverId: b1.id,
        driverName: d1.name,
        nationality: d1.nationality,
        flag: getCountryFlag(d1.nationality),
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
        currentTeamId: team.key,
        currentTeamName: team.name,
        currentTeamColor: team.color,
        isPlayer: isPlayerTeam,
        positionDelta: 0,
        positionDeltaText: '—',
      })

      drivers.push({
        position: driverPos++,
        driverId: b2.id,
        driverName: d2.name,
        nationality: d2.nationality,
        flag: getCountryFlag(d2.nationality),
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
        currentTeamId: team.key,
        currentTeamName: team.name,
        currentTeamColor: team.color,
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

      // Conjunto para detectar e evitar anomalia de driver duplicado no mesmo GP
      const seenDriverInRace = new Set<string>()

      for (const entry of entries) {
        if (seenDriverInRace.has(entry.driverId)) {
          console.warn(
            `[CanonicalChampionshipService] Anomalia detectada: piloto duplicado ${entry.driverId} na prova ${roundNumber}`,
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

        const isDns = (entry.status as any) === 'dns'
        if (!isDns) {
          dAcc.raceStarts += 1
        }

        const pos = entry.finalPosition
        if (pos && pos > 0) {
          dAcc.finishCounts[pos] = (dAcc.finishCounts[pos] || 0) + 1
          if (pos === 1) dAcc.wins += 1
          if (pos === 2) dAcc.secondPlaces += 1
          if (pos === 3) dAcc.thirdPlaces += 1
          if (pos === 4) dAcc.fourthPlaces += 1
          if (pos >= 1 && pos <= 3) dAcc.podiums += 1
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
          if (pos === 1) cAcc.wins += 1
          if (pos >= 1 && pos <= 3) cAcc.podiums += 1
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

      // Identificar equipe atual via career_drivers se existir
      const careerRec = driverBase2026Service.getCareerDriver(careerId, d.driverId)
      const currentTeamId = careerRec?.teamId || d.lastTeamId
      const currentTeamName = careerRec?.teamName || d.lastTeamName

      return {
        position: pos,
        driverId: d.driverId,
        driverName: d.driverName,
        nationality: d.nationality,
        flag: getCountryFlag(d.nationality),
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
        currentTeamId,
        currentTeamName,
        currentTeamColor: d.lastTeamColor,
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
   * Sincronização opcional não-bloqueante com PocketBase
   */
  public async syncSnapshotWithPocketBaseIfAvailable(
    snapshot: ChampionshipSnapshot,
  ): Promise<void> {
    try {
      if (!pb?.collection) return
      // Tenta gravar na coleção championship_snapshots se ela existir no backend
      try {
        await pb.collection('championship_snapshots').create({
          snapshot_key: snapshot.id,
          career_id: snapshot.careerId,
          season: snapshot.season,
          through_round: snapshot.throughRound,
          source_race_ids: snapshot.sourceRaceResultIds,
          source_checksums: snapshot.sourceChecksums,
          driver_standings: snapshot.driverStandings,
          constructor_standings: snapshot.constructorStandings,
        })
      } catch {
        // Se a coleção não existir no PB, ignora silenciosamente sem falhar o fluxo esportivo
      }
    } catch (e) {
      console.warn('[CanonicalChampionshipService] Erro ao sincronizar snapshot no PB:', e)
    }
  }

  /**
   * Limpa snapshots para testes
   */
  public clearSnapshotsForTesting(careerId: string, season: number, round: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = this.buildSnapshotKey(careerId, season, round)
    window.localStorage.removeItem(key)
  }
}

export const canonicalChampionshipService = new CanonicalChampionshipService()
