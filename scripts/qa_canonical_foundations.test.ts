import { describe, it, expect } from 'vitest'
import {
  canonicalCarRatingsAdapter,
  canonicalComponentAdapter,
  canonicalHomologationAdapter,
  canonicalEventNotificationAdapter,
} from '@/lib/canonical-adapters'
import {
  CANONICAL_COMPONENT_IDS,
  COMPONENT_NAME_TO_CANONICAL_ID,
  CanonicalDomainEvent,
} from '@/types/canonical-contracts'
import { carTechnicalService } from '@/services/carTechnicalService'
import type { TeamModel, DriverModel, PartModel } from '@/types/f1'
import type { ComponentSpecification } from '@/types/car-technical-model'

describe('FASE 0A — SANEAMENTO TÉCNICO E FUNDAÇÕES CANÔNICAS', () => {
  // ==========================================================================
  // 1. TESTES DE RATINGS (Canônico, Nova Carreira, Save Antigo, Equipe Custom)
  // ==========================================================================
  describe('1. Ratings do Carro (Canônico & Fallback)', () => {
    it('Nova carreira / equipe oficial: deriva chassisRating, powerUnitRating e balanceDelta', () => {
      const mockFerrariTeam: Partial<TeamModel> = {
        name: 'Scuderia Ferrari',
        team_key: 'ferrari',
        engine_supplier: 'Ferrari',
        strength: 91,
      }

      const ratings = canonicalCarRatingsAdapter.fromTeamModel(mockFerrariTeam)

      expect(ratings.chassisRating).toBeGreaterThanOrEqual(85)
      expect(ratings.chassisRating).toBeLessThanOrEqual(95)
      expect(ratings.powerUnitRating).toBeGreaterThan(90) // PU Ferrari ~95.8
      expect(ratings.carPerformanceRating).toBeGreaterThan(80)
      expect(ratings.legacyTeamStrength).toBe(91)
      expect(Math.abs(ratings.balanceDelta)).toBeLessThanOrEqual(2.0)
      expect(Number.isNaN(ratings.chassisRating)).toBe(false)
      expect(Number.isNaN(ratings.powerUnitRating)).toBe(false)
      expect(Number.isNaN(ratings.carPerformanceRating)).toBe(false)
    })

    it('Save antigo: sem campos técnicos, fallback a partir de macro/strength sem quebrar', () => {
      const oldSaveAudiTeam: Partial<TeamModel> = {
        id: '8oveg16plyvu1yj',
        name: 'Audi F1 Team',
        team_key: 'audi',
        engine_supplier: 'Audi',
        strength: 52,
        // calculated_overall e technical_attributes ausentes no save antigo
      }

      const ratings = canonicalCarRatingsAdapter.fromTeamModel(oldSaveAudiTeam)

      expect(ratings.chassisRating).toBeGreaterThan(50)
      expect(ratings.powerUnitRating).toBeGreaterThan(80)
      expect(ratings.legacyTeamStrength).toBe(52)
      expect(ratings.carPerformanceRating).toBeGreaterThan(50)
      expect(ratings.balanceDelta).toBeDefined()
      expect(Number.isNaN(ratings.chassisRating)).toBe(false)

      // Teste do ensureTechnicalData
      const ensured = carTechnicalService.ensureTechnicalData(oldSaveAudiTeam)
      expect(ensured.calculated_overall).toBeGreaterThan(50)
      expect(ensured.technical_attributes).toHaveProperty('slowCorner')
      expect(ensured.technical_attributes).toHaveProperty('topSpeed')
      expect(ensured.technical_attributes).toHaveProperty('cooling')
    })

    it('Equipe personalizada (custom_12th): calcula ratings com consistência', () => {
      const customTeam: Partial<TeamModel> = {
        name: 'Escuderia Brasil',
        is_custom: true,
        engine_supplier: 'Mercedes',
        strength: 40,
      }

      const ratings = canonicalCarRatingsAdapter.fromTeamModel(customTeam)

      expect(ratings.chassisRating).toBeGreaterThanOrEqual(35)
      expect(ratings.powerUnitRating).toBeGreaterThan(90) // Motor Mercedes
      expect(ratings.carPerformanceRating).toBeGreaterThan(45)
      expect(ratings.legacyTeamStrength).toBe(40)
    })

    it('Power Unit permanece separada do chassisRating', () => {
      const teamMercEngine: Partial<TeamModel> = {
        team_key: 'williams',
        engine_supplier: 'Mercedes',
        strength: 42,
      }
      const teamAudiEngine: Partial<TeamModel> = {
        team_key: 'williams',
        engine_supplier: 'Audi',
        strength: 42,
      }

      const ratingsMerc = canonicalCarRatingsAdapter.fromTeamModel(teamMercEngine)
      const ratingsAudi = canonicalCarRatingsAdapter.fromTeamModel(teamAudiEngine)

      // O chassis puro é o mesmo para a Williams
      expect(ratingsMerc.chassisRating).toBe(ratingsAudi.chassisRating)
      // Mas o powerUnitRating difere
      expect(ratingsMerc.powerUnitRating).not.toBe(ratingsAudi.powerUnitRating)
      expect(ratingsMerc.powerUnitRating).toBeGreaterThan(ratingsAudi.powerUnitRating)
    })
  })

  // ==========================================================================
  // 2. TESTES DE COMPONENTES (Ponte Design/Spec ⇄ Unidade Física)
  // ==========================================================================
  describe('2. Componentes e Bridge Canônica', () => {
    it('Normalização tolerante de strings legadas para os 8 IDs canônicos', () => {
      expect(canonicalComponentAdapter.normalizeComponentId('Asa dianteira')).toBe('frontWing')
      expect(canonicalComponentAdapter.normalizeComponentId('Asa traseira')).toBe('rearWing')
      expect(canonicalComponentAdapter.normalizeComponentId('Assoalho')).toBe('floor')
      expect(canonicalComponentAdapter.normalizeComponentId('Difusor')).toBe('diffuser')
      expect(canonicalComponentAdapter.normalizeComponentId('Sidepods')).toBe('sidepods')
      expect(canonicalComponentAdapter.normalizeComponentId('Aerodinâmica ativa')).toBe('sidepods')
      expect(canonicalComponentAdapter.normalizeComponentId('Chassi')).toBe('chassis')
      expect(canonicalComponentAdapter.normalizeComponentId('Suspensão')).toBe('suspension')
      expect(canonicalComponentAdapter.normalizeComponentId('Freios')).toBe('brakes')

      // 8 IDs canônicos oficiais
      expect(CANONICAL_COMPONENT_IDS).toHaveLength(8)
    })

    it('Mapeia PartModel (físico) para PhysicalComponentUnit sem perder integridade', () => {
      const mockPart: PartModel = {
        id: 'part_chassis_01',
        name: 'Chassi',
        level: 7,
        condition: 76,
        team_id: 'team_audi',
      }

      const physicalUnit = canonicalComponentAdapter.partModelToPhysicalUnit(mockPart)

      expect(physicalUnit.unitId).toBe('part_chassis_01')
      expect(physicalUnit.componentId).toBe('chassis')
      expect(physicalUnit.condition).toBe(76)
      expect(physicalUnit.wearPercentage).toBe(24)
      expect(physicalUnit.damagePercentage).toBe(0)
      expect(physicalUnit.isAvailable).toBe(true)
    })

    it('Desgaste da unidade física NÃO altera a qualidade/rating intrínseco do Design/Spec', () => {
      const spec: ComponentSpecification = {
        specId: 'spec_frontWing_gen2',
        componentId: 'frontWing',
        generation: 2,
        specName: 'Spec 2.0 Aero Package',
        baseRating: 88,
        characteristics: { highSpeedBias: 3 },
        costUsd: 3000000,
        rdLeadTimeRounds: 3,
        introducedRound: 5,
      }

      const wornPart: PartModel = {
        id: 'unit_fw_001',
        name: 'Asa dianteira',
        level: 8,
        condition: 35, // Peça bastante gasta em pista
        team_id: 'team_audi',
      }

      const bridge = canonicalComponentAdapter.buildComponentBridge('frontWing', [wornPart], spec)

      // A qualidade intrínseca do projeto permanece 88
      expect(bridge.spec.baseRating).toBe(88)
      expect(bridge.spec.generation).toBe(2)

      // Apenas a unidade física sofreu o desgaste de corrida
      expect(bridge.activeCar1Unit?.condition).toBe(35)
      expect(bridge.activeCar1Unit?.wearPercentage).toBe(65)
    })

    it('Ausência de duplicação lógica: mapAllComponents cobre todos os 8 componentes canônicos', () => {
      const parts: PartModel[] = [
        { id: 'p1', name: 'Chassi', level: 6, condition: 80, team_id: 't1' },
        { id: 'p2', name: 'Asa dianteira', level: 6, condition: 85, team_id: 't1' },
        { id: 'p3', name: 'Asa traseira', level: 6, condition: 70, team_id: 't1' },
        { id: 'p4', name: 'Assoalho', level: 6, condition: 90, team_id: 't1' },
        { id: 'p5', name: 'Suspensão', level: 6, condition: 75, team_id: 't1' },
        { id: 'p6', name: 'Aerodinâmica ativa', level: 6, condition: 80, team_id: 't1' },
      ]

      const all = canonicalComponentAdapter.mapAllComponents(parts)

      expect(Object.keys(all)).toHaveLength(8)
      for (const cId of CANONICAL_COMPONENT_IDS) {
        expect(all[cId]).toBeDefined()
        expect(all[cId].componentId).toBe(cId)
        expect(all[cId].displayName).toBeTruthy()
        expect(all[cId].spec).toBeDefined()
      }
    })
  })

  // ==========================================================================
  // 3. TESTES DE HOMOLOGAÇÃO (Canônico vs Legado)
  // ==========================================================================
  describe('3. Homologação e Licenças de Piloto', () => {
    it('Sistema NOVO (license_status) tem prioridade absoluta quando presente', () => {
      const driverWithNewSystem: Partial<DriverModel> = {
        id: 'driver_bortoleto',
        name: 'Gabriel Bortoleto',
        license_status: 'nivel_a',
        // Valores legados desatualizados ou divergentes
        homologation_status: 'formacao',
        superlicense_points: 15,
      }

      const view = canonicalHomologationAdapter.toCanonicalView(driverWithNewSystem)

      // Sistema novo prevalece
      expect(view.licenseStatus).toBe('nivel_a')
      expect(view.isEligibleForF1Seat).toBe(true)
      expect(view.isEligibleForFP1).toBe(true)
    })

    it('Save antigo sem license_status: fallback seguro converte homologation_status e superlicense', () => {
      const oldDriverEligible: Partial<DriverModel> = {
        id: 'driver_old_1',
        name: 'Piloto Antigo Elegível',
        homologation_status: 'elegivel',
        superlicense_points: 40,
        license_status: undefined,
      }

      const viewEligible = canonicalHomologationAdapter.toCanonicalView(oldDriverEligible)
      expect(viewEligible.licenseStatus).toBe('nivel_a')
      expect(viewEligible.isEligibleForF1Seat).toBe(true)

      const oldDriverReserve: Partial<DriverModel> = {
        id: 'driver_old_2',
        name: 'Piloto Reserva Antigo',
        homologation_status: 'homologacao',
        superlicense_points: 25,
        license_status: undefined,
      }

      const viewReserve = canonicalHomologationAdapter.toCanonicalView(oldDriverReserve)
      expect(viewReserve.licenseStatus).toBe('nivel_b')
      expect(viewReserve.isEligibleForF1Seat).toBe(false)
      expect(viewReserve.isEligibleForFP1).toBe(true)
    })

    it('Conversão para persistência: gera escrita compatível sem apagar legado', () => {
      const updatePayload = canonicalHomologationAdapter.toDatabaseUpdate('nivel_a')

      expect(updatePayload.license_status).toBe('nivel_a')
      expect(updatePayload.homologation_status).toBe('elegivel')
      expect(updatePayload.superlicense_points).toBe(40)
    })
  })

  // ==========================================================================
  // 4. TESTES DE EVENTOS E NOTIFICAÇÕES (Separação de Responsabilidades)
  // ==========================================================================
  describe('4. Eventos de Domínio e Notificações UI', () => {
    it('DomainEvent de contrato gera notificação com canal e link corretos', () => {
      const domainEvent: CanonicalDomainEvent = {
        teamId: 'team_audi',
        type: 'contrato',
        message: 'Contrato de Gabriel Bortoleto renovado por 2 anos!',
        round: 12,
      }

      const notif = canonicalEventNotificationAdapter.domainEventToNotification(
        domainEvent,
        'user_123',
      )

      expect(notif.user_id).toBe('user_123')
      expect(notif.type).toBe('radio')
      expect(notif.title).toBe('Comunicação Contratual')
      expect(notif.link).toBe('/team')
      expect(notif.round).toBe(12)
      expect(notif.read).toBe(false)
    })

    it('DomainEvent técnico/desenvolvimento gera notificação direcionada para /car', () => {
      const domainEvent: CanonicalDomainEvent = {
        teamId: 'team_audi',
        type: 'desenvolvimento',
        message: 'Nova asa dianteira Gen 2 concluída no túnel de vento.',
        round: 4,
      }

      const notif = canonicalEventNotificationAdapter.domainEventToNotification(
        domainEvent,
        'user_123',
      )

      expect(notif.type).toBe('motor')
      expect(notif.title).toBe('Atualização Técnica')
      expect(notif.link).toBe('/car')
    })
  })

  // ==========================================================================
  // 5. TESTES DE COMPATIBILIDADE DE SAVE (Load / Reload / Sem NaN ou Undefined)
  // ==========================================================================
  describe('5. Compatibilidade e Integridade de Dados', () => {
    it('Save antigo da Audi: simulação de reload sem NaN, sem null ou undefined inesperados', () => {
      const audiSave = {
        id: '8oveg16plyvu1yj',
        name: 'Audi F1 Team',
        strength: 52,
        engine_supplier: 'Audi',
        budget: 84035627,
        chassis_level: 47,
        aero_level: 47,
        strategy_level: 46,
      }

      const ratings = canonicalCarRatingsAdapter.fromTeamModel(audiSave as any)
      const patch = canonicalCarRatingsAdapter.toTeamModelPatch(audiSave as any)

      // Validação de sanidade numérica
      expect(ratings.chassisRating).not.toBeNaN()
      expect(ratings.powerUnitRating).not.toBeNaN()
      expect(ratings.carPerformanceRating).not.toBeNaN()
      expect(ratings.balanceDelta).not.toBeNaN()

      // Patch compatível
      expect(patch.calculated_overall).toBeGreaterThan(0)
      expect(patch.balance_delta).toBeDefined()
      expect(patch.technical_balance_delta).toBe(patch.balance_delta)
      expect(patch.technical_attributes).toBeDefined()

      // Todos os 12 atributos devem ser números válidos entre 0 e 100
      for (const [attr, val] of Object.entries(patch.technical_attributes)) {
        expect(typeof val).toBe('number')
        expect(Number.isNaN(val)).toBe(false)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(100)
      }
    })
  })
})
