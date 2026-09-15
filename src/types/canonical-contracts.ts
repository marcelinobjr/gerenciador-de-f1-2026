/**
 * CONTRATOS CANÔNICOS E NOMENCLATURA OFICIAL — F1 MANAGER 2026
 * Saneamento Técnico e Unificação das Fundações (Fase 0A)
 *
 * Este módulo estabelece a fonte canônica para:
 * 1. Ratings do Carro:
 *    - chassisRating: resultado técnico dos componentes aero/mecânicos (0-100)
 *    - powerUnitRating: rating separado da Unidade de Potência (0-100)
 *    - carPerformanceRating: indicador global unificado do monoposto (0-100)
 *    - teamStrength: preservado APENAS como legado/compatibilidade de saves antigos
 *
 * 2. Componentes do Carro:
 *    - 8 componentes canônicos: frontWing, rearWing, floor, diffuser, sidepods, chassis, suspension, brakes
 *    - Design / Especificação (qualidade técnica, geração, rating de projeto)
 *    - Unidade Física (condição, desgaste, dano, quilometragem, alocação de carro)
 *
 * 3. Homologação e Licenças de Pilotos:
 *    - Sistema canônico: licenseStatus ('nivel_c' | 'nivel_b' | 'nivel_a'), driverTests, seatSecurity, technicalFeedback
 *    - Sistema legado mantido via adapter: homologation_status ('formacao' | 'homologacao' | 'elegivel'), superlicense_points
 *
 * 4. Eventos e Notificações:
 *    - DomainEvent (events): estado/evento de domínio com impacto esportivo ou financeiro
 *    - Notification (notifications): representação visual e comunicação direta para o jogador/UI
 */

import {
  TechnicalAttributeId,
  TechnicalComponentId,
  TechnicalAttributesMap,
  ComponentRatingsMap,
  PowerUnitSubsystem,
  ComponentSpecification,
  PhysicalComponentUnit,
} from './car-technical-model'
import { DriverLicenseStatus, HomologationPhase, DriverTestType } from './driver-development'
import type { TeamModel, DriverModel, PartModel, EventModel, F1NotificationModel } from './f1'

// ============================================================================
// 1. RATINGS DO CARRO (CANÔNICO)
// ============================================================================

export interface CanonicalCarRatings {
  /**
   * chassisRating: resultado estritamente técnico dos componentes
   * aerodinâmicos e mecânicos do carro (0-100), ponderado pela matriz oficial.
   */
  chassisRating: number

  /**
   * powerUnitRating: rating intrínseco separado da Unidade de Potência (0-100),
   * baseado na entrega de potência e confiabilidade do fornecedor.
   */
  powerUnitRating: number

  /**
   * carPerformanceRating: indicador global consolidado do monoposto (0-100),
   * combinando chassi + PU sem alterar a matemática original das planilhas.
   */
  carPerformanceRating: number

  /**
   * balanceDelta: diferença entre calculatedOverall e a nota de referência macro.
   * Preferência canônica única para balanceDelta (antigo technical_balance_delta / balance_delta).
   */
  balanceDelta: number

  /**
   * teamStrength: legado mantido estritamente para compatibilidade com saves antigos.
   * NUNCA deve ser usado como fonte canônica primária em novas regras.
   * @deprecated Usar chassisRating ou carPerformanceRating
   */
  legacyTeamStrength?: number

  /**
   * calculatedOverall: sinônimo técnico de chassisRating.
   */
  calculatedOverall: number
}

// ============================================================================
// 2. COMPONENTES — 8 IDS CANÔNICOS E MAPA DE NOMES
// ============================================================================

export const CANONICAL_COMPONENT_IDS: readonly TechnicalComponentId[] = [
  'frontWing',
  'rearWing',
  'floor',
  'diffuser',
  'sidepods',
  'chassis',
  'suspension',
  'brakes',
] as const

/**
 * Mapeamento bidirecional e tolerante entre strings legadas e os 8 IDs canônicos.
 */
export const COMPONENT_NAME_TO_CANONICAL_ID: Record<string, TechnicalComponentId> = {
  // Front Wing
  frontwing: 'frontWing',
  'front wing': 'frontWing',
  'asa dianteira': 'frontWing',
  asadianteira: 'frontWing',
  bico: 'frontWing',

  // Rear Wing
  rearwing: 'rearWing',
  'rear wing': 'rearWing',
  'asa traseira': 'rearWing',
  asatraseira: 'rearWing',

  // Floor
  floor: 'floor',
  assoalho: 'floor',
  fundo: 'floor',

  // Diffuser
  diffuser: 'diffuser',
  difusor: 'diffuser',
  'difusor traseiro': 'diffuser',

  // Sidepods
  sidepods: 'sidepods',
  sidepod: 'sidepods',
  'sidepods & radiadores': 'sidepods',
  radiadores: 'sidepods',
  'aerodinâmica ativa': 'sidepods', // Mapeamento de compatibilidade da 6ª peça legada do banco
  aerodinamicaativa: 'sidepods',

  // Chassis
  chassis: 'chassis',
  chassi: 'chassis',
  monocoque: 'chassis',

  // Suspension
  suspension: 'suspension',
  suspensao: 'suspension',
  suspensão: 'suspension',

  // Brakes
  brakes: 'brakes',
  freios: 'brakes',
  freio: 'brakes',
}

export const CANONICAL_COMPONENT_DISPLAY_NAMES: Record<TechnicalComponentId, string> = {
  frontWing: 'Asa Dianteira',
  rearWing: 'Asa Traseira',
  floor: 'Assoalho',
  diffuser: 'Difusor',
  sidepods: 'Sidepods',
  chassis: 'Chassi',
  suspension: 'Suspensão',
  brakes: 'Freios',
}

/**
 * Modelo Unificado de Componente: conecta Design/Spec com Physical Unit
 */
export interface CanonicalComponentBridge {
  componentId: TechnicalComponentId
  displayName: string
  spec: ComponentSpecification
  physicalUnits: PhysicalComponentUnit[]
  activeCar1Unit?: PhysicalComponentUnit
  activeCar2Unit?: PhysicalComponentUnit
  stockUnits: PhysicalComponentUnit[]
}

// ============================================================================
// 3. HOMOLOGAÇÃO E LICENÇAS (CANÔNICO)
// ============================================================================

export type CanonicalLicenseStatus = 'nivel_c' | 'nivel_b' | 'nivel_a'

export interface CanonicalDriverHomologationView {
  driverId: string
  driverName: string
  /**
   * Fonte canônica de elegibilidade para pilotar na F1:
   * - nivel_a: Super Licença FIA ativa (pode ser titular)
   * - nivel_b: Licença de Testes/Treinos Livres (pode ser reserva/TL1)
   * - nivel_c: Formação / Piloto de Academia
   */
  licenseStatus: CanonicalLicenseStatus
  isEligibleForF1Seat: boolean
  isEligibleForFP1: boolean

  // Testes e métricas canônicas
  seatSecurity: number // 0-100
  technicalFeedback: number // 0-100
  isAcademy: boolean
  isTestDriver: boolean

  // Campos legados preservados de forma transparente
  legacySuperlicensePoints: number
  legacyHomologationStatus: 'formacao' | 'homologacao' | 'elegivel'
}

// ============================================================================
// 4. EVENTOS DE DOMÍNIO E NOTIFICAÇÕES (CANÔNICO)
// ============================================================================

export type DomainEventType =
  | 'resultado'
  | 'contrato'
  | 'desenvolvimento'
  | 'patrocinio'
  | 'financeiro'
  | 'tecnico'

export interface CanonicalDomainEvent {
  id?: string
  teamId: string
  type: DomainEventType
  message: string
  round?: number
  created?: string
  // Metadados aditivos opcionais para rastreamento
  metadata?: {
    entityType?: 'driver' | 'part' | 'sponsor' | 'power_unit' | 'race' | 'fia'
    entityId?: string
    severity?: 'info' | 'warning' | 'critical'
  }
}

export interface CanonicalNotificationBridge {
  domainEvent?: CanonicalDomainEvent
  notification: F1NotificationModel
}
