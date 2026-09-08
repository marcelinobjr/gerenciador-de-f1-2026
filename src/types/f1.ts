export interface TeamModel {
  id: string
  name: string
  color: string
  chassis_level: number // 0-100
  aero_level: number // 0-100
  strategy_level: number // 0-100
  budget: number
  engine_supplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
  strength?: number // 0-100 rating baseado em momento atual + história
  is_custom?: boolean // true se criada pelo jogador (12ª equipe)
  team_key?: string // chave da equipe se for do grid oficial ('mclaren', 'ferrari', etc)
  reserve_setup_bonus?: boolean // true se o piloto reserva treinou no FP e gerou bônus de setup
  cost_cap_spent?: number // Total gasto na temporada sujeito ao teto FIA (R$ 135M)
  engine_pool_used?: number // Motores introduzidos no pool (limite regulamentar 4 antes de penalidades)
  active_engine_wear?: number // Desgaste 0-100% da unidade de potência atualmente instalada no carro
  engine_history?: Array<{
    id: number
    wear: number
    status: 'instalado' | 'reserva' | 'aposentado'
    supplier: string
    introducedRound: number
  }>
  user_id?: string
  created?: string
  updated?: string
}

export interface SeasonModel {
  id: string
  year: number
  current_round: number
  total_rounds: number
  team_id: string
  created?: string
  updated?: string
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
  created?: string
  updated?: string
  // expanded relations if any
  expand?: {
    driver_id?: DriverModel
    team_id?: TeamModel
  }
}

export interface SponsorModel {
  id: string
  name: string
  value_per_round: number
  requirement: string
  status: 'ativo' | 'suspenso' | 'encerrado'
  rounds_remaining?: number
  team_id: string
  created?: string
  updated?: string
}

export interface PartModel {
  id: string
  name: string
  level: number // 0-10
  condition?: number // 0-100 (% de integridade mecânica/estrutural)
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

export interface GrandPrixInfo {
  round: number
  name: string
  circuit: string
  country: string
  flag: string
  laps: number
  circuitLengthKm: number
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
  compound: TireCompound
  wear: number // 0-100% de desgaste (0% = jogo novo de fábrica)
  lapsUsed: number
  isFitted?: boolean
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
  notes?: string
}

export interface EngineSupplierSpec {
  name: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
  power: number
  reliability: number
  costAnnual: number
  description: string
  techBadge: string
}
