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
import { Zap, AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { EngineSupplierSpec } from '@/types/f1'
import { getEngineSupplierLogo } from '@/lib/drive-storage-photos'

interface PowerUnitNegotiationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetSupplier: EngineSupplierSpec | null
  currentSupplierName: string
  currentContractEndYear: number
  nextSeasonYear: number
  budget: number
  onConfirmContract: (targetSupplier: EngineSupplierSpec, contractDetails: any) => Promise<void>
}

export function PowerUnitNegotiationModal({
  open,
  onOpenChange,
  targetSupplier,
  currentSupplierName,
  currentContractEndYear,
  nextSeasonYear,
  budget,
  onConfirmContract,
}: PowerUnitNegotiationModalProps) {
  const [contractYears, setContractYears] = useState<number>(3)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!targetSupplier) return null

  const isCurrentActive = targetSupplier.name.toLowerCase() === currentSupplierName.toLowerCase()

  // Valores canônicos de negociação
  const annualCost = targetSupplier.costAnnual || 30000000
  const signingFee = Math.round(annualCost * 0.18) // Taxa de assinatura com fornecedor
  const isEarlyBreak = !isCurrentActive && currentContractEndYear >= nextSeasonYear
  const breakPenalty = isEarlyBreak ? 12000000 : 0 // Multa de rescisão contratual se trocar antes do fim
  const initialCashOutflow = signingFee + breakPenalty
  const canAfford = budget >= initialCashOutflow

  // Nível de integração e risco de adaptação
  const integrationPredicted =
    targetSupplier.name === 'Audi'
      ? 'Excelente (100% Fábrica)'
      : targetSupplier.name === 'Mercedes'
        ? 'Alta (Arquitetura Refinada)'
        : targetSupplier.name === 'Ferrari'
          ? 'Boa (Potente / Requer Ajuste Térmico)'
          : targetSupplier.name === 'Honda'
            ? 'Equilibrada (Compacto)'
            : 'Moderada (Novo Pacote)'

  const adaptationRisk =
    targetSupplier.name === currentSupplierName
      ? 'Nenhum (Parceria Contínua)'
      : targetSupplier.name === 'Ford' || targetSupplier.name === 'Ferrari'
        ? 'Alto (Redesenho do Monocoque & Refrigeração)'
        : 'Médio (2 a 4 corridas de aclimatação no túnel)'

  const handleSignContract = async () => {
    try {
      setIsSubmitting(true)
      await onConfirmContract(targetSupplier, {
        supplierName: targetSupplier.name,
        startsSeason: nextSeasonYear,
        endsSeason: nextSeasonYear + contractYears - 1,
        annualCost,
        signingFee,
        breakPenalty,
        totalInitialCost: initialCashOutflow,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const supplierLogo = getEngineSupplierLogo(targetSupplier.name)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E2E8F0] text-[#0F172A] max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#E10600] font-sans text-xs uppercase tracking-wider font-bold">
            <Zap className="w-4 h-4" />
            <span>Mesa de Negociação // Fornecimento de Power Unit</span>
          </div>
          <DialogTitle className="text-xl font-bold font-sans tracking-tight text-[#0F172A] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>Contrato Oficial: {targetSupplier.name} Power Unit</span>
              {supplierLogo && (
                <img
                  src={supplierLogo}
                  alt={targetSupplier.name}
                  className="w-5 h-5 rounded-full object-contain border border-[#CBD5E1] bg-white shadow-2xs"
                />
              )}
            </span>
            <Badge className="bg-neutral-100 text-[#475569] border border-[#CBD5E1] text-xs font-mono font-bold">
              A partir de {nextSeasonYear}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Acordo técnico e comercial para fornecimento de unidades de potência regulamentares F1
            2026+. Trocas de fornecedor entram em vigor na próxima temporada para permitir
            integração de chassi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Alerta de Contrato Futuro Canônico */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-blue-900 font-sans uppercase text-[11px] block">
                Regulamento FIA: Troca não-instantânea de motor
              </strong>
              <p className="text-blue-900/80 text-[11px] leading-relaxed">
                A assinatura deste acordo sela o fornecimento para a temporada de{' '}
                <strong>{nextSeasonYear}</strong>. Durante o ano corrente, a equipe continuará
                utilizando o pool atual da <strong>{currentSupplierName}</strong>. A engenharia
                iniciará o projeto aerodinâmico e estrutural do chassi adaptado imediatamente.
              </p>
            </div>
          </div>

          {/* Comparativo de Custo & Condições Financeiras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
                Termos Comerciais
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Custo Operacional Anual:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {formatCurrency(annualCost)}/ano
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Taxa de Assinatura (Sinal):</span>
                <span className="font-mono text-cyan-700 font-bold">
                  {formatCurrency(signingFee)}
                </span>
              </div>
              {breakPenalty > 0 && (
                <div className="flex justify-between items-center text-xs text-amber-700">
                  <span>Multa Rescisória ({currentSupplierName}):</span>
                  <span className="font-mono font-bold">{formatCurrency(breakPenalty)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#E2E8F0] flex justify-between items-center text-xs">
                <span className="text-[#0F172A] font-bold">Desembolso Imediato:</span>
                <span className="font-mono font-black text-emerald-600 text-sm">
                  {formatCurrency(initialCashOutflow)}
                </span>
              </div>
            </div>

            {/* Impacto Técnico e Integração */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
                Impacto Técnico Previsto
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Integração com Chassi:</span>
                <span className="font-mono font-semibold text-[#0F172A]">
                  {integrationPredicted}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Risco de Adaptação:</span>
                <span
                  className={`font-mono font-semibold ${
                    adaptationRisk.startsWith('Nenhum')
                      ? 'text-emerald-600'
                      : adaptationRisk.startsWith('Alto')
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }`}
                >
                  {adaptationRisk}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Classificação FIA:</span>
                <span className="font-mono text-xs text-[#0F172A] font-medium">
                  {targetSupplier.techBadge}
                </span>
              </div>
              <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B]">
                Potência: <strong className="text-[#0F172A]">{targetSupplier.power}/100</strong> •
                Confiabilidade:{' '}
                <strong className="text-emerald-600">{targetSupplier.reliability}%</strong>
              </div>
            </div>
          </div>

          {/* Duração do Contrato */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <label className="text-[10px] font-mono text-[#64748B] uppercase block font-bold">
              Duração Contratual Desejada
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 5].map((years) => (
                <button
                  key={years}
                  type="button"
                  onClick={() => setContractYears(years)}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                    contractYears === years
                      ? 'bg-[#E10600] text-white border-[#E10600] shadow-xs'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-neutral-50 hover:text-[#0F172A]'
                  }`}
                >
                  {years} Temporadas ({nextSeasonYear} - {nextSeasonYear + years - 1})
                </button>
              ))}
            </div>
          </div>

          {/* Checagem Orçamentária */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-xs">
            <span className="text-[#64748B]">Orçamento Atual da Equipe:</span>
            <span className={canAfford ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {formatCurrency(budget)} {canAfford ? '(Suficiente)' : '(Insuficiente)'}
            </span>
          </div>

          {!canAfford && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>
                Fundos insuficientes para honrar o sinal de assinatura e multas rescisórias.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-[#F1F5F9]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="bg-white border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] font-sans text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSignContract}
            disabled={!canAfford || isSubmitting}
            className="bg-[#E10600] hover:bg-[#C00400] text-white font-sans text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            {isSubmitting
              ? 'Registrando Contrato FIA...'
              : `Assinar Contrato Futuro (${formatCurrency(initialCashOutflow)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
