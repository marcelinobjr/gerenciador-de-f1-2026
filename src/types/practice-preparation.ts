import type { TireCompound } from './f1'

export type PracticeSessionType = 'tp1' | 'tp2' | 'tp3'

export type PracticeProgramType = 'car_setup' | 'race_pace' | 'qualifying_sim' | 'tyre_knowledge'

export interface PracticeProgramMeta {
  id: PracticeProgramType
  title: string
  subtitle: string
  objective: string
  lapsTarget: number
  description: string
}

export const PRACTICE_PROGRAMS: Record<PracticeProgramType, PracticeProgramMeta> = {
  car_setup: {
    id: 'car_setup',
    title: 'Acerto do Carro',
    subtitle: 'Calibração aerodinâmica e mecânica',
    objective:
      'Avaliar equilíbrio entre asa dianteira, asa traseira e suspensão para encontrar o balanço ideal na pista.',
    lapsTarget: 12,
    description:
      'Foco prioritário em validar respostas de comportamento dinâmico nas curvas e no diferencial sob tração.',
  },
  race_pace: {
    id: 'race_pace',
    title: 'Ritmo de Corrida',
    subtitle: 'Simulação de stints longos em alta carga',
    objective:
      'Medir degradação de pneus em ritmo constante e validar taxas de consumo térmico com tanque carregado.',
    lapsTarget: 18,
    description:
      'Stint longo com combustível para entender o ritmo em ar limpo e comportamento da asa em alta carga.',
  },
  qualifying_sim: {
    id: 'qualifying_sim',
    title: 'Simulação de Classificação',
    subtitle: 'Ataque em volta lançada com pneus macios',
    objective:
      'Extrair o limite absoluto de aderência mecânica em volta única e mapear curvas de velocidade máxima.',
    lapsTarget: 6,
    description:
      'Voltas rápidas em modo ataque com combustível leve para referenciar a melhor marca do fim de semana.',
  },
  tyre_knowledge: {
    id: 'tyre_knowledge',
    title: 'Conhecimento de Pneus',
    subtitle: 'Mapeamento térmico de compostos',
    objective:
      'Identificar a curva de degradação térmica e mecânica do composto selecionado na abrasividade do circuito.',
    lapsTarget: 14,
    description:
      'Coleta de dados sobre o comportamento da carcaça e limite de voltas antes de atingir o cliff de rendimento.',
  },
}

export interface PracticeCarSetup {
  frontWing: number // 1 a 10
  rearWing: number // 1 a 10
  suspension: number // 1 a 10
  differential: number // 20 a 80 (%)
}

export interface PracticeTyreSelection {
  setId: string
  compound: TireCompound
  isReserved: boolean
}

export interface PracticeFuelLoad {
  kg: number
  estimatedLaps: number
}

export type PracticePreparationCarStatus = 'empty' | 'preparing' | 'ready'

export interface PracticeCarPreparation {
  carId: 'car1' | 'car2'
  driverId: string
  program: PracticeProgramType
  tyreSelection: PracticeTyreSelection | null
  fuelLoad: PracticeFuelLoad
  setup: PracticeCarSetup
  objective: string
  status: PracticePreparationCarStatus
}

export type PracticeOverallStatus = 'not_started' | 'preparing' | 'ready' | 'started' | 'completed'

export interface PracticePreparation {
  careerId: string
  seasonId: string
  round: number
  sessionType: PracticeSessionType
  cars: [PracticeCarPreparation, PracticeCarPreparation]
  status: PracticeOverallStatus
  updatedAt?: string
}

export interface PracticeCarValidation {
  valid: boolean
  errors: {
    driver?: string
    program?: string
    tyres?: string
    fuel?: string
    setup?: string
  }
}

export interface PracticeOverallValidation {
  canStart: boolean
  car1: PracticeCarValidation
  car2: PracticeCarValidation
}

export const DEFAULT_PRACTICE_SETUP: PracticeCarSetup = {
  frontWing: 6,
  rearWing: 6,
  suspension: 6,
  differential: 50,
}

export const FUEL_CONSUMPTION_KG_PER_LAP = 1.65 // Canônico aproximado F1 2026
