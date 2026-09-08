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
  created?: string
  updated?: string
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
}

export interface EngineSupplierSpec {
  name: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
  power: number
  reliability: number
  costAnnual: number
  description: string
  techBadge: string
}
