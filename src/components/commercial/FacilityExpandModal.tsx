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
      <DialogContent className="bg-[#0B0F17] border-[#1C2638] text-[#F1F5F9] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#E10600] font-mono text-xs uppercase tracking-wider font-bold">
            <Hammer className="w-4 h-4" />
            <span>Engenharia & Campus // Plano de Expansão Predial</span>
          </div>
          <DialogTitle className="text-xl font-black font-mono tracking-tight text-white flex items-center justify-between">
            <span>{facility.name}</span>
            <Badge className="bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-mono">
              Nível {currentLevel} → {nextLevel}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8B98AD]">
            {facility.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Banner da Instalação com Imagem Real */}
          <div className="relative h-40 rounded-xl overflow-hidden border border-[#1E293B]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/40 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#CBD5E1] tracking-wider block">
                  Padrão Tecnológico
                </span>
                <span className="font-mono font-bold text-white text-sm">{currentLevelLabel}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase text-cyan-400 tracking-wider block">
                  Próximo Salto
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {nextLevelLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Dados Técnicos e Financeiros de Construção */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lado A: Investimento e Prazos */}
            <div className="p-3.5 rounded-lg bg-[#0F1622] border border-[#1C2738] space-y-2.5">
              <span className="text-[10px] font-mono text-[#8B98AD] uppercase block font-bold">
                Parâmetros da Obra
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">Investimento CAPEX:</span>
                <span className="font-mono font-black text-white text-sm">
                  {formatCurrency(capexCost)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">Prazo de Execução:</span>
                <span className="font-mono text-cyan-400 font-bold">{duration} Rodadas</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">Data Prevista de Conclusão:</span>
                <span className="font-mono text-white font-bold">Rodada {completionRound}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#1C2738]">
                <span className="text-[#94A3B8]">OPEX Adicional Recorrente:</span>
                <span className="font-mono text-amber-400 font-semibold">
                  +{formatCurrency(additionalOpex)}/ano
                </span>
              </div>
            </div>

            {/* Lado B: Capacidade e Efeitos */}
            <div className="p-3.5 rounded-lg bg-[#0F1622] border border-[#1C2738] space-y-2.5">
              <span className="text-[10px] font-mono text-[#8B98AD] uppercase block font-bold">
                Capacidade Derivada (Regra de Ouro)
              </span>
              <div className="text-[11px] text-[#CBD5E1] leading-relaxed">
                <strong className="text-cyan-400 block font-mono text-[10px] uppercase">
                  {facility.primaryCapabilitiesText}
                </strong>
                A expansão eleva o throughput, precisão e mitigação de incerteza da equipe técnica
                sem gerar velocidade mágica instantânea no carro.
              </div>

              <div className="space-y-1.5 pt-1">
                {facility.effects.map((eff, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-[#090C12] border border-[#161F2E] flex items-start gap-1.5 text-[10px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">{eff.title}</span>
                      <span className="text-[#8B98AD]">{eff.gameplayBonusDescription}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sinergias e Dependências */}
          <div className="p-3 rounded-lg bg-[#0C121C] border border-[#1A2536] text-[11px] space-y-1 text-[#94A3B8]">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold uppercase text-[10px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sinergias & Dependências Técnicas</span>
            </div>
            <p>
              Instalações operam interligadas: a expansão de <strong>{facility.name}</strong>{' '}
              potencializa os departamentos vizinhos e elimina riscos de subutilização de dados no
              ciclo de desenvolvimento.
            </p>
          </div>

          {/* Saldo de Caixa e Checagem do Teto */}
          <div className="p-3 rounded-lg bg-[#090C12] border border-[#161F2E] flex justify-between items-center text-xs font-mono">
            <div>
              <span className="text-[#8B98AD] block text-[10px]">Saldo Atual em Caixa</span>
              <span className="text-white font-bold">{formatCurrency(budget)}</span>
            </div>
            <div className="text-right">
              <span className="text-[#8B98AD] block text-[10px]">Saldo Pós-Investimento</span>
              <span className={canAfford ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {formatCurrency(budget - capexCost)}
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="p-2.5 rounded bg-red-950/30 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>
                Fundos insuficientes para instalar o canteiro de obras. É necessário{' '}
                {formatCurrency(capexCost)}.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#161F2E]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpgrading}
            className="bg-[#121926] border-[#1F2A3C] text-[#8B98AD] hover:text-white font-mono text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirmUpgrade(facility)}
            disabled={!canAfford || isUpgrading}
            className="bg-[#E10600] hover:bg-[#C00400] text-white font-mono text-xs font-black uppercase tracking-wider"
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
