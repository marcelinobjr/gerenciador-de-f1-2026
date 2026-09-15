import { describe, it, expect, beforeEach } from 'vitest'
import { commercialService } from '@/services/commercialService'
import { financialLedgerService } from '@/services/financialLedgerService'
import {
  CanonicalSponsorSlot,
  CANONICAL_SLOT_METAS,
  SponsorshipContract,
} from '@/types/canonical-commercial'
import { OFFICIAL_SPONSOR_POOL } from '@/lib/sponsor-database'
import { TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 5B — COMERCIAL, PATROCINADORES & CONTRATOS (Casos 72 a 85)', () => {
  const dummyBackmarkerTeam: Partial<TeamModel> = {
    id: 'team_backmarker_1',
    name: 'Sauber Kick Racing',
    strength: 32,
    budget: 40_000_000,
    is_custom: false,
  }

  const dummyMidfieldTeam: Partial<TeamModel> = {
    id: 'team_audi_1',
    name: 'Audi Revolut F1 Team',
    team_key: 'audi',
    strength: 68,
    budget: 95_000_000,
    is_custom: false,
    manager_profile: 'empresario',
  }

  const dummyTopTeam: Partial<TeamModel> = {
    id: 'team_top_1',
    name: 'Ferrari Scuderia',
    strength: 95,
    budget: 150_000_000,
    is_custom: false,
  }

  const dummySponsor = OFFICIAL_SPONSOR_POOL[0] // Itaú / banco enterprise

  // (72) Balanceamento dos cinco slots
  it('(72) Balanceamento dos 5 slots respeita as faixas econômicas (fundo R$ 20-34M, meio R$ 42-63M, ponta R$ 74-102M)', () => {
    const slots: CanonicalSponsorSlot[] = [
      'sidepod',
      'engine_cover',
      'rear_wing',
      'nose',
      'front_wing',
    ]

    // Backmarker
    let backmarkerTotal = 0
    slots.forEach((s) => {
      const off = commercialService.generateContractOfferValue({
        slot: s,
        team: dummyBackmarkerTeam,
        sponsor: dummySponsor,
        constructorRank: 10,
      })
      backmarkerTotal += off.annualValue
    })
    expect(backmarkerTotal).toBeGreaterThanOrEqual(18_000_000)
    expect(backmarkerTotal).toBeLessThanOrEqual(36_000_000)

    // Midfield
    let midfieldTotal = 0
    slots.forEach((s) => {
      const off = commercialService.generateContractOfferValue({
        slot: s,
        team: dummyMidfieldTeam,
        sponsor: dummySponsor,
        constructorRank: 6,
      })
      midfieldTotal += off.annualValue
    })
    expect(midfieldTotal).toBeGreaterThanOrEqual(40_000_000)
    expect(midfieldTotal).toBeLessThanOrEqual(68_000_000)

    // Top Team
    let topTeamTotal = 0
    slots.forEach((s) => {
      const off = commercialService.generateContractOfferValue({
        slot: s,
        team: dummyTopTeam,
        sponsor: dummySponsor,
        constructorRank: 1,
      })
      topTeamTotal += off.annualValue
    })
    expect(topTeamTotal).toBeGreaterThanOrEqual(70_000_000)
    expect(topTeamTotal).toBeLessThanOrEqual(105_000_000)
  })

  // (73) Audi intermediária/forte — referência de calibração
  it('(73) Audi intermediária/forte gera valores proporcionais aos 5 slots (Sidepod > Engine Cover > Wing > Nose > Front)', () => {
    const sidepod = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      constructorRank: 5,
    })
    const engineCover = commercialService.generateContractOfferValue({
      slot: 'engine_cover',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      constructorRank: 5,
    })
    const rearWing = commercialService.generateContractOfferValue({
      slot: 'rear_wing',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      constructorRank: 5,
    })
    const nose = commercialService.generateContractOfferValue({
      slot: 'nose',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      constructorRank: 5,
    })
    const frontWing = commercialService.generateContractOfferValue({
      slot: 'front_wing',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      constructorRank: 5,
    })

    expect(sidepod.annualValue).toBeGreaterThan(engineCover.annualValue)
    expect(engineCover.annualValue).toBeGreaterThan(rearWing.annualValue)
    expect(rearWing.annualValue).toBeGreaterThan(nose.annualValue)
    expect(nose.annualValue).toBeGreaterThan(frontWing.annualValue)

    const total =
      sidepod.annualValue +
      engineCover.annualValue +
      rearWing.annualValue +
      nose.annualValue +
      frontWing.annualValue
    expect(total).toBeGreaterThanOrEqual(45_000_000)
    expect(total).toBeLessThanOrEqual(68_000_000)
  })

  // (74) Inflação controlada (não exponencial em 10 temporadas simuladas)
  it('(74) Simulação de 10 temporadas garante que valores não cresçam exponencialmente', () => {
    let currentMultiplier = 1.0
    for (let season = 1; season <= 10; season++) {
      const attr = commercialService.calculateCommercialAttractiveness({
        team: dummyMidfieldTeam,
        constructorRank: Math.max(1, 6 - Math.floor(season / 3)),
        recentWinsCount: Math.min(5, Math.floor(season / 2)),
      })
      currentMultiplier = attr.commercialMultiplier
      expect(currentMultiplier).toBeLessThanOrEqual(1.45) // Cap estrito
      expect(currentMultiplier).toBeGreaterThanOrEqual(0.65)
    }
  })

  // (75) Recuperação esportiva — crescimento comercial progressivo, não instantâneo
  it('(75) Equipe de fundo que melhora em 3 temporadas cresce de forma progressiva', () => {
    const yr1 = commercialService.calculateCommercialAttractiveness({
      team: dummyBackmarkerTeam,
      constructorRank: 10,
      recentPodiumsCount: 0,
    })
    const yr2 = commercialService.calculateCommercialAttractiveness({
      team: dummyBackmarkerTeam,
      constructorRank: 7,
      recentPodiumsCount: 1,
    })
    const yr3 = commercialService.calculateCommercialAttractiveness({
      team: dummyBackmarkerTeam,
      constructorRank: 4,
      recentPodiumsCount: 3,
    })

    expect(yr1.score).toBeLessThan(yr2.score)
    expect(yr2.score).toBeLessThan(yr3.score)
    // Sem salto absurdo instantâneo (ano 2 não é 2x ano 1)
    expect(yr2.commercialMultiplier).toBeLessThan(yr1.commercialMultiplier * 1.5)
  })

  // (76) Queda — top team cai para o fundo: valor cai gradualmente, marca/prestígio amortecem
  it('(76) Top team caindo para o fundo tem queda amortecida pelo prestígio histórico', () => {
    const fallenTopTeam = commercialService.calculateCommercialAttractiveness({
      team: dummyTopTeam,
      constructorRank: 9,
      recentPodiumsCount: 0,
    })
    const pureBackmarker = commercialService.calculateCommercialAttractiveness({
      team: dummyBackmarkerTeam,
      constructorRank: 9,
      recentPodiumsCount: 0,
    })

    // Ferrari em P9 ainda tem mais valor comercial que Sauber em P9 pelo histórico
    expect(fallenTopTeam.score).toBeGreaterThan(pureBackmarker.score)
    expect(fallenTopTeam.commercialMultiplier).toBeGreaterThan(pureBackmarker.commercialMultiplier)
  })

  // (77) Perfil Empresário vs Engenheiro
  it('(77) Perfil Empresário consegue termos moderadamente melhores e Engenheiro não gera bônus sem motivo', () => {
    const businessmanTeam: Partial<TeamModel> = {
      ...dummyMidfieldTeam,
      manager_profile: 'empresario',
    }
    const engineerTeam: Partial<TeamModel> = {
      ...dummyMidfieldTeam,
      manager_profile: 'engenheiro',
    }

    const offerBusiness = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      team: businessmanTeam,
      sponsor: dummySponsor,
    })
    const offerEngineer = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      team: engineerTeam,
      sponsor: dummySponsor,
    })

    expect(offerBusiness.annualValue).toBeGreaterThanOrEqual(offerEngineer.annualValue)
    // O bônus do empresário é moderado (respeita o cap de -5% a +8%)
    expect(offerBusiness.annualValue).toBeLessThanOrEqual(offerEngineer.annualValue * 1.15)
  })

  // (78) Title Sponsor — não cria sexto slot, premium limitado (+20% a +40%)
  it('(78) Title Sponsor é status contratual sem sexto slot e com premium limitado', () => {
    const standardOffer = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      isTitleSponsor: false,
    })
    const titleOffer = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
      isTitleSponsor: true,
    })

    expect(titleOffer.titlePremiumMultiplier).toBeGreaterThanOrEqual(1.2)
    expect(titleOffer.titlePremiumMultiplier).toBeLessThanOrEqual(1.4)
    expect(titleOffer.annualValue).toBeGreaterThan(standardOffer.annualValue)
    expect(titleOffer.annualValue).toBeLessThan(standardOffer.annualValue * 1.45)
  })

  // (79) Multi-slot package (Sidepod + Engine Cover)
  it('(79) Multi-slot package bloqueia ambos os slots com pagamento único e desconto de bundle', () => {
    const singleSidepod = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
    })
    const singleEngine = commercialService.generateContractOfferValue({
      slot: 'engine_cover',
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
    })

    const packageOffer = commercialService.generateContractOfferValue({
      slot: 'sidepod',
      packageSlots: ['sidepod', 'engine_cover'],
      team: dummyMidfieldTeam,
      sponsor: dummySponsor,
    })

    const simpleSum = singleSidepod.annualValue + singleEngine.annualValue
    // Pacote tem bundle discount, evitando exploit
    expect(packageOffer.annualValue).toBeLessThan(simpleSum)
    expect(packageOffer.annualValue).toBeGreaterThan(singleSidepod.annualValue)
  })

  // (80) Exclusividade setorial — bloqueia concorrente
  it('(80) Exclusividade setorial detecta conflito caso duas marcas do mesmo setor sejam ativadas', () => {
    const activeContracts: SponsorshipContract[] = [
      {
        contractId: 'cnt_bank_1',
        sponsorId: 'sp_itau',
        sponsorName: 'Itaú Private',
        teamId: 'team_audi',
        seasonStart: 2026,
        seasonEnd: 2028,
        slot: 'sidepod',
        fixedAnnualValue: 16_000_000,
        valuePerRound: 666_666,
        paymentSchedule: 'per_round',
        bonuses: [],
        objectives: [],
        exclusivitySector: 'bancos',
        partnershipType: 'main_partner',
        isTitleSponsor: false,
        satisfaction: 85,
        renewalInterest: 75,
        status: 'ativo',
        signingDate: '2026-03-01',
      },
      {
        contractId: 'cnt_bank_2',
        sponsorId: 'sp_santander',
        sponsorName: 'Santander Global',
        teamId: 'team_audi',
        seasonStart: 2026,
        seasonEnd: 2028,
        slot: 'rear_wing',
        fixedAnnualValue: 10_000_000,
        valuePerRound: 416_666,
        paymentSchedule: 'per_round',
        bonuses: [],
        objectives: [],
        exclusivitySector: 'bancos',
        partnershipType: 'main_partner',
        isTitleSponsor: false,
        satisfaction: 80,
        renewalInterest: 70,
        status: 'ativo',
        signingDate: '2026-03-01',
      },
    ]

    const audit = commercialService.auditCommercialIntegrity(
      dummyMidfieldTeam,
      activeContracts,
      2026,
    )
    expect(audit.exclusivityConflicts).toBeGreaterThan(0)
    expect(audit.financialLedgerIntegrity).toBe('WARN')
  })

  // (81) Satisfação do patrocinador suave e amortecida
  it('(81) Satisfação reage aos resultados esportivos sem quedas absurdas de uma única corrida', () => {
    const baseContract: SponsorshipContract = {
      contractId: 'cnt_test_1',
      sponsorId: 'sp_test',
      sponsorName: 'Test Sponsor',
      teamId: 'team_audi',
      seasonStart: 2026,
      seasonEnd: 2027,
      slot: 'sidepod',
      fixedAnnualValue: 15_000_000,
      valuePerRound: 625_000,
      paymentSchedule: 'per_round',
      bonuses: [],
      objectives: [],
      partnershipType: 'main_partner',
      isTitleSponsor: false,
      satisfaction: 85,
      renewalInterest: 70,
      status: 'ativo',
      signingDate: '2026-03-01',
    }

    // Corrida ruim (P14 com meta Top 5)
    const badRace = commercialService.updateSponsorSatisfactionOnRaceResult({
      contract: baseContract,
      teamPosition: 14,
      expectedPosition: 5,
    })
    expect(badRace.updatedContract.satisfaction).toBeLessThan(85)
    expect(badRace.updatedContract.satisfaction).toBeGreaterThan(70) // Não despenca para 20!

    // Corrida excelente (P2 com meta Top 5)
    const goodRace = commercialService.updateSponsorSatisfactionOnRaceResult({
      contract: baseContract,
      teamPosition: 2,
      expectedPosition: 5,
    })
    expect(goodRace.updatedContract.satisfaction).toBeGreaterThan(85)
  })

  // (82) Renovação — satisfação alta permite renovação prioritária
  it('(82) Satisfação alta gera oferta de renovação antecipada e reajuste positivo', () => {
    const happyContract: SponsorshipContract = {
      contractId: 'cnt_test_happy',
      sponsorId: 'sp_test',
      sponsorName: 'Test Sponsor',
      teamId: 'team_audi',
      seasonStart: 2026,
      seasonEnd: 2026,
      slot: 'sidepod',
      fixedAnnualValue: 15_000_000,
      valuePerRound: 625_000,
      paymentSchedule: 'per_round',
      bonuses: [],
      objectives: [],
      partnershipType: 'main_partner',
      isTitleSponsor: false,
      satisfaction: 92,
      renewalInterest: 85,
      status: 'ativo',
      signingDate: '2026-03-01',
    }

    const attr = commercialService.calculateCommercialAttractiveness({
      team: dummyMidfieldTeam,
      constructorRank: 4,
    })
    const evalRenewal = commercialService.evaluateContractRenewal(
      happyContract,
      dummyMidfieldTeam,
      attr,
    )

    expect(evalRenewal.canRenew).toBe(true)
    expect(evalRenewal.earlyRenewalOffered).toBe(true)
    expect(evalRenewal.renewalFixedAnnualValue).toBeGreaterThan(happyContract.fixedAnnualValue)
  })

  // (83) Pagamento de Patrocínio via Financial Ledger com idempotência
  it('(83) Pagamento passa pelo Financial Ledger da 5A e não duplica transações', async () => {
    const postRes1 = await financialLedgerService.postTransaction({
      teamId: 'test_team_pay_1',
      seasonYear: 2026,
      round: 1,
      type: 'revenue',
      category: 'sponsorship',
      subcategory: 'sponsor_payout_r1',
      direction: 'inflow',
      amount: 600_000,
      costCapClassification: 'excluded',
      sourceSystem: 'sponsor_contract',
      sourceEntityId: 'cnt_pay_1',
      idempotencyKey: 'sp_payout_test_team_pay_1_r1_cnt_pay_1',
      description: 'Repasse comercial GP 1',
    })
    expect(postRes1.wasAlreadyProcessed).toBe(false)
    expect(postRes1.transaction.cash_impact).toBe(600_000)

    // Tentativa duplicada com a mesma chave (reload de corrida)
    const postRes2 = await financialLedgerService.postTransaction({
      teamId: 'test_team_pay_1',
      seasonYear: 2026,
      round: 1,
      type: 'revenue',
      category: 'sponsorship',
      subcategory: 'sponsor_payout_r1',
      direction: 'inflow',
      amount: 600_000,
      costCapClassification: 'excluded',
      sourceSystem: 'sponsor_contract',
      sourceEntityId: 'cnt_pay_1',
      idempotencyKey: 'sp_payout_test_team_pay_1_r1_cnt_pay_1',
      description: 'Repasse comercial GP 1 duplicado',
    })
    expect(postRes2.wasAlreadyProcessed).toBe(true)
  })

  // (84) Slot vazio gera receita ZERO (nenhum fallback invisível)
  it('(84) Equipe sem patrocinadores em um slot tem receita zero e a auditoria confirma', () => {
    const emptyContracts: SponsorshipContract[] = []
    const audit = commercialService.auditCommercialIntegrity(
      dummyMidfieldTeam,
      emptyContracts,
      2026,
    )

    expect(audit.totalFixedSponsorshipAnnual).toBe(0)
    audit.slotsBreakdown.forEach((slotInfo) => {
      expect(slotInfo.isOccupied).toBe(false)
      expect(slotInfo.contractAnnualValue).toBe(0)
    })
  })

  // (85) Auditoria de Integridade e Debug Telemetry String
  it('(85) auditCommercialIntegrity emite telemetria canônica no formato exigido pela especificação', () => {
    const activeContracts: SponsorshipContract[] = [
      {
        contractId: 'cnt_audi_sidepod',
        sponsorId: 'sp_vipal',
        sponsorName: 'Vipal',
        teamId: 'team_audi_1',
        seasonStart: 2026,
        seasonEnd: 2028,
        slot: 'sidepod',
        fixedAnnualValue: 17_400_000,
        valuePerRound: 725_000,
        paymentSchedule: 'per_round',
        bonuses: [],
        objectives: [],
        partnershipType: 'main_partner',
        isTitleSponsor: false,
        satisfaction: 81,
        renewalInterest: 75,
        status: 'ativo',
        signingDate: '2026-03-01',
      },
    ]

    const audit = commercialService.auditCommercialIntegrity(
      dummyMidfieldTeam,
      activeContracts,
      2026,
    )
    expect(audit.debugTelemetryString).toContain('COMMERCIAL AUDIT')
    expect(audit.debugTelemetryString).toContain('Commercial Attractiveness:')
    expect(audit.debugTelemetryString).toContain('Team Multiplier:')
    expect(audit.debugTelemetryString).toContain('Sidepod:')
    expect(audit.debugTelemetryString).toContain('Financial Ledger Integrity:')
    expect(audit.financialLedgerIntegrity).toBe('PASS')
  })
})
