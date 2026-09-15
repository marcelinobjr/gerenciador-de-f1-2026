import type { CanonicalDriverContract } from '@/types/canonical-driver-market'

export type EngineSupplierName = 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'

export interface TeamModel {
  id: string
  name: string
  color: string
  chassis_level: number // 0-100
  aero_level: number // 0-100
  strategy_level: number // 0-100
  budget: number
  engine_supplier: EngineSupplierName
  strength?: number // 0-100 rating baseado em momento atual + história
  strength_rating?: number // 0-10 rating exato do usuário (ex: 10.0, 9.1, 3.7)
  strength_verdict?: string // Parecer textual do usuário
  is_custom?: boolean // true se criada pelo jogador (12ª equipe)
  team_key?: string // chave da equipe se for do grid oficial ('mclaren', 'ferrari', etc)
  reserve_setup_bonus?: boolean // true se o piloto reserva treinou no FP e gerou bônus de setup
  photo?: string // Foto lateral do carro / banner da equipe
  carImage?: string // Foto lateral personalizada do carro do jogador
  cost_cap_spent?: number // Total gasto na temporada sujeito ao teto FIA (R$ 215M)
  // Sistema de Homologação de Pilotos, Testes Privados e Academia
  academy_development_data?: {
    testDrivers?: string[] // driverIds
    academyDrivers?: string[] // driverIds
    homologationPrograms?: Record<string, any> // driverId -> DriverHomologationProgram
    testResults?: any[] // DriverTestResult[]
    seatSecurities?: Record<string, number> // driverId -> number (0-100)
    technicalFeedbacks?: Record<string, number> // driverId -> number (0-100)
    developmentProgresses?: Record<string, any> // driverId -> developmentProgress
  }
  // Modelo Técnico Estrutural (Fase 3D) - Campos aditivos opcionais para compatibilidade
  technical_attributes?: Record<string, number> // 12 atributos calculados
  calculated_overall?: number // Overall técnico calculado
  component_ratings?: Record<string, number> // Ratings dos 8 componentes
  balance_delta?: number // Nomenclatura canônica única: delta macro vs calculado
  technical_balance_delta?: number // Alias legado mantido para compatibilidade
  engine_pool_used?: number // Motores introduzidos no pool (limite regulamentar 4 antes de penalidades)
  active_engine_wear?: number // Desgaste 0-100% da unidade de potência atualmente instalada no carro
  // As 9 Instalações Canônicas de Infraestrutura (Fase 4A)
  factory_level?: number // Nível 1 a 5 da Fábrica de P&D & Sede
  design_centre_level?: number // Nível 1 a 5 do Centro de Design
  cfd_level?: number // Nível 1 a 5 do Cluster de CFD
  wind_tunnel_level?: number // Nível 1 a 5 do Túnel de Vento 60%
  manufacturing_level?: number // Nível 1 a 5 da Manufatura de Peças
  simulator_level?: number // Nível 1 a 5 do Simulador de Pilotos
  operations_centre_level?: number // Nível 1 a 5 do Centro de Operações
  pitstop_center_level?: number // Nível 1 a 5 do Centro de Testes de Pit Stop
  youth_academy_level?: number // Nível 1 a 5 da Academia de Jovens Pilotos
  facility_projects?: Array<{
    facilityId: string
    fromLevel: number
    targetLevel: number
    capexCost: number
    startedAtRound: number
    completionRound: number
    status: 'em_construcao' | 'concluido'
    isCapexPaid: boolean
  }>
  development_projects?: import('@/types/car-development').DevelopmentProject[]
  component_specs?: import('@/types/car-development').CanonicalComponentSpec[]
  manufacturing_orders?: import('@/types/car-development').ManufacturingOrder[]
  technical_knowledge?: import('@/types/car-development').TeamTechnicalKnowledge
  cost_cap_penalties?: Array<{
    id: string
    timestamp: string
    overspendAmount: number
    pointsDeducted: number
    rdPenaltyRounds: number
    reason: string
  }>
  rd_penalty_rounds_left?: number // Rodadas com eficácia de P&D/Oficina reduzida pela FIA
  constructors_points_deduction?: number // Dedução de pontos nos construtores
  engine_history?: Array<{
    id: number
    wear: number
    status: 'instalado' | 'reserva' | 'aposentado'
    supplier: string
    introducedRound: number
  }>
  user_id?: string
  manager_name?: string
  manager_profile?: any
  career_settings?: any
  custom_grid_teams?: any
  universe_type?: string
  hero_title?: string
  hero_tagline?: string
  hero_car_model?: string
  financial_commitments?: any[]
  budget_allocations?: Record<string, number>
  opening_balances?: Record<string, any>
  created?: string
  updated?: string
}

export interface MarketMoveEvent {
  id: string
  type: 'aposentadoria' | 'transferencia' | 'promocao' | 'demissao' | 'renovacao'
  driverName: string
  driverAge: number
  previousTeam?: string
  newTeam?: string
  salary?: number
  headline: string
  details: string
  impact: 'alto' | 'medio' | 'baixo'
}

export interface SeasonModel {
  id: string
  year: number
  current_round: number
  total_rounds: number
  team_id: string
  last_processed_round?: number
  created?: string
  updated?: string
  market_moves?: MarketMoveEvent[]
}
export interface DriverModel {
  id: string
  name: string
  nationality: string
  age: number
  speed: number
  consistency: number
  rain: number
  defense: number
  salary: number
  contract_end: number
  team_id?: string | null
  role?: 'titular' | 'reserva' | null
  category?:
    | 'f1'
    | 'f2'
    | 'indycar'
    | 'indynxt'
    | 'formula_e'
    | 'nascar'
    | 'prototipos'
    | 'mercado'
    | 'f1_academy'
    | null
  reserve_team_id?: string | null
  fp_sessions_completed?: number // 0, 1 ou 2
  fp_scheduled_rounds?: number[] // rounds em que está escalado para treinar, ex: [3, 8]
  is_incapacitated?: boolean // se está com lesão/doença
  incapacitated_rounds_left?: number // quantas corridas restantes de afastamento (1 a 3)
  incapacitated_reason?: string // motivo da incapacidade
  fatigue?: number
  morale?: number // 0-100 (afetada por resultados, contrato, etc.)
  physical_condition?: number // 0-100 (condição física afetada por fadiga acumulada e corridas)
  helmet?: string | null
  next_team_id?: string | null
  next_contract_role?: 'titular' | 'reserva' | null
  superlicense_points?: number
  homologation_status?: 'formacao' | 'homologacao' | 'elegivel'
  homologation_sessions_done?: number
  f1_adaptation?: number
  // Campos aditivos do sistema de homologação e desenvolvimento
  license_status?: 'nivel_c' | 'nivel_b' | 'nivel_a'
  is_academy?: boolean
  is_test_driver?: boolean
  technical_feedback?: number
  seat_security?: number
  canonical_contract?: CanonicalDriverContract | null
  future_contract?: CanonicalDriverContract | null
  psychology_data?: any
  academy_origin_team_id?: string | null
  career_status?: string | null
  created?: string
  updated?: string
}

export interface WeatherForecast {
  probability: number // 0 a 100%
  expectedCondition:
    | 'Ensolarado'
    | 'Parcialmente Nublado'
    | 'Nublado com risco de chuva'
    | 'Chuva Iminente'
    | 'Tempestade'
  airTemp: number // graus C
  trackTemp: number // graus C
  rainLapStart?: number // volta aproximada em que a chuva começa (se ocorrer)
}

export interface RaceResultModel {
  id: string
  season_id: string
  round: number
  driver_id: string
  team_id: string
  position: number
  points: number
  fastest_lap?: boolean
  laps_completed?: number
  accumulated_time_sec?: number
  created?: string
  updated?: string
  // expanded relations if any
  expand?: {
    driver_id?: DriverModel
    team_id?: TeamModel
  }
}

export type SponsorQuotaSlot =
  | 'bico'
  | 'laterais'
  | 'asa_traseira'
  | 'halo'
  | 'macacao'
  | 'retrovisores'

export interface SponsorModel {
  id: string
  name: string
  value_per_round: number
  requirement: string
  status: 'ativo' | 'suspenso' | 'encerrado'
  rounds_remaining?: number
  slot?: SponsorQuotaSlot | string
  team_id: string
  created?: string
  updated?: string
  // Campos aditivos Fase 5B
  sponsor_key?: string
  sector?: string
  country?: string
  fixed_annual_value?: number
  contract_start_year?: number
  contract_end_year?: number
  satisfaction?: number
  renewal_interest?: number
  is_title_sponsor?: boolean
  title_name_suffix?: string
  exclusivity_sector?: string
  partnership_type?: string
  package_slots?: string[]
  bonuses?: any[]
  objectives?: any[]
  clauses?: Record<string, any>
  contract_id?: string
}

export interface PartModel {
  id: string
  name: string
  level: number // 0-10
  condition?: number // 0-100 (% de integridade mecânica/estrutural)
  // Campos aditivos para arquitetura Fase 3D: separação Design (Spec) vs Unidade Física
  spec_id?: string // Referência à especificação de engenharia (Gen/Spec)
  spec_generation?: number // Geração do projeto (1, 2, 3...)
  component_id?: string // ID estável: frontWing, rearWing, floor, diffuser, sidepods, chassis, suspension, brakes
  car_assignment?: 'car1' | 'car2' | 'stock' // Atribuição: Carro 1, Carro 2 ou Estoque
  mileage_km?: number // Quilometragem percorrida pela unidade física
  team_id: string
  created?: string
  updated?: string
}

export interface EventModel {
  id: string
  message: string
  type: 'resultado' | 'contrato' | 'desenvolvimento' | 'patrocinio'
  team_id: string
  created?: string
  updated?: string
}

export type NotificationType =
  | 'radio'
  | 'patrocinio'
  | 'motor'
  | 'fia'
  | 'rival'
  | 'lesao'
  | 'corrida'
  | 'sistema'

export interface NotificationModel {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  round?: number
  read: boolean
  link?: string
  created?: string
  updated?: string
}

export interface CircuitModel {
  id: string
  round: number
  name: string
  circuit_name?: string
  country?: string
  photo?: string
  created?: string
  updated?: string
}

export interface GrandPrixInfo {
  round: number
  name: string
  circuit: string
  country: string
  flag: string
  laps: number
  circuitLengthKm: number
  turns?: number // Número de curvas
  characteristic: string // "Alta velocidade", "Técnico e travado", "Misto", etc.
  tireAbrasiveness?: number // 1 a 10 (ex: 8 = Bahrain/Barcelona, 3 = Mônaco)
  downforceIdeal?: number // 1 a 10 asa recomendada (ex: Monza = 2, Mônaco = 10)
  suspensionIdeal?: number // 1 a 10 rigidez ideal
}

export type TireCompound = 'duro' | 'medio' | 'macio' | 'intermediario' | 'chuva_extrema'

export interface TireAllotment {
  duro: number
  medio: number
  macio: number
  intermediario: number
  chuva_extrema: number
}

export interface TireSetItem {
  id: string
  driverId?: string
  compound: TireCompound
  wear: number // 0-100% de desgaste (0% = jogo novo de fábrica)
  lapsUsed: number
  isFitted?: boolean
}

export interface PitStopPlan {
  id: string
  lap: number // Volta alvo do pit (ex: volta 18)
  compound: TireCompound // Composto a calçar nessa parada
}

export interface DriverRaceStrategy {
  driverId: string
  driverName: string
  startCompound: TireCompound // Pneu de largada (stint 1)
  pitStops: PitStopPlan[] // Até 4 paradas planejadas
}

export interface DriverCarSetup {
  driverId: string
  wing_level: number // 1 a 10
  suspension_stiffness: number // 1 a 10
  pu_electric_ratio: number // 20 a 80
  tire_compound?: TireCompound
}

export interface SessionSetupModel {
  id?: string
  team_id: string
  season_id: string
  round: number
  session: 'tp1' | 'tp2' | 'q1' | 'q2' | 'q3' | 'race'
  wing_level: number // 1 a 10
  suspension_stiffness: number // 1 a 10
  pu_electric_ratio: number // 20 a 80 (padrão 50%)
  tire_compound?: TireCompound
  target_pit_lap?: number
  second_tire_compound?: TireCompound
  driver_wear?: number
  initial_fuel_load?: number // 90 a 110%, padrão 100%
  driver_strategies?: Record<string, DriverRaceStrategy> // Estratégia customizada por piloto (driverId -> strategy)
  driver_setups?: Record<string, DriverCarSetup> // Setup individual por piloto (asa, suspensão, balanço elétrico)
  notes?: string
}

export interface EngineSupplierSpec {
  name: EngineSupplierName
  power: number
  reliability: number
  costAnnual: number
  description: string
  techBadge: string
}

export type F1NotificationType =
  | 'radio'
  | 'patrocinio'
  | 'motor'
  | 'fia'
  | 'rival'
  | 'lesao'
  | 'corrida'
  | 'sistema'

export interface F1NotificationModel {
  id: string
  user_id: string
  type: F1NotificationType
  title: string
  message: string
  round?: number
  read?: boolean
  link?: string
  created?: string
  updated?: string
}

export interface DriverPostRaceSummary {
  driverId: string
  driverName: string
  nationality?: string
  flag?: string
  finalPosition: number
  points: number
  fastestLap?: boolean
  lapsCompleted?: number
  dnf?: boolean
  dnfReason?: string
  totalTime?: string
  stints: {
    compound: TireCompound
    startLap: number
    endLap: number
    lapsDone: number
    wearAtEnd?: number
  }[]
  pitStops: {
    lap: number
    durationSec?: number
    toCompound: TireCompound
  }[]
  oldMorale?: number
  newMorale?: number
  oldPhysical?: number
  newPhysical?: number
  physicalReason?: string
}

export interface RadioHighlight {
  id: string
  lap: number
  driverName: string
  driverMessage: string
  bossResponse?: string
  driverFeedback?: string
  category?: string
}

export interface ConstructorPositionDelta {
  rankBefore: number
  rankAfter: number
  pointsBefore: number
  pointsAfter: number
  pointsGained: number
  positionDelta: number // >0 ganho de posições, <0 perda de posições, 0 estável
}

export interface RaceReportData {
  round: number
  gpName: string
  circuitName: string
  country?: string
  flag?: string
  date?: string
  weatherSummary?: string
  totalLaps: number
  lapsCompleted?: number
  teamDrivers: DriverPostRaceSummary[]
  teamPoints: number
  constructorDelta: ConstructorPositionDelta
  teamIncidents: string[]
  allIncidents?: string[]
  radioHighlights: RadioHighlight[]
  bestMoment: {
    title: string
    description: string
    badge?: string
    driverName?: string
  }
  puWearSummary?: string
}

export interface RaceReportModel {
  id: string
  season_id: string
  team_id: string
  round: number
  gp_name: string
  circuit_name?: string
  country?: string
  data: RaceReportData
  created?: string
  updated?: string
}
