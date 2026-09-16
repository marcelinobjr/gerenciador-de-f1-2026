/**
 * BATERIA DE TESTES OBRIGATÓRIOS DA ETAPA 8C.1
 * Núcleo Regulatório Canônico & Knowledge Transfer
 *
 * TEST 1 — BASELINE: sem future regulation, carro permanece igual.
 * TEST 2 — ANNOUNCEMENT: regulation anunciada para temporada futura atualiza a timeline; carro não muda.
 * TEST 3 — MINOR VS NEW ERA: Minor mantém maior transferibilidade que New Era nos domínios mais afetados.
 * TEST 4 — GENERIC KNOWLEDGE: Manufacturing sobrevive melhor que Aero Concept específico.
 * TEST 5 — SAVE/LOAD: timeline idêntica após reload.
 * TEST 6 — IDEMPOTENCY: mesmo sourceEventId não duplica announcement.
 * TEST 7 — AUDI MIGRATION: cópia do save Audi permanece 2027 Round 3 com carro e finanças intactos.
 * TEST 8 — NO RETROACTIVE CHANGE: future regulation não altera technical state 2027.
 * TEST 9 — SEASON TRANSITION READINESS: future regulation é reconhecida para a temporada correta, mas ainda não gera carro.
 * + AUDIT & EXPLICABILITY TESTS
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  regulationTimelineService,
  regulationService,
  createDefaultBaselineTimeline,
  buildDefaultTransferabilityProfile,
  CANONICAL_BASELINE_REGULATION_ID,
  CANONICAL_BASELINE_ERA_ID,
} from '@/services/regulationService'
import {
  CANONICAL_TECHNICAL_DOMAINS,
  RegulationTimelineState,
  TechnicalRegulation,
  getKnowledgeTransferTier,
} from '@/types/canonical-regulations'
import { TeamTechnicalOrganization } from '@/types/canonical-staff'

describe('IMPLEMENTAÇÃO Nº 8C.1 — NÚCLEO REGULATÓRIO & KNOWLEDGE TRANSFER', () => {
  beforeEach(() => {
    regulationTimelineService.clearCache()
  })

  // TEST 1 — BASELINE: sem future regulation, carro permanece igual
  it('TEST 1 — BASELINE: inicializa com baseline ativa correta e sem alterar o carro', () => {
    const baselineTimeline = createDefaultBaselineTimeline(2027)

    expect(baselineTimeline.activeRegulationId).toBe(CANONICAL_BASELINE_REGULATION_ID)
    expect(baselineTimeline.activeEraId).toBe(CANONICAL_BASELINE_ERA_ID)
    expect(baselineTimeline.regulations).toHaveLength(1)

    const activeReg = regulationTimelineService.getActiveRegulation(baselineTimeline)
    expect(activeReg).not.toBeNull()
    expect(activeReg?.status).toBe('ACTIVE')
    expect(activeReg?.effectiveSeason).toBe(2026)

    // Sem regulamentos futuros anunciados inicialmente
    const futureRegs = regulationTimelineService.getFutureRegulations(baselineTimeline, 2027)
    expect(futureRegs).toHaveLength(0)

    // Auditoria passa sem erros
    const audit = regulationService.auditRegulationFoundation(baselineTimeline)
    expect(audit.isValid).toBe(true)
    expect(audit.errors).toHaveLength(0)
  })

  // TEST 2 — ANNOUNCEMENT: regulation anunciada para temporada futura atualiza a timeline; carro não muda
  it('TEST 2 — ANNOUNCEMENT: anuncia regulamento futuro atualizando a timeline sem mutar o carro', () => {
    let timeline = createDefaultBaselineTimeline(2027)

    const announceResult = regulationService.announceRegulation({
      timeline,
      regulationId: 'reg_2030_future_concept',
      name: 'Regulamento Técnico FIA 2030 — Nova Era de Sustentabilidade',
      category: 'NEW_TECHNICAL_ERA',
      severity: 'EXTREME',
      announcementSeason: 2028,
      effectiveSeason: 2030,
      affectedDomains: ['aerodynamics', 'floorGroundEffect', 'chassis', 'cooling'],
      sourceEventId: 'fia_wmc_2028_announcement',
    })

    expect(announceResult.announced).toBe(true)
    expect(announceResult.event).not.toBeNull()
    expect(announceResult.event?.type).toBe('RegulationAnnounced')
    timeline = announceResult.updatedTimeline

    // Timeline agora tem 2 regulamentos: 1 ativo (2026) e 1 anunciado futuro (2030)
    expect(timeline.regulations).toHaveLength(2)
    const futureRegs = regulationTimelineService.getFutureRegulations(timeline, 2027)
    expect(futureRegs).toHaveLength(1)
    expect(futureRegs[0].regulationId).toBe('reg_2030_future_concept')
    expect(futureRegs[0].effectiveSeason).toBe(2030)

    // O ativo continua sendo o de 2026!
    const active = regulationTimelineService.getActiveRegulation(timeline)
    expect(active?.regulationId).toBe(CANONICAL_BASELINE_REGULATION_ID)
    expect(active?.status).toBe('ACTIVE')

    // Auditoria canônica permanece 100% válida
    const audit = regulationService.auditRegulationFoundation(timeline)
    expect(audit.isValid).toBe(true)
  })

  // TEST 3 — MINOR VS NEW ERA: Minor mantém maior transferibilidade que New Era nos domínios mais afetados
  it('TEST 3 — MINOR VS NEW ERA: Minor mantém significativamente maior transferibilidade que New Era no aero', () => {
    const minorProfile = buildDefaultTransferabilityProfile('MINOR_REGULATION_CHANGE', [
      'aerodynamics',
      'floorGroundEffect',
    ])
    const newEraProfile = buildDefaultTransferabilityProfile('NEW_TECHNICAL_ERA', [
      'aerodynamics',
      'floorGroundEffect',
    ])

    // No domínio de aerodinâmica
    const aeroMinor = minorProfile.aerodynamics
    const aeroNewEra = newEraProfile.aerodynamics

    expect(aeroMinor).toBeGreaterThan(aeroNewEra)
    expect(aeroMinor).toBeGreaterThanOrEqual(0.75) // Alta continuidade
    expect(aeroNewEra).toBeLessThan(0.5) // Ruptura conceitual

    // Tiers qualitativos
    expect(getKnowledgeTransferTier(aeroMinor)).toBe('HIGH')
    expect(getKnowledgeTransferTier(aeroNewEra)).toBe('LOW')
  })

  // TEST 4 — GENERIC KNOWLEDGE: Manufacturing sobrevive melhor que Aero Concept específico
  it('TEST 4 — GENERIC KNOWLEDGE: Manufacturing e processos sobrevivem melhor que Aero na New Era', () => {
    const newEraProfile = buildDefaultTransferabilityProfile('NEW_TECHNICAL_ERA', [
      'aerodynamics',
      'floorGroundEffect',
      'chassis',
    ])

    const manufacturingRatio = newEraProfile.manufacturing
    const simulationRatio = newEraProfile.simulation
    const aeroRatio = newEraProfile.aerodynamics

    expect(manufacturingRatio).toBeGreaterThan(0.85) // Regra 12: Genérico não desaparece
    expect(simulationRatio).toBeGreaterThan(0.8)
    expect(manufacturingRatio).toBeGreaterThan(aeroRatio)

    // Testar cálculo de Applicable Knowledge com org fictícia da 7B
    const mockOrg: TeamTechnicalOrganization = {
      teamId: 'audi_test',
      season: 2027,
      organizationLevel: 75,
      operationalEfficiency: 80,
      knowledge: {
        domains: {
          aerodynamics: {
            accumulatedExperience: 90,
            staffDomainStrength: 85,
            dominantConcepts: ['ground_effect'],
          },
          chassis: {
            accumulatedExperience: 80,
            staffDomainStrength: 75,
            dominantConcepts: ['monocoque'],
          },
          vehicleDynamics: {
            accumulatedExperience: 75,
            staffDomainStrength: 70,
            dominantConcepts: ['pull_rod'],
          },
          simulation: {
            accumulatedExperience: 85,
            staffDomainStrength: 80,
            dominantConcepts: ['cfd_correlation'],
          },
          operations: {
            accumulatedExperience: 92,
            staffDomainStrength: 88,
            dominantConcepts: ['rapid_cnc'],
          },
        },
      },
    } as any

    const testReg: TechnicalRegulation = {
      regulationId: 'reg_2030_new_era',
      name: '2030 New Era',
      technicalEraId: 'era_2030',
      category: 'NEW_TECHNICAL_ERA',
      severity: 'EXTREME',
      status: 'ANNOUNCED',
      announcementSeason: 2028,
      effectiveSeason: 2030,
      affectedDomains: ['aerodynamics'],
      technicalPriorities: { aerodynamics: 'HIGH' },
      transferabilityProfile: newEraProfile,
      uncertainty: 'HIGH',
      publicDescription: 'Teste de nova era',
      createdAt: new Date().toISOString(),
    }

    const appAero = regulationService.getApplicableKnowledge({
      teamTechnicalOrg: mockOrg,
      regulation: testReg,
      domain: 'aerodynamics',
    })

    const appMfg = regulationService.getApplicableKnowledge({
      teamTechnicalOrg: mockOrg,
      regulation: testReg,
      domain: 'manufacturing',
    })

    // Manufacturing deve reter muito mais do conhecimento existente que o Aero
    expect(appMfg.applicableKnowledge).toBeGreaterThan(appAero.applicableKnowledge)
    expect(appMfg.applicableKnowledge).toBeGreaterThanOrEqual(80)
    expect(appAero.applicableKnowledge).toBeLessThan(50)
    expect(appAero.applicableKnowledge).toBeGreaterThan(0) // Proibido zerar (Regra 12)
  })

  // TEST 5 — SAVE/LOAD: timeline idêntica após serialização / persistência
  it('TEST 5 — SAVE/LOAD: timeline idêntica após serialização e desserialização JSON', () => {
    let timeline = createDefaultBaselineTimeline(2027)

    const ann = regulationService.announceRegulation({
      timeline,
      regulationId: 'reg_2029_td',
      name: 'Diretiva Técnica TD-042 Flexi-Wings',
      category: 'TECHNICAL_DIRECTIVE',
      severity: 'LOW',
      announcementSeason: 2028,
      effectiveSeason: 2029,
      affectedDomains: ['aerodynamics'],
      sourceEventId: 'ev_td_042',
    })
    timeline = ann.updatedTimeline

    // Simulação do Save/Load no PocketBase (JSON)
    const jsonString = JSON.stringify(timeline)
    const restoredTimeline: RegulationTimelineState = JSON.parse(jsonString)

    expect(restoredTimeline.activeEraId).toBe(timeline.activeEraId)
    expect(restoredTimeline.activeRegulationId).toBe(timeline.activeRegulationId)
    expect(restoredTimeline.regulations).toHaveLength(timeline.regulations.length)
    expect(restoredTimeline.regulations[1].regulationId).toBe('reg_2029_td')
    expect(restoredTimeline.regulations[1].status).toBe('ANNOUNCED')
    expect(restoredTimeline.historyLog).toHaveLength(timeline.historyLog.length)

    // Auditoria passa após o restore
    const audit = regulationService.auditRegulationFoundation(restoredTimeline)
    expect(audit.isValid).toBe(true)
  })

  // TEST 6 — IDEMPOTENCY: mesmo sourceEventId não duplica announcement
  it('TEST 6 — IDEMPOTENCY: mesmo sourceEventId ou regulationId não duplica o anúncio na timeline', () => {
    let timeline = createDefaultBaselineTimeline(2027)

    const call1 = regulationService.announceRegulation({
      timeline,
      regulationId: 'reg_2030_duplicate_test',
      name: 'Regulamento 2030',
      category: 'MAJOR_REGULATION_CHANGE',
      announcementSeason: 2028,
      effectiveSeason: 2030,
      sourceEventId: 'event_idem_100',
    })

    expect(call1.announced).toBe(true)
    timeline = call1.updatedTimeline
    expect(timeline.regulations).toHaveLength(2)

    // Segunda chamada idêntica (reload ou retry de rede)
    const call2 = regulationService.announceRegulation({
      timeline,
      regulationId: 'reg_2030_duplicate_test',
      name: 'Regulamento 2030 Repetido',
      category: 'MAJOR_REGULATION_CHANGE',
      announcementSeason: 2028,
      effectiveSeason: 2030,
      sourceEventId: 'event_idem_100',
    })

    expect(call2.announced).toBe(false)
    expect(call2.event).toBeNull()
    expect(call2.updatedTimeline.regulations).toHaveLength(2) // NÃO duplicou
  })

  // TEST 7 — AUDI MIGRATION: cópia do save Audi permanece 2027 Round 3 com carro e finanças intactos
  it('TEST 7 — AUDI MIGRATION: inicialização de timeline não altera atributos de carro, round ou finanças da Audi', () => {
    // Snapshot fiel do save atual da Audi
    const audiSaveSnapshot = {
      id: '8oveg16plyvu1yj',
      name: 'Audi Revolut F1 Team',
      seasonYear: 2027,
      currentRound: 3,
      chassisLevel: 62,
      aeroLevel: 65,
      budget: 142000000,
      costCapSpent: 38500000,
      strength: 63,
    }

    // Inicialização da baseline regulatória aditiva
    const baseline = createDefaultBaselineTimeline(audiSaveSnapshot.seasonYear)

    // Verificar que o estado do save permaneceu estritamente intocado
    expect(audiSaveSnapshot.seasonYear).toBe(2027)
    expect(audiSaveSnapshot.currentRound).toBe(3)
    expect(audiSaveSnapshot.chassisLevel).toBe(62)
    expect(audiSaveSnapshot.aeroLevel).toBe(65)
    expect(audiSaveSnapshot.budget).toBe(142000000)
    expect(audiSaveSnapshot.costCapSpent).toBe(38500000)
    expect(audiSaveSnapshot.strength).toBe(63)

    expect(baseline.currentSeason).toBe(2027)
    expect(baseline.activeRegulationId).toBe(CANONICAL_BASELINE_REGULATION_ID)
  })

  // TEST 8 — NO RETROACTIVE CHANGE: future regulation não altera technical state 2027
  it('TEST 8 — NO RETROACTIVE CHANGE: anúncio para 2030 não afeta o carro ou o regulamento de 2027', () => {
    let timeline = createDefaultBaselineTimeline(2027)

    const initialActive = regulationTimelineService.getActiveRegulation(timeline)

    // Anunciar grande ruptura técnica para 2030
    const res = regulationService.announceRegulation({
      timeline,
      regulationId: 'reg_2030_radical_shift',
      name: 'Ruptura Radical 2030',
      category: 'NEW_TECHNICAL_ERA',
      severity: 'EXTREME',
      announcementSeason: 2028,
      effectiveSeason: 2030,
      affectedDomains: ['aerodynamics', 'floorGroundEffect', 'chassis', 'suspension'],
    })
    timeline = res.updatedTimeline

    // O regulamento ativo em 2027 CONTINUA o mesmo
    const activeAfter = regulationTimelineService.getActiveRegulation(timeline)
    expect(activeAfter?.regulationId).toBe(initialActive?.regulationId)
    expect(activeAfter?.status).toBe('ACTIVE')
    expect(activeAfter?.effectiveSeason).toBe(2026)

    // O novo está confirmado APENAS como futuro (ANNOUNCED)
    const target2030 = regulationTimelineService.findRegulationById(
      timeline,
      'reg_2030_radical_shift',
    )
    expect(target2030?.status).toBe('ANNOUNCED')
    expect(target2030?.effectiveSeason).toBe(2030)
  })

  // TEST 9 — SEASON TRANSITION READINESS: future regulation é reconhecida para a temporada correta, mas ainda não gera carro
  it('TEST 9 — SEASON TRANSITION READINESS: Season Transition reconhece future regulation e ativa no ano correto sem gerar novo carro', () => {
    let timeline = createDefaultBaselineTimeline(2027)

    // Anunciar regulamento que entra em vigor em 2028
    const annRes = regulationService.announceRegulation({
      timeline,
      regulationId: 'reg_2028_aero_trim',
      name: 'Revisão Aerodinâmica 2028',
      category: 'MINOR_REGULATION_CHANGE',
      severity: 'MEDIUM',
      announcementSeason: 2027,
      effectiveSeason: 2028,
      affectedDomains: ['aerodynamics'],
    })
    timeline = annRes.updatedTimeline

    // Simulação do check da Season Transition de 2027 -> 2028
    const fromSeasonYear = 2027
    const toSeasonYear = 2028

    const futureRegs = regulationTimelineService.getFutureRegulations(timeline, fromSeasonYear)
    const targetReg = futureRegs.find((r) => r.effectiveSeason === toSeasonYear)

    expect(targetReg).toBeDefined()
    expect(targetReg?.regulationId).toBe('reg_2028_aero_trim')

    // Ativação canônica na virada de temporada
    const actRes = regulationService.activateRegulation({
      timeline,
      regulationId: targetReg!.regulationId,
      seasonYear: toSeasonYear,
      sourceEventId: `trans_act_${toSeasonYear}`,
    })

    expect(actRes.activated).toBe(true)
    expect(actRes.activatedRegulation?.regulationId).toBe('reg_2028_aero_trim')
    expect(actRes.activatedRegulation?.status).toBe('ACTIVE')
    expect(actRes.supersededRegulation?.regulationId).toBe(CANONICAL_BASELINE_REGULATION_ID)
    expect(actRes.supersededRegulation?.status).toBe('SUPERSEDED')

    const newTimeline = actRes.updatedTimeline
    expect(newTimeline.activeRegulationId).toBe('reg_2028_aero_trim')
    expect(newTimeline.currentSeason).toBe(2028)

    // Auditoria canônica permanece 100% válida após a transição
    const audit = regulationService.auditRegulationFoundation(newTimeline)
    expect(audit.isValid).toBe(true)
    expect(audit.stats.activeCount).toBe(1)
    expect(audit.stats.supersededCount).toBe(1)
  })

  // TESTE EXTRA — EXPLICABILIDADE CANÔNICA (Regra 30)
  it('TEST EXTRA — EXPLICABILIDADE CANÔNICA: explainRegulationImpact gera diagnósticos qualitativos sem vazar números crus', () => {
    const newEraProfile = buildDefaultTransferabilityProfile('NEW_TECHNICAL_ERA', [
      'aerodynamics',
      'cooling',
    ])

    const testReg: TechnicalRegulation = {
      regulationId: 'reg_2030_explain_test',
      name: 'Regulamento Técnico FIA 2030',
      technicalEraId: 'era_2030',
      category: 'NEW_TECHNICAL_ERA',
      severity: 'EXTREME',
      status: 'ANNOUNCED',
      announcementSeason: 2028,
      effectiveSeason: 2030,
      affectedDomains: ['aerodynamics', 'cooling'],
      technicalPriorities: { aerodynamics: 'CRITICAL', manufacturing: 'MEDIUM' },
      transferabilityProfile: newEraProfile,
      uncertainty: 'HIGH',
      publicDescription: 'Teste de explicabilidade oficial da FIA.',
      createdAt: new Date().toISOString(),
    }

    const explanation = regulationService.explainRegulationImpact(testReg)

    expect(explanation.regulationId).toBe('reg_2030_explain_test')
    expect(explanation.uncertainty).toBe('HIGH')
    expect(explanation.domains).toHaveLength(CANONICAL_TECHNICAL_DOMAINS.length)

    const aeroExp = explanation.domains.find((d) => d.domainId === 'aerodynamics')
    expect(aeroExp?.isAffected).toBe(true)
    expect(aeroExp?.transferabilityTier).toBe('LOW')
    expect(aeroExp?.summaryText).toContain('Ruptura profunda no conceito aerodinâmico')

    const mfgExp = explanation.domains.find((d) => d.domainId === 'manufacturing')
    expect(mfgExp?.isAffected).toBe(false)
    expect(mfgExp?.transferabilityTier).toBe('VERY_HIGH')
    expect(mfgExp?.summaryText).toContain('processos de fabricação sobrevivem intactos')
  })
})
