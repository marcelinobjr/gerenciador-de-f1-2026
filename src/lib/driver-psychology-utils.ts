import {
  DriverPersonalityTraits,
  PersonalityDescriptor,
  DriverEmotionalState,
  DriverRelationships,
  DriverToTPRelationship,
  DriverToTeamRelationship,
  DriverToTeammateRelationship,
  TeammateDynamicStatus,
  DriverMemoryEvent,
  DriverPromise,
} from '@/types/driver-psychology'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { DriverModel } from '@/types/f1'

/**
 * Mapeamento e fallback para Personalidade Canônica dos 9 Traits:
 * ambition, loyalty, aggression, cooperation, pressureTolerance, professionalism, adaptability, ego, resilience.
 */
export function getDriverPersonalityTraits(
  driver: Partial<DriverModel> & { name?: string; procedural_data?: any },
): DriverPersonalityTraits {
  // 1. Procedural data (da Implementação 4C)
  const procData = driver.procedural_data
  if (procData?.psychology) {
    const p = procData.psychology
    return {
      ambition: clamp(p.ambition ?? 75),
      loyalty: clamp(p.loyalty ?? 75),
      aggression: clamp(p.aggression ?? 70),
      cooperation: clamp(p.cooperation ?? 75),
      pressureTolerance: clamp(p.pressureTolerance ?? 75),
      professionalism: clamp(p.professionalism ?? 80),
      adaptability: clamp(p.adaptability ?? 75),
      ego: clamp(p.ego ?? Math.round((p.ambition || 75) * 0.9)),
      resilience: clamp(p.resilience ?? Math.round(((p.pressureTolerance || 75) + 70) / 2)),
    }
  }

  // 2. Busca na base oficial MBJ 2026
  const mbj = MBJ_2026_PILOTS.find(
    (p) =>
      p.id === driver.id ||
      (driver.name && p.name.toLowerCase() === driver.name.toLowerCase()) ||
      (driver.name && p.name.toLowerCase().includes(driver.name.toLowerCase())),
  )

  if (mbj) {
    // Estimativas coerentes com histórico do piloto
    const ambition = mbj.ambition ?? 80
    const loyalty = mbj.loyalty ?? 80
    const aggression = mbj.aggressiveness ?? 70
    const pressureTolerance = mbj.pressure ?? 80
    const professionalism = mbj.professionalism ?? 85
    const adaptability = mbj.adaptability ?? 80
    const resilience = mbj.resilience ?? mbj.defense ?? 80

    // Ego derivado do status de campeão/vitórias e ambição
    let ego = Math.round(ambition * 0.85 + (mbj.reputation ? mbj.reputation * 0.15 : 10))
    if (
      mbj.name.includes('Verstappen') ||
      mbj.name.includes('Hamilton') ||
      mbj.name.includes('Alonso')
    ) {
      ego = Math.max(90, ego)
    }

    // Cooperação estimada pelo papel e personalidade conhecida
    let cooperation = 75
    if (
      mbj.name.includes('Bottas') ||
      mbj.name.includes('Pérez') ||
      mbj.name.includes('Hülkenberg')
    ) {
      cooperation = 88
    } else if (mbj.name.includes('Verstappen') || mbj.name.includes('Alonso')) {
      cooperation = 65
    }

    return {
      ambition: clamp(ambition),
      loyalty: clamp(loyalty),
      aggression: clamp(aggression),
      cooperation: clamp(cooperation),
      pressureTolerance: clamp(pressureTolerance),
      professionalism: clamp(professionalism),
      adaptability: clamp(adaptability),
      ego: clamp(ego),
      resilience: clamp(resilience),
    }
  }

  // 3. Fallback neutro para outros pilotos/categorias
  const speed = driver.speed || 75
  const consistency = driver.consistency || 75
  return {
    ambition: clamp(Math.round(speed * 0.95)),
    loyalty: 75,
    aggression: clamp(Math.round(speed * 0.85)),
    cooperation: 78,
    pressureTolerance: clamp(consistency),
    professionalism: 80,
    adaptability: 75,
    ego: clamp(Math.round(speed * 0.8)),
    resilience: clamp(consistency),
  }
}

/**
 * Retorna descritores qualitativos baseados nos traços permanentes
 */
export function getPersonalityDescriptors(
  traits: DriverPersonalityTraits,
): PersonalityDescriptor[] {
  const descriptors: PersonalityDescriptor[] = []

  if (traits.ambition >= 88) descriptors.push('Altamente Ambicioso')
  if (traits.loyalty >= 85) descriptors.push('Fiel e Leal')
  if (traits.aggression >= 82) descriptors.push('Agressivo nas Pistas')
  if (traits.cooperation >= 85) descriptors.push('Espírito Coletivo')
  if (traits.pressureTolerance >= 88) descriptors.push('Frio sob Pressão')
  if (traits.professionalism >= 90) descriptors.push('Profissional Exemplar')
  if (traits.adaptability >= 88) descriptors.push('Camaleão Técnico')
  if (traits.ego >= 88) descriptors.push('Ego Elevado / Status First')
  if (traits.resilience >= 88) descriptors.push('Resiliente Inabalável')

  if (descriptors.length === 0) {
    descriptors.push('Equilibrado e Metódico')
    descriptors.push('Competidor Nato')
  }

  return descriptors.slice(0, 4)
}

/**
 * Cria o estado emocional padrão (baseline) modulado pelos traços do piloto
 */
export function createDefaultEmotionalState(
  traits: DriverPersonalityTraits,
  existingMorale?: number,
): DriverEmotionalState {
  const moraleBase = existingMorale && existingMorale > 0 ? existingMorale : 75
  return {
    confidence: clamp(Math.round(moraleBase * 0.6 + traits.pressureTolerance * 0.4)),
    motivation: clamp(Math.round(traits.ambition * 0.4 + moraleBase * 0.6)),
    satisfaction: clamp(moraleBase),
    frustration: clamp(Math.round(Math.max(10, 100 - moraleBase) * 0.7)),
    pressure: clamp(Math.round(Math.max(10, 100 - traits.pressureTolerance) * 0.6)),
    teamTrust: clamp(Math.round(moraleBase * 0.5 + traits.loyalty * 0.5)),
    emotionalTension: 15,
  }
}

/**
 * Cria as relações padrão (neutras/estáveis) para um piloto com a equipe atual
 */
export function createDefaultRelationships(
  traits: DriverPersonalityTraits,
  teammate?: { id: string; name: string } | null,
): DriverRelationships {
  const teamPrincipal: DriverToTPRelationship = {
    trust: clamp(Math.round(70 + traits.loyalty * 0.1)),
    respect: clamp(Math.round(72 + traits.professionalism * 0.1)),
    confidence: 75,
    personalLoyalty: clamp(Math.round(65 + traits.loyalty * 0.15)),
  }

  const team: DriverToTeamRelationship = {
    belonging: clamp(Math.round(70 + traits.loyalty * 0.1)),
    sportingTrust: 75,
    technicalTrust: 75,
    satisfaction: 75,
    desireToStay: clamp(Math.round(65 + traits.loyalty * 0.2)),
  }

  let teammateRel: DriverToTeammateRelationship | undefined
  if (teammate) {
    const respect = clamp(Math.round(75 + traits.professionalism * 0.1))
    const cooperation = clamp(Math.round(traits.cooperation))
    const rivalry = clamp(Math.round(traits.ambition * 0.75))
    const tension = 15
    teammateRel = {
      teammateId: teammate.id,
      teammateName: teammate.name,
      respect,
      cooperation,
      rivalry,
      tension,
      status: deriveTeammateStatus(respect, cooperation, rivalry, tension),
    }
  }

  return {
    teamPrincipal,
    team,
    teammate: teammateRel,
    historicalTeams: {},
  }
}

/**
 * Deriva o estado descritivo da relação entre companheiros
 * Partners, Respectful, Competitive, Tense, Rivals, Hostile
 */
export function deriveTeammateStatus(
  respect: number,
  cooperation: number,
  rivalry: number,
  tension: number,
): TeammateDynamicStatus {
  if (tension >= 75 || (rivalry >= 85 && cooperation < 40)) {
    return 'Hostile'
  }
  if (tension >= 55 || (rivalry >= 75 && cooperation < 55)) {
    return 'Tense'
  }
  if (rivalry >= 70) {
    return 'Rivals'
  }
  if (rivalry >= 55) {
    return 'Competitive'
  }
  if (cooperation >= 75 && respect >= 75) {
    return 'Partners'
  }
  return 'Respectful'
}

/**
 * Converte valor quantitativo (0-100) em rótulo qualitativo amigável
 */
export function formatQualitativeState(
  value: number,
  type: 'satisfaction' | 'confidence' | 'motivation' | 'pressure' | 'frustration' | 'trust',
): string {
  const v = clamp(value)
  if (type === 'pressure' || type === 'frustration') {
    if (v >= 80) return 'Crítica / Muito Alta'
    if (v >= 60) return 'Alta'
    if (v >= 40) return 'Moderada'
    if (v >= 20) return 'Baixa'
    return 'Mínima / Nenhuma'
  }

  if (v >= 85) return 'Muito Alto / Excelente'
  if (v >= 70) return 'Alto / Satisfeito'
  if (v >= 50) return 'Neutro / Estável'
  if (v >= 35) return 'Baixo / Preocupante'
  return 'Muito Baixo / Crítico'
}

/**
 * Converte delta de relação e estado com limite rígido 0-100
 */
export function clamp(val: number, min = 0, max = 100): number {
  if (Number.isNaN(val)) return min
  return Math.max(min, Math.min(max, Math.round(val)))
}

/**
 * Estrutura serializável armazenada no banco ou cache de psicologia
 */
export interface DriverPsychologyDataBundle {
  driverId: string
  traits: DriverPersonalityTraits
  emotionalState: DriverEmotionalState
  relationships: DriverRelationships
  memories: DriverMemoryEvent[]
  promises: DriverPromise[]
  lastProcessedRound?: number
  lastProcessedSeason?: number
}
