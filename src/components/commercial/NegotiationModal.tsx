import React, { useState } from 'react'
import { NegotiationState } from '@/types/canonical-commercial'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { Handshake, AlertTriangle, ShieldCheck, XCircle, TrendingUp } from 'lucide-react'

interface NegotiationModalProps {
  negotiation: NegotiationState
  onClose: () => void
  onAcceptOffer: (negotiationId: string) => void
  onRejectOffer: () => void
  onSendCounterOffer: (negotiationId: string, askedValue: number, askedYears: number) => void
  isProcessing?: boolean
  feedbackMessage?: string | null
}

/**
 * Modal Interativo de Negociação com Patrocinadores (LIGHT-UI-01C)
 * Fundo branco, cards off-white, inputs claros, tipografia grafite.
 */
export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  negotiation,
  onAcceptOffer,
  onRejectOffer,
  onSendCounterOffer,
  isProcessing = false,
  feedbackMessage,
}) => {
  const currentOffer = negotiation.currentSponsorOffer
  const [askedValue, setAskedValue] = useState<number>(currentOffer.fixedAnnualValue)
  const [askedYears, setAskedYears] = useState<number>(currentOffer.durationYears)
  const [askedExclusivity, setAskedExclusivity] = useState<boolean>(currentOffer.exclusivity)

  const handleSendCounter = () => {
    onSendCounterOffer(negotiation.id, askedValue, askedYears)
  }

  const onAcceptSponsorOffer = () => {
    onAcceptOffer(negotiation.id)
  }

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'baixo':
      case 'muito_baixo':
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-emerald-300 text-emerald-700 bg-emerald-50"
          >
            Risco de Perda: Baixo
          </Badge>
        )
      case 'moderado':
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-amber-300 text-amber-700 bg-amber-50"
          >
            Risco de Perda: Moderado
          </Badge>
        )
      case 'alto':
      case 'critico':
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-red-300 text-red-700 bg-red-50 flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Risco Crítico de Ruptura
          </Badge>
        )
      default:
        return null
    }
  }

  const getInterestText = (interest: string) => {
    switch (interest) {
      case 'muito_alto':
      case 'alto':
        return 'Alta receptividade ao projeto'
      case 'moderado':
        return 'Avaliando sinergia técnica'
      case 'frio':
        return 'Exigências financeiras estritas'
      case 'desistindo':
        return 'Prestes a retirar proposta'
      default:
        return 'Encerrado'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-[#E2E8F0] shadow-2xl p-6 text-[#0F172A] space-y-5 animate-scale-in">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-[#F1F5F9] pb-4">
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
              MESA DE NEGOCIAÇÃO COMERCIAL
            </span>
            <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2 mt-1">
              <Handshake className="w-5 h-5 text-emerald-600" />
              {negotiation.sponsorName} ({negotiation.country})
            </h3>
            <p className="text-xs text-[#64748B]">
              Espaço: <strong className="text-[#0F172A] uppercase">{negotiation.slot}</strong> •
              Setor: <strong className="text-[#0F172A] capitalize">{negotiation.sector}</strong>
              {negotiation.isTitleSponsor && (
                <span className="text-amber-600 font-bold ml-2">★ TITLE SPONSOR</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {getRiskBadge(negotiation.rejectionRisk)}
            <span className="text-[10px] font-mono text-[#64748B]">
              Rodada {negotiation.roundsCount} de {negotiation.maxRounds}
            </span>
          </div>
        </div>

        {/* Feedback da Rodada Anterior */}
        {feedbackMessage && (
          <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs flex items-center gap-2 font-mono">
            <TrendingUp className="w-4 h-4 shrink-0 text-cyan-600" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Comparativo de Termos: Oferta Deles vs Nossa Contraproposta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Oferta Atual do Patrocinador */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <span className="text-xs font-bold text-[#0F172A]">Oferta Atual da Marca</span>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50"
              >
                Oficial
              </Badge>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Valor Anual Fixo:</span>
                <span className="text-emerald-600 font-bold text-sm">
                  {formatCurrency(currentOffer.fixedAnnualValue)}/ano
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Repasse por GP:</span>
                <span className="text-[#0F172A]">
                  {formatCurrency(Math.round(currentOffer.fixedAnnualValue / 24))}/GP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Duração do Vínculo:</span>
                <span className="text-[#0F172A]">{currentOffer.durationYears} temporadas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Exclusividade:</span>
                <span className="text-[#0F172A]">
                  {currentOffer.exclusivity ? 'Sim (Setorial)' : 'Não'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Interesse da Marca:</span>
                <span className="text-cyan-700 font-semibold">
                  {getInterestText(negotiation.qualitativeInterest)}
                </span>
              </div>
            </div>

            {/* Bônus previstos */}
            {currentOffer.bonuses && currentOffer.bonuses.length > 0 && (
              <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B]">
                <span className="block font-bold text-[#0F172A] mb-1">Bônus Adicionais:</span>
                {currentOffer.bonuses.map((b) => (
                  <div key={b.id} className="flex justify-between text-[10px]">
                    <span>• {b.description}:</span>
                    <strong className="text-emerald-600">+{formatCurrency(b.rewardAmount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contraproposta do Jogador */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <span className="text-xs font-bold text-amber-700">Nossa Contraproposta</span>
              <span className="text-[10px] text-[#64748B] font-mono">Ajuste os valores</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#64748B] block text-[11px] mb-1 font-mono">
                  Valor Anual Desejado (R$):
                </label>
                <Input
                  type="number"
                  step="250000"
                  value={askedValue}
                  onChange={(e) => setAskedValue(Number(e.target.value))}
                  className="bg-white border-[#CBD5E1] text-[#0F172A] font-mono text-sm h-9"
                />
              </div>

              <div>
                <label className="text-[#64748B] block text-[11px] mb-1 font-mono">
                  Duração do Contrato:
                </label>
                <select
                  value={askedYears}
                  onChange={(e) => setAskedYears(Number(e.target.value))}
                  className="w-full h-9 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] text-xs px-2 font-mono"
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
                  className="rounded border-[#CBD5E1] bg-white text-[#E10600]"
                />
                <label htmlFor="chk_exclusivity" className="text-xs text-[#64748B]">
                  Exigir Exclusividade Setorial (Bloqueia concorrentes)
                </label>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-[10px] text-[#64748B] font-mono">
                💡 <span className="text-[#0F172A] font-semibold">Dica Comercial:</span>{' '}
                Contrapropostas moderadas (+5% a +10%) têm alta taxa de sucesso. Exigências acima de
                +20% aumentam drasticamente a chance de encerramento da negociação.
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#F1F5F9]">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRejectOffer}
            disabled={isProcessing}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
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
              className="text-xs border-[#CBD5E1] bg-white text-amber-700 hover:bg-[#F1F5F9]"
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
