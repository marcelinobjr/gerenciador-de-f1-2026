import React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

interface PostRaceFloatingActionsProps {
  isRaceFinished: boolean
  isFinishing: boolean
  onAdvanceRound: () => void
  currentRound?: number
}

/**
 * Botão fixo no CANTO SUPERIOR ESQUERDO da tela de corrida:
 * Sempre que a corrida estiver finalizada (isRaceFinished), exibe botão destacado
 * (padrão visual Race Operations, ação primária vermelha F1) com o rótulo
 * "Salvar e Avançar para Próxima Rodada", disparando handleAdvanceRound.
 * Durante a sessão em andamento ele fica oculto ou desabilitado.
 */
export function PostRaceFloatingActions({
  isRaceFinished,
  isFinishing,
  onAdvanceRound,
  currentRound,
}: PostRaceFloatingActionsProps) {
  if (!isRaceFinished) return null

  return (
    <div
      aria-label="Ações de Pós-Corrida"
      className="fixed top-20 left-4 sm:left-8 z-50 animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-center gap-2 bg-[#090D15]/95 p-1.5 sm:p-2 rounded-2xl border border-red-500/50 shadow-[0_10px_35px_rgba(225,6,0,0.35)] backdrop-blur-md">
        <Button
          onClick={onAdvanceRound}
          disabled={isFinishing}
          className="h-11 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-[#E10600] to-[#B30500] hover:from-[#FF1E17] hover:to-[#CC0600] text-white font-mono font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{isFinishing ? 'Salvando dados...' : 'Salvar e Avançar para Próxima Rodada'}</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </Button>
      </div>
    </div>
  )
}
