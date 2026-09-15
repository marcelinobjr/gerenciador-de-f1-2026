/**
 * Serviço de Cálculo e Domínio Técnico do Carro - F1 Manager 2026
 *
 * Centraliza:
 * 1. Derivação de Atributos Técnicos a partir dos Componentes e Matriz de Influência
 * 2. Cálculo do Overall do Monoposto e Auditoria de Deltas (Aba 5 e 6 da Planilha)
 * 3. Fallbacks e Compatibilidade total para saves sem os novos atributos
 * 4. Separação conceitual entre Especificação (Design/Performance) e Unidade Física (Condição/Desgaste)
 */

import {
  TechnicalAttributeId,
  TechnicalComponentId,
  TechnicalAttributesMap,
  ComponentRatingsMap,
  CarCalculationResult,
  PowerUnitSubsystem,
  TECHNICAL_ATTRIBUTE_METAS,
  TECHNICAL_COMPONENT_METAS,
  CarComparisonData,
} from '@/types/car-technical-model'
import {
  COMPONENT_INFLUENCE_MATRIX,
  TECHNICAL_ATTRIBUTE_WEIGHTS,
  OFFICIAL_TEAMS_TECHNICAL_DATA,
  OFFICIAL_POWER_UNITS,
  generateDefaultComponentsFromMacro,
} from '@/lib/car-technical-data'

export class CarTechnicalService {
  /**
   * 1. Calcula os 12 atributos técnicos a partir dos ratings dos 8 componentes
   * usando a Matriz de Influência (Aba 3 da Planilha).
   */
  public calculateAttributesFromComponents(
    components: ComponentRatingsMap,
    puSupplier?: string,
  ): TechnicalAttributesMap {
    const attributeIds = Object.keys(TECHNICAL_ATTRIBUTE_METAS) as TechnicalAttributeId[]
    const attributes: Partial<TechnicalAttributesMap> = {}

    for (const attrId of attributeIds) {
      const influenceMap = COMPONENT_INFLUENCE_MATRIX[attrId]
      let weightedSum = 0
      let totalWeight = 0

      if (influenceMap) {
        for (const [compKey, weight] of Object.entries(influenceMap)) {
          const cId = compKey as TechnicalComponentId
          const compRating = components[cId] ?? 50
          weightedSum += compRating * (weight as number)
          totalWeight += weight as number
        }
      }

      // Normalização caso os pesos da linha não somem exatamente 1.0
      let rawAttrScore = totalWeight > 0 ? weightedSum / totalWeight : 50

      // Pequena contribuição da Power Unit em velocidade, aceleração e confiabilidade
      if (puSupplier && OFFICIAL_POWER_UNITS[puSupplier]) {
        const pu = OFFICIAL_POWER_UNITS[puSupplier]
        if (attrId === 'topSpeed') {
          // 85% aero/chassi + 15% potência do motor
          rawAttrScore = rawAttrScore * 0.85 + pu.powerRating * 0.15
        } else if (attrId === 'acceleration') {
          // 85% mecânica/tração + 15% entrega de torque do motor
          rawAttrScore = rawAttrScore * 0.85 + pu.powerRating * 0.15
        } else if (attrId === 'reliability') {
          // 90% chassi + 10% confiabilidade do motor
          rawAttrScore = rawAttrScore * 0.9 + pu.reliabilityRating * 0.1
        }
      }

      attributes[attrId] = Number(rawAttrScore.toFixed(2))
    }

    return attributes as TechnicalAttributesMap
  }

  /**
   * 2. Calcula o Car Overall final a partir dos 12 atributos técnicos e seus pesos (Aba 5).
   * Pesos: 12/12/12/10/8/8/8/8/8/5/4/5 (soma 100%).
   */
  public calculateCarOverall(attributes: TechnicalAttributesMap): number {
    let overall = 0
    for (const [attrId, weight] of Object.entries(TECHNICAL_ATTRIBUTE_WEIGHTS)) {
      const val = attributes[attrId as TechnicalAttributeId] ?? 50
      overall += val * weight
    }
    return Number(overall.toFixed(2))
  }

  /**
   * 3. Auditoria Completa: Gera o resultado técnico completo de uma equipe,
   * calculando attributes, overall e o delta vs macro (Aba 6).
   */
  public evaluateCarTechnicalProfile(
    teamKey: string,
    components: ComponentRatingsMap,
    macroRating: number,
    puSupplier: 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi' = 'Ferrari',
  ): CarCalculationResult {
    const attributes = this.calculateAttributesFromComponents(components, puSupplier)
    const calculatedOverall = this.calculateCarOverall(attributes)
    const balanceDelta = Number((calculatedOverall - macroRating).toFixed(2))
    const isBalanced = Math.abs(balanceDelta) <= 1.5

    const pu = OFFICIAL_POWER_UNITS[puSupplier] || OFFICIAL_POWER_UNITS.Ferrari
    const puBonus = {
      topSpeedBonus: Number((pu.powerRating * 0.15).toFixed(2)),
      accelerationBonus: Number((pu.powerRating * 0.15).toFixed(2)),
      reliabilityBonus: Number((pu.reliabilityRating * 0.1).toFixed(2)),
    }

    const officialTeam = OFFICIAL_TEAMS_TECHNICAL_DATA[teamKey]

    return {
      teamKey,
      teamName: officialTeam?.teamName || teamKey,
      macroRating,
      calculatedOverall,
      balanceDelta,
      isBalanced,
      attributes,
      componentRatings: components,
      powerUnitContribution: puBonus,
    }
  }

  /**
   * 4. Obter perfil técnico de uma equipe oficial ou gerar fallback consistente
   * para equipes customizadas ou saves antigos sem atributos salvos.
   */
  public getOrCreateTeamTechnicalData(
    teamKey?: string,
    currentStrength?: number,
    engineSupplier?: string,
  ): CarCalculationResult {
    const normalizedKey = teamKey?.toLowerCase() || ''
    const officialProfile = OFFICIAL_TEAMS_TECHNICAL_DATA[normalizedKey]

    if (officialProfile) {
      return this.evaluateCarTechnicalProfile(
        officialProfile.teamKey,
        officialProfile.initialComponents,
        officialProfile.macroRating,
        officialProfile.engineSupplier,
      )
    }

    // Fallback gracioso para equipes customizadas ou não catalogadas
    const macro = currentStrength ?? 70
    const fallbackComponents = generateDefaultComponentsFromMacro(macro)
    const fallbackSupplier = (engineSupplier as any) || 'Ferrari'

    return this.evaluateCarTechnicalProfile(
      teamKey || 'custom_team',
      fallbackComponents,
      macro,
      fallbackSupplier,
    )
  }

  /**
   * 5. Comparação estruturada entre Carro #1 e Carro #2
   * Permite identificar discrepâncias de setup, desgaste de peças ou especificações distintas.
   */
  public compareCars(
    componentsCar1: ComponentRatingsMap,
    conditionsCar1: Record<TechnicalComponentId, number>,
    componentsCar2: ComponentRatingsMap,
    conditionsCar2: Record<TechnicalComponentId, number>,
    puSupplier: 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi',
  ): CarComparisonData {
    const attr1 = this.calculateAttributesFromComponents(componentsCar1, puSupplier)
    const attr2 = this.calculateAttributesFromComponents(componentsCar2, puSupplier)

    const ovr1 = this.calculateCarOverall(attr1)
    const ovr2 = this.calculateCarOverall(attr2)

    const avgCond1 =
      Object.values(conditionsCar1).reduce((acc, c) => acc + c, 0) /
      Math.max(1, Object.keys(conditionsCar1).length)
    const avgCond2 =
      Object.values(conditionsCar2).reduce((acc, c) => acc + c, 0) /
      Math.max(1, Object.keys(conditionsCar2).length)

    const differences: Partial<Record<TechnicalAttributeId, number>> = {}
    for (const key of Object.keys(attr1) as TechnicalAttributeId[]) {
      differences[key] = Number((attr1[key] - attr2[key]).toFixed(2))
    }

    return {
      car1: {
        overall: ovr1,
        attributes: attr1,
        components: componentsCar1,
        averageCondition: Math.round(avgCond1),
      },
      car2: {
        overall: ovr2,
        attributes: attr2,
        components: componentsCar2,
        averageCondition: Math.round(avgCond2),
      },
      differences,
    }
  }

  /**
   * 6. Helpers de tradução e metadados
   */
  public getAttributeMeta(id: TechnicalAttributeId) {
    return TECHNICAL_ATTRIBUTE_METAS[id]
  }

  public getComponentMeta(id: TechnicalComponentId) {
    return TECHNICAL_COMPONENT_METAS[id]
  }
}

export const carTechnicalService = new CarTechnicalService()
