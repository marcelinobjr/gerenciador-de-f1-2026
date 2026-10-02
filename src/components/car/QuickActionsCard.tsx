import React from 'react'
import { Wrench, Sliders, Scale, Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface QuickActionsCardProps {
  onRepairPart?: () => void
  onUpgradePart?: () => void
  onCompareCars?: () => void
  onBalanceSetup?: () => void
  onOpenQuickSwap?: () => void
  isRepairing?: boolean
  isUpgrading?: boolean
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onRepairPart,
  onUpgradePart,
  onCompareCars,
  onBalanceSetup,
  onOpenQuickSwap,
  isRepairing = false,
  isUpgrading = false,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between min-w-0 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 min-w-0">
        <Wrench className="w-4 h-4 text-slate-700 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900 truncate">Ações rápidas</h3>
      </div>

      <p className="text-[11px] text-slate-500 mt-2 mb-4">
        Operações da garagem e gerenciamento de componentes.
      </p>

      {/* Grade de Ações 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
        {/* Trocar / Reparar peça (Ação de Destaque em Vermelho) com seleção explícita de carro */}
        <Button
          onClick={onOpenQuickSwap || onRepairPart}
          disabled={isRepairing}
          className="w-full min-h-10 h-auto py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-red-200 transition-all hover:shadow-md cursor-pointer disabled:opacity-50 whitespace-normal text-center min-w-0"
        >
          <RotateCcw className={`w-4 h-4 shrink-0 ${isRepairing ? 'animate-spin' : ''}`} />
          <span className="break-words line-clamp-2">
            {isRepairing ? 'Reparando...' : 'Trocar peça (Carro #1 / #2)'}
          </span>
        </Button>
        {/* Instalar upgrade */}
        <Button
          onClick={onUpgradePart}
          disabled={isUpgrading}
          variant="outline"
          className="w-full min-h-10 h-auto py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 font-semibold text-xs flex items-center justify-center gap-2 rounded-lg whitespace-normal text-center min-w-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="truncate">{isUpgrading ? 'Instalando...' : 'Instalar upgrade'}</span>
        </Button>

        {/* Comparar carros */}
        <Button
          onClick={onCompareCars}
          variant="outline"
          className="w-full min-h-10 h-auto py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 font-semibold text-xs flex items-center justify-center gap-2 rounded-lg whitespace-normal text-center min-w-0"
        >
          <Scale className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="truncate">Comparar carros</span>
        </Button>

        {/* Equilibrar setup */}
        <Button
          onClick={onBalanceSetup}
          variant="outline"
          className="w-full min-h-10 h-auto py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 font-semibold text-xs flex items-center justify-center gap-2 rounded-lg whitespace-normal text-center min-w-0"
        >
          <Sliders className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="truncate">Equilibrar setup</span>
        </Button>
      </div>
    </div>
  )
}

export default QuickActionsCard
