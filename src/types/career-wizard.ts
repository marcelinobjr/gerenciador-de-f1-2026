// Modelos e tipos conceituais do Wizard de Criação de Carreira (Fase 2)
import { EngineSupplierName } from './f1'

export type UniverseType = 'championship_2026' | 'custom_championship'

export interface ManagerBonus {
  attribute: string
  value: number // ex: +10, +12, +8
}

export interface ManagerWeakness {
  attribute: string
  value: number // ex: -5
}

export interface ManagerProfile {
  id: string
  number: number
  title: string // ex: "O Estrategista"
  slug: string // "estrategista"
  archetype: string
  specialty: string // "Planejamento"
  style: string // "Analítico, racional, longo prazo"
  description: string
  bonuses: ManagerBonus[]
  weakness: ManagerWeakness
  avatarId: string
  avatarFilename: string
  avatarUrl: string
  baseAttributes: Record<string, number> // 28 atributos estruturados (0-100)
}

export interface ManagerCustomData {
  name: string
  nationality: string
  age?: number
  avatarUrl?: string
  profileId: string
}

export interface CareerSettings {
  aiDifficulty: 'easy' | 'normal' | 'hard' | 'expert'
  eventFrequency: 'low' | 'normal' | 'high'
  marketBehavior: 'conservative' | 'dynamic' | 'chaotic'
  devSpeed: 'normal' | 'accelerated'
  seasonFormat: 'official_24' | 'custom'
  sprintEnabled: boolean
}

export interface GridTeamDefinition {
  key: string
  name: string
  shortName: string
  country: string
  flag: string
  color: string
  engine: EngineSupplierName
  strengthRating: number // 0 a 10
  strength: number // 0 a 100
  carLevel: number
  budget: number
  competitivenessVerdict: string
  boardPressure: 'Baixa' | 'Média' | 'Alta' | 'Extrema'
  difficulty: 'Fácil' | 'Média' | 'Desafiadora' | 'Muito Difícil'
  initialObjective: string
  infrastructureRating: number // 1 a 5 estrelas
  financesRating: number // 1 a 5 estrelas
  historySummary: string
  currentSituation: string
  logoUrl?: string
  headquarters?: string
  category?: string
  specialTraits?: string[]
  carRating?: number // 0 a 10 ou 0 a 100
  engineeringRating?: number // 0 a 100
  operationsRating?: number // 0 a 100
  prestigeRating?: number // 0 a 100
  cultureRating?: number // 0 a 100
  potentialRating?: number // 0 a 100
  driver1: {
    name: string
    nationality: string
    flag: string
    age: number
    speed: number
    consistency: number
    rain: number
    defense: number
    salary: number
  }
  driver2: {
    name: string
    nationality: string
    flag: string
    age: number
    speed: number
    consistency: number
    rain: number
    defense: number
    salary: number
  }
  reserveDriver: {
    name: string
    nationality: string
    flag: string
    age: number
    speed: number
    consistency: number
    rain: number
    defense: number
    salary: number
  }
  isCustomPlaceholder?: boolean
}

export interface PlayerChosenTeam {
  isCustom: boolean
  teamKey: string
  customName?: string
  customColor?: string
  customEngine?: EngineSupplierName
  customCarDesign?: string // "Carro1", "Carro2", etc.
  officialTeam?: GridTeamDefinition
}

/**
 * Estado único e centralizado do Wizard de Criação de Carreira (Fase 2)
 */
export interface NewGameConfig {
  manager: ManagerCustomData
  managerProfile: ManagerProfile
  universeType: UniverseType
  selectedTeams: GridTeamDefinition[] // Exatamente 12 equipes
  playerTeam: PlayerChosenTeam
  careerSettings: CareerSettings
}

export type WizardStepId =
  | 'start' // Início (Menu de Pré-Jogo: Novo Jogo, Continuar, etc.)
  | 'manager' // Escolha do Manager e personalização
  | 'universe' // Escolha do Universo (2026 vs Personalizado)
  | 'teams' // Seleção de Equipe (2026) OU Monte seu Grid + Escolha (Personalizado)
  | 'settings' // Configurações da Carreira
  | 'review' // Revisão Completa antes de criar
