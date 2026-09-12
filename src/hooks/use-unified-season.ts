import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import {
  standingsService,
  DriverStanding,
  TeamStanding,
  FullStandingsResult,
} from '@/services/standingsService'
import { RaceResultModel, DriverModel, TeamModel, SeasonModel } from '@/types/f1'

export interface UnifiedSeasonData {
  season: SeasonModel | null
  team: TeamModel | null
  playerDrivers: DriverModel[]
  raceResults: RaceResultModel[]
  standings: FullStandingsResult
  driverStandings: DriverStanding[]
  constructorStandings: TeamStanding[]
  currentRound: number
  totalRounds: number
  loading: boolean
  error: Error | null
  reload: () => Promise<void>
}

// Cache em memória compartilhado entre instâncias do hook (tempo de vida da sessão da janela)
interface MemorySeasonCache {
  seasonId: string
  teamId: string
  timestamp: number
  raceResults: RaceResultModel[]
  playerDrivers: DriverModel[]
}

let globalMemoryCache: MemorySeasonCache | null = null
const CACHE_TTL_MS = 60_000 // 1 minuto de TTL para evitar requisições redundantes, mas com bypass em realtime

/**
 * Hook unificado de dados da temporada.
 * Sincroniza season, team, pilotos e race_results através de um único canal
 * com cache em memória compartilhado entre CalendarPage, Standings e RaceSlim.
 */
export function useUnifiedSeason(): UnifiedSeasonData {
  const { team, season } = useAuth()

  const [raceResults, setRaceResults] = useState<RaceResultModel[]>(() => {
    if (globalMemoryCache && globalMemoryCache.seasonId === season?.id) {
      return globalMemoryCache.raceResults
    }
    return []
  })

  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>(() => {
    if (globalMemoryCache && globalMemoryCache.teamId === team?.id) {
      return globalMemoryCache.playerDrivers
    }
    return []
  })

  const [loading, setLoading] = useState<boolean>(() => {
    // Se temos cache válido e atual, não inicia em loading
    if (
      globalMemoryCache &&
      season &&
      team &&
      globalMemoryCache.seasonId === season.id &&
      globalMemoryCache.teamId === team.id &&
      Date.now() - globalMemoryCache.timestamp < CACHE_TTL_MS
    ) {
      return false
    }
    return true
  })

  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(
    async (forceBypassCache = false) => {
      if (!season || !team) {
        setLoading(false)
        return
      }

      const isCacheFresh =
        globalMemoryCache &&
        globalMemoryCache.seasonId === season.id &&
        globalMemoryCache.teamId === team.id &&
        Date.now() - globalMemoryCache.timestamp < CACHE_TTL_MS

      if (!forceBypassCache && isCacheFresh && globalMemoryCache) {
        setRaceResults(globalMemoryCache.raceResults)
        setPlayerDrivers(globalMemoryCache.playerDrivers)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const [rList, dList] = await Promise.all([
          f1Service.getSeasonRaceResults(season.id),
          f1Service.getTeamDrivers(team.id),
        ])

        // Se não houver piloto reserva em dList, buscar quem tem reserve_team_id
        let fullDrivers = [...dList]
        const hasReserve = fullDrivers.some((d) => d.role === 'reserva')
        if (!hasReserve) {
          try {
            const marketOrReserves = await f1Service.getMarketDrivers()
            const myReserve = marketOrReserves.find(
              (d) =>
                d.reserve_team_id === team.id || (d.role === 'reserva' && d.team_id === team.id),
            )
            if (myReserve && !fullDrivers.some((d) => d.id === myReserve.id)) {
              fullDrivers.push(myReserve)
            }
          } catch (rErr) {
            console.warn('Erro ao carregar piloto reserva no useUnifiedSeason:', rErr)
          }
        }

        // Atualiza cache em memória
        globalMemoryCache = {
          seasonId: season.id,
          teamId: team.id,
          timestamp: Date.now(),
          raceResults: rList,
          playerDrivers: fullDrivers,
        }

        setRaceResults(rList)
        setPlayerDrivers(fullDrivers)
        setError(null)
      } catch (err: any) {
        console.error('Erro ao carregar dados unificados da temporada:', err)
        setError(err)
      } finally {
        setLoading(false)
      }
    },
    [season?.id, team?.id],
  )

  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  // Invalidação por Realtime
  useRealtime('race_results', () => {
    fetchData(true)
  })

  useRealtime('drivers', () => {
    fetchData(true)
  })

  // Cálculo consolidado das classificações via standingsService
  const standings = useMemo(() => {
    return standingsService.calculateStandings({
      raceResults,
      playerDrivers,
      team,
      season,
    })
  }, [raceResults, playerDrivers, team, season])

  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24

  return {
    season,
    team,
    playerDrivers,
    raceResults,
    standings,
    driverStandings: standings.driverStandings,
    constructorStandings: standings.constructorStandings,
    currentRound,
    totalRounds,
    loading,
    error,
    reload: () => fetchData(true),
  }
}
