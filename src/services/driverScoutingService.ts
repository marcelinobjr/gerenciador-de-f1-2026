/**
 * Serviço de Scouting e Ciclos de Observação de Pilotos
 * F1 Manager 2026 — Implementação Nº 4C
 *
 * Regras:
 * 1. Scouting Reach e Prospect Discovery Capacity determinam a quantidade e alcance dos prospects.
 * 2. Candidatos chegam com Fog-of-War (atributos desconhecidos, confiança parcial).
 * 3. Reavaliar um candidato aumenta a confiança e revela mais dados, mas NUNCA altera o piloto.
 * 4. Testes (Rookie Test / Avaliação) geram dados e aumentam confiança.
 * 5. ViewModel esconde rigorosamente o truePotential e dados não revelados.
 */

import { ProceduralDriverMetadata, ProspectScoutingCardViewModel } from '@/types/procedural-driver'
import { DriverModel, TeamModel } from '@/types/f1'
import { proceduralDriverGenerator } from './proceduralDriverGenerator'
import { infrastructureCapabilityService } from './infrastructureCapabilityService'
import { preservePortraitFields } from '@/lib/preservePortraitFields'
import { driverVisualAssetService } from './driverVisualAssetService'

export class DriverScoutingService {
  /**
   * Converte um piloto procedural para o ViewModel seguro com Fog-of-War
   * NUNCA vaza truePotential nem atributos confidenciais
   */
  public createScoutingViewModel(
    driver: DriverModel,
    teamId?: string,
  ): ProspectScoutingCardViewModel {
    const meta = (driver as any).procedural_data as ProceduralDriverMetadata | undefined
    const teamScout = teamId && meta?.scoutingRecords?.[teamId]

    const perceivedValue =
      teamScout?.perceivedPotential || (driver as any).perceived_potential || 72
    const confidence =
      teamScout?.evaluationConfidence || (driver as any).evaluation_confidence || 45

    // Rótulo qualitativo do potencial percebido
    let perceivedPotentialLabel: ProspectScoutingCardViewModel['perceivedPotentialLabel'] = 'Médio'
    if (perceivedValue >= 90) perceivedPotentialLabel = 'Excepcional'
    else if (perceivedValue >= 83) perceivedPotentialLabel = 'Muito Alto'
    else if (perceivedValue >= 76) perceivedPotentialLabel = 'Promissor'
    else if (perceivedValue >= 68) perceivedPotentialLabel = 'Médio'
    else perceivedPotentialLabel = 'Baixo'

    // Faixa de confiança
    let confidenceGrade: ProspectScoutingCardViewModel['confidenceGrade'] = 'Média'
    if (confidence >= 80) confidenceGrade = 'Muito Alta'
    else if (confidence >= 65) confidenceGrade = 'Alta'
    else if (confidence >= 45) confidenceGrade = 'Média'
    else if (confidence >= 30) confidenceGrade = 'Baixa'
    else confidenceGrade = 'Muito Baixa'

    // Fog-of-War em atributos conforme a confiança acumulada:
    // Confiança < 40: "Desconhecido" ou faixa ampla
    // Confiança 40-70: Faixa estimada
    // Confiança > 70: Valor exato
    const formatAttribute = (
      val: number,
      conf: number,
      labelName: string,
    ): { label: string; value?: number; range?: string } => {
      if (conf < 40) {
        return { label: `${labelName}: Desconhecido` }
      } else if (conf < 70) {
        const floor = Math.floor(val / 5) * 5
        return { label: labelName, range: `${floor}-${floor + 5}` }
      } else {
        return { label: labelName, value: val }
      }
    }

    const cat = meta?.juniorCategory || 'f4'
    const catLabels: Record<string, string> = {
      karting: 'Karting Internacional',
      f4: 'Fórmula 4 Regional',
      regional: 'Fórmula Regional / FRECA',
      f3: 'FIA Fórmula 3',
      f2: 'FIA Fórmula 2',
      f1_academy: 'F1 Academy',
    }

    const isLinkedPlayer = Boolean(teamId && driver.team_id === teamId)
    const isLinkedRival = Boolean(driver.team_id && driver.team_id !== teamId)

    const resolvedUrls = meta?.visualIdentity
      ? driverVisualAssetService.resolveVisualUrls(meta.visualIdentity)
      : null
    const posterUrl = resolvedUrls?.displayUrl || meta?.visualIdentity?.posterAssetId

    return {
      driverId: driver.id,
      name: driver.name,
      age: driver.age,
      nationality: driver.nationality,
      countryFlag: meta?.countryFlag || '🏁',
      juniorCategory: cat,
      categoryLabel: catLabels[cat] || 'Base',
      currentTeamOrAcademyName:
        meta?.currentAcademyTeamId || (driver.team_id ? 'Vinculado' : 'Independente'),
      isLinkedToPlayerAcademy: isLinkedPlayer,
      isLinkedToRivalAcademy: isLinkedRival,
      visualIdentityId: meta?.visualIdentity?.visualIdentityId || driver.id,
      visualIdentity: meta?.visualIdentity,
      generatedPortraitProfileId:
        (driver as any).generatedPortraitProfileId ||
        meta?.visualIdentity?.generatedPortraitProfileId ||
        (meta as any)?.generatedPortraitProfileId ||
        (meta?.visualIdentity?.portraitAssetId?.startsWith('GEN_')
          ? meta.visualIdentity.portraitAssetId
          : undefined),
      posterUrl,
      gender: meta?.visualIdentity?.gender || 'male',
      perceivedPotentialLabel,
      perceivedPotentialValue: perceivedValue,
      evaluationConfidence: confidence,
      confidenceGrade,
      perceivedSpeed: formatAttribute(driver.speed || 60, confidence, 'Ritmo'),
      perceivedConsistency: formatAttribute(driver.consistency || 60, confidence, 'Consistência'),
      perceivedRain: formatAttribute(driver.rain || 60, confidence - 10, 'Chuva'),
      perceivedDefense: formatAttribute(driver.defense || 60, confidence - 10, 'Defesa'),
      perceivedFeedback: formatAttribute(
        driver.technical_feedback || 60,
        confidence - 5,
        'Feedback Técnico',
      ),
      drivingStyle: meta?.drivingStyle || 'técnico',
      strengths: meta?.strengths || ['Jovem promissor'],
      weaknesses: meta?.weaknesses || ['Pouca experiência em monopostos'],
      personalitySummary: meta?.psychology?.dominantTrait
        ? `Perfil ${meta.psychology.dominantTrait}`
        : 'Em avaliação',
      lastSeasonSummary: meta?.seasonsHistory?.[0]
        ? `${meta.seasonsHistory[0].year}: ${meta.seasonsHistory[0].championshipPosition}º lugar (${meta.seasonsHistory[0].wins} vitórias)`
        : undefined,
      evaluationsDone: teamScout?.evaluationsCount || 1,
      careerStatus: meta?.careerStatus || 'prospect',
      licenseStatus: driver.license_status || 'nivel_c',
    }
  }

  /**
   * Gera uma leva de novos candidatos para a janela de scouting da equipe
   * Quantidade e qualidade da informação dependem das capabilities da infraestrutura
   */
  public generateScoutingBatch(
    team: TeamModel,
    existingDriverIds: string[] = [],
    countOverride?: number,
  ): { driver: DriverModel; metadata: ProceduralDriverMetadata }[] {
    const audit = infrastructureCapabilityService.auditInfrastructure(team)
    const capabilities = audit.capabilities

    // Quantidade de prospectos gerados depende de prospectDiscoveryCapacity:
    // 3 a 7 candidatos por leva
    const count =
      countOverride ||
      Math.max(3, Math.min(7, Math.round(capabilities.prospectDiscoveryCapacity / 18)))

    const results: { driver: DriverModel; metadata: ProceduralDriverMetadata }[] = []

    for (let i = 0; i < count; i++) {
      const generated = proceduralDriverGenerator.generateDriver({
        scoutingReach: capabilities.scoutingReach,
        evaluationAccuracy: capabilities.evaluationAccuracy,
        scoutingTeamId: team.id,
        seed: Date.now() + i * 1337,
      })

      // Garante ID único
      if (!existingDriverIds.includes(generated.driver.id)) {
        results.push(generated)
      }
    }

    return results
  }

  /**
   * Executa scouting aprofundado em um prospect já existente (Reavaliação)
   * Reduz o erro de avaliação e eleva a confiança de observação SEM alterar o talento real.
   */
  public evaluateProspectAgain(
    driver: DriverModel,
    team: TeamModel,
  ): { updatedDriver: DriverModel; evaluationGainText: string } {
    const meta = (driver as any).procedural_data as ProceduralDriverMetadata | undefined
    if (!meta) {
      return { updatedDriver: driver, evaluationGainText: 'Dados de scouting não disponíveis.' }
    }

    const audit = infrastructureCapabilityService.auditInfrastructure(team)
    const accuracy = audit.capabilities.evaluationAccuracy

    const existingRecord = meta.scoutingRecords?.[team.id]
    const currentConfidence =
      existingRecord?.evaluationConfidence || (driver as any).evaluation_confidence || 40

    // Ganho de confiança proporcional à accuracy (ex: +12% a +25%)
    const confidenceGain = Math.round(10 + accuracy * 0.15 + Math.random() * 5)
    const newConfidence = Math.min(95, currentConfidence + confidenceGain)

    // Ajuste do perceivedPotential em direção ao truePotential (reduzindo margem de erro)
    const truePot = meta.truePotential || (driver as any).true_potential || 75
    const currentPerceived =
      existingRecord?.perceivedPotential || (driver as any).perceived_potential || truePot

    // Conforme a confiança aumenta, o perceived converge para o truePotential
    const divergence = truePot - currentPerceived
    const correctionFactor = Math.min(0.8, (accuracy / 100) * 0.75 + 0.2)
    const newPerceived = Math.round(currentPerceived + divergence * correctionFactor)

    const evaluationsCount = (existingRecord?.evaluationsCount || 1) + 1

    const updatedScoutingRecord = {
      perceivedPotential: newPerceived,
      evaluationConfidence: newConfidence,
      knownAttributes: {
        speed: driver.speed,
        consistency: newConfidence >= 55 ? driver.consistency : undefined,
        rain: newConfidence >= 65 ? driver.rain : undefined,
        defense: newConfidence >= 65 ? driver.defense : undefined,
        technicalFeedback: newConfidence >= 75 ? driver.technical_feedback : undefined,
      },
      evaluationsCount,
      scoutingNotes: `Reavaliado pela equipe técnica. Confiança elevada para ${newConfidence}%. Potencial estimado refinado para ${newPerceived}.`,
    }

    const baseUpdatedMeta: ProceduralDriverMetadata = {
      ...meta,
      scoutingRecords: {
        ...(meta.scoutingRecords || {}),
        [team.id]: updatedScoutingRecord,
      },
    }

    // Blindagem de retrato: preserva generatedPortraitProfileId e visualIdentity.portraitAssetId do objeto persistido
    const updatedMeta = preservePortraitFields(meta, baseUpdatedMeta)

    const updatedDriver: DriverModel = {
      ...driver,
      ...({
        perceived_potential: newPerceived,
        evaluation_confidence: newConfidence,
        procedural_data: updatedMeta,
      } as any),
    }

    const diff = newPerceived - currentPerceived
    const diffText =
      diff > 0
        ? ` (projeção subiu +${diff} pts)`
        : diff < 0
          ? ` (projeção ajustada para baixo em ${diff} pts)`
          : ' (projeção confirmada)'

    const evaluationGainText = `Relatório atualizado: Confiança subiu para ${newConfidence}%${diffText}.`

    return { updatedDriver, evaluationGainText }
  }
}

export const driverScoutingService = new DriverScoutingService()
