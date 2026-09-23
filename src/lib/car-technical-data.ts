/**
 * Dados Estruturados do Modelo Técnico do Carro - F1 Manager 2026
 *
 * Mapeamento fiel das 6 abas da planilha técnica oficial:
 * 1_Equipes: Atributos macro por equipe, motor e classificação esportiva
 * 2_Atributos_Carro: Metadados dos 12 atributos técnicos e pesos oficiais (soma 100%)
 * 3_Componentes: Os 8 componentes e a matriz de influência em cada atributo técnico
 * 4_Especificacoes: Especificações iniciais (Gen 1) das peças por equipe
 * 5_Carro_Final: Ratings calculados de cada atributo e overall derivado
 * 6_Balanceamento: Auditoria de deltas macro vs calculado (|delta| <= 1.5 aceitável; > 1.5 revisar)
 */

import {
  TechnicalAttributeId,
  TechnicalComponentId,
  TechnicalAttributesMap,
  ComponentRatingsMap,
  PowerUnitSubsystem,
  ComponentSpecification,
} from '@/types/car-technical-model'

// Pesos dos 12 atributos para o cálculo do Overall (Aba 2 - soma 100%)
export const TECHNICAL_ATTRIBUTE_WEIGHTS: Record<TechnicalAttributeId, number> = {
  slowCorner: 0.12,
  mediumCorner: 0.12,
  fastCorner: 0.12,
  topSpeed: 0.1,
  acceleration: 0.08,
  braking: 0.08,
  traction: 0.08,
  tyreManagement: 0.08,
  aeroEfficiency: 0.08,
  cooling: 0.05,
  weight: 0.04,
  reliability: 0.05,
}

// Matriz de Influência Componente × Atributo (Aba 3)
// Representa quanto cada componente contribui para os 12 atributos do carro.
// As frações por atributo somam 1.0 (ou 100% da contribuição do chassi/aero).
export const COMPONENT_INFLUENCE_MATRIX: Record<
  TechnicalAttributeId,
  Partial<Record<TechnicalComponentId, number>>
> = {
  // Curvas de Baixa: Forte influência da Asa Dianteira, Assoalho, Chassi e Suspensão
  slowCorner: {
    frontWing: 0.25,
    floor: 0.25,
    chassis: 0.15,
    suspension: 0.25,
    diffuser: 0.1,
  },
  // Curvas de Média: Assoalho, Difusor, Asas Dianteira e Traseira
  mediumCorner: {
    frontWing: 0.2,
    rearWing: 0.2,
    floor: 0.35,
    diffuser: 0.15,
    sidepods: 0.1,
  },
  // Curvas de Alta: Downforce puro de Assoalho, Difusor e Asas
  fastCorner: {
    frontWing: 0.2,
    rearWing: 0.25,
    floor: 0.35,
    diffuser: 0.2,
  },
  // Velocidade Final: Eficiência de arrasto (Asa Traseira, Dianteira, Sidepods e Difusor)
  topSpeed: {
    rearWing: 0.35,
    frontWing: 0.2,
    sidepods: 0.25,
    diffuser: 0.1,
    floor: 0.1,
  },
  // Aceleração: Tracionamento, rigidez do chassi e peso
  acceleration: {
    chassis: 0.35,
    suspension: 0.35,
    floor: 0.15,
    rearWing: 0.15,
  },
  // Frenagem: Conjunto de freios, suspensão e estabilidade do chassi
  braking: {
    brakes: 0.5,
    suspension: 0.3,
    frontWing: 0.1,
    chassis: 0.1,
  },
  // Tração: Geometria de suspensão, asa traseira e rigidez
  traction: {
    suspension: 0.45,
    rearWing: 0.25,
    floor: 0.15,
    chassis: 0.15,
  },
  // Gestão de Pneus: Equilíbrio mecânico da suspensão, freios e sustentação suave do assoalho
  tyreManagement: {
    suspension: 0.35,
    brakes: 0.25,
    floor: 0.2,
    chassis: 0.2,
  },
  // Eficiência Aero (L/D): Harmonia global do pacote aerodinâmico
  aeroEfficiency: {
    floor: 0.3,
    diffuser: 0.2,
    rearWing: 0.2,
    frontWing: 0.2,
    sidepods: 0.1,
  },
  // Arrefecimento: Sidepods, radiadores e dutos de freio
  cooling: {
    sidepods: 0.6,
    brakes: 0.25,
    chassis: 0.15,
  },
  // Distribuição de Peso: Monocoque/Chassi, Sidepods e Suspensão
  weight: {
    chassis: 0.5,
    sidepods: 0.25,
    suspension: 0.25,
  },
  // Confiabilidade: Monocoque, Freios e Suspensão
  reliability: {
    chassis: 0.4,
    brakes: 0.3,
    suspension: 0.3,
  },
}

// Aba 1: Macro Ratings das 12 Equipes do Grid 2026
export interface TeamTechnicalProfile {
  teamKey: string
  teamName: string
  macroRating: number // Nota macro consolidada (0-100)
  engineSupplier: 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi'
  // Ratings iniciais dos 8 componentes (Aba 4)
  initialComponents: ComponentRatingsMap
  // Ratings de referência esperados para os 12 atributos (Aba 5)
  expectedAttributes?: Partial<TechnicalAttributesMap>
}

export const OFFICIAL_TEAMS_TECHNICAL_DATA: Record<string, TeamTechnicalProfile> = {
  mercedes: {
    teamKey: 'mercedes',
    teamName: 'Mercedes-AMG Petronas',
    macroRating: 100,
    engineSupplier: 'Mercedes',
    initialComponents: {
      frontWing: 99,
      rearWing: 100,
      floor: 100,
      diffuser: 99,
      sidepods: 98,
      chassis: 99,
      suspension: 99,
      brakes: 98,
    },
  },
  ferrari: {
    teamKey: 'ferrari',
    teamName: 'Scuderia Ferrari',
    macroRating: 91,
    engineSupplier: 'Ferrari',
    initialComponents: {
      frontWing: 91,
      rearWing: 92,
      floor: 90,
      diffuser: 91,
      sidepods: 89,
      chassis: 92,
      suspension: 90,
      brakes: 92,
    },
  },
  mclaren: {
    teamKey: 'mclaren',
    teamName: 'McLaren F1 Team',
    macroRating: 88,
    engineSupplier: 'Mercedes',
    initialComponents: {
      frontWing: 89,
      rearWing: 87,
      floor: 88,
      diffuser: 88,
      sidepods: 87,
      chassis: 88,
      suspension: 87,
      brakes: 87,
    },
  },
  redbull: {
    teamKey: 'redbull',
    teamName: 'Red Bull Racing',
    macroRating: 84,
    engineSupplier: 'Ford',
    initialComponents: {
      frontWing: 86,
      rearWing: 84,
      floor: 85,
      diffuser: 85,
      sidepods: 83,
      chassis: 84,
      suspension: 83,
      brakes: 83,
    },
  },
  racingbulls: {
    teamKey: 'racingbulls',
    teamName: 'Visa Cash App RB',
    macroRating: 63,
    engineSupplier: 'Ford',
    initialComponents: {
      frontWing: 64,
      rearWing: 63,
      floor: 63,
      diffuser: 62,
      sidepods: 63,
      chassis: 64,
      suspension: 63,
      brakes: 62,
    },
  },
  alpine: {
    teamKey: 'alpine',
    teamName: 'Alpine F1 Team',
    macroRating: 61,
    engineSupplier: 'Mercedes',
    initialComponents: {
      frontWing: 62,
      rearWing: 60,
      floor: 61,
      diffuser: 61,
      sidepods: 62,
      chassis: 60,
      suspension: 61,
      brakes: 60,
    },
  },
  audi: {
    teamKey: 'audi',
    teamName: 'Audi F1 Team',
    macroRating: 55,
    engineSupplier: 'Audi',
    initialComponents: {
      frontWing: 56,
      rearWing: 55,
      floor: 55,
      diffuser: 54,
      sidepods: 55,
      chassis: 56,
      suspension: 55,
      brakes: 54,
    },
  },
  haas: {
    teamKey: 'haas',
    teamName: 'Haas F1 Team',
    macroRating: 48,
    engineSupplier: 'Ferrari',
    initialComponents: {
      frontWing: 49,
      rearWing: 48,
      floor: 47,
      diffuser: 48,
      sidepods: 48,
      chassis: 49,
      suspension: 47,
      brakes: 48,
    },
  },
  williams: {
    teamKey: 'williams',
    teamName: 'Williams Racing',
    macroRating: 42,
    engineSupplier: 'Mercedes',
    initialComponents: {
      frontWing: 43,
      rearWing: 42,
      floor: 41,
      diffuser: 42,
      sidepods: 43,
      chassis: 41,
      suspension: 42,
      brakes: 42,
    },
  },
  astonmartin: {
    teamKey: 'astonmartin',
    teamName: 'Aston Martin Aramco',
    macroRating: 37,
    engineSupplier: 'Honda',
    initialComponents: {
      frontWing: 38,
      rearWing: 37,
      floor: 37,
      diffuser: 36,
      sidepods: 38,
      chassis: 37,
      suspension: 36,
      brakes: 37,
    },
  },
  andretti: {
    teamKey: 'andretti',
    teamName: 'Andretti Global',
    macroRating: 35,
    engineSupplier: 'Honda',
    initialComponents: {
      frontWing: 36,
      rearWing: 35,
      floor: 35,
      diffuser: 34,
      sidepods: 36,
      chassis: 35,
      suspension: 34,
      brakes: 35,
    },
  },
  cadillac: {
    teamKey: 'cadillac',
    teamName: 'Cadillac F1 Team',
    macroRating: 30,
    engineSupplier: 'Ferrari',
    initialComponents: {
      frontWing: 31,
      rearWing: 30,
      floor: 30,
      diffuser: 29,
      sidepods: 30,
      chassis: 31,
      suspension: 30,
      brakes: 29,
    },
  },
}

// Subsistemas de Motores (Power Unit) 2026
export const OFFICIAL_POWER_UNITS: Record<string, PowerUnitSubsystem> = {
  Mercedes: {
    supplier: 'Mercedes',
    powerRating: 98,
    reliabilityRating: 96,
    currentWear: 0,
    poolEnginesUsed: 1,
    annualCostUsd: 22000000,
  },
  Ferrari: {
    supplier: 'Ferrari',
    powerRating: 97,
    reliabilityRating: 94,
    currentWear: 0,
    poolEnginesUsed: 1,
    annualCostUsd: 21500000,
  },
  Honda: {
    supplier: 'Honda',
    powerRating: 92,
    reliabilityRating: 91,
    currentWear: 0,
    poolEnginesUsed: 1,
    annualCostUsd: 19000000,
  },
  Ford: {
    supplier: 'Ford',
    powerRating: 94,
    reliabilityRating: 90,
    currentWear: 0,
    poolEnginesUsed: 1,
    annualCostUsd: 20000000,
  },
  Audi: {
    supplier: 'Audi',
    powerRating: 88,
    reliabilityRating: 89,
    currentWear: 0,
    poolEnginesUsed: 1,
    annualCostUsd: 18000000,
  },
}

// Helper para gerar componentes padrão a partir de um rating macro
export function generateDefaultComponentsFromMacro(macroRating: number): ComponentRatingsMap {
  const base = Math.max(10, Math.min(100, Math.round(macroRating)))
  return {
    frontWing: Math.min(100, base + 1),
    rearWing: base,
    floor: Math.max(10, base - 1),
    diffuser: base,
    sidepods: base,
    chassis: Math.min(100, base + 1),
    suspension: base,
    brakes: Math.max(10, base - 1),
  }
}

// Helper para gerar especificações de fábrica (Gen 1)
export function createDefaultSpecifications(
  teamKey: string,
  components: ComponentRatingsMap,
): ComponentSpecification[] {
  const componentKeys = Object.keys(components) as TechnicalComponentId[]
  return componentKeys.map((cId) => ({
    specId: `${teamKey}_${cId}_spec1`,
    componentId: cId,
    generation: 1,
    specName: `Spec 1.0 - Base 2026`,
    baseRating: components[cId],
    characteristics: {
      lowSpeedBias: 0,
      highSpeedBias: 0,
      coolingBias: 0,
    },
    costUsd: 2500000,
    rdLeadTimeRounds: 3,
    introducedRound: 1,
  }))
}
