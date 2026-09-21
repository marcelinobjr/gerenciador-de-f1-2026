/**
 * driverBase2026Service.ts
 *
 * SEÇÕES 3 E 4: BASE ORIGINAL DOS PILOTOS 2026 (IMUTÁVEL) & ESTADO DE PILOTOS POR CARREIRA
 *
 * Princípios mandatórios:
 * A. BASE ORIGINAL 2026 (drivers_base_2026):
 *    - Representa o estado oficial imutável dos pilotos em 01/01/2026.
 *    - Congelada com Object.freeze e cópias defensivas em tempo de execução.
 *    - Não existe método/caminho de escrita em runtime.
 *    - Retornada via getBaseDriver2026(driverId) ou getAllBaseDrivers2026().
 *
 * B. ESTADO DOS PILOTOS POR CARREIRA (career_drivers):
 *    - Inicializado a partir da base 2026 na criação da carreira: drivers_base_2026 → inicialização → career_drivers.
 *    - Chave obrigatória composta por: careerId + driverId.
 *    - Duas carreiras diferentes (ex: carreira A com Audi, carreira B com Ferrari) evoluem independentemente
 *      sem alterar a base 2026 nem interferir uma na outra.
 *    - Mantém: equipe atual, contrato, salário, papel, elegibilidade, ratings, GPs, vitórias, poles,
 *      pódios, pontos, voltas mais rápidas, DNFs, títulos, etc.
 */

import { MBJ_2026_PILOTS, type MBJPilotData } from '@/lib/mbj-drivers-data'
import type { TireCompound } from '@/types/f1'

/**
 * Entidade Imutável de Piloto na data base 01/01/2026.
 * Nenhuma alteração durante o jogo pode modificar estes registros.
 */
export interface BaseDriver2026 {
  readonly id: string
  readonly name: string
  readonly nationality: string
  readonly age: number
  readonly baseAge2026: number
  readonly permanentNumber?: number
  readonly activeRaceNumber?: number
  readonly preferredNumber?: number
  readonly category: string
  readonly defaultRole?: 'titular' | 'reserva'
  readonly defaultTeamKey?: string
  readonly defaultTeamName?: string
  readonly speed: number
  readonly consistency: number
  readonly rain: number
  readonly defense: number
  readonly qualifying?: number
  readonly racePace?: number
  readonly tireManagement?: number
  readonly energyManagement?: number
  readonly feedback?: number
  readonly pressure?: number
  readonly concentration?: number
  readonly resilience?: number
  readonly salaryUsd: number
  readonly contractYears: number
  readonly superlicensePoints: number
  readonly eligibilityStatus?: string
  // Estatísticas históricas oficiais congeladas em 01/01/2026
  readonly f1RacesCompleted: number
  readonly f1Wins: number
  readonly f1Poles: number
  readonly f1Championships: number
  readonly biography?: string
  readonly photoFilename?: string
}

/**
 * Estado Canônico de um Piloto associado a uma Carreira Específica (career_drivers).
 * Evolui ao longo das etapas, temporadas e transferências sem alterar a base de 2026.
 */
export interface CareerDriverRecord {
  careerId: string
  driverId: string
  teamId: string
  teamName: string
  role: 'titular' | 'reserva' | 'academy' | 'free_agent' | 'retired'
  contractEndYear: number
  salaryUsd: number
  ratings: {
    speed: number
    consistency: number
    rain: number
    defense: number
    qualifying: number
    racePace: number
    tireManagement: number
    energyManagement: number
    feedback: number
    pressure: number
    concentration: number
    resilience: number
  }
  morale: number
  physicalCondition: number
  superlicensePoints: number
  homologationStatus: 'formacao' | 'homologacao' | 'elegivel'

  // Estatísticas acumuladas na Carreira:
  // total = histórico 01/01/2026 + estatísticas desta carreira
  stats: {
    careerGps: number
    careerWins: number
    careerPoles: number
    careerPodiums: number
    careerPoints: number
    careerFastestLaps: number
    careerDnfs: number
    careerTitles: number
    // FW2.1E-G — Acumulados detalhados de corrida
    raceStarts?: number
    wins?: number
    podiums?: number
    poles?: number
    fastestLaps?: number
    points?: number
    dnfs?: number
    lapsCompleted?: number
    pitStops?: number
    positionsGained?: number
    bestFinish?: number
    bestGridPosition?: number
  }

  updatedAt: string
}

const CAREER_DRIVERS_STORAGE_KEY_PREFIX = 'apex_career_drivers_v2'

/**
 * Cria o snapshot congelado oficial da Base de 2026.
 */
function buildFrozenBase2026(): ReadonlyMap<string, Readonly<BaseDriver2026>> {
  const map = new Map<string, Readonly<BaseDriver2026>>()

  for (const p of MBJ_2026_PILOTS) {
    const baseEntry: BaseDriver2026 = Object.freeze({
      id: p.id,
      name: p.name,
      nationality: p.nationality,
      age: p.baseAge2026 || p.age,
      baseAge2026: p.baseAge2026 || p.age,
      permanentNumber: p.permanentNumber,
      activeRaceNumber: p.activeRaceNumber,
      preferredNumber: p.preferredNumber,
      category: p.category,
      defaultRole: p.role,
      defaultTeamKey: p.teamKey,
      defaultTeamName: p.teamName,
      speed: p.speed,
      consistency: p.consistency,
      rain: p.rain,
      defense: p.defense,
      qualifying: p.qualifying ?? p.speed,
      racePace: p.racePace ?? p.speed,
      tireManagement: p.tireManagement ?? p.consistency,
      energyManagement: p.energyManagement ?? p.consistency,
      feedback: p.feedback ?? 80,
      pressure: p.pressure ?? 80,
      concentration: p.concentration ?? 80,
      resilience: p.resilience ?? 80,
      salaryUsd: p.salaryUsd,
      contractYears: p.contractYears,
      superlicensePoints: p.superlicensePoints,
      eligibilityStatus: p.eligibilityStatus,
      f1RacesCompleted: p.f1RacesCompleted || 0,
      f1Wins: p.f1Wins || 0,
      f1Poles: p.f1Poles || 0,
      f1Championships: p.f1Championships || p.f1Titles || 0,
      biography: p.biography,
      photoFilename: p.photoFilename,
    })
    map.set(p.id, baseEntry)
  }

  return Object.freeze(map)
}

// Instância única imutável em memória
const FROZEN_BASE_2026 = buildFrozenBase2026()

export const driverBase2026Service = {
  /**
   * Retorna a entidade imutável de um piloto em 01/01/2026.
   * Não pode ser alterada por gameplay ou transferências.
   */
  getBaseDriver2026(driverId: string): Readonly<BaseDriver2026> | null {
    if (!driverId) return null
    return FROZEN_BASE_2026.get(driverId) || null
  },

  /**
   * Retorna a lista completa congelada dos 135 pilotos originais da base 2026.
   */
  getAllBaseDrivers2026(): ReadonlyArray<Readonly<BaseDriver2026>> {
    return Object.freeze(Array.from(FROZEN_BASE_2026.values()))
  },

  /**
   * Chave de armazenamento seguro para career_drivers de uma carreira.
   */
  getCareerDriversStorageKey(careerId: string): string {
    return `${CAREER_DRIVERS_STORAGE_KEY_PREFIX}_${careerId}`
  },

  /**
   * Inicializa o conjunto de career_drivers para uma nova carreira a partir da base 2026.
   * Totalmente isolado por careerId.
   */
  initializeCareerDrivers(params: {
    careerId: string
    playerTeamId: string
    playerTeamKey?: string
  }): Record<string, CareerDriverRecord> {
    const { careerId, playerTeamId } = params

    const careerDrivers: Record<string, CareerDriverRecord> = {}
    const nowIso = new Date().toISOString()

    for (const base of FROZEN_BASE_2026.values()) {
      careerDrivers[base.id] = {
        careerId,
        driverId: base.id,
        teamId: base.defaultTeamKey || 'free_agent',
        teamName: base.defaultTeamName || 'Sem Equipe',
        role: (base.defaultRole as any) || (base.category === 'f1' ? 'titular' : 'free_agent'),
        contractEndYear: 2026 + Math.max(1, base.contractYears || 1),
        salaryUsd: base.salaryUsd || 1000000,
        ratings: {
          speed: base.speed,
          consistency: base.consistency,
          rain: base.rain,
          defense: base.defense,
          qualifying: base.qualifying || base.speed,
          racePace: base.racePace || base.speed,
          tireManagement: base.tireManagement || base.consistency,
          energyManagement: base.energyManagement || base.consistency,
          feedback: base.feedback || 80,
          pressure: base.pressure || 80,
          concentration: base.concentration || 80,
          resilience: base.resilience || 80,
        },
        morale: 85,
        physicalCondition: 90,
        superlicensePoints: base.superlicensePoints,
        homologationStatus: base.superlicensePoints >= 40 ? 'elegivel' : 'formacao',
        stats: {
          careerGps: base.f1RacesCompleted,
          careerWins: base.f1Wins,
          careerPoles: base.f1Poles,
          careerPodiums: 0,
          careerPoints: 0,
          careerFastestLaps: 0,
          careerDnfs: 0,
          careerTitles: base.f1Championships,
          raceStarts: base.f1RacesCompleted,
          wins: base.f1Wins,
          podiums: 0,
          poles: base.f1Poles,
          fastestLaps: 0,
          points: 0,
          dnfs: 0,
          lapsCompleted: 0,
          pitStops: 0,
          positionsGained: 0,
          bestFinish: undefined,
          bestGridPosition: undefined,
        },
        updatedAt: nowIso,
      }
    }

    this.saveCareerDrivers(careerId, careerDrivers)
    return careerDrivers
  },

  /**
   * Salva career_drivers de uma carreira específica.
   */
  saveCareerDrivers(careerId: string, records: Record<string, CareerDriverRecord>): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getCareerDriversStorageKey(careerId)
      window.localStorage.setItem(key, JSON.stringify(records))
    } catch (e) {
      console.warn('[driverBase2026Service] Erro ao salvar career_drivers:', e)
    }
  },

  /**
   * Lê career_drivers de uma carreira específica.
   */
  getCareerDrivers(careerId: string): Record<string, CareerDriverRecord> | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = this.getCareerDriversStorageKey(careerId)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as Record<string, CareerDriverRecord>
    } catch (e) {
      console.warn('[driverBase2026Service] Erro ao ler career_drivers:', e)
      return null
    }
  },

  /**
   * Lê o registro de um piloto específico na carreira informada.
   */
  getCareerDriver(careerId: string, driverId: string): CareerDriverRecord | null {
    const all = this.getCareerDrivers(careerId)
    if (!all) return null
    return all[driverId] || null
  },

  /**
   * Atualiza as estatísticas de um piloto em sua carreira sem tocar na base 2026.
   * Total acumulado = histórico 2026 + eventos da carreira.
   */
  updateCareerDriverStats(params: {
    careerId: string
    driverId: string
    deltaGps?: number
    deltaWins?: number
    deltaPoles?: number
    deltaPodiums?: number
    deltaPoints?: number
    deltaFastestLaps?: number
    deltaDnfs?: number
    deltaTitles?: number
    // FW2.1E-G — Acumulados canônicos adicionais
    deltaRaceStarts?: number
    deltaLapsCompleted?: number
    deltaPitStops?: number
    deltaPositionsGained?: number
    newFinishPosition?: number
    newGridPosition?: number
  }): CareerDriverRecord | null {
    const { careerId, driverId } = params
    let all = this.getCareerDrivers(careerId)
    if (!all) {
      all = this.initializeCareerDrivers({ careerId, playerTeamId: 'default' })
    }

    let current = all[driverId]
    if (!current) {
      // Piloto pode ser procedural ou não estar no mapa original
      const nowIso = new Date().toISOString()
      current = {
        careerId,
        driverId,
        teamId: 'free_agent',
        teamName: 'Piloto',
        role: 'titular',
        contractEndYear: 2026,
        salaryUsd: 1000000,
        ratings: {
          speed: 80,
          consistency: 80,
          rain: 80,
          defense: 80,
          qualifying: 80,
          racePace: 80,
          tireManagement: 80,
          energyManagement: 80,
          feedback: 80,
          pressure: 80,
          concentration: 80,
          resilience: 80,
        },
        morale: 80,
        physicalCondition: 90,
        superlicensePoints: 40,
        homologationStatus: 'elegivel',
        stats: {
          careerGps: 0,
          careerWins: 0,
          careerPoles: 0,
          careerPodiums: 0,
          careerPoints: 0,
          careerFastestLaps: 0,
          careerDnfs: 0,
          careerTitles: 0,
          raceStarts: 0,
          wins: 0,
          podiums: 0,
          poles: 0,
          fastestLaps: 0,
          points: 0,
          dnfs: 0,
          lapsCompleted: 0,
          pitStops: 0,
          positionsGained: 0,
          bestFinish: undefined,
          bestGridPosition: undefined,
        },
        updatedAt: nowIso,
      }
      all[driverId] = current
    }

    // Sincronizar contadores legados e FW2.1E-G
    const dGps =
      params.deltaRaceStarts !== undefined ? params.deltaRaceStarts : params.deltaGps || 0
    current.stats.careerGps += dGps
    current.stats.raceStarts = (current.stats.raceStarts ?? current.stats.careerGps - dGps) + dGps

    const dWins = params.deltaWins || 0
    current.stats.careerWins += dWins
    current.stats.wins = (current.stats.wins ?? current.stats.careerWins - dWins) + dWins

    const dPoles = params.deltaPoles || 0
    current.stats.careerPoles += dPoles
    current.stats.poles = (current.stats.poles ?? current.stats.careerPoles - dPoles) + dPoles

    const dPodiums = params.deltaPodiums || 0
    current.stats.careerPodiums += dPodiums
    current.stats.podiums =
      (current.stats.podiums ?? current.stats.careerPodiums - dPodiums) + dPodiums

    const dPoints = params.deltaPoints || 0
    current.stats.careerPoints += dPoints
    current.stats.points = (current.stats.points ?? current.stats.careerPoints - dPoints) + dPoints

    const dFastestLaps = params.deltaFastestLaps || 0
    current.stats.careerFastestLaps += dFastestLaps
    current.stats.fastestLaps =
      (current.stats.fastestLaps ?? current.stats.careerFastestLaps - dFastestLaps) + dFastestLaps

    const dDnfs = params.deltaDnfs || 0
    current.stats.careerDnfs += dDnfs
    current.stats.dnfs = (current.stats.dnfs ?? current.stats.careerDnfs - dDnfs) + dDnfs

    current.stats.careerTitles += params.deltaTitles || 0

    // FW2.1E-G campos específicos
    if (params.deltaLapsCompleted) {
      current.stats.lapsCompleted = (current.stats.lapsCompleted || 0) + params.deltaLapsCompleted
    }
    if (params.deltaPitStops) {
      current.stats.pitStops = (current.stats.pitStops || 0) + params.deltaPitStops
    }
    if (params.deltaPositionsGained) {
      current.stats.positionsGained =
        (current.stats.positionsGained || 0) + params.deltaPositionsGained
    }
    if (params.newFinishPosition !== undefined && params.newFinishPosition > 0) {
      if (current.stats.bestFinish === undefined || current.stats.bestFinish === null) {
        current.stats.bestFinish = params.newFinishPosition
      } else {
        current.stats.bestFinish = Math.min(current.stats.bestFinish, params.newFinishPosition)
      }
    }
    if (params.newGridPosition !== undefined && params.newGridPosition > 0) {
      if (current.stats.bestGridPosition === undefined || current.stats.bestGridPosition === null) {
        current.stats.bestGridPosition = params.newGridPosition
      } else {
        current.stats.bestGridPosition = Math.min(
          current.stats.bestGridPosition,
          params.newGridPosition,
        )
      }
    }

    current.updatedAt = new Date().toISOString()

    this.saveCareerDrivers(careerId, all)
    return current
  },
}
