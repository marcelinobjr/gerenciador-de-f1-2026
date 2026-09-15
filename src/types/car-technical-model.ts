/**
 * Tipos e Definições do Modelo Técnico do Carro - F1 Manager 2026
 * Referência: F1_Manager_2026_Modelo_Tecnico_Carro_CORRIGIDO
 *
 * Regra:
 * - 12 Atributos Técnicos com pesos somando 100%
 * - 8 Componentes físicos/aero (PU mantida em subsistema separado)
 * - Separação entre Especificação (Design/Specs) e Unidade Física (condição/desgaste)
 */

// 1. Identificadores estáveis dos 12 atributos técnicos do carro
export type TechnicalAttributeId =
  | 'slowCorner'
  | 'mediumCorner'
  | 'fastCorner'
  | 'topSpeed'
  | 'acceleration'
  | 'braking'
  | 'traction'
  | 'tyreManagement'
  | 'aeroEfficiency'
  | 'cooling'
  | 'weight'
  | 'reliability'

// 2. Identificadores estáveis dos 8 componentes do carro
export type TechnicalComponentId =
  | 'frontWing'
  | 'rearWing'
  | 'floor'
  | 'diffuser'
  | 'sidepods'
  | 'chassis'
  | 'suspension'
  | 'brakes'

// Metadados dos 12 atributos com pesos oficiais da planilha (soma 100%)
export interface TechnicalAttributeMeta {
  id: TechnicalAttributeId
  name: string
  shortName: string
  weight: number // em porcentagem (ex: 12 = 12%)
  category: 'aerodynamics' | 'dynamics' | 'mechanics' | 'systems'
  description: string
}

export const TECHNICAL_ATTRIBUTE_METAS: Record<TechnicalAttributeId, TechnicalAttributeMeta> = {
  slowCorner: {
    id: 'slowCorner',
    name: 'Curvas de Baixa',
    shortName: 'Curva Baixa',
    weight: 12,
    category: 'dynamics',
    description:
      'Aderência mecânica e equilíbrio em curvas lentas e travadas (hairpins, chicanes).',
  },
  mediumCorner: {
    id: 'mediumCorner',
    name: 'Curvas de Média',
    shortName: 'Curva Média',
    weight: 12,
    category: 'dynamics',
    description: 'Estabilidade aero-mecânica em curvas de média velocidade.',
  },
  fastCorner: {
    id: 'fastCorner',
    name: 'Curvas de Alta',
    shortName: 'Curva Alta',
    weight: 12,
    category: 'aerodynamics',
    description: 'Downforce absoluto em curvas de alta velocidade e sustentação.',
  },
  topSpeed: {
    id: 'topSpeed',
    name: 'Velocidade Final',
    shortName: 'Vel. Final',
    weight: 10,
    category: 'aerodynamics',
    description: 'Resistência ao arrasto (drag) em retas longas com e sem DRS.',
  },
  acceleration: {
    id: 'acceleration',
    name: 'Aceleração',
    shortName: 'Aceleração',
    weight: 8,
    category: 'dynamics',
    description: 'Capacidade de retomada de velocidade em saídas de curva.',
  },
  braking: {
    id: 'braking',
    name: 'Frenagem',
    shortName: 'Frenagem',
    weight: 8,
    category: 'mechanics',
    description: 'Distância de parada, estabilidade na desaceleração e dissipação térmica.',
  },
  traction: {
    id: 'traction',
    name: 'Tração',
    shortName: 'Tração',
    weight: 8,
    category: 'dynamics',
    description: 'Aderência longitudinal no eixo de saída sem destracionar.',
  },
  tyreManagement: {
    id: 'tyreManagement',
    name: 'Gestão de Pneus',
    shortName: 'Gestão Pneus',
    weight: 8,
    category: 'mechanics',
    description: 'Preservação da vida útil dos compostos e controle de granulação (graining).',
  },
  aeroEfficiency: {
    id: 'aeroEfficiency',
    name: 'Eficiência Aero (L/D)',
    shortName: 'Efic. Aero',
    weight: 8,
    category: 'aerodynamics',
    description: 'Razão sustentação/arrasto (Lift-to-Drag) do pacote aerodinâmico global.',
  },
  cooling: {
    id: 'cooling',
    name: 'Arrefecimento',
    shortName: 'Arrefecimento',
    weight: 5,
    category: 'systems',
    description: 'Eficiência de refrigeração da PU, caixas de freio e radiadores.',
  },
  weight: {
    id: 'weight',
    name: 'Distribuição de Peso / Lastro',
    shortName: 'Peso/Lastro',
    weight: 4,
    category: 'mechanics',
    description: 'Margem para lastro e proximidade do peso mínimo FIA 2026.',
  },
  reliability: {
    id: 'reliability',
    name: 'Confiabilidade do Chassi',
    shortName: 'Confiabilidade',
    weight: 5,
    category: 'systems',
    description: 'Resistência a falhas estruturais, fadiga de materiais e integridade do chassi.',
  },
}

// Metadados dos 8 componentes do carro
export interface TechnicalComponentMeta {
  id: TechnicalComponentId
  name: string
  category: 'aero' | 'chassis_dynamics'
  description: string
  affectedAttributes: TechnicalAttributeId[]
}

export const TECHNICAL_COMPONENT_METAS: Record<TechnicalComponentId, TechnicalComponentMeta> = {
  frontWing: {
    id: 'frontWing',
    name: 'Asa Dianteira',
    category: 'aero',
    description: 'Direcionamento de fluxo de ar para o assoalho e sustentação dianteira.',
    affectedAttributes: ['slowCorner', 'mediumCorner', 'fastCorner', 'topSpeed', 'aeroEfficiency'],
  },
  rearWing: {
    id: 'rearWing',
    name: 'Asa Traseira & DRS',
    category: 'aero',
    description: 'Downforce traseiro, eficiência do DRS e equilíbrio aerodinâmico posterior.',
    affectedAttributes: ['mediumCorner', 'fastCorner', 'topSpeed', 'aeroEfficiency', 'traction'],
  },
  floor: {
    id: 'floor',
    name: 'Assoalho (Efeito Solo)',
    category: 'aero',
    description: 'Geração primária de pressão negativa com estabilidade sob o assoalho.',
    affectedAttributes: [
      'slowCorner',
      'mediumCorner',
      'fastCorner',
      'aeroEfficiency',
      'tyreManagement',
    ],
  },
  diffuser: {
    id: 'diffuser',
    name: 'Difusor Traseiro',
    category: 'aero',
    description: 'Expansão de fluxo traseiro e extração de ar de alta eficiência.',
    affectedAttributes: ['slowCorner', 'mediumCorner', 'fastCorner', 'aeroEfficiency'],
  },
  sidepods: {
    id: 'sidepods',
    name: 'Sidepods & Radiadores',
    category: 'aero',
    description: 'Alimentação dos radiadores e direcionamento de fluxo para a traseira.',
    affectedAttributes: ['cooling', 'topSpeed', 'aeroEfficiency', 'weight'],
  },
  chassis: {
    id: 'chassis',
    name: 'Monocoque / Chassi',
    category: 'chassis_dynamics',
    description:
      'Célula de sobrevivência, rigidez torcional, distribuição de peso e centro de gravidade.',
    affectedAttributes: ['weight', 'reliability', 'slowCorner', 'acceleration'],
  },
  suspension: {
    id: 'suspension',
    name: 'Suspensão (Diant/Tras)',
    category: 'chassis_dynamics',
    description: 'Geometria de suspensão, controle de altura de rodagem e tração mecânica.',
    affectedAttributes: ['slowCorner', 'traction', 'tyreManagement', 'braking'],
  },
  brakes: {
    id: 'brakes',
    name: 'Freios & Dutos de Freio',
    category: 'chassis_dynamics',
    description: 'Conjunto de pinças, discos de carbono e dutos aerodinâmicos de refrigeração.',
    affectedAttributes: ['braking', 'cooling', 'tyreManagement', 'reliability'],
  },
}

// Mapa de atributos do carro com valores 0-100
export type TechnicalAttributesMap = Record<TechnicalAttributeId, number>

// Mapa de componentes com rating 0-100
export type ComponentRatingsMap = Record<TechnicalComponentId, number>

// 5. Separação Arquitetural: Design/Especificação vs Unidade Física
export interface ComponentSpecification {
  specId: string
  componentId: TechnicalComponentId
  generation: number // Geração (1, 2, 3...)
  specName: string // Ex: "Spec 1 - Base Bahrain"
  baseRating: number // 0-100 (qualidade e performance intrínseca do projeto)
  characteristics: {
    lowSpeedBias?: number // -5 a +5
    highSpeedBias?: number // -5 a +5
    coolingBias?: number // -5 a +5
    weightReductionKg?: number
  }
  costUsd: number
  rdLeadTimeRounds: number // Tempo de projeto
  introducedRound: number
}

export interface PhysicalComponentUnit {
  unitId: string
  specId: string // Referência à especificação de engenharia
  componentId: TechnicalComponentId
  carAssignment: 'car1' | 'car2' | 'stock' // Carro #1, Carro #2 ou Estoque
  condition: number // 0-100% integridade física
  wearPercentage: number // 0-100% desgaste de corrida
  damagePercentage: number // 0-100% dano estrutural acumulado
  mileageKm: number // Quilometragem total percorrida
  isAvailable: boolean // Pronto para montagem no final de semana
}

// Subsistema Power Unit (separado dos 8 componentes)
export interface PowerUnitSubsystem {
  supplier: 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi'
  powerRating: number // Potência
  reliabilityRating: number // Confiabilidade básica
  currentWear: number // Desgaste 0-100%
  poolEnginesUsed: number // Motores usados no teto de 4
  annualCostUsd: number
}

// 4. Resultados do cálculo central de um monoposto
export interface CarCalculationResult {
  teamKey: string
  teamName: string
  macroRating: number // Nota macro da planilha / jogo atual (0-100)
  calculatedOverall: number // Overall derivado dos 12 atributos e pesos
  balanceDelta: number // calculatedOverall - macroRating
  isBalanced: boolean // Se |balanceDelta| <= 1.5
  attributes: TechnicalAttributesMap
  componentRatings: ComponentRatingsMap
  powerUnitContribution: {
    topSpeedBonus: number
    accelerationBonus: number
    reliabilityBonus: number
  }
}

// Comparação entre Carro #1 e Carro #2
export interface CarComparisonData {
  car1: {
    overall: number
    attributes: TechnicalAttributesMap
    components: ComponentRatingsMap
    averageCondition: number
  }
  car2: {
    overall: number
    attributes: TechnicalAttributesMap
    components: ComponentRatingsMap
    averageCondition: number
  }
  differences: Partial<Record<TechnicalAttributeId, number>>
}

// 5. Preparação Estrutural para Desenvolvimento Futuro (Fase 3D - Item 7)
// Modelo de dados de Desenvolvimento preparado para specs, projetos, trade-offs, CFD, túnel e correlação, sem o pipeline completo
export interface DevelopmentTradeOff {
  attributeGained: TechnicalAttributeId
  gainAmount: number
  attributeSacrificed: TechnicalAttributeId
  sacrificeAmount: number
  rationale: string
}

export interface CfdWindTunnelAllocation {
  cfdHoursUsed: number
  cfdHoursMax: number
  windTunnelRunsUsed: number
  windTunnelRunsMax: number
  aeroEfficiencyBonus: number // Bônus gerado pela alocação no período ATR (Aerodynamic Testing Restrictions)
}

export interface CorrelationAnalysis {
  correlationRate: number // 0-100% (taxa de correlação túnel de vento vs pista real)
  simulatorFacilityLevel: number
  windTunnelFacilityLevel: number
  unforeseenAeroLossRisk: number // Risco de perda de correlação / porpoising imprevisto
}

export interface DevelopmentProjectBlueprint {
  projectId: string
  teamId: string
  targetComponent: TechnicalComponentId
  targetGeneration: number
  specName: string
  status: 'concepcao' | 'cfd_tunel' | 'fabricacao' | 'homologado' | 'cancelado'
  tradeOffs: DevelopmentTradeOff[]
  testingAllocation: CfdWindTunnelAllocation
  correlation: CorrelationAnalysis
  costUsd: number
  durationRounds: number
  roundsRemaining: number
  expectedDeltaRatings: Partial<Record<TechnicalComponentId, number>>
}
