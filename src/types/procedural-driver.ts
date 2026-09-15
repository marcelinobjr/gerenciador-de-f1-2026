/**
 * Modelos e Contratos Canônicos — Pilotos Procedurais, Scouting e Academia de Jovens
 * F1 Manager 2026 — Implementação Nº 4C
 *
 * Regras Centrais:
 * 1. ACADEMIA NÃO FABRICA CAMPEÕES: Procura, avalia e desenvolve.
 * 2. POTENCIAL REAL É OCULTO: O jogador administra incerteza através de perceivedPotential e evaluationConfidence.
 * 3. PILOTO PROCEDURAL É ENTIDADE PERMANENTE: Se dispensado, nunca é excluído — permanece no save.
 * 4. IA NÃO POSSUI ONISCIÊNCIA: Usa apenas atributos conhecidos, perceivedPotential e confiança.
 * 5. IMAGEM É UM ASSET DO PILOTO: Driver Entity é desacoplado de Visual Assets.
 */

import { DriverLicenseStatus } from './driver-development'

export type ProceduralCareerStatus =
  | 'prospect'
  | 'academy'
  | 'test_driver'
  | 'reserve'
  | 'f1_driver'
  | 'free_agent'
  | 'retired'

export type JuniorCategory = 'karting' | 'f4' | 'regional' | 'f3' | 'f2' | 'f1_academy'

export type DriverPersonalityTrait =
  | 'focado'
  | 'ambicioso'
  | 'metodico'
  | 'impulsivo'
  | 'resiliente'
  | 'calculista'
  | 'leal'
  | 'competitivo'

export type DrivingStyle =
  | 'agressivo'
  | 'suave'
  | 'tecnico'
  | 'qualificacao'
  | 'gestao_pneus'
  | 'chuva'
  | 'defensivo'
  | 'adaptavel'

/**
 * Personalidade psicológica com sementes quantitativas (0-100)
 */
export interface DriverPsychologyProfile {
  ambition: number // 0-100: pressão por promoção, exigência salarial
  loyalty: number // 0-100: facilidade de renovação e permanência
  aggression: number // 0-100: ultrapassagens arrojadas vs risco de incidentes
  cooperation: number // 0-100: trabalho em equipe, ordens de equipe, testes
  pressureTolerance: number // 0-100: estabilidade emocional em finais e disputas
  professionalism: number // 0-100: dedicação a feedback e treinos
  adaptability: number // 0-100: rapidez na transição entre categorias e carros
  dominantTrait: DriverPersonalityTrait
}

/**
 * Histórico de temporada nas categorias de formação ou F1
 */
export interface CareerSeasonHistory {
  year: number
  category: JuniorCategory | 'f1'
  teamName: string
  championshipPosition: number
  races: number
  wins: number
  podiums: number
  poles: number
  points: number
  bestFinish: number
  notes?: string
}

/**
 * Marcos e transferências de carreira permanentes
 */
export interface CareerMilestone {
  date: string
  type:
    | 'descoberto'
    | 'entrada_academia'
    | 'promocao_categoria'
    | 'designado_teste'
    | 'homologacao_conquistada'
    | 'reserva_contratado'
    | 'estreia_f1'
    | 'vitoria_f1'
    | 'podio_f1'
    | 'dispensado'
    | 'transferencia'
    | 'aposentadoria'
  teamId?: string
  teamName: string
  description: string
}

/**
 * Atributos visuais para geração e persistência de identidade
 */
export interface DriverVisualAssetIdentity {
  visualIdentityId: string // UUID permanente do piloto para consistência
  portraitAssetId?: string
  posterAssetId?: string
  gender: 'male' | 'female'
  skinTone: 'fair' | 'light' | 'medium' | 'olive' | 'brown' | 'dark'
  hairStyle: 'short' | 'curly' | 'wavy' | 'buzz' | 'ponytail' | 'straight'
  hairColor: 'black' | 'dark_brown' | 'brown' | 'blonde' | 'auburn' | 'red'
  eyeColor: 'brown' | 'black' | 'blue' | 'green' | 'hazel'
  facialFeatures?: string
  baseAge: number
  visualSeed: number
  currentPosterTeamId?: string
  lastGenerationAttempt?: string
  generationStatus: 'idle' | 'pending' | 'ready' | 'fallback'
}

/**
 * Modelo completo de metadados procedurais persistidos em driver.procedural_data
 */
export interface ProceduralDriverMetadata {
  driverId: string
  firstName: string
  lastName: string
  fullName: string
  displayName: string
  nationality: string
  countryFlag: string
  formationRegion: 'europa' | 'america_latina' | 'america_norte' | 'asia' | 'oceania' | 'africa'
  dateOfBirth: string
  entryYear: number
  academyOriginTeamId?: string
  currentAcademyTeamId?: string
  juniorCategory: JuniorCategory
  careerStatus: ProceduralCareerStatus

  // Potencial real OCULTO
  truePotential: number // 50-99 (NUNCA exposto na UI normal nem payload público)
  growthRate: 'precoce' | 'normal' | 'tardio' | 'irregular'
  peakAge: number // 25-30 anos

  // Estilo de pilotagem e pontos fortes/fracos (derivados de atributos)
  drivingStyle: DrivingStyle
  strengths: string[]
  weaknesses: string[]

  // Psicologia e personalidade
  psychology: DriverPsychologyProfile

  // Identidade Visual desacoplada
  visualIdentity: DriverVisualAssetIdentity

  // Histórico de Carreira acumulativo
  seasonsHistory: CareerSeasonHistory[]
  milestones: CareerMilestone[]

  // Estatísticas de F1 se chegar ao topo
  f1CareerStats: {
    gps: number
    wins: number
    podiums: number
    poles: number
    points: number
    fastestLaps: number
    championships: number
  }

  // Scouting data acumulado por equipe (teamId -> scout info)
  scoutingRecords: Record<
    string,
    {
      perceivedPotential: number
      evaluationConfidence: number // 0 a 100
      knownAttributes: Partial<{
        speed: number
        consistency: number
        rain: number
        defense: number
        technicalFeedback: number
      }>
      lastEvaluatedRound?: number
      evaluationsCount: number
      scoutingNotes?: string
    }
  >
}

/**
 * Visão pública de um prospect com Fog-of-War aplicado
 * NUNCA contém truePotential nem dados não revelados
 */
export interface ProspectScoutingCardViewModel {
  driverId: string
  name: string
  age: number
  nationality: string
  countryFlag: string
  juniorCategory: JuniorCategory
  categoryLabel: string
  currentTeamOrAcademyName?: string
  isLinkedToPlayerAcademy: boolean
  isLinkedToRivalAcademy: boolean
  visualIdentityId: string
  posterUrl?: string
  gender: 'male' | 'female'

  // Estimativas com Fog-of-War
  perceivedPotentialLabel: 'Baixo' | 'Médio' | 'Promissor' | 'Muito Alto' | 'Excepcional'
  perceivedPotentialValue: number
  evaluationConfidence: number // 0 a 100%
  confidenceGrade: 'Muito Baixa' | 'Baixa' | 'Média' | 'Alta' | 'Muito Alta'

  // Atributos revelados conforme a confiança do scouting
  perceivedSpeed?: { label: string; value?: number; range?: string }
  perceivedConsistency?: { label: string; value?: number; range?: string }
  perceivedRain?: { label: string; value?: number; range?: string }
  perceivedDefense?: { label: string; value?: number; range?: string }
  perceivedFeedback?: { label: string; value?: number; range?: string }

  drivingStyle: string
  strengths: string[]
  weaknesses: string[]
  personalitySummary: string

  // Histórico recente
  lastSeasonSummary?: string
  evaluationsDone: number
  careerStatus: ProceduralCareerStatus
  licenseStatus: DriverLicenseStatus
}

/**
 * Interface de Provedor Desacoplado de Imagem (VisualGenerationProvider)
 */
export interface VisualGenerationProvider {
  id: string
  name: string
  isAvailable(): Promise<boolean>
  generateDriverPoster(params: {
    driverId: string
    visualIdentity: DriverVisualAssetIdentity
    teamName: string
    teamColor: string
  }): Promise<{ success: boolean; assetUrl?: string; error?: string }>
}
