/**
 * Serviço Canônico de Roster da Equipe (2 Titulares + 1 Reserva + 2 Jovens de Academia)
 *
 * Garante fonte única da verdade para Minha Equipe, Pilotos & Homologação,
 * Academia, Home, Mercado e Paddock.
 *
 * Constraints estritas de negócio:
 * - Máximo de 2 pilotos titulares (exige Superlicença válida / canSignTitular)
 * - Máximo de 1 piloto reserva (exige elegibilidade FIA / canSignReserve)
 * - Máximo de 2 pilotos na academia (exclusividade de vínculo real)
 * - Exclusividade de papel (um mesmo piloto NUNCA pode ocupar dois slots simultaneamente)
 * - Estados vazios canônicos ("Vaga em aberto", "Sem piloto reserva", "0/2 pilotos")
 * - Nunca preencher vagas vazias com mocks/fictícios automaticamente
 */

import { DriverModel, TeamModel } from '@/types/f1'
import { getElegibilidadeDetalhada } from '@/lib/superlicense'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'

export interface TeamCanonicalRoster {
  driver1: DriverModel | null
  driver2: DriverModel | null
  reserve: DriverModel | null
  academyDriver1: DriverModel | null
  academyDriver2: DriverModel | null
  titularCount: number
  reserveCount: number
  academyCount: number
  titulars: DriverModel[]
  reserves: DriverModel[]
  academyDrivers: DriverModel[]
  allLinkedDrivers: DriverModel[]
}

export class TeamRosterService {
  /**
   * Valida se um piloto tem Superlicença válida para atuar como Titular de F1
   */
  public isTitularEligible(driver: DriverModel): boolean {
    if (!driver) return false
    // 1. Verificação via adapter canônico
    const view = canonicalHomologationAdapter.toCanonicalView(driver)
    if (view.licenseStatus === 'nivel_a') return true

    // 2. Verificação via regras clássicas de superlicença
    const age = driver.age || 25
    const points = driver.superlicense_points ?? 0
    const f1Races =
      (driver as any).f1_races_completed ??
      (driver as any).f1RacesCompleted ??
      (driver.category === 'f1' ? 24 : 0)
    const homologationDone = driver.homologation_sessions_done ?? 0

    const eligibility = getElegibilidadeDetalhada(age, points, f1Races, homologationDone)
    return eligibility.canSignTitular
  }

  /**
   * Valida se um piloto é elegível perante a FIA para ser Reserva
   */
  public isReserveEligible(driver: DriverModel): boolean {
    if (!driver) return false
    const age = driver.age || 21
    const points = driver.superlicense_points ?? 0
    const f1Races = (driver as any).f1_races_completed ?? (driver as any).f1RacesCompleted ?? 0
    const eligibility = getElegibilidadeDetalhada(
      age,
      points,
      f1Races,
      driver.homologation_sessions_done ?? 0,
    )
    return eligibility.canSignReserve
  }

  /**
   * Constrói o Roster Canônico 2+1+2 rigoroso para uma equipe.
   * Filtra vínculos REAIS com a equipe informada e aplica teto regulamentar.
   */
  public buildTeamRoster(
    team: TeamModel | null | undefined,
    allDrivers: DriverModel[],
  ): TeamCanonicalRoster {
    if (!team || !team.id || !Array.isArray(allDrivers)) {
      return {
        driver1: null,
        driver2: null,
        reserve: null,
        academyDriver1: null,
        academyDriver2: null,
        titularCount: 0,
        reserveCount: 0,
        academyCount: 0,
        titulars: [],
        reserves: [],
        academyDrivers: [],
        allLinkedDrivers: [],
      }
    }

    const teamId = team.id

    // Identificar IDs vinculados formalmente à academia da equipe
    let officialAcademyDriverIds = new Set<string>()
    const rawAcadData = (team as any).academy_development_data
    if (rawAcadData) {
      const parsed = typeof rawAcadData === 'string' ? JSON.parse(rawAcadData) : rawAcadData
      if (Array.isArray(parsed?.academyDrivers)) {
        parsed.academyDrivers.forEach((id: string) => officialAcademyDriverIds.add(id))
      }
    }

    // Pilotos que têm vínculo canônico de titular:
    // team_id === teamId E role !== 'reserva' E NÃO é piloto exclusivo de academia sem assento
    const candidateTitulars = allDrivers.filter(
      (d) => d.team_id === teamId && d.role !== 'reserva' && !officialAcademyDriverIds.has(d.id),
    )

    // Pilotos que têm vínculo canônico de reserva:
    // role === 'reserva' OU reserve_team_id === teamId (e não é titular ativo em outro time)
    const candidateReserves = allDrivers.filter(
      (d) =>
        (d.reserve_team_id === teamId || (d.team_id === teamId && d.role === 'reserva')) &&
        !officialAcademyDriverIds.has(d.id) &&
        !candidateTitulars.some((t) => t.id === d.id),
    )

    // Pilotos que têm vínculo canônico de academia:
    // Estão em academyDrivers OU marcados com is_academy vinculado à equipe
    const candidateAcademy = allDrivers.filter((d) => {
      const isOfficialLinked = officialAcademyDriverIds.has(d.id)
      const isTaggedAcademy = Boolean(
        d.is_academy && (d.team_id === teamId || (d as any).academy_origin_team_id === teamId),
      )
      const isNotAlreadyRoster =
        !candidateTitulars.some((t) => t.id === d.id) &&
        !candidateReserves.some((r) => r.id === d.id)
      return (isOfficialLinked || isTaggedAcademy) && isNotAlreadyRoster
    })

    // Aplicar teto estrito 2 + 1 + 2 (ordem de prioridade para os slots)
    const titulars = candidateTitulars.slice(0, 2)
    const reserve = candidateReserves.length > 0 ? candidateReserves[0] : null
    const academy = candidateAcademy.slice(0, 2)

    const driver1 = titulars[0] || null
    const driver2 = titulars[1] || null
    const academyDriver1 = academy[0] || null
    const academyDriver2 = academy[1] || null

    const allLinked: DriverModel[] = []
    if (driver1) allLinked.push(driver1)
    if (driver2 && driver2.id !== driver1?.id) allLinked.push(driver2)
    if (reserve && !allLinked.some((d) => d.id === reserve.id)) allLinked.push(reserve)
    if (academyDriver1 && !allLinked.some((d) => d.id === academyDriver1.id))
      allLinked.push(academyDriver1)
    if (academyDriver2 && !allLinked.some((d) => d.id === academyDriver2.id))
      allLinked.push(academyDriver2)

    return {
      driver1,
      driver2,
      reserve,
      academyDriver1,
      academyDriver2,
      titularCount: titulars.length,
      reserveCount: reserve ? 1 : 0,
      academyCount: academy.length,
      titulars,
      reserves: reserve ? [reserve] : [],
      academyDrivers: academy,
      allLinkedDrivers: allLinked,
    }
  }

  /**
   * Valida se uma operação de adição/mudança violaria as regras do Roster 2+1+2
   */
  public validateRoleAssignment(
    roster: TeamCanonicalRoster,
    targetDriver: DriverModel,
    targetRole: 'titular' | 'reserva' | 'academia',
  ): { valid: boolean; error?: string } {
    if (targetRole === 'titular') {
      if (!this.isTitularEligible(targetDriver)) {
        return {
          valid: false,
          error: `Piloto ${targetDriver.name} não possui Superlicença FIA válida para assumir vaga de Titular.`,
        }
      }
      const existingOtherTitulars = roster.titulars.filter((t) => t.id !== targetDriver.id)
      if (existingOtherTitulars.length >= 2) {
        return {
          valid: false,
          error: 'Limite máximo de 2 pilotos titulares atingido para a equipe.',
        }
      }
    }

    if (targetRole === 'reserva') {
      if (!this.isReserveEligible(targetDriver)) {
        return {
          valid: false,
          error: `Piloto ${targetDriver.name} não atende aos requisitos de elegibilidade da FIA para piloto reserva.`,
        }
      }
      if (roster.reserve && roster.reserve.id !== targetDriver.id) {
        return {
          valid: false,
          error: 'A equipe já possui 1 piloto reserva contratado.',
        }
      }
    }

    if (targetRole === 'academia') {
      const existingOtherAcademy = roster.academyDrivers.filter((a) => a.id !== targetDriver.id)
      if (existingOtherAcademy.length >= 2) {
        return {
          valid: false,
          error: 'Limite máximo de 2 pilotos na Academia atingido.',
        }
      }
    }

    return { valid: true }
  }
}

export const teamRosterService = new TeamRosterService()
