import { describe, it, expect } from 'vitest'
import {
  managerEffectService,
  NEUTRAL_DOMAIN_BASELINE,
  MAX_MANAGER_MODIFIER,
  MIN_MANAGER_MODIFIER,
} from '@/services/managerEffectService'
import {
  MANAGER_DOMAINS,
  MANAGER_ATTRIBUTE_DOMAIN_MAP,
  ManagerDomainId,
} from '@/lib/manager-attribute-domains'
import { MANAGER_PROFILES, getManagerProfileById } from '@/lib/manager-profiles'
import { f1Service } from '@/services/f1Service'
import { standingsService } from '@/services/standingsService'
import { calculatePitStopDuration } from '@/lib/f1-tire-system'
import type { TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 3 — TEAM PRINCIPAL ATIVO', () => {
  // ==========================================================================
  // 1. MAPEAMENTO DOS ATRIBUTOS E ESTRUTURA DOS 6 DOMÍNIOS CANÔNICOS
  // ==========================================================================
  describe('1. Mapeamento dos 28 Atributos para os 6 Domínios Canônicos', () => {
    it('Confirma a existência e integridade dos 6 domínios canônicos', () => {
      const canonicalDomainKeys: ManagerDomainId[] = [
        'raceManagement',
        'technicalManagement',
        'peopleManagement',
        'commercialManagement',
        'politicalManagement',
        'talentDevelopment',
      ]

      for (const dKey of canonicalDomainKeys) {
        expect(MANAGER_DOMAINS[dKey]).toBeDefined()
        expect(MANAGER_DOMAINS[dKey].id).toBe(dKey)
        expect(MANAGER_DOMAINS[dKey].name).toBeTruthy()
        expect(MANAGER_DOMAINS[dKey].description).toBeTruthy()
      }
    })

    it('Mapeia todos os atributos de manager-profiles.ts com exatamente 1 domínio primário e peso definido', () => {
      const allAttrKeys = Object.keys(MANAGER_PROFILES[0].baseAttributes)
      expect(allAttrKeys.length).toBeGreaterThanOrEqual(28)

      for (const key of allAttrKeys) {
        const mapping = MANAGER_ATTRIBUTE_DOMAIN_MAP[key]
        expect(mapping, `Atributo ${key} deve estar no MANAGER_ATTRIBUTE_DOMAIN_MAP`).toBeDefined()
        expect(mapping.primaryDomain).toBeDefined()
        expect(mapping.primaryWeight).toBeGreaterThan(0)
        expect(mapping.primaryWeight).toBeLessThanOrEqual(1.0)
        if (mapping.secondaryDomain) {
          expect(mapping.secondaryWeight).toBeGreaterThan(0)
          expect(mapping.secondaryWeight).toBeLessThanOrEqual(0.4)
          // Domínio primário e secundário devem ser distintos
          expect(mapping.primaryDomain).not.toBe(mapping.secondaryDomain)
        }
      }
    })

    it('Calcula pontuações dos 6 domínios de forma estável e normalizada (30 a 100)', () => {
      for (const profile of MANAGER_PROFILES) {
        const scores = managerEffectService.calculateDomainScores(
          profile.baseAttributes,
          profile.id,
        )
        for (const [dom, score] of Object.entries(scores)) {
          expect(typeof score).toBe('number')
          expect(Number.isNaN(score)).toBe(false)
          expect(score).toBeGreaterThanOrEqual(30)
          expect(score).toBeLessThanOrEqual(100)
        }
      }
    })
  })

  // ==========================================================================
  // 2. MODIFICADORES, INTENSIDADE (1% a 8%), CAPS E TRADE-OFFS POR ARQUÉTIPO
  // ==========================================================================
  describe('2. Balanceamento, Caps e Anti-Stacking', () => {
    it('Respeita rigorosamente o teto global do modificador (MAX_MANAGER_MODIFIER = 8%)', () => {
      // Teste com atributos extremos (100)
      const maxedAttributes: Record<string, number> = {}
      for (const key of Object.keys(MANAGER_PROFILES[0].baseAttributes)) {
        maxedAttributes[key] = 100
      }

      const teamMaxed: Partial<TeamModel> = {
        name: 'Top Team',
        manager_name: 'Super Boss',
        manager_profile: {
          profileId: 'estrategista',
          baseAttributes: maxedAttributes,
        } as any,
      }

      const evalMaxed = managerEffectService.evaluateManager(teamMaxed)

      for (const [modKey, modVal] of Object.entries(evalMaxed.modifiers)) {
        expect(
          modVal,
          `Modificador ${modKey} deve respeitar teto de ${MAX_MANAGER_MODIFIER}`,
        ).toBeLessThanOrEqual(MAX_MANAGER_MODIFIER + 0.0001)
        expect(
          modVal,
          `Modificador ${modKey} deve respeitar piso de ${MIN_MANAGER_MODIFIER}`,
        ).toBeGreaterThanOrEqual(MIN_MANAGER_MODIFIER - 0.0001)
      }
    })

    it('Estrategista: vantagem em raceManagement (+pit window/estratégia)', () => {
      const estrategistaTeam: Partial<TeamModel> = {
        name: 'Estrategista Team',
        manager_profile: {
          profileId: 'estrategista',
        } as any,
      }

      const evaluation = managerEffectService.evaluateManager(estrategistaTeam)
      expect(evaluation.archetypeId).toBe('estrategista')
      expect(evaluation.domainScores.raceManagement).toBeGreaterThan(85)
      expect(evaluation.modifiers.strategyDecisionBonus).toBeGreaterThan(0.03) // > +3%
      expect(evaluation.modifiers.pitStopErrorReduction).toBeGreaterThan(0.01) // Reduz erros de pit
    })

    it('Competidor: foco em competitividade e motivação com trade-off institucional', () => {
      const competidorTeam: Partial<TeamModel> = {
        name: 'Competidor Team',
        manager_profile: {
          profileId: 'competidor',
        } as any,
      }

      const evaluation = managerEffectService.evaluateManager(competidorTeam)
      expect(evaluation.archetypeId).toBe('competidor')
      expect(evaluation.domainScores.peopleManagement).toBeGreaterThan(75)
      // Trade-off: diplomacia e política menores
      expect(evaluation.domainScores.politicalManagement).toBeLessThan(
        evaluation.domainScores.peopleManagement,
      )
    })

    it('Engenheiro: vantagem em technicalManagement e eficiência de revisões', () => {
      const engenheiroTeam: Partial<TeamModel> = {
        name: 'Engenheiro Team',
        manager_profile: {
          profileId: 'engenheiro',
        } as any,
      }

      const evaluation = managerEffectService.evaluateManager(engenheiroTeam)
      expect(evaluation.archetypeId).toBe('engenheiro')
      expect(evaluation.domainScores.technicalManagement).toBeGreaterThan(85)
      expect(evaluation.modifiers.workshopEfficiencyBonus).toBeGreaterThan(0.02)
    })

    it('Gestor: estabilidade de ambiente, cultura e retenção de moral', () => {
      const gestorTeam: Partial<TeamModel> = {
        name: 'Gestor Team',
        manager_profile: {
          profileId: 'gestor',
        } as any,
      }

      const evaluation = managerEffectService.evaluateManager(gestorTeam)
      expect(evaluation.archetypeId).toBe('gestor')
      expect(evaluation.domainScores.peopleManagement).toBeGreaterThan(85)
      expect(evaluation.modifiers.moraleRecoveryBonus).toBeGreaterThan(0.03)
      expect(evaluation.modifiers.internalStabilityBonus).toBeGreaterThan(0.02)
    })

    it('Empresário: vantagem em commercialManagement e captação de patrocínios', () => {
      const empresarioTeam: Partial<TeamModel> = {
        name: 'Empresário Team',
        manager_profile: {
          profileId: 'empresario',
        } as any,
      }

      const evaluation = managerEffectService.evaluateManager(empresarioTeam)
      expect(evaluation.archetypeId).toBe('empresario')
      expect(evaluation.domainScores.commercialManagement).toBeGreaterThan(85)
      expect(evaluation.modifiers.sponsorValueBonus).toBeGreaterThan(0.03)
      expect(evaluation.modifiers.negotiationMarginBonus).toBeGreaterThan(0.015)
    })

    it('Líder: vantagem em talentDevelopment para aceleração da Academia', () => {
      const liderTeam: Partial<TeamModel> = {
        name: 'Líder Team',
        manager_profile: {
          profileId: 'lider',
        } as any,
      }

      const evaluation = managerEffectService.evaluateManager(liderTeam)
      expect(evaluation.archetypeId).toBe('lider')
      expect(evaluation.domainScores.talentDevelopment).toBeGreaterThan(85)
      expect(evaluation.modifiers.academyDevelopmentBonus).toBeGreaterThan(0.03)
    })
  })

  // ==========================================================================
  // 3. REGRA CRÍTICA DE FISICA: NÃO CRIAR VELOCIDADE DIRETA
  // ==========================================================================
  describe('3. Isolamento Físico e Neutralidade Técnica', () => {
    it('Empresário NÃO altera velocidade, downforce ou carPerformanceRating', () => {
      // Simula time base com piloto e carro
      const baseTeam: Partial<TeamModel> = {
        id: 'team_test',
        name: 'Test Team',
        strength: 70,
        engine_supplier: 'Mercedes',
      }

      const teamWithEmpresario: Partial<TeamModel> = {
        ...baseTeam,
        manager_profile: { profileId: 'empresario' } as any,
      }

      const teamWithNeutral: Partial<TeamModel> = {
        ...baseTeam,
        manager_profile: undefined,
      }

      // Ambos devem preservar a mesma capacidade de chassi e motor
      const evalEmp = managerEffectService.evaluateManager(teamWithEmpresario)
      const evalNeu = managerEffectService.evaluateManager(teamWithNeutral)

      // A avaliação não deve exportar multiplicadores de velocidade direta
      expect((evalEmp.modifiers as any).speedBonus).toBeUndefined()
      expect((evalEmp.modifiers as any).downforceBonus).toBeUndefined()
      expect((evalEmp.modifiers as any).carPerformanceRatingBonus).toBeUndefined()
      expect((evalNeu.modifiers as any).speedBonus).toBeUndefined()
    })

    it('Engenheiro NÃO aumenta patrocínio sem motivo comercial', () => {
      const engenheiroTeam: Partial<TeamModel> = {
        manager_profile: { profileId: 'engenheiro' } as any,
      }
      const empresarioTeam: Partial<TeamModel> = {
        manager_profile: { profileId: 'empresario' } as any,
      }

      const engEval = managerEffectService.evaluateManager(engenheiroTeam)
      const empEval = managerEffectService.evaluateManager(empresarioTeam)

      // O Empresário tem bônus comercial expressivamente superior ao Engenheiro
      expect(empEval.modifiers.sponsorValueBonus).toBeGreaterThan(
        engEval.modifiers.sponsorValueBonus,
      )
    })
  })

  // ==========================================================================
  // 4. INTEGRAÇÃO COM SUBSISTEMAS EXISTENTES
  // ==========================================================================
  describe('4. Integração Controlada com Subsistemas do Jogo', () => {
    it('Patrocínios: f1Service.calculateSponsorMultiplier aplica modificador do Manager de forma controlada', () => {
      const neutralScale = f1Service.calculateSponsorMultiplier({
        constructorPos: 4,
        wins: 1,
        podiums: 2,
        managerCommercialBonus: 0,
      })

      const boostedScale = f1Service.calculateSponsorMultiplier({
        constructorPos: 4,
        wins: 1,
        podiums: 2,
        managerCommercialBonus: 0.06, // +6% do Empresário
      })

      expect(boostedScale.multiplier).toBeGreaterThan(neutralScale.multiplier)
      expect(boostedScale.explanation).toContain('Team Principal')
    })

    it('Moral do Time: standingsService.getTeamMorale recebe amortecimento sem explodir escala', () => {
      const moraleNeutral = standingsService.getTeamMorale({
        teamPoints: 40,
        constructorRank: 7,
        parts: [{ level: 5 }, { level: 5 }],
        managerMoraleBonus: 0,
      })

      const moraleGestor = standingsService.getTeamMorale({
        teamPoints: 40,
        constructorRank: 7,
        parts: [{ level: 5 }, { level: 5 }],
        managerMoraleBonus: 0.05, // +5% do Gestor
      })

      expect(moraleGestor).toBeGreaterThanOrEqual(moraleNeutral)
      expect(moraleGestor).toBeLessThanOrEqual(100)
    })

    it('Pit Stop: calculatePitStopDuration aceita redução de erro do Manager mantendo física realista', () => {
      // 100 execuções não devem gerar tempos irreais (< 1.80s)
      for (let i = 0; i < 50; i++) {
        const pit = calculatePitStopDuration('Audi F1', 'Piloto', true, 80, 3, 0.03)
        expect(pit.durationSec).toBeGreaterThanOrEqual(1.85)
        expect(pit.durationSec).toBeLessThan(15.0) // A menos que slow pit extremo
      }
    })

    it('Reparo de Peças: getPartRepairCost com desconto do Engenheiro', () => {
      const mockPart = { id: 'p1', name: 'Asa', condition: 50, level: 5, team_id: 't1' }
      const normalCost = f1Service.getPartRepairCost(mockPart, 0)
      const discountedCost = f1Service.getPartRepairCost(mockPart, 0.05) // 5% de desconto

      expect(discountedCost).toBeLessThan(normalCost)
      expect(discountedCost).toBe(Math.round(normalCost * 0.95))
    })
  })

  // ==========================================================================
  // 5. TESTE DE TELEMETRIA, AUDITORIA E FALLBACK DE SAVES ANTIGOS
  // ==========================================================================
  describe('5. Telemetria de Auditoria e Compatibilidade de Saves Legados', () => {
    it('Save antigo sem manager_profile retorna fallback neutro com isNeutralFallback = true', () => {
      const legacySaveTeam: Partial<TeamModel> = {
        id: 'legacy_team_1',
        name: 'Old Team',
        strength: 55,
      }

      const evaluation = managerEffectService.evaluateManager(legacySaveTeam)

      expect(evaluation.isNeutralFallback).toBe(true)
      expect(evaluation.managerName).toBe('Team Principal')
      expect(evaluation.archetypeId).toBe('estrategista')
      for (const [dom, score] of Object.entries(evaluation.domainScores)) {
        expect(score).toBeGreaterThanOrEqual(40)
        expect(score).toBeLessThanOrEqual(99)
      }
    })

    it('Formata telemetria de QA legível e rastreável conforme Requisito 14', () => {
      const team: Partial<TeamModel> = {
        name: 'Scuderia',
        manager_profile: { profileId: 'estrategista' } as any,
      }

      const logString = managerEffectService.formatDebugTelemetry(
        team,
        'raceManagement',
        'Pit Window Decision',
        68,
        0.052,
      )

      expect(logString).toContain('Manager: O Estrategista')
      expect(logString).toContain('Gestão de Corrida Domain:')
      expect(logString).toContain('Base: 68%')
      expect(logString).toContain('Manager modifier: +5.2%')
      expect(logString).toContain('Final: 71.5%')
    })
  })
})
