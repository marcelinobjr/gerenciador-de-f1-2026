/**
 * driverHiringService.ts
 *
 * Serviço canônico centralizado de contratação de pilotos no APEX GP Manager.
 * Garante:
 * 1. Preservação estrita e integral de identidade: driverId_before === driverId_after,
 *    portrait, potencial, confiança, estatísticas históricas, metadados persistentes.
 * 2. Unicidade de registro (sem clonagem, sem criação de id duplicado).
 * 3. Criação/atualização consistente do canonical_contract (status active ou future_pending).
 * 4. Sem contratos conflitantes e sem vínculos duplicados.
 * 5. Lançamento regulamentar de luvas no FinancialLedger e conciliação de orçamento.
 * 6. Utilizado tanto pela tela de Pilotos (DriversPage) quanto pela aba Contratos de Equipe (TeamPage).
 */

import pb from '@/lib/pocketbase/client'
import { DriverModel, TeamModel } from '@/types/f1'
import { financialLedgerService } from '@/services/financialLedgerService'
import { assignGeneratedPortraitProfile } from '@/services/driverPortraitAssignmentService'
import { sanitizeDriverProceduralData } from '@/lib/sanitizeDriverProceduralData'

export interface CanonicalContractData {
  contractId: string
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  role: 'LEAD_DRIVER' | 'RESERVE'
  startSeason: number
  endSeason: number
  annualSalary: number
  signingBonus: number
  status: 'active' | 'future_pending'
  signedDate: string
}

export interface HireDriverParams {
  driver: DriverModel | any
  team: TeamModel | any
  contractRole: 'titular' | 'reserva'
  contractMode?: 'immediate' | 'precontract'
  seasonYear?: number
  currentRound?: number
  durationYears?: number
  customSalaryUsd?: number
}

export interface HireDriverResult {
  success: boolean
  driverId: string
  updatedDriver: DriverModel
  canonicalContract: CanonicalContractData
  proratedSigningFeeUsd: number
  message: string
}

export const driverHiringService = {
  /**
   * Valida elegibilidade básica de contratação
   */
  canHireDriver(
    driver: DriverModel | any,
    contractRole: 'titular' | 'reserva',
  ): { eligible: boolean; reason?: string } {
    if (!driver) return { eligible: false, reason: 'Piloto inválido' }

    // Idade mínima para titular (18 anos)
    if (contractRole === 'titular' && driver.age && driver.age < 18) {
      return {
        eligible: false,
        reason: 'Pilotos menores de 18 anos só podem assumir posições de reserva ou academia.',
      }
    }

    return { eligible: true }
  },

  /**
   * Calcula taxa de assinatura (luvas) proporcional
   */
  calculateSigningFee(
    annualSalaryUsd: number,
    contractMode: 'immediate' | 'precontract' = 'immediate',
  ): number {
    return contractMode === 'immediate'
      ? Math.round(annualSalaryUsd * 0.25)
      : Math.round(annualSalaryUsd * 0.1)
  },

  /**
   * Executa a contratação canônica do piloto preservando integralmente sua identidade.
   */
  async executeDriverHire(params: HireDriverParams): Promise<HireDriverResult> {
    const {
      driver,
      team,
      contractRole,
      contractMode = 'immediate',
      seasonYear = 2026,
      currentRound = 1,
      durationYears = 1,
      customSalaryUsd,
    } = params

    if (!team || !team.id) {
      throw new Error('Equipe não identificada.')
    }
    if (!driver) {
      throw new Error('Piloto não identificado.')
    }

    const validation = this.canHireDriver(driver, contractRole)
    if (!validation.eligible) {
      throw new Error(validation.reason || 'Contratação não permitida.')
    }

    const annualSalaryUsd =
      customSalaryUsd !== undefined
        ? customSalaryUsd
        : (driver.salaryUsd ?? driver.salary ?? 2000000)

    const proratedSigningFeeUsd = this.calculateSigningFee(annualSalaryUsd, contractMode)

    if ((team.budget || 0) < proratedSigningFeeUsd) {
      throw new Error(
        `Orçamento insuficiente. É necessário $${proratedSigningFeeUsd.toLocaleString()} para as luvas contratuais.`,
      )
    }

    const targetDriverId = driver.rawDbRecord?.id || driver.id

    // Busca registro existente se existir ou prepara dados
    let existingDriverRecord: any = driver.rawDbRecord
    if (!existingDriverRecord && targetDriverId) {
      try {
        existingDriverRecord = await pb.collection('drivers').getOne(targetDriverId)
      } catch {
        // Se targetDriverId não existir no banco, busca por nome antes de criar qualquer novo registro
        try {
          existingDriverRecord = await pb
            .collection('drivers')
            .getFirstListItem(`name = "${driver.name}"`)
        } catch {
          existingDriverRecord = null
        }
      }
    }

    let finalDriverId = targetDriverId
    if (!finalDriverId && existingDriverRecord) {
      finalDriverId = existingDriverRecord.id
    }

    // Se verdadeiramente não existe registro persistido no banco para este piloto, cria uma única vez
    if (!finalDriverId) {
      let initialProcData = driver.procedural_data || {}
      if (driver.origin_type === 'procedural' || (!driver.id?.startsWith('DRV_') && !driver.id?.startsWith('mbj-'))) {
        const existingProfileId =
          initialProcData.generatedPortraitProfileId ||
          initialProcData.visualIdentity?.generatedPortraitProfileId ||
          (initialProcData.visualIdentity?.portraitAssetId?.startsWith('Piloto')
            ? initialProcData.visualIdentity.portraitAssetId
            : null)
        if (!existingProfileId) {
          const assigned = assignGeneratedPortraitProfile(
            initialProcData.visualIdentity?.gender || driver.gender,
            driver.id || driver.name || Date.now(),
          )
          initialProcData = {
            ...initialProcData,
            generatedPortraitProfileId: assigned.profileId,
            visualIdentity: {
              ...(initialProcData.visualIdentity || {}),
              portraitAssetId: assigned.portraitAssetId,
              generatedPortraitProfileId: assigned.profileId,
              gender: assigned.gender,
            },
          }
        }
      }

      const created = await pb.collection('drivers').create({
        name: driver.name,
        nationality: driver.nationality,
        age: driver.age,
        speed: driver.speed,
        consistency: driver.consistency,
        rain: driver.rain,
        defense: driver.defense,
        salary: annualSalaryUsd,
        contract_end: seasonYear + durationYears,
        role: contractRole,
        category: 'f1',
        morale: driver.morale ?? 80,
        physical_condition: driver.physical_condition ?? 100,
        true_potential: driver.true_potential,
        perceived_potential: driver.perceived_potential,
        evaluation_confidence: driver.evaluation_confidence,
        procedural_data: sanitizeDriverProceduralData(initialProcData, initialProcData),
      })
      finalDriverId = created.id
      existingDriverRecord = created
    }

    const existingProcData =
      existingDriverRecord?.procedural_data || (driver as any)?.procedural_data || {}

    const wasInAcademy = Boolean(
      existingDriverRecord?.is_academy ||
      existingDriverRecord?.career_status === 'academy' ||
      existingProcData?.careerStatus === 'academy' ||
      existingProcData?.academyOriginTeamId,
    )

    const academyOrigin =
      existingDriverRecord?.academy_origin_team_id ||
      existingProcData?.academyOriginTeamId ||
      (wasInAcademy ? team.id : null)

    const updatedProceduralData = sanitizeDriverProceduralData(existingProcData, {
      ...existingProcData,
      academyOriginTeamId: academyOrigin,
      academyPromotedToProfessional: wasInAcademy
        ? true
        : existingProcData?.academyPromotedToProfessional,
      academyPromotionDate: wasInAcademy
        ? existingProcData?.academyPromotionDate || new Date().toISOString()
        : existingProcData?.academyPromotionDate,
      careerStatus: 'professional',
    })

    const canonicalContractObj: CanonicalContractData = {
      contractId: `contract_${finalDriverId}_${seasonYear}_${Date.now()}`,
      driverId: finalDriverId,
      driverName: driver.name,
      teamId: team.id,
      teamName: team.name,
      role: contractRole === 'reserva' ? 'RESERVE' : 'LEAD_DRIVER',
      startSeason: contractMode === 'precontract' ? seasonYear + 1 : seasonYear,
      endSeason: seasonYear + durationYears,
      annualSalary: annualSalaryUsd,
      signingBonus: proratedSigningFeeUsd,
      status: contractMode === 'precontract' ? 'future_pending' : 'active',
      signedDate: new Date().toISOString(),
    }

    let updatedDriverDb: DriverModel

    if (contractMode === 'precontract') {
      updatedDriverDb = await pb.collection('drivers').update<DriverModel>(finalDriverId, {
        next_team_id: team.id,
        next_contract_role: contractRole,
        future_contract: canonicalContractObj,
        procedural_data: updatedProceduralData,
      })
    } else {
      if (contractRole === 'titular') {
        updatedDriverDb = await pb.collection('drivers').update<DriverModel>(finalDriverId, {
          team_id: team.id,
          reserve_team_id: null,
          role: 'titular',
          contract_role: 'titular',
          category: 'f1',
          salary: annualSalaryUsd,
          contract_end: seasonYear + durationYears,
          career_status: 'active',
          canonical_contract: canonicalContractObj,
          academy_origin_team_id: academyOrigin,
          procedural_data: updatedProceduralData,
        })
      } else {
        updatedDriverDb = await pb.collection('drivers').update<DriverModel>(finalDriverId, {
          reserve_team_id: team.id,
          team_id: null,
          role: 'reserva',
          contract_role: 'reserva',
          category: 'f1',
          salary: annualSalaryUsd,
          contract_end: seasonYear + durationYears,
          career_status: 'active',
          canonical_contract: canonicalContractObj,
          academy_origin_team_id: academyOrigin,
          procedural_data: updatedProceduralData,
        })
      }
    }

    // Lançamento Canônico no Financial Ledger se houver luvas de assinatura
    if (proratedSigningFeeUsd > 0) {
      try {
        await financialLedgerService.postTransaction({
          teamId: team.id,
          seasonYear,
          round: currentRound,
          type: 'expense',
          category: 'driverSalaries',
          subcategory: 'driver_signing_bonus',
          direction: 'outflow',
          amount: proratedSigningFeeUsd,
          costCapClassification: 'excluded',
          sourceSystem: 'driver_contract_signing',
          sourceEntityId: finalDriverId,
          idempotencyKey: `driver_signing_fee_${team.id}_${finalDriverId}_${seasonYear}_${contractMode}_${contractRole}`,
          description: `Luvas contratuais de assinatura de contrato: ${driver.name} (${contractRole})`,
        })
      } catch (finErr) {
        console.warn('Erro ao lançar luvas no FinancialLedger:', finErr)
      }
    }

    try {
      await financialLedgerService.syncTeamBudgetCache(team.id, seasonYear)
    } catch (syncErr) {
      console.warn('Erro ao sincronizar cache de orçamento:', syncErr)
    }

    // Registra evento no sistema
    try {
      await pb.collection('events').create({
        team_id: team.id,
        message:
          contractMode === 'precontract'
            ? `Pré-contrato assinado com ${driver.name} para a próxima temporada (${contractRole}). Taxa de garantia: $${proratedSigningFeeUsd.toLocaleString()}.`
            : `Contratação de ${driver.name} formalizada com sucesso como piloto ${contractRole}. Taxa de assinatura: $${proratedSigningFeeUsd.toLocaleString()}.`,
        type: 'contrato',
      })
    } catch (evErr) {
      console.warn('Falha ao gravar evento de contrato:', evErr)
    }

    const message =
      contractMode === 'precontract'
        ? `Pré-contrato assinado com ${driver.name} para a próxima temporada (${contractRole}).`
        : `Contratação de ${driver.name} formalizada com sucesso como piloto ${contractRole}.`

    return {
      success: true,
      driverId: finalDriverId,
      updatedDriver: updatedDriverDb,
      canonicalContract: canonicalContractObj,
      proratedSigningFeeUsd,
      message,
    }
  },
}
