/**
 * Sistema de Superlicença & Homologação FIA / MBJ
 * F1 2026 Manager
 */

export type HomologationStatus = 'formacao' | 'homologacao' | 'elegivel'

export interface SuperlicensePointsCategoryTable {
  [position: number]: number
}

// Tabela Oficial de Pontos FIA para concessão de Superlicença
export const FIA_SUPERLICENSE_POINTS_TABLE: Record<string, SuperlicensePointsCategoryTable> = {
  f2: {
    1: 40,
    2: 40,
    3: 40,
    4: 30,
    5: 20,
    6: 10,
    7: 8,
    8: 6,
    9: 4,
    10: 3,
  },
  f3: {
    1: 30,
    2: 25,
    3: 20,
    4: 15,
    5: 12,
    6: 9,
    7: 7,
    8: 5,
    9: 3,
    10: 2,
  },
  indycar: {
    1: 40,
    2: 30,
    3: 20,
    4: 10,
    5: 8,
    6: 6,
    7: 4,
    8: 3,
    9: 2,
    10: 1,
  },
  formula_e: {
    1: 30,
    2: 25,
    3: 20,
    4: 10,
    5: 8,
    6: 6,
    7: 4,
    8: 3,
    9: 2,
    10: 1,
  },
  f1_academy: {
    1: 15,
    2: 12,
    3: 10,
    4: 7,
    5: 5,
  },
}

// Regras de adaptação à F1
export const ADAPTATION_RULES = {
  target: 80,
  rates: {
    rookieTitular: 14.0,
    reserveWithFP: 8.0,
    reserveBench: 3.5,
  },
} as const

// Meta de homologação FIA para pilotos em homologação
export const HOMOLOGATION_FP_SESSIONS_REQUIRED = 2 // 2 sessões TL1 (mínimo 100 km cada)

export interface EligibilityResult {
  status: HomologationStatus
  label: string
  description: string
  canSignTitular: boolean
  canSignReserve: boolean
  requiresHomologation: boolean
}

/**
 * Calcula o status de elegibilidade regulamentar FIA do piloto:
 * - Menor de 18: 'formacao' (bloqueado para titular, restrito a Academia/reserva)
 * - 18+ anos, 0 corridas na F1 e menos de 40 pontos de superlicença: 'homologacao'
 * - 18+ anos com >= 40 pontos de superlicença OU com corridas prévias de F1: 'elegivel'
 */
export function calcularElegibilidade(
  idade: number,
  pontosSuperlicenca: number = 0,
  corridasF1: number = 0,
): HomologationStatus {
  if (idade < 18) {
    return 'formacao'
  }
  if (corridasF1 > 0 || pontosSuperlicenca >= 40) {
    return 'elegivel'
  }
  return 'homologacao'
}

/**
 * Retorna dados detalhados da elegibilidade para renderização na UI
 */
export function getElegibilidadeDetalhada(
  idade: number,
  pontosSuperlicenca: number = 0,
  corridasF1: number = 0,
  homologationSessionsDone: number = 0,
): EligibilityResult {
  const status = calcularElegibilidade(idade, pontosSuperlicenca, corridasF1)

  if (status === 'formacao') {
    return {
      status: 'formacao',
      label: 'Piloto em Formação / Academia',
      description:
        'Menor de 18 anos. Elegível apenas para desenvolvimento e programa de jovens talentos.',
      canSignTitular: false,
      canSignReserve: true,
      requiresHomologation: true,
    }
  }

  if (status === 'homologacao') {
    const sDone = Math.min(HOMOLOGATION_FP_SESSIONS_REQUIRED, Math.max(0, homologationSessionsDone))
    return {
      status: 'homologacao',
      label: 'Homologação FIA Pendente',
      description: `Necessita cumprir ${sDone}/${HOMOLOGATION_FP_SESSIONS_REQUIRED} sessões oficiais de TL1 (mín. 100 km) para obter liberação definitiva da FIA.`,
      canSignTitular: false,
      canSignReserve: true,
      requiresHomologation: true,
    }
  }

  return {
    status: 'elegivel',
    label: 'Totalmente Elegível (Superlicença FIA)',
    description:
      'Atende a todos os critérios da FIA e requisitos regulamentares para vaga de titular ou reserva.',
    canSignTitular: true,
    canSignReserve: true,
    requiresHomologation: false,
  }
}

/**
 * Obtém os pontos de superlicença ganhos conforme categoria e posição no campeonato
 */
export function getSuperlicensePointsGained(category: string, position: number): number {
  const table = FIA_SUPERLICENSE_POINTS_TABLE[category]
  if (!table) return 0
  return table[position] ?? 0
}
