import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StaffMember } from '@/types/canonical-staff'
import { deriveStaffContractStatus } from '@/lib/canonical-staff-contract-status'
import { formatCurrency } from '@/lib/formatters'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import {
  Shield,
  Calendar,
  Award,
  Heart,
  DollarSign,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  UserMinus,
  Sparkles,
} from 'lucide-react'

export interface StaffContractDetailsModalProps {
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
  onRenewContract?: (
    member: StaffMember,
    additionalYears: number,
    newSalary: number,
  ) => Promise<void> | void
  onDismissStaff?: (member: StaffMember) => Promise<void> | void
  isProcessing?: boolean
}

export const StaffContractDetailsModal: React.FC<StaffContractDetailsModalProps> = ({
  isOpen,
  onClose,
  member,
  currentSeasonYear,
  roleDisplayName,
  overallRating,
  decisionContext,
  onRenewContract,
  onDismissStaff,
  isProcessing = false,
}) => {
  // Modos de visualização do modal: 'details' | 'renew' | 'dismiss'
  const [viewMode, setViewMode] = useState<'details' | 'renew' | 'dismiss'>('details')
  const [additionalYears, setAdditionalYears] = useState<number>(2)
  const [proposedSalary, setProposedSalary] = useState<number>(member?.salary || 2500000)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset do estado ao alternar membro ou abrir
  React.useEffect(() => {
    if (member) {
      setViewMode('details')
      setAdditionalYears(2)
      setProposedSalary(member.salary && member.salary > 0 ? member.salary : 2500000)
      setErrorMessage(null)
    }
  }, [member, isOpen])

  if (!member) return null

  const contractStatus = deriveStaffContractStatus(member.contract_end, currentSeasonYear)
  const roleName = roleDisplayName || member.role
  const terminationFee = technicalOrganizationService.calculateStaffTerminationFee(
    member,
    currentSeasonYear,
  )
  const contractEndYear = member.contract_end ?? currentSeasonYear
  const isContractExpired = contractEndYear < currentSeasonYear
  const isExpiringThisSeason = contractEndYear === currentSeasonYear
  const remainingSeasons = Math.max(0, contractEndYear - currentSeasonYear)

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

  // Novo contract_end calculado
  const baseEndYear = Math.max(member.contract_end ?? currentSeasonYear, currentSeasonYear)
  const calculatedNewContractEnd = baseEndYear + additionalYears

  const handleExecuteRenew = async () => {
    setErrorMessage(null)
    if (additionalYears < 1) {
      setErrorMessage('Duração mínima deve ser de 1 temporada adicional.')
      return
    }
    if (proposedSalary <= 0) {
      setErrorMessage('O salário proposto deve ser maior que zero.')
      return
    }
    if (calculatedNewContractEnd <= currentSeasonYear) {
      setErrorMessage('O término do contrato deve ser posterior à temporada atual.')
      return
    }

    try {
      if (onRenewContract) {
        await onRenewContract(member, additionalYears, proposedSalary)
      }
      setViewMode('details')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao renovar contrato do membro.')
    }
  }

  const handleExecuteDismiss = async () => {
    setErrorMessage(null)
    try {
      if (onDismissStaff) {
        await onDismissStaff(member)
      }
      onClose()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao processar desligamento.')
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setViewMode('details')
          setErrorMessage(null)
          onClose()
        }
      }}
    >
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

        {/* Mensagem de Erro se houver */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. MODO PADRÃO: DETALHES INFORMATIVOS + BOTÕES DE AÇÃO */}
        {viewMode === 'details' && (
          <>
            {/* Notificação/Decisão Contextual se aberta por uma decisão */}
            {decisionContext && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300">{decisionContext.title}</p>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    {decisionContext.description}
                  </p>
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
                  <span className="text-lg font-bold text-white mt-1 block">
                    {member.morale}/100
                  </span>
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
                      O contrato com <strong className="text-white">{member.name}</strong> expirou
                      no final da temporada {member.contract_end}. Um novo acordo ou rescisão formal
                      é recomendado pela diretoria para estabilidade da equipe técnica.
                    </>
                  )}
                  {contractStatus.status === 'EXPIRING_THIS_SEASON' && (
                    <>
                      O vínculo com <strong className="text-white">{member.name}</strong> está no
                      seu último ano ({currentSeasonYear}). A escuderia tem prioridade para abrir
                      conversas de extensão antes da virada de temporada.
                    </>
                  )}
                  {contractStatus.status === 'ACTIVE' && (
                    <>
                      Vínculo com <strong className="text-white">{member.name}</strong> regular e
                      garantido até o término da temporada{' '}
                      <strong className="text-emerald-400">{member.contract_end}</strong>. Nenhuma
                      ação urgente exigida da diretoria no momento.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Ações no Modal (ITEM 2: RENOVAR CONTRATO e DISPENSAR) */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/80 pt-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode('dismiss')}
                  disabled={isProcessing}
                  className="border-red-900/60 text-red-300 hover:bg-red-950/40 hover:text-red-200 text-xs h-8"
                >
                  <UserMinus className="w-3.5 h-3.5 mr-1 text-red-400" />
                  Dispensar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setViewMode('renew')}
                  disabled={isProcessing}
                  className="bg-[#E10600] hover:bg-red-700 text-white font-bold text-xs h-8"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Renovar Contrato
                </Button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </>
        )}

        {/* 2. MODO RENOVAÇÃO (ITEM 3) */}
        {viewMode === 'renew' && (
          <div className="mt-4 space-y-4 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2">
              <span className="text-[11px] font-bold uppercase text-amber-400 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Negociação Simples de Extensão
              </span>
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                Defina o período adicional de permanência e o salário anual acordado com{' '}
                <strong className="text-white">{member.name}</strong>. A renovação atualizará o
                vínculo imediatamente e dissipará pendências de contrato expirando.
              </p>
            </div>

            {/* Duração Adicional */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase text-neutral-400 font-bold block">
                Duração da Extensão (Temporadas Adicionais):
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((years) => (
                  <button
                    key={years}
                    type="button"
                    onClick={() => setAdditionalYears(years)}
                    className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                      additionalYears === years
                        ? 'bg-[#E10600] border-[#E10600] text-white shadow'
                        : 'bg-black/40 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    +{years} {years === 1 ? 'ano' : 'anos'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-neutral-500 block pt-0.5">
                Término anterior: <strong>{member.contract_end ?? currentSeasonYear}</strong> → Novo
                vencimento: <strong className="text-emerald-400">{calculatedNewContractEnd}</strong>
              </span>
            </div>

            {/* Salário Proposto */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] uppercase text-neutral-400 font-bold block">
                Salário Anual Proposto (USD):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="50000"
                  min="100000"
                  value={proposedSalary}
                  onChange={(e) =>
                    setProposedSalary(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="flex-1 bg-black/60 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#E10600]"
                />
                <span className="text-xs text-neutral-400 font-sans">
                  {formatCurrency(proposedSalary)}/ano
                </span>
              </div>
              {/* Presets rápidos de ajuste */}
              <div className="flex gap-1.5 pt-1">
                {[
                  { label: '-10%', mult: 0.9 },
                  { label: 'Manter Atual', mult: 1.0 },
                  { label: '+10%', mult: 1.1 },
                  { label: '+25%', mult: 1.25 },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const base = member.salary || 2500000
                      setProposedSalary(Math.round(base * preset.mult))
                    }}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo da Operação Financeira / Regra do Bloco */}
            <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <span className="text-neutral-300 font-bold block">
                Regra Econômica de Renovação:
              </span>
              <p>
                Salários futuros não são antecipados no caixa. O novo valor de{' '}
                <strong className="text-white">{formatCurrency(proposedSalary)}/ano</strong> passará
                a reger a folha de pagamento periódica do staff.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-800/80 pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('details')}
                disabled={isProcessing}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecuteRenew}
                disabled={isProcessing}
                className="bg-[#E10600] hover:bg-red-700 text-white font-bold text-xs"
              >
                {isProcessing ? 'Processando...' : 'Confirmar Renovação'}
              </Button>
            </div>
          </div>
        )}

        {/* 3. MODO DISPENSA / RESCISÃO (ITEM 4 & ITEM 6) */}
        {viewMode === 'dismiss' && (
          <div className="mt-4 space-y-4 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-800/50 space-y-2">
              <span className="text-[11px] font-bold uppercase text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Confirmação de Desligamento de Staff
              </span>
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                Você está prestes a dispensar <strong className="text-white">{member.name}</strong>{' '}
                do cargo de <strong className="text-white">{roleName}</strong>. O cargo ficará vago
                imediatamente e haverá perda de retenção de conhecimento operacional.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase block">Cargo Atual</span>
                <strong className="text-white block mt-0.5">{roleName}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase block">
                  Vínculo Vigente
                </span>
                <strong className="text-white block mt-0.5">
                  Até {member.contract_end ?? '—'}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase block">Salário Anual</span>
                <strong className="text-white block mt-0.5">
                  {member.salary ? formatCurrency(member.salary) : 'N/A'}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase block">
                  Multa Rescisória
                </span>
                <strong
                  className={`block mt-0.5 ${
                    terminationFee > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {terminationFee === 0 && isContractExpired
                    ? 'Multa rescisória: $0 — contrato vencido'
                    : `Multa rescisória: ${formatCurrency(terminationFee)}`}
                </strong>
              </div>
            </div>

            {/* Aviso Canônico da Regra Econômica de Multa Rescisória */}
            <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <span className="text-neutral-300 font-bold block flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-neutral-400" /> Regra Econômica de Rescisão de
                Staff:
              </span>
              <p>
                {isContractExpired && (
                  <>
                    Profissional atuando além do término do contrato anterior (vencido em{' '}
                    {contractEndYear}). A liberação ocorre com{' '}
                    <strong>multa rescisória de $0</strong>, sem lançamento de penalidades no Ledger
                    da equipe.
                  </>
                )}
                {isExpiringThisSeason && (
                  <>
                    Contrato com término previsto na temporada corrente ({currentSeasonYear}). A
                    rescisão antecipada aplica <strong>25% do salário anual</strong> (
                    {formatCurrency(terminationFee)}), registrado como despesa no Ledger.
                  </>
                )}
                {!isContractExpired && !isExpiringThisSeason && (
                  <>
                    Contrato com{' '}
                    <strong>
                      {remainingSeasons}{' '}
                      {remainingSeasons === 1 ? 'temporada restante' : 'temporadas restantes'}
                    </strong>{' '}
                    (término em {contractEndYear}). A rescisão unilateral aplica{' '}
                    <strong>50% × salário anual × temporadas restantes</strong> (
                    {formatCurrency(terminationFee)}), registrado como despesa no Ledger.
                  </>
                )}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-800/80 pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('details')}
                disabled={isProcessing}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleExecuteDismiss}
                disabled={isProcessing}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
              >
                {isProcessing ? 'Processando...' : 'Confirmar Dispensa'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
