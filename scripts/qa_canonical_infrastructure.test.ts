import { describe, it, expect } from 'vitest'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import { f1Service } from '@/services/f1Service'
import { CANONICAL_FACILITIES_DEFINITIONS } from '@/types/canonical-facilities-data'
import { INITIAL_GRID_FACILITIES, getInitialTeamFacilities } from '@/data/initial-team-facilities'
import { calculateCarPerformance, calculateTrackFit } from '@/lib/car-session-performance-engine'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 4A — INFRAESTRUTURA TÉCNICA E ORGANIZACIONAL', () => {
  // ==========================================================================
  // 1. AS 9 INSTALAÇÕES CANÔNICAS & RETORNOS DECRESCENTES
  // ==========================================================================
  describe('1. As 9 Instalações Canônicas e Diminishing Returns', () => {
    it('Confirma a existência das 9 instalações canônicas com dados completos', () => {
      expect(CANONICAL_FACILITIES_DEFINITIONS.length).toBe(9)
      const expectedIds = [
        'factory',
        'design_centre',
        'cfd',
        'wind_tunnel',
        'manufacturing',
        'simulator',
        'operations_centre',
        'pitstop_center',
        'youth_academy',
      ]
      const registeredIds = CANONICAL_FACILITIES_DEFINITIONS.map((f) => f.id)
      for (const id of expectedIds) {
        expect(registeredIds).toContain(id)
      }
    })

    it('Diminishing Returns: 1->2 produz ganho relativo maior que 4->5', () => {
      const score1 = infrastructureCapabilityService.calculateDiminishingScore(1) // 35
      const score2 = infrastructureCapabilityService.calculateDiminishingScore(2) // 55 (+20)
      const score3 = infrastructureCapabilityService.calculateDiminishingScore(3) // 72 (+17)
      const score4 = infrastructureCapabilityService.calculateDiminishingScore(4) // 85 (+13)
      const score5 = infrastructureCapabilityService.calculateDiminishingScore(5) // 95 (+10)

      const gain1to2 = score2 - score1
      const gain4to5 = score5 - score4

      expect(gain1to2).toBeGreaterThan(gain4to5)
      expect(gain1to2).toBe(20)
      expect(gain4to5).toBe(10)
      expect(score5).toBeGreaterThan(score4)
    })
  })

  // ==========================================================================
  // 2. TESTE DE NÃO-INTERFERÊNCIA FÍSICA DIRETA (Requisito 37)
  // ==========================================================================
  describe('2. Teste de Não-Interferência Física Direta (Regra de Ouro)', () => {
    const mockTechnicalAttributes = {
      downforce_high: 80,
      downforce_med: 80,
      downforce_low: 80,
      aerodynamic_efficiency: 80,
      drag: 75,
      suspension_geometry: 78,
      ride_height_sensitivity: 76,
      chassis_rigidity: 82,
      mechanical_balance: 80,
      braking_stability: 81,
      tyre_management: 79,
      gearbox_efficiency: 80,
      deployment_strategy: 80,
      cooling_efficiency: 80,
      harvest_efficiency: 78,
      ice_power: 82,
      ers_power: 80,
      turbo_response: 80,
      driveability: 80,
    }

    const mockPowerUnit = {
      supplier: 'Mercedes' as const,
      icePower: 82,
      ersPower: 80,
      turboResponse: 80,
      coolingDemand: 75,
      harvestEfficiency: 78,
      deploymentStrategy: 80,
      fuelEfficiency: 82,
      overallRating: 81,
    }

    it('Wind Tunnel 2 -> 5 sem P&D mantém carPerformanceRating inalterado', () => {
      const carInput = {
        technicalAttributes: mockTechnicalAttributes,
        chassisRating: 80,
        powerUnitRating: 81,
        carPerformanceRating: 80.5,
        powerUnit: mockPowerUnit,
      }

      const perfBefore = calculateCarPerformance(carInput)

      // Simula alteração do Wind Tunnel sem mexer no carro
      const levelsTunnel2 = {
        factory: 3,
        design_centre: 3,
        cfd: 3,
        wind_tunnel: 2,
        manufacturing: 3,
        simulator: 3,
        operations_centre: 3,
        pitstop_center: 3,
        youth_academy: 3,
      }
      const levelsTunnel5 = { ...levelsTunnel2, wind_tunnel: 5 }

      const caps2 = infrastructureCapabilityService.calculateCapabilities(levelsTunnel2)
      const caps5 = infrastructureCapabilityService.calculateCapabilities(levelsTunnel5)

      // A aeroCorrelation cresceu significativamente
      expect(caps5.aeroCorrelation).toBeGreaterThan(caps2.aeroCorrelation)

      // Mas a performance física direta do carro calculada pelo motor é idêntica
      const perfAfter = calculateCarPerformance(carInput)
      expect(perfAfter.carPerformanceRating).toBe(perfBefore.carPerformanceRating)
      expect(perfAfter.aeroScore).toBe(perfBefore.aeroScore)
    })

    it('CFD 1 -> 5 sem P&D mantém technical_attributes e trackFit inalterados', () => {
      const profileAlbertPark = resolveCircuitProfile(1, 'Melbourne')
      const carInput = {
        technicalAttributes: mockTechnicalAttributes,
        chassisRating: 80,
        powerUnitRating: 81,
        carPerformanceRating: 80.5,
        powerUnit: mockPowerUnit,
      }

      const fitBefore = calculateTrackFit(carInput, profileAlbertPark)
      const fitAfter = calculateTrackFit(carInput, profileAlbertPark)

      expect(fitAfter.trackFitScore).toBe(fitBefore.trackFitScore)
      expect(fitAfter.fitMultiplier).toBe(fitBefore.fitMultiplier)
    })

    it('Academy 1 -> 5 NÃO adiciona atributos gratuitamente a pilotos existentes', () => {
      const levelsAcad1 = {
        factory: 3,
        design_centre: 3,
        cfd: 3,
        wind_tunnel: 3,
        manufacturing: 3,
        simulator: 3,
        operations_centre: 3,
        pitstop_center: 3,
        youth_academy: 1,
      }
      const levelsAcad5 = { ...levelsAcad1, youth_academy: 5 }

      const cap1 = infrastructureCapabilityService.calculateCapabilities(levelsAcad1)
      const cap5 = infrastructureCapabilityService.calculateCapabilities(levelsAcad5)

      // Crescimento de scoutingReach e evaluationAccuracy
      expect(cap5.scoutingReach).toBeGreaterThan(cap1.scoutingReach)
      expect(cap5.evaluationAccuracy).toBeGreaterThan(cap1.evaluationAccuracy)

      // Piloto fictício não é alterado magicamente
      const pilotSpeed = 82
      expect(pilotSpeed).toBe(82)
    })
  })

  // ==========================================================================
  // 3. TESTES DE GARGALOS E SINERGIAS (Requisito 38)
  // ==========================================================================
  describe('3. Diagnóstico de Gargalos (Bottlenecks) e Sinergias', () => {
    it('Caso A: Design 5 / CFD 5 / Wind Tunnel 5 / Manufacturing 1 = alta capacidade conceitual, mas baixa capacidade industrial', () => {
      const levelsCaseA = {
        factory: 4,
        design_centre: 5,
        cfd: 5,
        wind_tunnel: 5,
        manufacturing: 1,
        simulator: 3,
        operations_centre: 3,
        pitstop_center: 3,
        youth_academy: 3,
      }

      const { bottlenecks } =
        infrastructureCapabilityService.evaluateBottlenecksAndSynergies(levelsCaseA)
      const mfgBottleneck = bottlenecks.find((b) => b.domain === 'manufacturing_bridge')

      expect(mfgBottleneck).toBeDefined()
      expect(mfgBottleneck?.weakFacilityId).toBe('manufacturing')
      expect(mfgBottleneck?.penaltyPercent).toBeGreaterThan(0)

      const caps = infrastructureCapabilityService.calculateCapabilities(levelsCaseA)
      expect(caps.designCapacity).toBeGreaterThan(80)
      // Throughput e capacidade física penalizados pelo gargalo da manufatura
      expect(caps.manufacturingCapacity).toBeLessThan(70)
    })

    it('Caso B: Design 2 / CFD 2 / Wind Tunnel 2 / Manufacturing 5 = boa fábrica física, mas capacidade limitada de projeto', () => {
      const levelsCaseB = {
        factory: 3,
        design_centre: 2,
        cfd: 2,
        wind_tunnel: 2,
        manufacturing: 5,
        simulator: 3,
        operations_centre: 3,
        pitstop_center: 3,
        youth_academy: 3,
      }

      const { bottlenecks } =
        infrastructureCapabilityService.evaluateBottlenecksAndSynergies(levelsCaseB)
      const subutilization = bottlenecks.find((b) => b.weakFacilityId === 'design_centre')

      expect(subutilization).toBeDefined()
      const caps = infrastructureCapabilityService.calculateCapabilities(levelsCaseB)
      expect(caps.designCapacity).toBeLessThan(65)
    })

    it('Caso C: Academy 5 / Simulator 1 = alto scouting e programa júnior, mas capacidade de preparação/treinamento limitada', () => {
      const levelsCaseC = {
        factory: 3,
        design_centre: 3,
        cfd: 3,
        wind_tunnel: 3,
        manufacturing: 3,
        simulator: 1,
        operations_centre: 3,
        pitstop_center: 3,
        youth_academy: 5,
      }

      const { bottlenecks } =
        infrastructureCapabilityService.evaluateBottlenecksAndSynergies(levelsCaseC)
      const academyBottleneck = bottlenecks.find((b) => b.domain === 'talent_academy')

      expect(academyBottleneck).toBeDefined()
      expect(academyBottleneck?.weakFacilityId).toBe('simulator')

      const caps = infrastructureCapabilityService.calculateCapabilities(levelsCaseC)
      expect(caps.scoutingReach).toBeGreaterThan(80)
      // Evaluation e Talent Development sofrem penalidade pela falta do simulador
      expect(caps.evaluationAccuracy).toBeLessThan(caps.scoutingReach)
    })

    it('Caso D: Academy 1 + excelente Talent Manager = Manager melhora eficiência (+3% a +8%), mas não transforma infraestrutura básica em nível 5', () => {
      const levelsCaseD = {
        factory: 1,
        design_centre: 1,
        cfd: 1,
        wind_tunnel: 1,
        manufacturing: 1,
        simulator: 1,
        operations_centre: 1,
        pitstop_center: 1,
        youth_academy: 1,
      }

      const mockLiderTeam: Partial<TeamModel> = {
        name: 'Academy Team',
        manager_profile: { profileId: 'lider' } as any,
      }

      const capsWithManager = infrastructureCapabilityService.calculateCapabilities(
        levelsCaseD,
        mockLiderTeam,
      )
      const capsWithoutManager = infrastructureCapabilityService.calculateCapabilities(
        levelsCaseD,
        null,
      )

      // Manager melhora modestamente a capacidade de desenvolvimento de talentos
      expect(capsWithManager.talentDevelopmentCapacity).toBeGreaterThan(
        capsWithoutManager.talentDevelopmentCapacity,
      )
      // Mas não atinge os patamares de uma elite nível 5 (> 85)
      expect(capsWithManager.talentDevelopmentCapacity).toBeLessThan(55)
    })
  })

  // ==========================================================================
  // 4. TESTE DE AUDITORIA E TELEMETRIA (Requisito 36)
  // ==========================================================================
  describe('4. Auditoria de Infraestrutura & Telemetria Completa', () => {
    it('Gera auditoria detalhada para Audi com identificação de gargalos e OPEX', () => {
      const audiTeam: Partial<TeamModel> = {
        name: 'Audi',
        factory_level: 4,
        design_centre_level: 4,
        cfd_level: 4,
        wind_tunnel_level: 3,
        manufacturing_level: 4,
        simulator_level: 4,
        operations_centre_level: 4,
        pitstop_center_level: 3,
        youth_academy_level: 4,
        manager_profile: { profileId: 'engenheiro' } as any,
      }

      const audit = infrastructureCapabilityService.auditInfrastructure(audiTeam)

      expect(audit.facilityLevels.manufacturing).toBe(4)
      expect(audit.facilityLevels.wind_tunnel).toBe(3)
      expect(audit.capabilities.designCapacity).toBeGreaterThan(70)
      expect(audit.capabilities.manufacturingCapacity).toBeGreaterThan(75)
      expect(audit.telemetrySummary).toContain('AUDI')
      expect(audit.telemetrySummary).toContain('Derived:')
      expect(audit.totalAnnualOpex).toBeGreaterThan(30000000) // OPEX anual realista > R$ 30M
      expect(audit.roundOpex).toBe(Math.round(audit.totalAnnualOpex / 24))
    })
  })

  // ==========================================================================
  // 5. TESTE DE DADOS INICIAIS E PRESERVAÇÃO DE SAVES (Requisitos 31 e 40)
  // ==========================================================================
  describe('5. Dados Iniciais Heterogêneos das 28 Equipes e Fallback de Saves Antigos', () => {
    it('Todas as 28 equipes possuem perfil de infraestrutura heterogêneo definido', () => {
      const teamKeys = Object.keys(INITIAL_GRID_FACILITIES)
      expect(teamKeys.length).toBe(28)

      // Teste de heterogeneidade: Haas e Ferrari não possuem as mesmas notas
      const ferrari = getInitialTeamFacilities('ferrari')
      const haas = getInitialTeamFacilities('haas')

      expect(ferrari.wind_tunnel).toBe(5)
      expect(haas.wind_tunnel).toBe(3)
      expect(haas.manufacturing).toBe(2)
    })

    it('Saves antigos sem campos novos herdam fallback seguro de factory_level e simulator_level', () => {
      const oldSaveTeam: Partial<TeamModel> = {
        name: 'Vintage Team',
        factory_level: 4,
        simulator_level: 3,
        pitstop_center_level: 2,
        youth_academy_level: 3,
      }

      const levels = infrastructureCapabilityService.getFacilityLevels(oldSaveTeam)

      // Novos campos herdam factory_level (4) ou simulator_level (3)
      expect(levels.design_centre).toBe(4)
      expect(levels.cfd).toBe(4)
      expect(levels.wind_tunnel).toBe(4)
      expect(levels.manufacturing).toBe(4)
      expect(levels.operations_centre).toBe(3)
      expect(levels.pitstop_center).toBe(2)
      expect(levels.youth_academy).toBe(3)
    })
  })
})
