/**
 * canonicalSeasonHistoryService.ts — Reconstrução canônica da agregação de campeonato
 * de uma temporada encerrada, acumulando TODAS as rodadas a partir dos race_results
 * canônicos (fonte de verdade imutável) e gravando de forma idempotente o
 * season_histories + prêmios FIA coerentes.
 *
 * Baseado no padrão do canonicalChampionshipService (rebuild determinístico),
 * mas operando no backend: lê todas as linhas de race_results da temporada,
 * acumula pontos/vitórias/pódios por piloto e equipe, valida limites regulamentares
 * (ex: max 24 vitórias em 24 corridas) e regrava o snapshot histórico.
 */

export interface HistoryDriverEntry {
  driverId: string
  name: string
  teamId?: string
  teamName?: string
  nationality?: string
  points: number
  wins: number
  podiums: number
  bestPosition: number
}

export interface HistoryConstructorEntry {
  teamId: string
  name: string
  color?: string
  engine?: string
  points: number
  wins: number
  podiums: number
  bestPosition: number
  isPlayer?: boolean
}

export interface RebuiltSeasonHistory {
  seasonYear: number
  totalRaces: number
  driverChampion: HistoryDriverEntry | null
  constructorChampion: HistoryConstructorEntry | null
  driverStandings: HistoryDriverEntry[]
  constructorStandings: HistoryConstructorEntry[]
  teamSummary: Record<string, any>
}

const POINTS_TABLE: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
}

/**
 * Reconstrói a agregação de campeonato acumulando TODAS as rodadas
 * a partir dos race_results canônicos (fonte de verdade).
 */
export function rebuildSeasonHistoryFromRaceResults(rows: any[]): RebuiltSeasonHistory {
  const driverMap = new Map<string, HistoryDriverEntry>()
  const teamMap = new Map<string, HistoryConstructorEntry>()

  // Inicializar registros a partir das próprias rows (defensivo: drivers/teams referenciados)
  for (const r of rows) {
    const dId = r.driver_id
    if (dId && !driverMap.has(dId)) {
      driverMap.set(dId, {
        driverId: dId,
        name: r.expand?.driver_id?.name || r.driverName || dId,
        teamId: r.team_id,
        teamName: r.expand?.team_id?.name || '',
        nationality: r.expand?.driver_id?.nationality || '',
        points: 0,
        wins: 0,
        podiums: 0,
        bestPosition: 99,
      })
    }
    const tId = r.team_id
    if (tId && !teamMap.has(tId)) {
      teamMap.set(tId, {
        teamId: tId,
        name: r.expand?.team_id?.name || tId,
        color: r.expand?.team_id?.color || '#333',
        engine: r.expand?.team_id?.engine_supplier || '',
        points: 0,
        wins: 0,
        podiums: 0,
        bestPosition: 99,
        isPlayer: r.expand?.team_id?.is_player === true,
      })
    }
  }

  // Acumular TODAS as rodadas
  for (const r of rows) {
    const dId = r.driver_id
    const tId = r.team_id
    const pos = Number(r.position) || 99
    const pts = r.points != null ? Number(r.points) || 0 : POINTS_TABLE[pos] || 0 // fallback para registros antigos sem points

    const dAcc = driverMap.get(dId)
    if (dAcc) {
      dAcc.points += pts
      if (pos === 1) dAcc.wins += 1
      if (pos >= 1 && pos <= 3) dAcc.podiums += 1
      if (pos < dAcc.bestPosition) dAcc.bestPosition = pos
    }

    const tAcc = teamMap.get(tId)
    if (tAcc) {
      tAcc.points += pts
      if (pos === 1) tAcc.wins += 1
      if (pos >= 1 && pos <= 3) tAcc.podiums += 1
      if (pos < tAcc.bestPosition) tAcc.bestPosition = pos
    }
  }

  // Ordenação canônica: pontos, depois vitórias, pódios, melhor posição
  const byStanding = (a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.podiums !== a.podiums) return b.podiums - a.podiums
    return a.bestPosition - b.bestPosition
  }

  const driverStandings = Array.from(driverMap.values()).sort(byStanding)
  const constructorStandings = Array.from(teamMap.values()).sort(byStanding)

  return {
    seasonYear: rows.length > 0 ? Number(rows[0].season_year) || 0 : 0,
    totalRaces: new Set(rows.map((r) => r.round)).size,
    driverChampion: driverStandings[0] || null,
    constructorChampion: constructorStandings[0] || null,
    driverStandings,
    constructorStandings,
    teamSummary: {},
  }
}

/**
 * Validação regulamentar da agregação reconstruída:
 * - Vitórias de um piloto não podem exceder o total de corridas
 * - Pódios não podem exceder o total de corridas
 * - Pontos coerentes com a tabela oficial (limite teórico por piloto)
 */
export function validateSeasonHistoryAggregation(history: RebuiltSeasonHistory): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const totalRaces = history.totalRaces || 24

  for (const d of history.driverStandings) {
    if (d.wins > totalRaces) {
      errors.push(`${d.name} com ${d.wins} vitórias em ${totalRaces} corridas (impossível).`)
    }
    if (d.podiums > totalRaces) {
      errors.push(`${d.name} com ${d.podiums} pódios em ${totalRaces} corridas (impossível).`)
    }
    // Limite teórico: 24 corridas * 25 pts (ignorando FL) = 600
    if (d.points > totalRaces * 26) {
      errors.push(
        `${d.name} com ${d.points} pts excede o limite regulamentar de ${totalRaces} corridas.`,
      )
    }
  }

  for (const t of history.constructorStandings) {
    if (t.wins > totalRaces) {
      errors.push(`${t.name} com ${t.wins} vitórias em ${totalRaces} corridas (impossível).`)
    }
    // 2 pilotos * 25 pts * 24 corridas = 1200
    if (t.points > totalRaces * 50) {
      errors.push(
        `${t.name} com ${t.points} pts excede o limite regulamentar de ${totalRaces} corridas.`,
      )
    }
  }

  return { isValid: errors.length === 0, errors }
}
