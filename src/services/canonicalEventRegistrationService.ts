/**
 * CANONICAL EVENT REGISTRATION SERVICE — F1 2026 / APEX GP MANAGER
 * ETAPA FW2.1: INSCRIÇÕES OFICIAIS DO EVENTO E SNAPSHOT REGULAMENTAR
 *
 * Regras Canônicas Estritas:
 * 1. Exatamente 12 equipes homologadas no grid por evento.
 * 2. Cada equipe possui EXATAMENTE DOIS ASSENTOS DE CORRIDA (Carro 1 e Carro 2) -> Total 24 inscrições.
 * 3. driverIds estritamente únicos entre todas as 24 inscrições.
 * 4. A equipe do jogador JÁ PERTENCE ao grid: NUNCA concatenar grid + pilotos do jogador.
 * 5. Titular é o candidato padrão.
 * 6. Reserva disponível com titulares aptos: o reserva NÃO entra automaticamente.
 * 7. Academia NÃO entra automaticamente em GP: só se for formalmente escalada como substituto
 *    para um dos 2 assentos e tiver a elegibilidade regulamentar necessária.
 * 8. Piloto de Testes NÃO entra automaticamente em GP.
 * 9. Substituição formal: titular indisponível + substituto elegível (Super Licença / Licença A)
 *    -> substituto ocupa exatamente aquele assento (sem nunca criar 3º carro).
 * 10. Substituto sem licença regulamentar (nivel_a / Super Licença) -> BLOQUEADO para o assento de GP.
 * 11. Snapshot das inscrições: salvo no início do evento com { teamId, carId, driverId, role, licenseStatus, ... }.
 *     Não é recalculado a partir do roster durante a sessão em andamento.
 */

import type { TeamModel, DriverModel } from '@/types/f1'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'
import { resolveEventParticipatingTeams } from '@/lib/canonical-race-grid-resolver'
import { teamRosterService } from '@/services/teamRosterService'

export interface EventDriverEntrySnapshot {
  teamId: string
  teamName: string
  teamColor: string
  isPlayerTeam: boolean
  carId: 'car1' | 'car2'
  seatNumber: 1 | 2
  driverId: string
  driverName: string
  driverNumber: number
  eventRole: 'titular' | 'substituto'
  originalRole: 'titular' | 'reserva' | 'teste' | 'academia'
  licenseStatus: 'nivel_a' | 'nivel_b' | 'nivel_c'
  isSuperLicenseValid: boolean
  photoUrl?: string
  helmetUrl?: string
  engineSupplier?: string
}

export interface EventRegistrationSnapshot {
  seasonId: string
  round: number
  gpName: string
  registeredAt: string
  totalTeams: number // 12
  totalEntries: number // 24
  entries: EventDriverEntrySnapshot[]
  entriesByCar: {
    playerCar1?: EventDriverEntrySnapshot
    playerCar2?: EventDriverEntrySnapshot
  }
}

export interface PlayerSeatAssignment {
  car1DriverId?: string
  car2DriverId?: string
}

export interface RegistrationValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  snapshot?: EventRegistrationSnapshot
}

const REGISTRATION_STORAGE_PREFIX = 'apex_event_registration_v2'

export function getRegistrationStorageKey(seasonId: string, round: number): string {
  return `${REGISTRATION_STORAGE_PREFIX}_${seasonId}_r${round}`
}

export class CanonicalEventRegistrationService {
  /**
   * Verifica se um piloto é elegível perante a FIA para disputar assento de GP (Licença A / Super Licença).
   */
  public isDriverEligibleForGPSession(driver: Partial<DriverModel> | null | undefined): boolean {
    if (!driver) return false
    const view = canonicalHomologationAdapter.toCanonicalView(driver as DriverModel)
    return view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat
  }

  /**
   * Valida as inscrições e elegibilidade dos dois carros da equipe do jogador.
   */
  public validateRegistrationEntries(params: {
    car1Driver: DriverModel | Partial<DriverModel> | null
    car2Driver: DriverModel | Partial<DriverModel> | null
    playerTeam: TeamModel
  }): { valid: boolean; errors: string[] } {
    const { car1Driver, car2Driver, playerTeam } = params
    const errors: string[] = []

    if (!car1Driver) {
      errors.push('Carro 1 da equipe do jogador não possui piloto escalado.')
    } else {
      const isCar1Incapacitated = Boolean(
        car1Driver.is_incapacitated || (car1Driver.incapacitated_rounds_left ?? 0) > 0,
      )
      if (isCar1Incapacitated) {
        errors.push(
          `Piloto ${car1Driver.name} no Carro 1 está indisponível (${car1Driver.incapacitated_reason || 'médico/suspenso'}).`,
        )
      }
      const view1 = canonicalHomologationAdapter.toCanonicalView(car1Driver as DriverModel)
      if (view1.licenseStatus !== 'nivel_a' && !view1.isEligibleForF1Seat) {
        errors.push(
          `Piloto ${car1Driver.name} no Carro 1 não possui Licença A / Superlicença FIA válida para disputar o GP.`,
        )
      }
    }

    if (!car2Driver) {
      errors.push('Carro 2 da equipe do jogador não possui piloto escalado.')
    } else {
      const isCar2Incapacitated = Boolean(
        car2Driver.is_incapacitated || (car2Driver.incapacitated_rounds_left ?? 0) > 0,
      )
      if (isCar2Incapacitated) {
        errors.push(
          `Piloto ${car2Driver.name} no Carro 2 está indisponível (${car2Driver.incapacitated_reason || 'médico/suspenso'}).`,
        )
      }
      const view2 = canonicalHomologationAdapter.toCanonicalView(car2Driver as DriverModel)
      if (view2.licenseStatus !== 'nivel_a' && !view2.isEligibleForF1Seat) {
        errors.push(
          `Piloto ${car2Driver.name} no Carro 2 não possui Licença A / Superlicença FIA válida para disputar o GP.`,
        )
      }
    }

    if (car1Driver && car2Driver && car1Driver.id === car2Driver.id) {
      errors.push(
        `O mesmo piloto (${car1Driver.name}) não pode ser inscrito em ambos os carros da equipe.`,
      )
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Lê o snapshot de inscrições já confirmado e persistido para a rodada.
   */
  public readRegistrationSnapshot(
    seasonId: string,
    round: number,
  ): EventRegistrationSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(getRegistrationStorageKey(seasonId, round))
      if (!raw) return null
      return JSON.parse(raw) as EventRegistrationSnapshot
    } catch {
      return null
    }
  }

  /**
   * Grava o snapshot de inscrições confirmado no armazenamento.
   */
  public saveRegistrationSnapshot(snapshot: EventRegistrationSnapshot): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(
        getRegistrationStorageKey(snapshot.seasonId, snapshot.round),
        JSON.stringify(snapshot),
      )
    } catch {
      /* ignore */
    }
  }

  /**
   * Resolve e valida as inscrições do evento (24 pilotos, 12 equipes, 2 assentos por equipe).
   * Se já existir snapshot persistido para a sessão/rodada, o snapshot prevalece.
   */
  public resolveOrLoadEventRegistration(params: {
    seasonId: string
    round: number
    gpName: string
    playerTeam: TeamModel
    allDrivers: DriverModel[]
    playerSeatOverrides?: PlayerSeatAssignment
    forceRecalculate?: boolean
  }): RegistrationValidationResult {
    const {
      seasonId,
      round,
      gpName,
      playerTeam,
      allDrivers,
      playerSeatOverrides,
      forceRecalculate = false,
    } = params

    // Se já houver snapshot persistido e não for solicitado recálculo forçado, retorna o snapshot
    if (!forceRecalculate) {
      const existing = this.readRegistrationSnapshot(seasonId, round)
      if (existing && existing.entries.length === 24) {
        return {
          valid: true,
          errors: [],
          warnings: [],
          snapshot: existing,
        }
      }
    }

    const errors: string[] = []
    const warnings: string[] = []

    // 1. Resolver as 12 equipes homologadas do evento
    const participatingTeams = resolveEventParticipatingTeams(playerTeam)
    if (participatingTeams.length !== 12) {
      errors.push(
        `O evento requer exatamente 12 equipes homologadas. Encontradas: ${participatingTeams.length}.`,
      )
    }

    // 2. Determinar pilotos da equipe do jogador
    const playerRoster = teamRosterService.buildTeamRoster(playerTeam, allDrivers)
    const playerTeamDrivers = allDrivers.filter((d) => d.team_id === playerTeam.id)

    // Escolha para Carro 1 e Carro 2 do jogador
    let car1Driver: DriverModel | null = null
    let car2Driver: DriverModel | null = null

    if (playerSeatOverrides?.car1DriverId) {
      car1Driver = allDrivers.find((d) => d.id === playerSeatOverrides.car1DriverId) || null
    } else {
      car1Driver = playerRoster.driver1 || playerRoster.titulars[0] || null
    }

    if (playerSeatOverrides?.car2DriverId) {
      car2Driver = allDrivers.find((d) => d.id === playerSeatOverrides.car2DriverId) || null
    } else {
      car2Driver =
        playerRoster.driver2 || playerRoster.titulars.find((t) => t.id !== car1Driver?.id) || null
    }

    // Validações da equipe do jogador
    if (!car1Driver) {
      errors.push('Carro 1 da equipe do jogador não possui piloto escalado.')
    } else {
      const isCar1Incapacitated = Boolean(
        car1Driver.is_incapacitated || (car1Driver.incapacitated_rounds_left ?? 0) > 0,
      )
      if (isCar1Incapacitated) {
        errors.push(
          `Piloto ${car1Driver.name} no Carro 1 está indisponível (${car1Driver.incapacitated_reason || 'médico/suspenso'}).`,
        )
      }
      const view1 = canonicalHomologationAdapter.toCanonicalView(car1Driver)
      if (view1.licenseStatus !== 'nivel_a' && !view1.isEligibleForF1Seat) {
        errors.push(
          `Piloto ${car1Driver.name} no Carro 1 não possui Licença A / Superlicença FIA válida para disputar o GP.`,
        )
      }
    }

    if (!car2Driver) {
      errors.push('Carro 2 da equipe do jogador não possui piloto escalado.')
    } else {
      const isCar2Incapacitated = Boolean(
        car2Driver.is_incapacitated || (car2Driver.incapacitated_rounds_left ?? 0) > 0,
      )
      if (isCar2Incapacitated) {
        errors.push(
          `Piloto ${car2Driver.name} no Carro 2 está indisponível (${car2Driver.incapacitated_reason || 'médico/suspenso'}).`,
        )
      }
      const view2 = canonicalHomologationAdapter.toCanonicalView(car2Driver)
      if (view2.licenseStatus !== 'nivel_a' && !view2.isEligibleForF1Seat) {
        errors.push(
          `Piloto ${car2Driver.name} no Carro 2 não possui Licença A / Superlicença FIA válida para disputar o GP.`,
        )
      }
    }

    if (car1Driver && car2Driver && car1Driver.id === car2Driver.id) {
      errors.push(
        `O mesmo piloto (${car1Driver.name}) não pode ser inscrito em ambos os carros da equipe.`,
      )
    }

    // Se pilotos reservas ou de academia estiverem no elenco do jogador mas os titulares estiverem aptos,
    // o reserva / academia NÃO entra sem substituição formal
    if (playerRoster.reserve && (!car1Driver || !car2Driver)) {
      warnings.push('A equipe possui piloto reserva disponível para substituição.')
    }

    // 3. Montar as 24 inscrições (2 por equipe)
    const entries: EventDriverEntrySnapshot[] = []
    const registeredDriverIds = new Set<string>()

    // Função auxiliar para registrar assento
    const registerSeat = (
      teamId: string,
      teamName: string,
      teamColor: string,
      isPlayer: boolean,
      carId: 'car1' | 'car2',
      seatNumber: 1 | 2,
      driver: {
        id: string
        name: string
        number?: number
        license_status?: any
        role?: any
        photo_url?: string
        helmet_url?: string
      },
      engine?: string,
    ) => {
      if (registeredDriverIds.has(driver.id)) {
        errors.push(
          `Conflito regulamentar: Piloto ID '${driver.id}' (${driver.name}) já registrado em outro assento.`,
        )
        return
      }
      registeredDriverIds.add(driver.id)

      const view = canonicalHomologationAdapter.toCanonicalView(driver as DriverModel)
      const isSuperLicenseValid = view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat

      let origRole: 'titular' | 'reserva' | 'teste' | 'academia' = 'titular'
      if (driver.role === 'reserva') origRole = 'reserva'
      else if ((driver as any).is_academy) origRole = 'academia'
      else if ((driver as any).is_test_driver) origRole = 'teste'

      const snapshotEntry: EventDriverEntrySnapshot = {
        teamId,
        teamName,
        teamColor,
        isPlayerTeam: isPlayer,
        carId,
        seatNumber,
        driverId: driver.id,
        driverName: driver.name,
        driverNumber: driver.number || (carId === 'car1' ? 1 : 2),
        eventRole: origRole === 'titular' ? 'titular' : 'substituto',
        originalRole: origRole,
        licenseStatus: view.licenseStatus,
        isSuperLicenseValid,
        photoUrl: driver.photo_url,
        helmetUrl: driver.helmet_url,
        engineSupplier: engine,
      }
      entries.push(snapshotEntry)
    }

    // Registrar carros do jogador primeiro
    const playerTeamKey = (playerTeam.team_key || playerTeam.id).toLowerCase()
    const playerEngine = playerTeam.engine_supplier || 'Audi'

    if (car1Driver) {
      registerSeat(
        playerTeam.id,
        playerTeam.name,
        playerTeam.color || '#E10600',
        true,
        'car1',
        1,
        car1Driver,
        playerEngine,
      )
    }
    if (car2Driver) {
      registerSeat(
        playerTeam.id,
        playerTeam.name,
        playerTeam.color || '#E10600',
        true,
        'car2',
        2,
        car2Driver,
        playerEngine,
      )
    }

    // Registrar as outras 11 equipes
    // Critério canônico robusto para excluir a equipe do jogador:
    // Compara teamKey, id, nomes (incluindo normalização/substring) E IDs/nomes dos pilotos já inscritos no playerTeam
    const playerTeamNameNorm = (playerTeam.name || '').toLowerCase().trim()
    const playerTeamShortNorm = ((playerTeam as any).short_name || playerTeam.name || '')
      .toLowerCase()
      .trim()
    const playerDriverIds = new Set([car1Driver?.id, car2Driver?.id].filter(Boolean) as string[])
    const playerDriverNamesNorm = new Set(
      [car1Driver?.name, car2Driver?.name]
        .filter(Boolean)
        .map((n) => (n as string).toLowerCase().trim()),
    )

    for (const rival of participatingTeams) {
      const rivalKeyNorm = rival.key.toLowerCase().trim()
      const rivalNameNorm = rival.name.toLowerCase().trim()
      const rivalShortNorm = rival.shortName.toLowerCase().trim()

      const isKeyMatch =
        rivalKeyNorm === playerTeamKey ||
        playerTeamKey.includes(rivalKeyNorm) ||
        rivalKeyNorm.includes(playerTeamKey) ||
        rival.key.toLowerCase() === (playerTeam.id || '').toLowerCase()

      const isNameMatch =
        rivalNameNorm === playerTeamNameNorm ||
        rivalShortNorm === playerTeamShortNorm ||
        rivalShortNorm === playerTeamNameNorm ||
        rivalNameNorm.includes(playerTeamShortNorm) ||
        playerTeamNameNorm.includes(rivalShortNorm)

      // Identidade de pilotos: se qualquer piloto do rival coincidir por ID ou nome com os pilotos do jogador
      const rivalD1Id = (rival.driver1 as any).id || `${rival.key}_d1`
      const rivalD2Id = (rival.driver2 as any).id || `${rival.key}_d2`
      const rivalD1NameNorm = (rival.driver1.name || '').toLowerCase().trim()
      const rivalD2NameNorm = (rival.driver2.name || '').toLowerCase().trim()

      const isDriverMatch =
        playerDriverIds.has(rivalD1Id) ||
        playerDriverIds.has(rivalD2Id) ||
        playerDriverNamesNorm.has(rivalD1NameNorm) ||
        playerDriverNamesNorm.has(rivalD2NameNorm)

      if (isKeyMatch || isNameMatch || isDriverMatch) {
        // Equipe do jogador já foi inscrita acima! NUNCA duplicar ou concatenar novamente
        continue
      }

      // Rival Carro 1
      registerSeat(
        `team_${rival.key}`,
        rival.name,
        rival.color,
        false,
        'car1',
        1,
        {
          id: (rival.driver1 as any).id || `${rival.key}_d1`,
          name: rival.driver1.name,
          number: (rival.driver1 as any).number || 10,
          license_status: 'nivel_a',
          role: 'titular',
        },
        rival.engine,
      )

      // Rival Carro 2
      registerSeat(
        `team_${rival.key}`,
        rival.name,
        rival.color,
        false,
        'car2',
        2,
        {
          id: (rival.driver2 as any).id || `${rival.key}_d2`,
          name: rival.driver2.name,
          number: (rival.driver2 as any).number || 11,
          license_status: 'nivel_a',
          role: 'titular',
        },
        rival.engine,
      )
    }

    // Verificação estrita de contagem total
    if (entries.length !== 24) {
      errors.push(
        `Total de inscrições inválido: esperado exatamente 24 assentos homologados, gerado: ${entries.length}.`,
      )
    }

    const playerCar1 = entries.find((e) => e.isPlayerTeam && e.carId === 'car1')
    const playerCar2 = entries.find((e) => e.isPlayerTeam && e.carId === 'car2')

    const snapshot: EventRegistrationSnapshot = {
      seasonId,
      round,
      gpName,
      registeredAt: new Date().toISOString(),
      totalTeams: 12,
      totalEntries: entries.length,
      entries,
      entriesByCar: {
        playerCar1,
        playerCar2,
      },
    }

    if (errors.length === 0) {
      this.saveRegistrationSnapshot(snapshot)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      snapshot,
    }
  }
}

export const canonicalEventRegistrationService = new CanonicalEventRegistrationService()
