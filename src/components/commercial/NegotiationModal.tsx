import React, { useState } from 'react'
import { NegotiationState } from '@/types/canonical-commercial'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { Handshake, AlertTriangle, ShieldCheck, TrendingUp, XCircle } from 'lucide-react'

interface NegotiationModalProps {
  isOpen: boolean
  onClose: () => void
  negotiation: NegotiationState | null
  onCounterOffer: (counter: {
    fixedAnnualValue: number
    durationYears: number
    exclusivity: boolean
  }) => void
  onAcceptSponsorOffer: () => void
  onRejectOffer: () => void
  isProcessing?: boolean
  feedbackMessage?: string | null
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  isOpen,
  onClose,
  negotiation,
  onCounterOffer,
  onAcceptSponsorOffer,
  onRejectOffer,
  isProcessing = false,
  feedbackMessage,
}) => {
  const currentOffer = negotiation?.currentSponsorOffer
  const [askedValue, setAskedValue] = useState<number>(currentOffer?.fixedAnnualValue || 10_000_000)
  const [askedYears, setAskedYears] = useState<number>(currentOffer?.durationYears || 2)
  const [askedExclusivity, setAskedExclusivity] = useState<boolean>(
    currentOffer?.exclusivity || false,
  )

  React.useEffect(() => {
    if (negotiation?.currentSponsorOffer) {
      setAskedValue(negotiation.currentSponsorOffer.fixedAnnualValue)
      setAskedYears(negotiation.currentSponsorOffer.durationYears || 2)
      setAskedExclusivity(negotiation.currentSponsorOffer.exclusivity || false)
    }
  }, [negotiation])

  if (!isOpen || !negotiation || !currentOffer) return null

  const handleSendCounter = () => {
    onCounterOffer({
      fixedAnnualValue: askedValue,
      durationYears: askedYears,
      exclusivity: askedExclusivity,
    })
  }

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'muito_baixo':
        return (
          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500 text-[10px]">
            Risco Muito Baixo
          </Badge>
        )
      case 'baixo':
        return (
          <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-600 text-[10px]">
            Risco Baixo
          </Badge>
        )
      case 'moderado':
        return (
          <Badge className="bg-amber-950 text-amber-400 border-amber-500 text-[10px]">
            Risco Moderado
          </Badge>
        )
      case 'alto':
        return (
          <Badge className="bg-orange-950 text-orange-400 border-orange-500 text-[10px]">
            Risco Elevado
          </Badge>
        )
      case 'critico':
      default:
        return (
          <Badge className="bg-red-950 text-red-400 border-red-500 text-[10px]">
            Risco Crítico / Ruptura
          </Badge>
        )
    }
  }

  const getInterestText = (interest: string) => {
    switch (interest) {
      case 'muito_alto':
        return 'Muito Alto (Entusiasmo da Diretoria)'
      case 'alto':
        return 'Alto (Dispostos a negociar)'
      case 'moderado':
        return 'Moderado (Cautelosos)'
      case 'frio':
        return 'Frio (Perto do limite)'
      default:
        return 'Encerrado'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0B0E14] border border-[#1F2733] shadow-2xl p-6 text-[#F5F7FA] space-y-5 animate-scale-in">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-[#1F2733] pb-4">
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
              MESA DE NEGOCIAÇÃO COMERCIAL
            </span>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-1">
              <Handshake className="w-5 h-5 text-emerald-400" />
              {negotiation.sponsorName} ({negotiation.country})
            </h3>
            <p className="text-xs text-[#8B95A7]">
              Espaço: <strong className="text-white uppercase">{negotiation.slot}</strong> • Setor:{' '}
              <strong className="text-white capitalize">{negotiation.sector}</strong>
              {negotiation.isTitleSponsor && (
                <span className="text-amber-400 font-bold ml-2">★ TITLE SPONSOR</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {getRiskBadge(negotiation.rejectionRisk)}
            <span className="text-[10px] font-mono text-[#8B95A7]">
              Rodada {negotiation.roundsCount} de {negotiation.maxRounds}
            </span>
          </div>
        </div>

        {/* Feedback da Rodada Anterior */}
        {feedbackMessage && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs flex items-center gap-2 font-mono">
            <TrendingUp className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Comparativo de Termos: Oferta Deles vs Nossa Contraproposta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Oferta Atual do Patrocinador */}
          <div className="p-4 rounded-xl bg-[#0E131F] border border-[#1F2733] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="text-xs font-bold text-white">Oferta Atual da Marca</span>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500/40 text-emerald-400"
              >
                Oficial
              </Badge>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Valor Anual Fixo:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {formatCurrency(currentOffer.fixedAnnualValue)}/ano
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Repasse por GP:</span>
                <span className="text-white">
                  {formatCurrency(Math.round(currentOffer.fixedAnnualValue / 24))}/GP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Duração do Vínculo:</span>
                <span className="text-white">{currentOffer.durationYears} temporadas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Exclusividade:</span>
                <span className="text-white">
                  {currentOffer.exclusivity ? 'Sim (Setorial)' : 'Não'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Interesse da Marca:</span>
                <span className="text-cyan-400">
                  {getInterestText(negotiation.qualitativeInterest)}
                </span>
              </div>
            </div>

            {/* Bônus previstos */}
            {currentOffer.bonuses && currentOffer.bonuses.length > 0 && (
              <div className="pt-2 border-t border-[#1F2733] text-[11px] text-[#8B95A7]">
                <span className="block font-bold text-white mb-1">Bônus Adicionais:</span>
                {currentOffer.bonuses.map((b) => (
                  <div key={b.id} className="flex justify-between text-[10px]">
                    <span>• {b.description}:</span>
                    <strong className="text-emerald-400">+{formatCurrency(b.rewardAmount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contraproposta do Jogador */}
          <div className="p-4 rounded-xl bg-[#090D15] border border-[#1F2733] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="text-xs font-bold text-amber-400">Nossa Contraproposta</span>
              <span className="text-[10px] text-[#8B95A7] font-mono">Ajuste os valores</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8B95A7] block text-[11px] mb-1 font-mono">
                  Valor Anual Desejado (R$):
                </label>
                <Input
                  type="number"
                  step="250000"
                  value={askedValue}
                  onChange={(e) => setAskedValue(Number(e.target.value))}
                  className="bg-[#0E131F] border-[#1F2733] text-white font-mono text-sm h-9"
                />
              </div>

              <div>
                <label className="text-[#8B95A7] block text-[11px] mb-1 font-mono">
                  Duração do Contrato:
                </label>
                <select
                  value={askedYears}
                  onChange={(e) => setAskedYears(Number(e.target.value))}
                  className="w-full h-9 rounded-md bg-[#0E131F] border border-[#1F2733] text-white text-xs px-2 font-mono"
                >
                  <option value={1}>1 Temporada (Flexibilidade)</option>
                  <option value={2}>2 Temporadas (Padrão)</option>
                  <option value={3}>3 Temporadas (Segurança)</option>
                  <option value={4}>4 Temporadas (Longo Prazo)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk_exclusivity"
                  checked={askedExclusivity}
                  onChange={(e) => setAskedExclusivity(e.target.checked)}
                  className="rounded border-[#1F2733] bg-[#0E131F] text-[#E10600]"
                />
                <label htmlFor="chk_exclusivity" className="text-xs text-[#8B95A7]">
                  Exigir Exclusividade Setorial (Bloqueia concorrentes)
                </label>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0E131F] border border-[#1F2733] text-[10px] text-[#8B95A7] font-mono">
                💡 <span className="text-white">Dica Comercial:</span> Contrapropostas moderadas
                (+5% a +10%) têm alta taxa de sucesso. Exigências acima de +20% aumentam
                drasticamente a chance de encerramento da negociação.
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1F2733]">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRejectOffer}
            disabled={isProcessing}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Recusar e Encerrar Conversas
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendCounter}
              disabled={isProcessing || negotiation.status !== 'open'}
              className="text-xs border-[#1F2733] bg-[#0E131F] text-amber-400 hover:bg-[#161D29]"
            >
              Enviar Contraproposta
            </Button>
            <Button
              size="sm"
              onClick={onAcceptSponsorOffer}
              disabled={isProcessing || negotiation.status === 'rejected'}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              Assinar Acordo Oficial
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
