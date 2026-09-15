/**
 * ADAPTERS CANÔNICOS DE COMPATIBILIDADE — F1 MANAGER 2026
 * Saneamento Técnico e Unificação das Fundações (Fase 0A)
 *
 * Implementa bridges e conversores estritamente bidirecionais e aditivos:
 * 1. canonicalCarRatingsAdapter: converte qualquer TeamModel (antigo ou novo) para CanonicalCarRatings
 * 2. canonicalComponentAdapter: converte entre PartModel (Sistema A) e ComponentSpecification/PhysicalUnit (Sistema B)
 * 3. canonicalHomologationAdapter: unifica license_status com homologation_status e superlicense_points
 * 4. canonicalEventNotificationAdapter: mapeia DomainEvents para Notifications da UI sem quebrar o banco
 */

import type {
  TeamModel,
  DriverModel,
  PartModel,
  EventModel,
  F1NotificationModel,
  F1NotificationType,
} from '@/types/f1'
import {
  TechnicalComponentId,
  TechnicalAttributesMap,
  ComponentRatingsMap,
  ComponentSpecification,
  PhysicalComponentUnit,
  CarCalculationResult,
} from '@/types/car-technical-model'
import {
  CanonicalCarRatings,
  CANONICAL_COMPONENT_IDS,
  COMPONENT_NAME_TO_CANONICAL_ID,
  CANONICAL_COMPONENT_DISPLAY_NAMES,
  CanonicalComponentBridge,
  CanonicalLicenseStatus,
  CanonicalDriverHomologationView,
  CanonicalDomainEvent,
  DomainEventType,
} from '@/types/canonical-contracts'
import {
  OFFICIAL_TEAMS_TECHNICAL_DATA,
  OFFICIAL_POWER_UNITS,
  generateDefaultComponentsFromMacro,
  createDefaultSpecifications,
} from '@/lib/car-technical-data'
import { carTechnicalService } from '@/services/carTechnicalService'

// ============================================================================
// 1. CAR RATINGS ADAPTER
// ============================================================================

export const canonicalCarRatingsAdapter = {
  /**
   * Resolve o ID canônico da equipe se existir no catálogo oficial
   */
  resolveTeamKey(team: Partial<TeamModel> | null | undefined): string {
    if (!team) return 'audi'
    if (team.team_key && team.team_key.trim()) return team.team_key.trim().toLowerCase()
    const nameLower = (team.name || '').toLowerCase()
    for (const key of Object.keys(OFFICIAL_TEAMS_TECHNICAL_DATA)) {
      if (nameLower.includes(key)) return key
    }
    return team.is_custom ? 'custom_12th' : 'audi'
  },

  /**
   * Converte qualquer objeto de equipe para a representação canônica dos ratings
   */
  fromTeamModel(team: Partial<TeamModel> | null | undefined): CanonicalCarRatings {
    const teamKey = this.resolveTeamKey(team)
    const officialProfile = OFFICIAL_TEAMS_TECHNICAL_DATA[teamKey]

    // 1. Obter ou derivar macroRating de fallback
    const legacyStrength = team?.strength ?? officialProfile?.macroRating ?? 75

    // 2. Extrair componentes e atributos técnicos se persistidos
    let componentRatings: ComponentRatingsMap
    if (team?.component_ratings && Object.keys(team.component_ratings).length === 8) {
      componentRatings = team.component_ratings as ComponentRatingsMap
    } else if (officialProfile) {
      componentRatings = { ...officialProfile.initialComponents }
    } else {
      componentRatings = generateDefaultComponentsFromMacro(legacyStrength)
    }

    // 3. Unidade de potência
    const supplier = (team?.engine_supplier || officialProfile?.engineSupplier || 'Audi') as
      | 'Ferrari'
      | 'Mercedes'
      | 'Honda'
      | 'Ford'
      | 'Audi'
    const pu = OFFICIAL_POWER_UNITS[supplier] || OFFICIAL_POWER_UNITS.Audi

    // 4. Calcular chassisRating a partir dos 8 componentes
    let chassisRating: number
    let balanceDeltaVal: number

    if (typeof team?.calculated_overall === 'number' && team.calculated_overall > 0) {
      chassisRating = team.calculated_overall
      balanceDeltaVal =
        team.balance_delta ??
        team.technical_balance_delta ??
        Number((chassisRating - legacyStrength).toFixed(2))
    } else {
      const calcResult = carTechnicalService.evaluateCarTechnicalProfile(
        teamKey,
        componentRatings,
        legacyStrength,
        supplier,
      )
      chassisRating = calcResult.calculatedOverall
      balanceDeltaVal = calcResult.balanceDelta
    }

    // 5. powerUnitRating
    const powerUnitRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))

    // 6. carPerformanceRating: combinação equilibrada de chassi (70%) + PU (30%)
    // Preserva consistência técnica para o indicador global unificado sem alterar a corrida ainda
    const carPerformanceRating = Number((chassisRating * 0.7 + powerUnitRating * 0.3).toFixed(1))

    return {
      chassisRating,
      powerUnitRating,
      carPerformanceRating,
      balanceDelta: balanceDeltaVal,
      legacyTeamStrength: legacyStrength,
      calculatedOverall: chassisRating,
    }
  },

  /**
   * Gera o payload seguro para enriquecer um TeamModel com os campos técnicos oficiais
   */
  toTeamModelPatch(team: Partial<TeamModel>): Pick<
    TeamModel,
    'calculated_overall' | 'technical_attributes' | 'component_ratings'
  > & {
    balance_delta: number
    technical_balance_delta: number
  } {
    const ratings = this.fromTeamModel(team)
    const teamKey = this.resolveTeamKey(team)
    const officialProfile = OFFICIAL_TEAMS_TECHNICAL_DATA[teamKey]
    const legacyStrength = team.strength ?? officialProfile?.macroRating ?? 75
    const supplier = (team.engine_supplier || officialProfile?.engineSupplier || 'Audi') as any

    const compRatings =
      (team.component_ratings as ComponentRatingsMap) ||
      (officialProfile?.initialComponents
        ? { ...officialProfile.initialComponents }
        : generateDefaultComponentsFromMacro(legacyStrength))

    const attributes = carTechnicalService.calculateAttributesFromComponents(compRatings, supplier)

    return {
      calculated_overall: ratings.chassisRating,
      technical_attributes: attributes,
      component_ratings: compRatings,
      balance_delta: ratings.balanceDelta,
      technical_balance_delta: ratings.balanceDelta,
    }
  },
}

// ============================================================================
// 2. COMPONENT BRIDGE ADAPTER (SISTEMA A ⇄ SISTEMA B)
// ============================================================================

export const canonicalComponentAdapter = {
  /**
   * Mapeia qualquer nome/string para um dos 8 IDs canônicos
   */
  normalizeComponentId(rawNameOrId?: string): TechnicalComponentId {
    if (!rawNameOrId) return 'chassis'
    const clean = rawNameOrId.toLowerCase().trim().replace(/[-_]/g, '')
    if (CANONICAL_COMPONENT_IDS.includes(clean as TechnicalComponentId)) {
      return clean as TechnicalComponentId
    }
    return COMPONENT_NAME_TO_CANONICAL_ID[clean] || 'chassis'
  },

  /**
   * Converte um PartModel (físico/banco) em PhysicalComponentUnit
   */
  partModelToPhysicalUnit(part: PartModel): PhysicalComponentUnit {
    const compId = this.normalizeComponentId(part.component_id || part.name)
    const condition = Math.max(0, Math.min(100, part.condition ?? 100))
    const wearPercentage = Math.max(0, 100 - condition)

    return {
      unitId: part.id || `part_${compId}`,
      specId: part.spec_id || `spec_${compId}_gen${part.spec_generation || 1}`,
      componentId: compId,
      carAssignment: part.car_assignment || 'car1',
      condition,
      wearPercentage,
      damagePercentage: 0,
      mileageKm: part.mileage_km ?? 0,
      isAvailable: condition > 10,
    }
  },

  /**
   * Converte uma lista heterogênea de PartModel (Sistema A) e uma especificação (Sistema B)
   * em uma ponte consolidada CanonicalComponentBridge
   */
  buildComponentBridge(
    compId: TechnicalComponentId,
    parts: PartModel[],
    spec?: ComponentSpecification,
    fallbackRating: number = 70,
  ): CanonicalComponentBridge {
    const matchingParts = parts.filter(
      (p) => this.normalizeComponentId(p.component_id || p.name) === compId,
    )

    const physicalUnits = matchingParts.map((p) => this.partModelToPhysicalUnit(p))
    const activeCar1Unit = physicalUnits.find((u) => u.carAssignment === 'car1') || physicalUnits[0]
    const activeCar2Unit = physicalUnits.find((u) => u.carAssignment === 'car2') || physicalUnits[1]
    const stockUnits = physicalUnits.filter((u) => u.carAssignment === 'stock')

    const resolvedSpec: ComponentSpecification = spec || {
      specId: `spec_${compId}_gen1`,
      componentId: compId,
      generation: 1,
      specName: `Spec 1.0 - ${CANONICAL_COMPONENT_DISPLAY_NAMES[compId]}`,
      baseRating: fallbackRating,
      characteristics: {},
      costUsd: 2500000,
      rdLeadTimeRounds: 3,
      introducedRound: 1,
    }

    return {
      componentId: compId,
      displayName: CANONICAL_COMPONENT_DISPLAY_NAMES[compId],
      spec: resolvedSpec,
      physicalUnits,
      activeCar1Unit,
      activeCar2Unit,
      stockUnits,
    }
  },

  /**
   * Converte os 8 componentes canônicos a partir da lista de partes do usuário
   */
  mapAllComponents(
    parts: PartModel[],
    specs?: ComponentSpecification[],
    componentRatings?: ComponentRatingsMap,
  ): Record<TechnicalComponentId, CanonicalComponentBridge> {
    const result: Partial<Record<TechnicalComponentId, CanonicalComponentBridge>> = {}

    for (const cId of CANONICAL_COMPONENT_IDS) {
      const spec = specs?.find((s) => s.componentId === cId)
      const rating = componentRatings?.[cId] ?? 70
      result[cId] = this.buildComponentBridge(cId, parts, spec, rating)
    }

    return result as Record<TechnicalComponentId, CanonicalComponentBridge>
  },
}

// ============================================================================
// 3. HOMOLOGAÇÃO E LICENÇA ADAPTER
// ============================================================================

export const canonicalHomologationAdapter = {
  /**
   * Leitura Canônica com Prioridade ao Sistema Novo:
   * 1. license_status (novo)
   * 2. Se ausente, mapeia a partir de homologation_status / role / categoria (legado)
   */
  toCanonicalView(
    driver: Partial<DriverModel> | null | undefined,
  ): CanonicalDriverHomologationView {
    if (!driver) {
      return {
        driverId: 'unknown',
        driverName: 'Piloto',
        licenseStatus: 'nivel_c',
        isEligibleForF1Seat: false,
        isEligibleForFP1: false,
        seatSecurity: 50,
        technicalFeedback: 50,
        isAcademy: false,
        isTestDriver: false,
        legacySuperlicensePoints: 0,
        legacyHomologationStatus: 'formacao',
      }
    }

    let licenseStatus: CanonicalLicenseStatus

    // Prioridade 1: Sistema NOVO
    if (
      driver.license_status &&
      ['nivel_a', 'nivel_b', 'nivel_c'].includes(driver.license_status)
    ) {
      licenseStatus = driver.license_status
    } else {
      // Prioridade 2: Fallback defensivo a partir do legado
      if (driver.homologation_status === 'elegivel' || (driver.superlicense_points ?? 0) >= 40) {
        licenseStatus = 'nivel_a'
      } else if (
        driver.homologation_status === 'homologacao' ||
        (driver.superlicense_points ?? 0) >= 25 ||
        driver.role === 'reserva'
      ) {
        licenseStatus = 'nivel_b'
      } else if (driver.role === 'titular') {
        licenseStatus = 'nivel_a'
      } else {
        licenseStatus = 'nivel_c'
      }
    }

    const legacyStatus: 'formacao' | 'homologacao' | 'elegivel' =
      driver.homologation_status ||
      (licenseStatus === 'nivel_a'
        ? 'elegivel'
        : licenseStatus === 'nivel_b'
          ? 'homologacao'
          : 'formacao')

    const legacySl =
      driver.superlicense_points ??
      (licenseStatus === 'nivel_a' ? 40 : licenseStatus === 'nivel_b' ? 25 : 10)

    return {
      driverId: driver.id || '',
      driverName: driver.name || 'Piloto',
      licenseStatus,
      isEligibleForF1Seat: licenseStatus === 'nivel_a',
      isEligibleForFP1: licenseStatus === 'nivel_a' || licenseStatus === 'nivel_b',
      seatSecurity: driver.seat_security ?? 80,
      technicalFeedback: driver.technical_feedback ?? 70,
      isAcademy: driver.is_academy ?? false,
      isTestDriver: driver.is_test_driver ?? false,
      legacySuperlicensePoints: legacySl,
      legacyHomologationStatus: legacyStatus,
    }
  },

  /**
   * Converte uma alteração de licença para os campos correspondentes no banco
   * sem descontinuar os campos legados (dupla escrita aditiva segura).
   */
  toDatabaseUpdate(
    newStatus: CanonicalLicenseStatus,
  ): Pick<DriverModel, 'license_status' | 'homologation_status' | 'superlicense_points'> {
    let legacyStatus: 'formacao' | 'homologacao' | 'elegivel'
    let slPoints = 0

    if (newStatus === 'nivel_a') {
      legacyStatus = 'elegivel'
      slPoints = 40
    } else if (newStatus === 'nivel_b') {
      legacyStatus = 'homologacao'
      slPoints = 25
    } else {
      legacyStatus = 'formacao'
      slPoints = 10
    }

    return {
      license_status: newStatus,
      homologation_status: legacyStatus,
      superlicense_points: slPoints,
    }
  },
}

// ============================================================================
// 4. EVENTOS E NOTIFICAÇÕES ADAPTER
// ============================================================================

export const canonicalEventNotificationAdapter = {
  /**
   * Mapeia DomainEventType para a categoria visual da notificação (F1NotificationType)
   */
  domainTypeToNotificationType(domainType: DomainEventType): F1NotificationType {
    switch (domainType) {
      case 'resultado':
        return 'corrida'
      case 'contrato':
        return 'radio'
      case 'desenvolvimento':
      case 'tecnico':
        return 'motor'
      case 'patrocinio':
      case 'financeiro':
        return 'patrocinio'
      default:
        return 'sistema'
    }
  },

  /**
   * Transforma um DomainEvent em um modelo de notificação para ser persistido ou exibido
   */
  domainEventToNotification(
    event: CanonicalDomainEvent,
    userId: string,
  ): Omit<F1NotificationModel, 'id'> {
    return {
      user_id: userId,
      type: this.domainTypeToNotificationType(event.type),
      title: this.deriveTitle(event),
      message: event.message,
      round: event.round ?? 1,
      read: false,
      link: this.deriveLink(event),
      created: event.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    }
  },

  deriveTitle(event: CanonicalDomainEvent): string {
    switch (event.type) {
      case 'resultado':
        return 'Resultado de Corrida'
      case 'contrato':
        return 'Comunicação Contratual'
      case 'desenvolvimento':
        return 'Atualização Técnica'
      case 'patrocinio':
        return 'Patrocínio & Finanças'
      case 'tecnico':
        return 'Diagnóstico da Engenharia'
      default:
        return 'Comunicado Oficial FIA'
    }
  },

  deriveLink(event: CanonicalDomainEvent): string {
    switch (event.type) {
      case 'resultado':
        return '/history'
      case 'contrato':
        return '/team'
      case 'desenvolvimento':
      case 'tecnico':
        return '/car'
      case 'patrocinio':
        return '/sponsors'
      default:
        return '/paddock'
    }
  },
}
