import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Hammer,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { FacilityDefinition } from '@/types/canonical-facilities'

interface FacilityExpandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  facility: FacilityDefinition | null
  currentLevel: number
  budget: number
  costCapSpent: number
  costCapLimit: number
  currentRound: number
  isUpgrading: boolean
  facilityImageUrl: string
  onConfirmUpgrade: (facility: FacilityDefinition) => Promise<void>
}

export function FacilityExpandModal({
  open,
  onOpenChange,
  facility,
  currentLevel,
  budget,
  costCapSpent,
  costCapLimit,
  currentRound,
  isUpgrading,
  facilityImageUrl,
  onConfirmUpgrade,
}: FacilityExpandModalProps) {
  if (!facility) return null

  const nextLevel = currentLevel + 1
  const isMax = currentLevel >= 5
  const upgradeSpec = facility.upgrades[nextLevel]

  const capexCost =
    upgradeSpec?.capexCost ||
    (nextLevel === 2 ? 8000000 : nextLevel === 3 ? 16000000 : nextLevel === 4 ? 28000000 : 45000000)
  const duration =
    upgradeSpec?.durationRounds ||
    (nextLevel === 2 ? 2 : nextLevel === 3 ? 3 : nextLevel === 4 ? 4 : 5)
  const additionalOpex =
    upgradeSpec?.opexAnnualIncrease ||
    (nextLevel === 2 ? 1200000 : nextLevel === 3 ? 2500000 : nextLevel === 4 ? 4200000 : 7000000)
  const completionRound = currentRound + duration

  const canAfford = budget >= capexCost
  const wouldBreachCostCap = costCapSpent + capexCost > costCapLimit

  const currentLevelLabel = facility.levelLabels[currentLevel - 1] || `Nível ${currentLevel}`
  const nextLevelLabel = !isMax ? facility.levelLabels[currentLevel] : 'Nível Máximo'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E2E8F0] text-[#0F172A] max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#E10600] font-sans text-xs uppercase tracking-wider font-bold">
            <Hammer className="w-4 h-4" />
            <span>Engenharia & Campus // Plano de Expansão Predial</span>
          </div>
          <DialogTitle className="text-xl font-bold font-sans tracking-tight text-[#0F172A] flex items-center justify-between">
            <span>{facility.name}</span>
            <Badge className="bg-red-50 text-[#E10600] border border-red-200 text-xs font-mono font-bold">
              Nível {currentLevel} → {nextLevel}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            {facility.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Banner da Instalação com Imagem Real */}
          <div className="relative h-44 rounded-xl overflow-hidden border border-[#E2E8F0] bg-neutral-900 shadow-sm">
            <img
              src={facilityImageUrl}
              alt={facility.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget
                target.style.opacity = '0.3'
              }}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#CBD5E1] tracking-wider block font-medium">
                  Padrão Tecnológico
                </span>
                <span className="font-bold text-white text-sm">{currentLevelLabel}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase text-cyan-300 tracking-wider block font-medium">
                  Próximo Salto
                </span>
                <span className="font-bold text-emerald-400 text-sm">{nextLevelLabel}</span>
              </div>
            </div>
          </div>

          {/* Dados Técnicos e Financeiros de Construção */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lado A: Investimento e Prazos */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <span className="text-[10px] font-mono text-[#64748B] uppercase block font-bold">
                Parâmetros da Obra
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Investimento CAPEX:</span>
                <span className="font-mono font-bold text-[#0F172A] text-sm">
                  {formatCurrency(capexCost)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Prazo de Execução:</span>
                <span className="font-mono text-cyan-700 font-bold">{duration} Rodadas</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Conclusão Estimada:</span>
                <span className="font-mono text-[#0F172A] font-bold">Rodada {completionRound}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#E2E8F0]">
                <span className="text-[#64748B]">OPEX Adicional:</span>
                <span className="font-mono text-amber-700 font-semibold">
                  +{formatCurrency(additionalOpex)}/ano
                </span>
              </div>
            </div>

            {/* Lado B: Capacidade e Efeitos */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <span className="text-[10px] font-mono text-[#64748B] uppercase block font-bold">
                Capacidade Derivada
              </span>
              <div className="text-[11px] text-[#334155] leading-relaxed">
                <strong className="text-cyan-700 block font-mono text-[10px] uppercase">
                  {facility.primaryCapabilitiesText}
                </strong>
                A expansão eleva a capacidade de processamento, precisão e mitigação de incerteza da
                equipe de engenharia.
              </div>

              <div className="space-y-1.5 pt-1">
                {facility.effects.map((eff, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-white border border-[#E2E8F0] flex items-start gap-1.5 text-[10px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#0F172A] block">{eff.title}</span>
                      <span className="text-[#64748B]">{eff.gameplayBonusDescription}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sinergias e Dependências */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1 text-[#475569]">
            <div className="flex items-center gap-1.5 text-cyan-700 font-sans font-bold uppercase text-[10px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sinergias & Interdependência</span>
            </div>
            <p className="text-[11px] leading-snug">
              Instalações operam de forma conectada: a modernização de{' '}
              <strong>{facility.name}</strong> potencializa os departamentos adjacentes e reduz
              riscos de gargalo operacional.
            </p>
          </div>

          {/* Saldo de Caixa */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center text-xs font-mono">
            <div>
              <span className="text-[#64748B] block text-[10px]">Saldo Atual em Caixa</span>
              <span className="text-[#0F172A] font-bold">{formatCurrency(budget)}</span>
            </div>
            <div className="text-right">
              <span className="text-[#64748B] block text-[10px]">Saldo Pós-Investimento</span>
              <span className={canAfford ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                {formatCurrency(budget - capexCost)}
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>
                Fundos insuficientes para instalar o canteiro de obras. É necessário{' '}
                {formatCurrency(capexCost)}.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-[#F1F5F9]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpgrading}
            className="bg-white border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] font-sans text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirmUpgrade(facility)}
            disabled={!canAfford || isUpgrading}
            className="bg-[#E10600] hover:bg-[#C00400] text-white font-sans text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            {isUpgrading
              ? 'Instalando Canteiro de Obras...'
              : `Aprovar Obra (${formatCurrency(capexCost)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
