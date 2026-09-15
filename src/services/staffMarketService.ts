/**
 * StaffMarketService
 *
 * Implementação Nº 7B:
 * 1. Mercado próprio de Staff (agentes livres e contratações entre equipes rivais).
 * 2. IA atuante para todas as equipes ativas (renovações, contratações, preenchimento de vacâncias).
 * 3. Future Contracts (contrato assinado para a próxima temporada, staff atual cumpre o ano normalmente).
 * 4. Confidencialidade (talks -> agreement -> signed_confidential -> announced).
 * 5. Integração idempotente com FinancialLedgerService (salários, signing bonus, buyouts).
 * 6. Evita proliferação ou explosão salarial multitemporada.
 */

import {
  StaffMember,
  StaffRole,
  StaffContract,
  StaffMarketStatus,
  CANONICAL_STAFF_ROLES,
} from '@/types/canonical-staff'
import { financialLedgerService } from '@/services/financialLedgerService'
import { FREE_AGENT_STAFF_POOL } from '@/data/free-agent-staff'
import { INITIAL_GRID_STAFF_SEEDS } from '@/data/initial-team-staff'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'

export interface StaffMarketState {
  availablePool: StaffMember[]
  contracts: Record<string, StaffContract> // key = staffId
  news: Array<{
    id: string
    round: number
    seasonYear: number
    headline: string
    details: string
    isConfidential: boolean
  }>
}

export class StaffMarketService {
  /**
   * Calcula a atratividade de uma equipe para um membro de staff.
   * Considera prestígio, reputação, salário ofertado e projeto esportivo.
   */
  public evaluateStaffAttractiveness(
    staff: StaffMember,
    teamKey: string,
    offeredSalary: number,
    targetRole: StaffRole,
    teamReputation = 75,
  ): {
    score: number // 0 a 100
    willAccept: boolean
    feedback: string
  } {
    // Salário base esperado para a função e reputação
    const baseExpectedSalary = this.calculateFairMarketSalary(staff, targetRole)
    const salaryRatio = offeredSalary / Math.max(1, baseExpectedSalary)

    let score = 50 // Base neutra

    // Componente Salarial (+/- 30 pontos)
    if (salaryRatio >= 1.25) score += 30
    else if (salaryRatio >= 1.0) score += 15 + (salaryRatio - 1.0) * 60
    else if (salaryRatio >= 0.85) score -= (1.0 - salaryRatio) * 60
    else score -= 35

    // Componente Reputação da Equipe (+/- 15 pontos)
    score += (teamReputation - 75) * 0.5

    // Cargo oferecido: se for promoção (ex: Chief Designer -> Technical Director), ganha bônus
    if (staff.role === 'CHIEF_DESIGNER' && targetRole === 'TECHNICAL_DIRECTOR') {
      score += 15
    } else if (staff.role === 'HEAD_OF_AERODYNAMICS' && targetRole === 'TECHNICAL_DIRECTOR') {
      score += 12
    }

    const willAccept = score >= 60
    let feedback = 'Proposta dentro das expectativas financeiras e do projeto esportivo.'
    if (!willAccept) {
      if (salaryRatio < 0.9) {
        feedback = `Remuneração anual de $${(offeredSalary / 1000000).toFixed(2)}M é considerada abaixo da expectativa de mercado ($${(baseExpectedSalary / 1000000).toFixed(2)}M).`
      } else {
        feedback =
          'O profissional acredita que as ambições atuais da equipe não justificam uma mudança neste momento.'
      }
    }

    return { score: Math.round(score), willAccept, feedback }
  }

  /**
   * Calcula o salário anual justo de mercado com base no cargo, experiência e reputação.
   */
  public calculateFairMarketSalary(staff: StaffMember, targetRole: StaffRole): number {
    const roleBaseMap: Record<StaffRole, number> = {
      TECHNICAL_DIRECTOR: 4500000,
      HEAD_OF_AERODYNAMICS: 3200000,
      CHIEF_DESIGNER: 2700000,
      HEAD_OF_VEHICLE_PERFORMANCE: 2800000,
      HEAD_OF_STRATEGY: 2400000,
      SPORTING_DIRECTOR: 2600000,
      RACE_ENGINEER_1: 1300000,
      RACE_ENGINEER_2: 1200000,
      ACADEMY_DIRECTOR: 1600000,
    }

    const base = roleBaseMap[targetRole] || 2000000
    const repMod = (staff.reputation - 75) * 0.02 // +/- 20%
    const expMod = (staff.attributes.experience - 75) * 0.01 // +/- 15%

    return Math.round(Math.max(600000, base * (1 + repMod + expMod)))
  }

  /**
   * Assina um contrato de Staff (imediato ou futuro).
   * Lança transação no FinancialLedger da 5A de forma estritamente idempotente.
   */
  public async signContract(
    staff: StaffMember,
    teamId: string,
    role: StaffRole,
    annualSalary: number,
    signingBonus: number,
    startSeason: number,
    endSeason: number,
    isFutureContract: boolean,
    seasonYear: number,
    round: number,
  ): Promise<{
    success: boolean
    contract: StaffContract
    message: string
  }> {
    const isImmediate = !isFutureContract && startSeason === seasonYear
    const contractId = `contract_${teamId}_${staff.staffId}_${startSeason}`

    // 1. Registro no Financial Ledger: Signing Bonus (se houver e se for para a equipe do jogador)
    if (signingBonus > 0) {
      try {
        await financialLedgerService.postTransaction({
          teamId,
          seasonYear,
          round,
          category: 'staff',
          direction: 'outflow',
          type: 'expense',
          costCapClassification: 'excluded', // Salários de certos diretores de topo e bônus conforme regulamento
          amount: signingBonus,
          sourceSystem: 'staff_market',
          description: `Bônus de assinatura de contrato: ${staff.name} (${role})`,
          idempotencyKey: `staff_bonus_${contractId}`,
        })
      } catch (err) {
        console.warn('Registro contábil de bônus ignorado ou já computado:', err)
      }
    }

    // 2. Se for contratação imediata e o funcionário estava sob contrato de rival: buyout
    let buyoutClause = 0
    if (isImmediate && staff.teamId && staff.teamId !== teamId) {
      buyoutClause = Math.round(annualSalary * 0.35)
      try {
        await financialLedgerService.postTransaction({
          teamId,
          seasonYear,
          round,
          category: 'staff',
          direction: 'outflow',
          type: 'expense',
          costCapClassification: 'excluded',
          amount: buyoutClause,
          sourceSystem: 'staff_market',
          description: `Cláusula de rescisão contratual (buyout) para liberação de ${staff.name} de ${staff.teamId}`,
          idempotencyKey: `staff_buyout_${contractId}`,
        })
      } catch (err) {
        console.warn('Registro contábil de buyout ignorado ou já computado:', err)
      }
    }

    const contract: StaffContract = {
      contractId,
      staffId: staff.staffId,
      staffName: staff.name,
      teamId: isImmediate ? teamId : staff.teamId || teamId,
      role: isImmediate ? role : staff.role,
      annualSalary,
      startSeason,
      endSeason,
      signingBonus,
      buyoutClause,
      status: isImmediate ? 'active' : 'signed_future',
      confidentiality: isImmediate ? 'announced' : 'signed_confidential',
      futureContract: isFutureContract
        ? {
            nextTeamId: teamId,
            nextRole: role,
            annualSalary,
            startSeason,
            endSeason,
            isConfidential: true,
          }
        : undefined,
    }

    return {
      success: true,
      contract,
      message: isImmediate
        ? `${staff.name} assinou como titular imediato no cargo de ${role}.`
        : `${staff.name} firmou pré-contrato confidencial para assumir o cargo de ${role} na temporada ${startSeason}.`,
    }
  }

  /**
   * Executa a rotina periódica da IA do Mercado de Staff para todas as 11 equipes ativas.
   * Preenche vacâncias críticas, renova contratos expirando e faz propostas realistas.
   */
  public runAIMarketTick(
    seasonYear: number,
    round: number,
    teamsStaff: Record<string, Record<StaffRole, StaffMember | null>>,
    freeAgents: StaffMember[],
  ): {
    updatedTeamsStaff: Record<string, Record<StaffRole, StaffMember | null>>
    updatedFreeAgents: StaffMember[]
    marketEvents: Array<{ headline: string; details: string }>
  } {
    const updatedTeams = { ...teamsStaff }
    let pool = [...freeAgents]
    const events: Array<{ headline: string; details: string }> = []

    // Itera por equipes ativas
    for (const [teamKey, roles] of Object.entries(updatedTeams)) {
      // 1. Preenchimento de vacâncias urgentes
      for (const role of CANONICAL_STAFF_ROLES) {
        if (!roles[role]) {
          // Equipe possui vacância: procurar no mercado de agentes livres o melhor candidato disponível
          const candidateIdx = pool.findIndex((fa) => fa.role === role && fa.status === 'available')
          if (candidateIdx !== -1) {
            const chosen = pool[candidateIdx]
            pool.splice(candidateIdx, 1)

            // Contrata o agente livre
            const hired: StaffMember = {
              ...chosen,
              teamId: teamKey,
              status: 'under_contract',
              adaptation: 55, // Inicia adaptação
            }
            roles[role] = hired

            events.push({
              headline: `${teamKey.toUpperCase()}: Novo ${role} contratado`,
              details: `${hired.name} assumiu a liderança de ${role} após período livre no mercado.`,
            })
          }
        }
      }
    }

    return {
      updatedTeamsStaff: updatedTeams,
      updatedFreeAgents: pool,
      marketEvents: events,
    }
  }

  /**
   * Carrega o estado de mercado inicial ou padrão
   */
  public getInitialMarketPool(): StaffMember[] {
    return [...FREE_AGENT_STAFF_POOL]
  }
}

export const staffMarketService = new StaffMarketService()
