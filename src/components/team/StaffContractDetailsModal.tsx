import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { StaffMember } from '@/types/canonical-staff'
import { deriveStaffContractStatus } from '@/lib/canonical-staff-contract-status'
import { formatCurrency } from '@/lib/formatters'
import { Shield, Calendar, Award, Heart, DollarSign, Info } from 'lucide-react'

interface StaffContractDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  member: StaffMember | null
  currentSeasonYear: number
  roleDisplayName?: string
  overallRating?: number
  decisionContext?: {
    type?: string
    title?: string
    description?: string
  } | null
}

export const StaffContractDetailsModal: React.FC<StaffContractDetailsModalProps> = ({
  isOpen,
  onClose,
  member,
  currentSeasonYear,
  roleDisplayName,
  overallRating,
  decisionContext,
}) => {
  if (!member) return null

  const contractStatus = deriveStaffContractStatus(member.contract_end, currentSeasonYear)
  const roleName = roleDisplayName || member.role

  const getStatusBadge = () => {
    switch (contractStatus.status) {
      case 'EXPIRED':
        return (
          <Badge className="bg-red-600 text-white hover:bg-red-600 font-bold uppercase text-[10px] tracking-wider">
            Contrato Vencido
          </Badge>
        )
      case 'EXPIRING_THIS_SEASON':
        return (
          <Badge className="bg-amber-500 text-white hover:bg-amber-500 font-bold uppercase text-[10px] tracking-wider">
            Vence Nesta Temporada ({currentSeasonYear})
          </Badge>
        )
      case 'ACTIVE':
      default:
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 font-bold uppercase text-[10px] tracking-wider">
            Ativo
          </Badge>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-neutral-900 border-neutral-800 text-white p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700 shrink-0">
              <img
                src={
                  member.photoUrl ||
                  `https://img.usecurling.com/ppl/thumbnail?gender=male&seed=${member.name.length * 7}`
                }
                alt={member.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold font-serif text-white truncate flex items-center gap-2">
                {member.name}
                <span className="text-sm font-normal text-neutral-400">
                  {member.countryFlag || '🌐'}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                <span>{roleName}</span>
                <span>•</span>
                <span>{member.age} anos</span>
              </DialogDescription>
            </div>
            <div>{getStatusBadge()}</div>
          </div>
        </DialogHeader>

        {/* Notificação/Decisão Contextual se aberta por uma decisão */}
        {decisionContext && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">{decisionContext.title}</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">{decisionContext.description}</p>
            </div>
          </div>
        )}

        {/* Dados Contratuais e Técnicos */}
        <div className="mt-4 space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-black/40 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase block flex items-center gap-1">
                <Award className="w-3 h-3 text-cyan-400" /> GER (Rating)
              </span>
              <span className="text-lg font-bold text-white mt-1 block">
                {overallRating ?? member.reputation}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase block flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400" /> Moral
              </span>
              <span className="text-lg font-bold text-white mt-1 block">{member.morale}/100</span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase block flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-400" /> Vencimento
              </span>
              <span
                className={`text-lg font-bold mt-1 block ${
                  contractStatus.status === 'EXPIRED'
                    ? 'text-red-400'
                    : contractStatus.status === 'EXPIRING_THIS_SEASON'
                      ? 'text-amber-400'
                      : 'text-white'
                }`}
              >
                {member.contract_end ?? '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase block flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" /> Salário
              </span>
              <span className="text-sm font-bold text-white mt-1.5 block truncate">
                {member.salary != null && member.salary > 0
                  ? `${formatCurrency(member.salary)}/ano`
                  : 'Confidencial'}
              </span>
            </div>
          </div>

          {/* Resumo da Situação Contratual */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
            <div className="text-[11px] font-bold uppercase text-neutral-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-neutral-400" /> Situação Contratual Vigente
            </div>
            <p className="text-xs text-neutral-300 font-sans leading-relaxed">
              {contractStatus.status === 'EXPIRED' && (
                <>
                  O contrato com <strong className="text-white">{member.name}</strong> expirou no
                  final da temporada {member.contract_end}. Um novo acordo ou rescisão formal é
                  recomendado pela diretoria para estabilidade da equipe técnica.
                </>
              )}
              {contractStatus.status === 'EXPIRING_THIS_SEASON' && (
                <>
                  O vínculo com <strong className="text-white">{member.name}</strong> está no seu
                  último ano ({currentSeasonYear}). A escuderia tem prioridade para abrir conversas
                  de extensão antes da virada de temporada.
                </>
              )}
              {contractStatus.status === 'ACTIVE' && (
                <>
                  Vínculo com <strong className="text-white">{member.name}</strong> regular e
                  garantido até o término da temporada{' '}
                  <strong className="text-emerald-400">{member.contract_end}</strong>. Nenhuma ação
                  urgente exigida da diretoria no momento.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-neutral-800/80 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
