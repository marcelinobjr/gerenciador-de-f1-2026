import React from 'react'
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
import { Users, Sparkles, ArrowRight } from 'lucide-react'
import { MarketMoveEvent, SeasonModel } from '@/types/f1'

interface SillySeasonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  season?: SeasonModel | null
  seasonYear?: number
  year?: number
  marketMoves: MarketMoveEvent[]
  isStartingNewSeason: boolean
  onStartNextSeason: () => void
}

export function SillySeasonModal({
  open,
  onOpenChange,
  season,
  seasonYear,
  year,
  marketMoves,
  isStartingNewSeason,
  onStartNextSeason,
}: SillySeasonModalProps) {
  const currentYear = seasonYear || year || season?.year || 2026
  const nextYear = currentYear + 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#11161F] border-2 border-[#00A6FB]/80 text-[#F5F7FA] max-w-2xl sm:max-w-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
          <div className="flex items-center gap-2 text-[#00A6FB] font-mono text-xs uppercase tracking-wider font-bold">
            <Users className="w-5 h-5 text-[#00A6FB]" />
            Fim de Temporada • Silly Season Oficial FIA
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
            <span>MERCADO DE PILOTOS — FIM DA TEMPORADA</span>
            <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border-[#00A6FB]/40 text-xs font-mono">
              Ano {currentYear} → {nextYear}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
            As 24 rodadas do ano se encerraram! O mercado pegou fogo com aposentadorias de
            veteranos, trocas de equipes de ponta, promoções de jovens talentos da F2 e contratos
            vencidos.
          </DialogDescription>
        </DialogHeader>

        {/* Moves Feed */}
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#8B95A7]">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> Movimentações Confirmadas no Paddock:
            </span>
            <span>{marketMoves.length} anúncios oficiais</span>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {marketMoves.map((move, mIdx) => {
              const isRetirement = move.type === 'aposentadoria'
              const isTransfer = move.type === 'transferencia'
              const isPromotion = move.type === 'promocao'
              const isRenewalAlert = move.type === 'renovacao'

              const typeColor = isRetirement
                ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                : isTransfer
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : isPromotion
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'

              return (
                <div
                  key={move.id || mIdx}
                  className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1.5 font-mono text-xs hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 ${typeColor}`}
                      >
                        {move.type}
                      </Badge>
                      <span className="font-bold text-white text-xs">
                        {move.driverName} ({move.driverAge} anos)
                      </span>
                    </div>
                    {move.newTeam && (
                      <Badge className="bg-slate-800 text-cyan-300 border border-slate-700 text-[10px]">
                        Destino: {move.newTeam}
                      </Badge>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-100 text-[13px] leading-tight">
                    {move.headline}
                  </h4>
                  <p className="text-[11px] text-[#8B95A7] leading-relaxed">{move.details}</p>

                  {isRenewalAlert && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-amber-400">
                        ⚠️ Contrato deste piloto vence este ano. Renegocie na tela Equipe se quiser
                        mantê-lo!
                      </span>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                      >
                        <a href="/team">Ir para Equipe</a>
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className="border-t border-[#1F2733] pt-4 flex flex-col sm:flex-row gap-2 justify-between sm:items-center">
          <span className="text-[11px] text-[#8B95A7] font-mono">
            Iniciar o novo ano renova a preparação de chassis, redefine o calendário e libera a 1ª
            rodada.
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 text-xs"
            >
              Fechar e Revisar Equipe
            </Button>
            <Button
              onClick={onStartNextSeason}
              disabled={isStartingNewSeason}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-black font-extrabold text-xs shadow-lg flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              {isStartingNewSeason ? 'Iniciando temporada...' : `Iniciar Temporada ${nextYear}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
