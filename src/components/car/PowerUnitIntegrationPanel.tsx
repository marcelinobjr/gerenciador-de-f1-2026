import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Cpu,
  ShieldCheck,
  TrendingUp,
  Info,
  Wrench,
  Users,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import { PUSupplierId } from '@/types/canonical-pu-integration'

interface PowerUnitIntegrationPanelProps {
  teamId?: string
  careerId?: string
  seasonYear?: number
  supplierName?: string
  facilityLevel?: number
  staffRating?: number
}

export const PowerUnitIntegrationPanel: React.FC<PowerUnitIntegrationPanelProps> = ({
  teamId = 'audi',
  careerId = 'runtime_career',
  seasonYear = 2026,
  supplierName,
  facilityLevel = 5,
  staffRating = 75,
}) => {
  // Consumir dados canônicos do serviço oficial
  const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
    careerId,
    seasonYear,
    teamId,
    supplierId: supplierName as PUSupplierId | undefined,
  })

  // Fatores de progressão calculados pelo serviço canônico
  const learningGain = canonicalPowerUnitIntegrationService.calculateLearningGain({
    currentState: state,
    infrastructureFacilityLevel: facilityLevel,
    technicalStaffRating: staffRating,
  })

  // Derivar tendência a partir dos dados reais
  const isCloseToCap = state.maxIntegration - state.effectiveIntegration < 0.02
  const isFastEvolving = learningGain.totalGain >= 0.8
  const trendLabel = isCloseToCap
    ? '↑ Próximo do teto'
    : isFastEvolving
      ? '↑ Evoluindo rápido'
      : '→ Estável'
  const trendColor = isCloseToCap
    ? 'text-purple-600 bg-purple-50 border-purple-200'
    : isFastEvolving
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : 'text-cyan-700 bg-cyan-50 border-cyan-200'

  // Cap e valores em porcentagem
  const maxCapPercent = Math.round(state.maxIntegration * 100)
  const effectivePercent = Math.round(state.effectiveIntegration * 100)
  const isFactory = state.relationshipType === 'FACTORY'

  // Cálculo da largura da barra visual:
  // Para Customer, o teto é 90%. Para Factory, 100%.
  // A barra mapeia 0% a 100% de largura da barra correspondendo a 0% a 100% do teto máximo do tipo.
  // Barra visual: 0 -> integração atual -> teto
  const barFillPercent = isFactory
    ? Math.min(100, effectivePercent)
    : Math.min(100, Math.round((effectivePercent / maxCapPercent) * 100))

  return (
    <div
      data-testid="pu-integration-panel"
      className="p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-4 shadow-sm"
    >
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-cyan-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                Integração de Power Unit
              </h3>
              <Badge
                data-testid="pu-relationship-badge"
                className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 ${
                  isFactory
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                {isFactory ? 'FÁBRICA' : 'CLIENTE'}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Eficiência e sinergia de empacotamento entre o chassi e a PU {state.supplierId}
            </p>
          </div>
        </div>

        {/* Tendência e Badge do Fornecedor */}
        <div className="flex items-center gap-2">
          <span
            data-testid="pu-trend-badge"
            className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${trendColor}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {trendLabel}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-center cursor-help">
                  <Info className="w-3.5 h-3.5 text-[#64748B]" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs font-sans leading-relaxed p-3 bg-neutral-900 text-neutral-100 border-neutral-800">
                <p className="font-bold mb-1 text-white flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Regulamento de Fornecimento FIA:
                </p>
                <p>
                  Equipes <strong className="text-amber-300">FÁBRICA</strong> possuem co-design do
                  chassi e motor, podendo atingir até <strong className="text-white">100%</strong>{' '}
                  de eficiência de integração.
                </p>
                <p className="mt-1">
                  Equipes <strong className="text-cyan-300">CLIENTE</strong> recebem o motor
                  homologado e têm teto regulamentar de <strong className="text-white">90%</strong>{' '}
                  de integração máxima.
                </p>
                <p className="mt-1 text-neutral-400 text-[11px]">
                  O conhecimento técnico acumulado e a infraestrutura determinam a velocidade de
                  aproximação ao teto.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Indicadores Principais em Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Fornecedor */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
            Fornecedor
          </span>
          <strong
            data-testid="pu-supplier-name"
            className="text-base font-black font-sans text-[#0F172A] block mt-0.5 truncate"
          >
            {state.supplierId}
          </strong>
        </div>

        {/* Conhecimento de Integração */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
            Conhecimento
          </span>
          <strong
            data-testid="pu-knowledge-value"
            className="text-base font-black font-mono text-cyan-700 block mt-0.5"
          >
            {Math.round(state.integrationKnowledge)}{' '}
            <span className="text-xs text-[#64748B] font-normal font-sans">/ 100</span>
          </strong>
        </div>

        {/* Integração Efetiva */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
            Integração Efetiva
          </span>
          <strong
            data-testid="pu-effective-integration"
            className="text-base font-black font-mono text-emerald-600 block mt-0.5"
          >
            {effectivePercent}%
          </strong>
        </div>

        {/* Teto Regulamentar */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
            Teto Máximo
          </span>
          <strong
            data-testid="pu-max-cap"
            className={`text-base font-black font-mono block mt-0.5 ${
              isFactory ? 'text-amber-700' : 'text-slate-700'
            }`}
          >
            {maxCapPercent}%
          </strong>
        </div>
      </div>

      {/* Barra Visual de Integração */}
      <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#64748B] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-700" />
            <span>Progresso em direção ao teto ({maxCapPercent}%):</span>
          </span>
          <span className="font-bold text-[#0F172A]">
            {effectivePercent}% / {maxCapPercent}%
          </span>
        </div>

        {/* Barra de Progresso com Marcador de Teto */}
        <div className="relative w-full bg-[#E2E8F0] h-3.5 rounded-full overflow-hidden p-0.5 border border-[#CBD5E1]">
          <div
            data-testid="pu-integration-bar-fill"
            className={`h-full rounded-full transition-all duration-500 ${
              isFactory
                ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                : 'bg-gradient-to-r from-cyan-600 to-emerald-600'
            }`}
            style={{ width: `${barFillPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono text-[#64748B] pt-0.5">
          <span>0%</span>
          <span className="text-cyan-800 font-bold">Atual: {effectivePercent}%</span>
          <span className={isFactory ? 'text-amber-700 font-bold' : 'text-slate-700 font-bold'}>
            Teto {isFactory ? 'Fábrica' : 'Cliente'}: {maxCapPercent}%
          </span>
        </div>
      </div>

      {/* Fatores de Integração (Amigáveis e sem expor fórmulas internas) */}
      <div className="space-y-2 pt-1">
        <span className="text-xs font-bold font-sans uppercase tracking-wider text-[#0F172A] block">
          Fatores de Aprendizado & Eficiência
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          {/* Infraestrutura Técnica */}
          <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <Wrench className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block truncate">Infraestrutura</span>
              <strong className="text-[#0F172A] text-xs">
                {learningGain.factors.infraFactor > 1.15
                  ? 'Avançada'
                  : learningGain.factors.infraFactor >= 0.95
                    ? 'Padrão'
                    : 'Básica'}
              </strong>
            </div>
          </div>

          {/* Engenharia & Staff Técnico */}
          <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-purple-700" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block truncate">Corpo Técnico</span>
              <strong className="text-[#0F172A] text-xs">
                {learningGain.factors.staffFactor > 1.1
                  ? 'Alta Competência'
                  : learningGain.factors.staffFactor >= 0.95
                    ? 'Competente'
                    : 'Em Adaptação'}
              </strong>
            </div>
          </div>

          {/* Tempo com Fornecedor (Tenure) */}
          <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block truncate">Tempo de Parceria</span>
              <strong className="text-[#0F172A] text-xs">
                {state.seasonsWithSupplier}{' '}
                {state.seasonsWithSupplier === 1 ? 'temporada' : 'temporadas'}
              </strong>
            </div>
          </div>
        </div>

        {/* Conhecimento Geral e Específico */}
        <div className="grid grid-cols-2 gap-2.5 text-xs font-mono pt-1">
          <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[#64748B] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Conhecimento Geral:</span>
            </span>
            <strong className="text-[#0F172A]">
              {Math.round(state.generalIntegrationKnowledge)} / 100
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[#64748B] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-600" />
              <span>Conhecimento Específico:</span>
            </span>
            <strong className="text-[#0F172A]">
              {Math.round(state.supplierSpecificKnowledge)} / 100
            </strong>
          </div>
        </div>
      </div>
    </div>
  )
}
