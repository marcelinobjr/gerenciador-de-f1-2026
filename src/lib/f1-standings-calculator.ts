import { getAICompetitors, OFFICIAL_GRID_TEAMS } from './f1-data'
import { calculateCombinedPace } from './f1-pace-model'

/**
 * Tabela oficial de pontuação FIA para Fórmula 1 (Top 10):
 * P1 = 25 pts, P2 = 18 pts, P3 = 15 pts, P4 = 12 pts, P5 = 10 pts,
 * P6 = 8 pts, P7 = 6 pts, P8 = 4 pts, P9 = 2 pts, P10 = 1 pt.
 * Sistema de pontuação: pontos do 1º ao 10º lugar, sem bonificação por volta mais rápida.
 */
export const FIA_POINTS_TABLE: readonly number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const

/**
 * Retorna os pontos FIA padrão para uma determinada posição de chegada (1-indexed).
 */
export function getFiaPointsForPosition(position: number): number {
  if (position >= 1 && position <= FIA_POINTS_TABLE.length) {
    return FIA_POINTS_TABLE[position - 1]
  }
  return 0
}

export interface DriverStandingItem {
  id: string
  name: string
  nationality: string
  flag: string
  teamName: string
  teamColor: string
  points: number
  wins: number
  podiums: number
  isPlayer: boolean
  bestPosition?: number
}

export interface TeamStandingItem {
  id: string
  name: string
  color: string
  engine: string
  points: number
  wins: number
  podiums: number
  isPlayer: boolean
  bestPosition?: number
}

/**
 * Simula de forma determinística e calibrada os resultados de rodadas passadas
 * para o grid da IA utilizando a tabela oficial FIA (25/18/15/12/10/8/6/4/2/1),
 * sem heurística fracionada.
 *
 * Cada rodada passada é simulada ranqueando os pilotos rivais pela combinação
 * de velocidade/consistência do piloto com a força do carro da equipe.
 * Os 10 primeiros recebem exatamente os pontos oficiais FIA (pontos do 1º ao 10º lugar, sem bonificação por volta mais rápida).
 * P1 recebe +1 vitória e +1 pódio; P2 e P3 recebem +1 pódio.
 */
export function simulateAiGridFiaStandings(
  playerTeamKey?: string,
  isCustomTeam: boolean = true,
  pastRounds: number = 0,
): {
  driverStandingsMap: Record<
    string,
    { points: number; wins: number; podiums: number; bestPos: number }
  >
  teamStandingsMap: Record<
    string,
    { points: number; wins: number; podiums: number; bestPos: number }
  >
} {
  const aiGrid = getAICompetitors(playerTeamKey, isCustomTeam)

  const dMap: Record<string, { points: number; wins: number; podiums: number; bestPos: number }> =
    {}
  const tMap: Record<string, { points: number; wins: number; podiums: number; bestPos: number }> =
    {}

  // Inicializa todos os pilotos e equipes com 0
  aiGrid.forEach((aiTeam) => {
    tMap[aiTeam.id] = { points: 0, wins: 0, podiums: 0, bestPos: 99 }
    dMap[`${aiTeam.id}_d1`] = { points: 0, wins: 0, podiums: 0, bestPos: 99 }
    dMap[`${aiTeam.id}_d2`] = { points: 0, wins: 0, podiums: 0, bestPos: 99 }
  })

  if (pastRounds <= 0) {
    return { driverStandingsMap: dMap, teamStandingsMap: tMap }
  }

  // Para cada rodada passada, computar uma ordem realista com pesos de piloto + carro + semente determinística
  for (let r = 1; r <= pastRounds; r++) {
    const roundScores: Array<{
      driverKey: string
      teamId: string
      score: number
    }> = []

    aiGrid.forEach((aiTeam, teamIdx) => {
      // Driver 1 - Modelo combinado (70% Carro, 30% Piloto)
      const pseudoLuck1 = Math.sin(r * 12.9898 + teamIdx * 78.233) * 0.35
      const pace1 = calculateCombinedPace({
        teamStrength: aiTeam.strengthRating,
        carLevel: aiTeam.carLevel,
        driver: {
          speed: aiTeam.driver1.speed,
          consistency: aiTeam.driver1.consistency,
          defense: aiTeam.driver1.defense,
          rain: aiTeam.driver1.rain,
        },
        noise: pseudoLuck1,
      })

      roundScores.push({
        driverKey: `${aiTeam.id}_d1`,
        teamId: aiTeam.id,
        score: pace1.lapScore,
      })

      // Driver 2 - Modelo combinado (70% Carro, 30% Piloto)
      const pseudoLuck2 = Math.cos(r * 39.346 + teamIdx * 11.135) * 0.35
      const pace2 = calculateCombinedPace({
        teamStrength: aiTeam.strengthRating,
        carLevel: aiTeam.carLevel,
        driver: {
          speed: aiTeam.driver2.speed,
          consistency: aiTeam.driver2.consistency,
          defense: aiTeam.driver2.defense,
          rain: aiTeam.driver2.rain,
        },
        noise: pseudoLuck2,
      })

      roundScores.push({
        driverKey: `${aiTeam.id}_d2`,
        teamId: aiTeam.id,
        score: pace2.lapScore,
      })
    })

    // Ordena os pilotos pelo score da rodada
    roundScores.sort((a, b) => b.score - a.score)

    // Atribui pontos oficiais FIA para o Top 10
    roundScores.forEach((entry, idx) => {
      const pos = idx + 1
      const dData = dMap[entry.driverKey]
      const tData = tMap[entry.teamId]

      if (dData && pos < dData.bestPos) dData.bestPos = pos
      if (tData && pos < tData.bestPos) tData.bestPos = pos

      if (pos <= FIA_POINTS_TABLE.length) {
        const pts = FIA_POINTS_TABLE[pos - 1]
        if (dData) {
          dData.points += pts
          if (pos === 1) {
            dData.wins += 1
            dData.podiums += 1
          } else if (pos <= 3) {
            dData.podiums += 1
          }
        }
        if (tData) {
          tData.points += pts
          if (pos === 1) {
            tData.wins += 1
            tData.podiums += 1
          } else if (pos <= 3) {
            tData.podiums += 1
          }
        }
      }
    })
  }

  return { driverStandingsMap: dMap, teamStandingsMap: tMap }
}

/**
 * Normaliza strings de nomes para comparação insensível a acentos, pontuação e caixa.
 */
export function normalizeEntityName(name?: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}
