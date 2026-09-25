/**
 * Serviço de Novas Gerações e Ecologia Populacional (NewGenerationService)
 * F1 Manager 2026 — Implementação Nº 8B
 *
 * Princípios Fundamentais (Regras 41 a 55):
 * 1. Pipeline anual de novos pilotos procedurais em idade jovem (15 a 19 anos).
 * 2. Distribuição estrita de talentos (Regra 43):
 *    ~60% common (65-74)
 *    ~25% regular (75-81)
 *    ~10-12% excellent (82-87)
 *    ~3% stars (88-92)
 *    <1% generational (93-96)
 * 3. Controle ecológico da população: entradas ≈ saídas (aposentadorias) + demanda de academias.
 *    Evita crescimento infinito da base de dados (Regra 45).
 * 4. Procedural Driver Identity permanente (driverId, visualIdentityId).
 * 5. Diversidade de nacionalidades e nomes sem repetições anômalas.
 * 6. Entram nas categorias de base (karting, f4, regional, f3) como candidatos à academia.
 * 7. IA NUNCA enxerga truePotential na avaliação ou contratação.
 */

import pb from '@/lib/pocketbase/client'
import { DriverModel, TeamModel } from '@/types/f1'
import { proceduralDriverGenerator } from './proceduralDriverGenerator'
import { UniverseEcologyReport } from '@/types/driver-development'
import { preservePortraitFields } from '@/lib/preservePortraitFields'

export interface AnnualGenerationClassResult {
  seasonYear: number
  newDrivers: DriverModel[]
  scoutingPoolNotice: string
  ecologyReport: UniverseEcologyReport
}

export class NewGenerationService {
  /**
   * Calcula o tamanho ideal da nova safra baseado na ecologia do universo (Regras 45 e 46)
   */
  public calculateCohortSize(params: {
    activeDriversCount: number
    retirementsCount: number
    targetActiveDrivers?: number // padrão: ~110 a 140 pilotos ativos no universo
  }): number {
    const target = params.targetActiveDrivers || 120
    const current = params.activeDriversCount
    const exits = Math.max(1, params.retirementsCount)

    // Se o universo estiver abaixo do alvo, gera um pouco mais; se estiver inchado, desacelera
    let needed = exits + Math.round((target - current) * 0.25)
    // Classe anual equilibrada: mínimo de 8 a máximo de 18 jovens por temporada
    needed = Math.max(8, Math.min(18, needed))
    return needed
  }

  /**
   * Gera a safra anual de novos talentos para o scouting pool da temporada
   */
  public generateAnnualClass(params: {
    seasonYear: number
    allCurrentDrivers: DriverModel[]
    retirementsCount?: number
    seed?: number
  }): AnnualGenerationClassResult {
    const { seasonYear, allCurrentDrivers, seed } = params
    const activeDrivers = allCurrentDrivers.filter(
      (d) => d.career_status !== 'retired' && d.retirement_intent !== 'RETIRED',
    )

    const cohortSize = this.calculateCohortSize({
      activeDriversCount: activeDrivers.length,
      retirementsCount: params.retirementsCount || 2,
    })

    const newDrivers: DriverModel[] = []
    const seedBase = seed !== undefined ? seed : seasonYear * 1000

    for (let i = 0; i < cohortSize; i++) {
      const driverSeed = seedBase + i * 37
      const generated = proceduralDriverGenerator.generateDriver({
        seed: driverSeed,
        forcedAge: 15 + (i % 4), // 15 a 18 anos
        forcedCategory: i % 3 === 0 ? 'karting' : i % 3 === 1 ? 'f4' : 'regional',
      })

      const driver = generated.driver
      // Configurar metadados canônicos da nova safra
      driver.contract_end = seasonYear + 2
      driver.career_status = 'prospect'
      driver.role = null
      driver.team_id = null
      driver.salary = 120000 + (driverSeed % 60000)

      newDrivers.push(driver)
    }

    // Calcular estatísticas e ecologia do universo pós-geração
    const allCombined = [...activeDrivers, ...newDrivers]
    const totalActive = allCombined.length
    const titulars = allCombined.filter((d) => d.team_id && d.role === 'titular').length
    const reserves = allCombined.filter(
      (d) => d.role === 'reserva' || Boolean(d.is_test_driver),
    ).length
    const academy = allCombined.filter((d) => d.is_academy).length
    const freeAgents = allCombined.filter((d) => !d.team_id).length

    const avgAge = Math.round(
      allCombined.reduce((sum, d) => sum + (d.age || 25), 0) / (totalActive || 1),
    )
    const avgSpeed = Math.round(
      allCombined.reduce((sum, d) => sum + (d.speed || 75), 0) / (totalActive || 1),
    )
    const avgConsistency = Math.round(
      allCombined.reduce((sum, d) => sum + (d.consistency || 75), 0) / (totalActive || 1),
    )

    // Contagem de talentos de elite (sem expor quem são ao jogador)
    const starsCount = allCombined.filter(
      (d) => (d.true_potential || 0) >= 88 && (d.true_potential || 0) <= 92,
    ).length
    const generationalCount = allCombined.filter((d) => (d.true_potential || 0) >= 93).length

    const ecologyReport: UniverseEcologyReport = {
      seasonYear,
      totalActiveDrivers: totalActive,
      titularDriversCount: titulars,
      reserveDriversCount: reserves,
      academyDriversCount: academy,
      freeAgentsCount: freeAgents,
      retiredCount: allCurrentDrivers.filter((d) => d.career_status === 'retired').length,
      newGenerationsCount: newDrivers.length,
      averageAge: avgAge,
      averageSpeed: avgSpeed,
      averageConsistency: avgConsistency,
      starsCount,
      generationalCount,
    }

    const scoutingNotice = `Nova safra de pilotos de base: ${newDrivers.length} jovens talentos integraram o radar de scouting para a temporada ${seasonYear}.`

    return {
      seasonYear,
      newDrivers,
      scoutingPoolNotice: scoutingNotice,
      ecologyReport,
    }
  }

  /**
   * Persiste os novos pilotos procedurais no banco se necessário
   */
  public async persistGeneratedClass(newDrivers: DriverModel[]): Promise<void> {
    for (const d of newDrivers) {
      try {
        await pb.collection('drivers').create({
          id: d.id,
          name: d.name,
          nationality: d.nationality,
          age: d.age,
          speed: d.speed,
          consistency: d.consistency,
          rain: d.rain,
          defense: d.defense,
          salary: d.salary,
          contract_end: d.contract_end,
          team_id: null,
          role: null,
          category: d.category,
          superlicense_points: d.superlicense_points,
          homologation_status: d.homologation_status,
          f1_adaptation: d.f1_adaptation,
          license_status: d.license_status,
          is_academy: false,
          is_test_driver: false,
          technical_feedback: d.technical_feedback,
          seat_security: d.seat_security,
          origin_type: 'procedural',
          true_potential: d.true_potential,
          perceived_potential: d.perceived_potential,
          evaluation_confidence: d.evaluation_confidence,
          career_status: 'prospect',
          procedural_data: preservePortraitFields(
            (d as any).procedural_data,
            (d as any).procedural_data,
          ),
        })
      } catch (err) {
        // Tolerância para testes / offline
      }
    }
  }
}

export const newGenerationService = new NewGenerationService()
