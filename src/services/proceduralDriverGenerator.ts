/**
 * Gerador Procedural de Pilotos — F1 Manager 2026 (Implementação Nº 4C)
 *
 * Regras Estritas:
 * 1. ACADEMIA LEVEL NÃO DEFINE POTENCIAL: Proibido "academyLevel -> truePotential".
 * 2. RARIDADE REALISTA:
 *    - Comum/Limitado (truePotential 65-74): ~60%
 *    - Bom Piloto / F1 Regular (75-81): ~25%
 *    - Excelente / Vitórias F1 (82-87): ~11%
 *    - Estrela / Candidato a Título (88-92): ~3.5%
 *    - Talento Geracional / Fenômeno (93-96+): ~0.5% (raríssimo!)
 * 3. IDENTIDADE PERMANENTE: driverId único e perene.
 * 4. ATRIBUTOS COERENTES COM IDADE/CATEGORIA: Um kartista de 15-16 anos nasce com
 *    velocidade 58-68, sem equivaler a campeão de F1 consolidado.
 * 5. FOG OF WAR: perceivedPotential pode divergir de truePotential (erro orgânico de scouting).
 *    evaluationAccuracy melhora a precisão e confiança, sem alterar o truePotential.
 */

import {
  ProceduralDriverMetadata,
  JuniorCategory,
  DrivingStyle,
  DriverPersonalityTrait,
  DriverPsychologyProfile,
} from '@/types/procedural-driver'
import { DriverModel } from '@/types/f1'
import { CULTURAL_NAME_POOLS } from '@/lib/procedural-names'
import { driverVisualAssetService } from '@/services/driverVisualAssetService'

export interface GenerationOptions {
  scoutingReach?: number // 10-100 (da InfrastructureCapabilityService)
  evaluationAccuracy?: number // 10-100 (da InfrastructureCapabilityService)
  homeRegion?: string
  forcedCategory?: JuniorCategory
  forcedAge?: number
  seed?: number
  scoutingTeamId?: string
  femaleRatio?: number // Proporção feminina configurável, default 0.50 (50/50)
  teamDriverPortraits?: string[] // IDs de retratos já usados na equipe para evitar duplicação
}

export class ProceduralDriverGenerator {
  /**
   * Função pseudo-aleatória determinística por seed ou fallback para Math.random
   */
  private getRandom(seedState?: { val: number }): number {
    if (!seedState) return Math.random()
    // LCG determinístico
    seedState.val = (seedState.val * 1664525 + 1013904223) % 4294967296
    return seedState.val / 4294967296
  }

  /**
   * Gera um número inteiro entre min e max inclusivos
   */
  private randomInt(min: number, max: number, seedState?: { val: number }): number {
    return Math.floor(this.getRandom(seedState) * (max - min + 1)) + min
  }

  /**
   * Sorteia truePotential conforme distribuição de raridade estrita (Regra de Ouro)
   */
  public generateTruePotential(seedState?: { val: number }): number {
    const roll = this.getRandom(seedState) * 100

    if (roll < 0.5) {
      // 0.5% Talento Geracional / Fenômeno (93-96)
      return this.randomInt(93, 96, seedState)
    } else if (roll < 4.0) {
      // 3.5% Estrela / Campeão em potencial (88-92)
      return this.randomInt(88, 92, seedState)
    } else if (roll < 15.0) {
      // 11% Excelente / Futuro vencedor de corridas F1 (82-87)
      return this.randomInt(82, 87, seedState)
    } else if (roll < 40.0) {
      // 25% Bom Piloto / F1 Regular de pelotão intermediário (75-81)
      return this.randomInt(75, 81, seedState)
    } else {
      // 60% Comum / Piloto de base limitado ou F3/F2 médio (65-74)
      return this.randomInt(65, 74, seedState)
    }
  }

  /**
   * Estima o perceivedPotential e evaluationConfidence a partir de evaluationAccuracy
   * A precisão aproxima perceived do real, mas NUNCA altera o potencial real.
   */
  public calculatePerceivedAssessment(
    truePotential: number,
    evaluationAccuracy: number = 50,
    seedState?: { val: number },
  ): { perceivedPotential: number; evaluationConfidence: number } {
    // Confiança básica baseada na capacidade de avaliação (ex: 40% a 85%)
    const baseConfidence = Math.round(
      evaluationAccuracy * 0.7 + this.randomInt(10, 25, seedState) * 0.3,
    )
    const clampedConfidence = Math.max(25, Math.min(95, baseConfidence))

    // Margem de erro inversamente proporcional à evaluationAccuracy
    // Accuracy 35 -> margem ±10 a ±14 pts
    // Accuracy 90 -> margem ±2 a ±4 pts
    const maxErrorRange = Math.max(2, Math.round((100 - evaluationAccuracy) * 0.14))
    const error = this.randomInt(-maxErrorRange, maxErrorRange, seedState)

    const perceivedPotential = Math.max(58, Math.min(98, truePotential + error))

    return {
      perceivedPotential,
      evaluationConfidence: clampedConfidence,
    }
  }

  /**
   * Cria um piloto procedural completo integrado com modelo canônico de DriverModel
   */
  public generateDriver(options: GenerationOptions = {}): {
    driver: DriverModel
    metadata: ProceduralDriverMetadata
  } {
    const seedState = options.seed !== undefined ? { val: Math.abs(options.seed) } : undefined
    const reach = options.scoutingReach || 50
    const accuracy = options.evaluationAccuracy || 50

    // Seleção de Região Geográfica influenciada por scoutingReach
    // Alcance baixo foca mais na região de formação; alcance alto distribui globalmente
    const regionKeys = Object.keys(CULTURAL_NAME_POOLS)
    let selectedRegionKey = regionKeys[0]

    const rollGlobal = this.getRandom(seedState) * 100
    if (rollGlobal > 100 - reach * 0.7) {
      // Alcance global
      selectedRegionKey = regionKeys[this.randomInt(0, regionKeys.length - 1, seedState)]
    } else {
      // Região padrão ou local
      selectedRegionKey =
        options.homeRegion && CULTURAL_NAME_POOLS[options.homeRegion]
          ? options.homeRegion
          : this.getRandom(seedState) < 0.35
            ? 'brasil'
            : 'europa_ocidental'
    }

    const pool = CULTURAL_NAME_POOLS[selectedRegionKey] || CULTURAL_NAME_POOLS.brasil
    const femaleRatio = options.femaleRatio ?? 0.5
    const isFemale = this.getRandom(seedState) < femaleRatio
    const firstNames = isFemale ? pool.firstNamesFemale : pool.firstNamesMale
    const firstName = firstNames[this.randomInt(0, firstNames.length - 1, seedState)]
    const lastName = pool.lastNames[this.randomInt(0, pool.lastNames.length - 1, seedState)]
    const fullName = `${firstName} ${lastName}`
    const nationalityObj =
      pool.nationalities[this.randomInt(0, pool.nationalities.length - 1, seedState)]

    // Categoria de Base e Idade
    let category: JuniorCategory = options.forcedCategory || 'f4'
    let age = options.forcedAge || 16

    if (!options.forcedCategory) {
      const catRoll = this.getRandom(seedState) * 100
      if (catRoll < 25) {
        category = 'karting'
        age = this.randomInt(15, 16, seedState)
      } else if (catRoll < 60) {
        category = 'f4'
        age = this.randomInt(16, 17, seedState)
      } else if (catRoll < 85) {
        category = 'regional'
        age = this.randomInt(17, 19, seedState)
      } else {
        category = 'f3'
        age = this.randomInt(18, 20, seedState)
      }
    }

    // Geração do Potencial Real (Oculto)
    const truePotential = this.generateTruePotential(seedState)

    // Avaliação Percebida (com margem de erro)
    const { perceivedPotential, evaluationConfidence } = this.calculatePerceivedAssessment(
      truePotential,
      accuracy,
      seedState,
    )

    // Atributos Iniciais compatíveis com a idade e categoria
    // Karting: 56-66 | F4: 60-70 | Regional: 64-74 | F3: 68-78
    const baseOffset =
      category === 'karting' ? 58 : category === 'f4' ? 63 : category === 'regional' ? 67 : 71

    // Pilotos de maior truePotential nascem com atributos ligeiramente mais refinados
    const potentialBonus = Math.round((truePotential - 70) * 0.18)
    const initialBaseSkill = Math.max(50, Math.min(80, baseOffset + potentialBonus))

    const speed = Math.max(48, Math.min(84, initialBaseSkill + this.randomInt(-3, 4, seedState)))
    const consistency = Math.max(
      45,
      Math.min(82, initialBaseSkill + this.randomInt(-4, 3, seedState)),
    )
    const rain = Math.max(45, Math.min(85, initialBaseSkill + this.randomInt(-5, 5, seedState)))
    const defense = Math.max(45, Math.min(80, initialBaseSkill + this.randomInt(-4, 4, seedState)))
    const technicalFeedback = Math.max(
      40,
      Math.min(75, Math.round(consistency * 0.85) + this.randomInt(-3, 3, seedState)),
    )

    // Estilo de pilotagem derivado dos atributos
    let drivingStyle: DrivingStyle = 'adaptavel'
    if (speed >= consistency + 4) drivingStyle = 'qualificacao'
    else if (consistency >= speed + 3) drivingStyle = 'gestao_pneus'
    else if (rain >= speed + 4) drivingStyle = 'chuva'
    else if (defense >= speed + 3) drivingStyle = 'defensivo'
    else if (speed > 72 && defense > 70) drivingStyle = 'agressivo'
    else drivingStyle = 'tecnico'

    // Personalidade
    const traits: DriverPersonalityTrait[] = [
      'focado',
      'ambicioso',
      'metodico',
      'impulsivo',
      'resiliente',
      'calculista',
      'leal',
      'competitivo',
    ]
    const dominantTrait = traits[this.randomInt(0, traits.length - 1, seedState)]

    const psychology: DriverPsychologyProfile = {
      ambition: this.randomInt(50, 95, seedState),
      loyalty: this.randomInt(40, 90, seedState),
      aggression: this.randomInt(45, 92, seedState),
      cooperation: this.randomInt(50, 90, seedState),
      pressureTolerance: this.randomInt(50, 90, seedState),
      professionalism: this.randomInt(55, 95, seedState),
      adaptability: this.randomInt(50, 92, seedState),
      dominantTrait,
    }

    // Pontos Fortes e Fracos baseados em atributos reais
    const strengths: string[] = []
    const weaknesses: string[] = []

    if (speed >= 68) strengths.push('Velocidade pura em volta lançada')
    if (consistency >= 68) strengths.push('Consistência em ritmo de prova')
    if (rain >= 70) strengths.push('Excelente controle no asfalto molhado')
    if (defense >= 68) strengths.push('Forte defesa de posição sob pressão')
    if (technicalFeedback >= 65) strengths.push('Feedback técnico detalhado para engenheiros')
    if (psychology.pressureTolerance >= 80) strengths.push('Mente fria em momentos decisivos')

    if (consistency < 60) weaknesses.push('Oscilação de ritmo entre stints')
    if (defense < 60) weaknesses.push('Vulnerabilidade em disputas de freada')
    if (rain < 60) weaknesses.push('Dificuldade de adaptação em pista molhada')
    if (technicalFeedback < 55) weaknesses.push('Pouca clareza no ajuste do acerto')
    if (psychology.pressureTolerance < 60) weaknesses.push('Susceptível a erros sob pressão direta')

    if (strengths.length === 0) strengths.push('Margem para desenvolvimento amplo')
    if (weaknesses.length === 0) weaknesses.push('Necessita de mais quilometragem em monopostos')

    // Identificador único universal permanente
    const driverId = `drv_proc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    // Criação dos Assets Visuais desacoplados
    const visualSeed = this.randomInt(1, 999999, seedState)
    const visualIdentity = driverVisualAssetService.createVisualIdentity(
      driverId,
      visualSeed,
      isFemale ? 'female' : 'male',
      options.teamDriverPortraits || [],
    )

    // Histórico de temporada inicial simulado resumido
    const seasonsHistory = [
      {
        year: 2025,
        category,
        teamName: `Junior Team ${nationalityObj.name}`,
        championshipPosition: this.randomInt(2, 12, seedState),
        races: 14,
        wins: this.randomInt(0, 3, seedState),
        podiums: this.randomInt(1, 6, seedState),
        poles: this.randomInt(0, 2, seedState),
        points: this.randomInt(45, 140, seedState),
        bestFinish: 1,
      },
    ]

    const metadata: ProceduralDriverMetadata = {
      driverId,
      firstName,
      lastName,
      fullName,
      displayName: `${firstName[0]}. ${lastName}`,
      nationality: nationalityObj.name,
      countryFlag: nationalityObj.flag,
      formationRegion: selectedRegionKey as any,
      dateOfBirth: `20${26 - age}-0${this.randomInt(1, 9, seedState)}-${this.randomInt(10, 28, seedState)}`,
      entryYear: 2026,
      juniorCategory: category,
      careerStatus: 'prospect',
      truePotential,
      growthRate: this.randomInt(0, 3, seedState) === 0 ? 'precoce' : 'normal',
      peakAge: this.randomInt(25, 29, seedState),
      drivingStyle,
      strengths,
      weaknesses,
      psychology,
      visualIdentity,
      seasonsHistory,
      milestones: [
        {
          date: '2026-01-15',
          type: 'descoberto',
          teamName: 'Automobilismo de Base',
          description: `Descoberto atuando na ${category.toUpperCase()} aos ${age} anos de idade.`,
        },
      ],
      f1CareerStats: {
        gps: 0,
        wins: 0,
        podiums: 0,
        poles: 0,
        points: 0,
        fastestLaps: 0,
        championships: 0,
      },
      scoutingRecords: options.scoutingTeamId
        ? {
            [options.scoutingTeamId]: {
              perceivedPotential,
              evaluationConfidence,
              knownAttributes: {
                speed,
                consistency: evaluationConfidence > 55 ? consistency : undefined,
                technicalFeedback: evaluationConfidence > 70 ? technicalFeedback : undefined,
              },
              evaluationsCount: 1,
              scoutingNotes: `Observado na ${category.toUpperCase()}. Piloto com ritmo inicial interessante.`,
            },
          }
        : {},
    }

    // DriverModel canônico de banco
    const driver: DriverModel = {
      id: driverId,
      name: fullName,
      nationality: nationalityObj.name,
      age,
      speed,
      consistency,
      rain,
      defense,
      salary: 180000, // Bolsa de desenvolvimento anual básica
      contract_end: 2026,
      team_id: null,
      role: null,
      category:
        category === 'karting' || category === 'f4' || category === 'regional'
          ? 'mercado'
          : (category as any),
      superlicense_points: category === 'f3' ? 15 : category === 'regional' ? 10 : 5,
      homologation_status: 'formacao',
      f1_adaptation: Math.min(60, Math.round(speed * 0.7)),
      license_status: 'nivel_c',
      is_academy: false,
      is_test_driver: false,
      technical_feedback: technicalFeedback,
      seat_security: 80,
      // Extensões de persistência 4C
      ...({
        origin_type: 'procedural',
        true_potential: truePotential,
        perceived_potential: perceivedPotential,
        evaluation_confidence: evaluationConfidence,
        career_status: 'prospect',
        procedural_data: metadata,
      } as any),
    }

    return { driver, metadata }
  }
}

export const proceduralDriverGenerator = new ProceduralDriverGenerator()
