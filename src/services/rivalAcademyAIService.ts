/**
 * IA das Academias Rivais (RivalAcademyAIService)
 * F1 Manager 2026 — Implementação Nº 4C
 *
 * Princípios Invioláveis:
 * 1. A IA NUNCA CONSULTA TRUEPOTENTIAL.
 *    Decisões de contratação, dispensa e promoção usam apenas perceivedPotential,
 *    evaluationConfidence, atributos conhecidos e histórico.
 * 2. A IA TAMBÉM ERRA:
 *    Superestima medianos, dispensa futuros campeões, perde talentos para rivais.
 * 3. Dinâmica de Mercado:
 *    Se um piloto for dispensado por uma academia, rivais com vagas e interesse podem contratá-lo.
 */

import { DriverModel, TeamModel } from '@/types/f1'
import { ProceduralDriverMetadata } from '@/types/procedural-driver'
import { infrastructureCapabilityService } from './infrastructureCapabilityService'

export interface RivalAcademyDecision {
  action: 'hire' | 'release' | 'promote_test' | 'promote_reserve' | 'pass'
  targetTeamId: string
  targetTeamName: string
  driverId: string
  driverName: string
  reasoning: string
}

export class RivalAcademyAIService {
  /**
   * Avalia um piloto livre ou candidato sob a ótica de uma equipe rival.
   * ESTA FUNÇÃO NUNCA LÊ true_potential NEM metadata.truePotential!
   */
  public evaluateCandidateForRival(
    rivalTeam: TeamModel,
    driver: DriverModel,
    currentRivalAcademyDriverIds: string[] = [],
  ): RivalAcademyDecision {
    const meta = (driver as any).procedural_data as ProceduralDriverMetadata | undefined

    // 1. A IA consulta APENAS perceived_potential e evaluation_confidence
    const perceived = (driver as any).perceived_potential || 70
    const confidence = (driver as any).evaluation_confidence || 40
    const speed = driver.speed || 60
    const age = driver.age || 18

    // Vagas disponíveis na academia rival (limite médio de 3 a 4 pilotos por equipe)
    const audit = infrastructureCapabilityService.auditInfrastructure(rivalTeam)
    const maxSlots = Math.max(
      2,
      Math.min(5, Math.round(audit.capabilities.prospectDiscoveryCapacity / 20)),
    )

    const isFull = currentRivalAcademyDriverIds.length >= maxSlots

    // A IA erra conforme sua evaluationAccuracy da infraestrutura:
    // Uma equipe com baixa evaluationAccuracy confia em impressões superficiais
    const aiConfidenceThreshold = Math.max(
      35,
      75 - Math.round(audit.capabilities.evaluationAccuracy * 0.3),
    )

    if (isFull) {
      return {
        action: 'pass',
        targetTeamId: rivalTeam.id,
        targetTeamName: rivalTeam.name,
        driverId: driver.id,
        driverName: driver.name,
        reasoning: `Programa de formação da ${rivalTeam.name} já atingiu a capacidade máxima (${currentRivalAcademyDriverIds.length}/${maxSlots}).`,
      }
    }

    // Critério de interesse baseado em Perceived Potential
    // Equipes de topo (Ferrari, McLaren, Red Bull) são mais exigentes
    const isTopTeam = rivalTeam.chassis_level > 80
    const minPerceivedRequired = isTopTeam ? 80 : 72

    if (perceived >= minPerceivedRequired && confidence >= aiConfidenceThreshold && age <= 21) {
      return {
        action: 'hire',
        targetTeamId: rivalTeam.id,
        targetTeamName: rivalTeam.name,
        driverId: driver.id,
        driverName: driver.name,
        reasoning: `A ${rivalTeam.name} identificou alto potencial percebido (${perceived} pts, confiança ${confidence}%) e ofereceu vaga em seu programa de desenvolvimento.`,
      }
    } else if (perceived < 68 && age >= 19) {
      return {
        action: 'pass',
        targetTeamId: rivalTeam.id,
        targetTeamName: rivalTeam.name,
        driverId: driver.id,
        driverName: driver.name,
        reasoning: `Projeção percebida (${perceived}) insuficiente para os padrões atuais da ${rivalTeam.name}.`,
      }
    }

    return {
      action: 'pass',
      targetTeamId: rivalTeam.id,
      targetTeamName: rivalTeam.name,
      driverId: driver.id,
      driverName: driver.name,
      reasoning: 'Piloto mantido em observação sem proposta imediata.',
    }
  }

  /**
   * Decide se a equipe rival deve dispensar um piloto acadêmico atual que não atingiu as expectativas percebidas
   */
  public evaluateRivalAcademyPruning(
    rivalTeam: TeamModel,
    driver: DriverModel,
  ): RivalAcademyDecision {
    const perceived = (driver as any).perceived_potential || 70
    const age = driver.age || 18
    const speed = driver.speed || 60

    // Se tiver mais de 20 anos e o perceived for modesto (< 74), a IA dispensa
    // NOTA: Como a IA erra no perceived, ela pode dispensar um futuro campeão por falso negativo!
    if (age >= 21 && perceived < 75 && speed < 72) {
      return {
        action: 'release',
        targetTeamId: rivalTeam.id,
        targetTeamName: rivalTeam.name,
        driverId: driver.id,
        driverName: driver.name,
        reasoning: `A ${rivalTeam.name} dispensou ${driver.name} por avaliar que seu teto de desenvolvimento (${perceived} percebido) não atende aos requisitos de F1.`,
      }
    }

    return {
      action: 'pass',
      targetTeamId: rivalTeam.id,
      targetTeamName: rivalTeam.name,
      driverId: driver.id,
      driverName: driver.name,
      reasoning: 'Piloto mantido no programa para a próxima temporada.',
    }
  }
}

export const rivalAcademyAIService = new RivalAcademyAIService()
