/**
 * canonical-staff-contract-status.ts
 *
 * Módulo canônico para status contratual derivado e decisões pendentes de staff.
 * F1 Manager 2026 — BLOCO 2A
 *
 * PRINCÍPIO ARQUITETURAL:
 * «Contrato é persistido. Status contratual é derivado.»
 * NÃO cria campos persistentes como "contract_status", "is_expiring", "is_expired".
 */

import { StaffMember, ROLE_DISPLAY_NAMES } from '@/types/canonical-staff'
import { PendingDecisionItem } from '@/components/team/PendingDecisionsCard'

export type DerivedContractStatusType = 'ACTIVE' | 'EXPIRING_THIS_SEASON' | 'EXPIRED'

export interface DerivedStaffContractStatus {
  status: DerivedContractStatusType
  contractEnd: number | null
  badgeLabel: string
  badgeVariant: 'active' | 'expiring' | 'expired'
  isExpiringThisSeason: boolean
  isExpired: boolean
}

/**
 * ITEM 2 — STATUS DERIVADO
 * - ATIVO: contract_end > currentSeason (ex.: temporada 2027, contrato até 2029 → ativo)
 * - VENCE NESTA TEMPORADA: contract_end === currentSeason (ex.: 2027/2027 → vence ao final da temporada)
 * - VENCIDO: contract_end < currentSeason (ex.: contrato até 2026 na temporada 2027 → vencido)
 */
export function deriveStaffContractStatus(
  contractEnd: number | undefined | null,
  currentSeason: number,
): DerivedStaffContractStatus {
  if (contractEnd == null || isNaN(contractEnd)) {
    return {
      status: 'ACTIVE',
      contractEnd: null,
      badgeLabel: 'Contrato regular',
      badgeVariant: 'active',
      isExpiringThisSeason: false,
      isExpired: false,
    }
  }

  if (contractEnd > currentSeason) {
    return {
      status: 'ACTIVE',
      contractEnd,
      badgeLabel: `Contrato até ${contractEnd}`,
      badgeVariant: 'active',
      isExpiringThisSeason: false,
      isExpired: false,
    }
  }

  if (contractEnd === currentSeason) {
    return {
      status: 'EXPIRING_THIS_SEASON',
      contractEnd,
      badgeLabel: `Contrato até ${contractEnd} · Vence nesta temporada`,
      badgeVariant: 'expiring',
      isExpiringThisSeason: true,
      isExpired: false,
    }
  }

  // contractEnd < currentSeason
  return {
    status: 'EXPIRED',
    contractEnd,
    badgeLabel: 'Contrato vencido',
    badgeVariant: 'expired',
    isExpiringThisSeason: false,
    isExpired: true,
  }
}

export interface DerivedStaffPendingDecision extends PendingDecisionItem {
  staffId: string
  type: 'CONTRACT_EXPIRING' | 'CONTRACT_EXPIRED'
  description: string
  staffMember: StaffMember
  contractEnd: number
}

/**
 * ITEM 3 & 4 — DECISÕES PENDENTES REAIS
 * Substituir a lista vazia por lista derivada do staff real. Criar decisão quando:
 * A. contrato VENCE NESTA TEMPORADA → tipo "CONTRACT_EXPIRING" (ex.: "Contrato de James Key vence ao final de 2027")
 * B. contrato JÁ VENCIDO → tipo "CONTRACT_EXPIRED" (ex.: "Contrato de [Nome] está vencido")
 * NÃO GERAR decisão para staff com contrato futuro regular.
 * NÃO criar decisões narrativas artificiais.
 *
 * IDEMPOTÊNCIA:
 * A função é puramente derivativa e determinística baseada nos dados do staff e seasonYear.
 */
export function deriveStaffPendingDecisions(
  staffList: StaffMember[],
  currentSeason: number,
): DerivedStaffPendingDecision[] {
  const decisions: DerivedStaffPendingDecision[] = []

  for (const staff of staffList) {
    if (!staff || staff.isInterim || !staff.teamId) {
      continue
    }

    const contractEnd = staff.contract_end
    if (contractEnd == null) {
      continue
    }

    const derived = deriveStaffContractStatus(contractEnd, currentSeason)
    const roleLabel = ROLE_DISPLAY_NAMES[staff.role] || staff.role

    if (derived.status === 'EXPIRED') {
      decisions.push({
        id: `decision_staff_expired_${staff.staffId}_${currentSeason}`,
        type: 'CONTRACT_EXPIRED',
        staffId: staff.staffId,
        title: `Contrato de ${staff.name} está vencido`,
        description: `O vínculo de ${staff.name} (${roleLabel}) encerrou em ${contractEnd}. Situação contratual exige regularização.`,
        contextText: `Vínculo de ${roleLabel} encerrou em ${contractEnd}. Exige renovação ou dispensa.`,
        priority: 'ALTA',
        actionLabel: 'Decidir →',
        actionTab: 'staff',
        actionPayload: { staffId: staff.staffId, staffMember: staff, type: 'CONTRACT_EXPIRED' },
        staffMember: staff,
        contractEnd,
      })
    } else if (derived.status === 'EXPIRING_THIS_SEASON') {
      decisions.push({
        id: `decision_staff_expiring_${staff.staffId}_${currentSeason}`,
        type: 'CONTRACT_EXPIRING',
        staffId: staff.staffId,
        title: `Contrato de ${staff.name} vence ao final de ${currentSeason}`,
        description: `O vínculo de ${staff.name} (${roleLabel}) expira ao término da temporada atual (${currentSeason}).`,
        contextText: `Expira ao fim da temporada (${currentSeason}). Avalie extensão ou mercado.`,
        priority: 'MÉDIA',
        actionLabel: 'Avaliar →',
        actionTab: 'staff',
        actionPayload: { staffId: staff.staffId, staffMember: staff, type: 'CONTRACT_EXPIRING' },
        staffMember: staff,
        contractEnd,
      })
    }
  }

  // Ordena por prioridade: ALTA (vencido) antes de MÉDIA (vencendo) e por nome para estabilidade determinística
  return decisions.sort((a, b) => {
    if (a.priority === 'ALTA' && b.priority !== 'ALTA') return -1
    if (a.priority !== 'ALTA' && b.priority === 'ALTA') return 1
    return a.title.localeCompare(b.title)
  })
}
