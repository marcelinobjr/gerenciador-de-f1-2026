import React, { useMemo } from 'react'
import { DriverPoster } from '@/components/DriverPoster'
import { getCountryFlag } from '@/lib/country-flags'
import { CountryFlagChip } from '@/components/CountryFlagChip'
import { CountryFlag } from '@/components/CountryFlag'
import { getTeamLogoUrl } from '@/lib/lobby-assets'
import { formatUsdCurrency } from '@/components/PilotProfileDialog'
import { getOverallRating } from '@/lib/mbj-drivers-data'
import { UnifiedDriverItem } from '@/pages/DriversPage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Activity,
  Briefcase,
  ExternalLink,
  GitCompare,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Flame,
} from 'lucide-react'

interface DriverSidePanelProps {
  driver: UnifiedDriverItem | null
  f1CareerStats: {
    races: number
    wins: number
    poles: number
    championships: number
  }
  marketRange: {
    displayRange: string
    minAnnualSalary: number
    maxAnnualSalary: number
  }
  hasSuperlicense: boolean
  contractStatusLabel: string
  contractStatusType: 'contracted' | 'free' | 'reserve'
  onClose?: () => void
  onOpenFullProfile: (driver: UnifiedDriverItem) => void
  onOpenNegotiation?: (driver: UnifiedDriverItem) => void
  onOpenContract?: (driver: UnifiedDriverItem) => void
  onCompareDriver?: (driver: UnifiedDriverItem) => void
  categoryLabel: string
  isPlayerDriverTeam?: boolean
  isMobileModal?: boolean
  visualIdentity?: any
}

export const DriverSidePanel: React.FC<DriverSidePanelProps> = ({
  driver,
  f1CareerStats,
  marketRange,
  hasSuperlicense,
  contractStatusLabel,
  contractStatusType,
  onClose,
  onOpenFullProfile,
  onOpenNegotiation,
  onOpenContract,
  onCompareDriver,
  categoryLabel,
  isPlayerDriverTeam = false,
  isMobileModal = false,
  visualIdentity,
}) => {
  const overall = driver ? getOverallRating(driver) : 0
  const isContracted = contractStatusType === 'contracted' || contractStatusType === 'reserve'
  const isMarketFree = contractStatusType === 'free'

  // Número permanente ou preferido
  const driverNumber =
    driver?.preferredNumber || (driver?.rawDbRecord as any)?.permanent_number || null

  // Logo da equipe atual se existir
  const teamLogo = driver?.teamKey ? getTeamLogoUrl(driver.teamKey) : null

  // Atributos resumidos para o painel (Ritmo, Consistência, Feedback Técnico, Potencial)
  const pace = driver ? (driver.racePace ?? Math.round((driver.speed + driver.consistency) / 2)) : 0
  const consistency = driver?.consistency ?? 0
  const feedback = driver
    ? (driver.feedback ?? Math.min(99, Math.max(50, driver.consistency + 2)))
    : 0
  const potentialAvg = driver ? Math.round((driver.potentialMin + driver.potentialMax) / 2) : 0

  // Citações ou biografia de destaque sintética (chamado incondicionalmente)
  const quoteText = useMemo(() => {
    if (!driver) return ''
    if (driver.f1RacesCompleted > 150) {
      return '"Veterano de referência global, liderança técnica de paddock comprovada."'
    }
    if (driver.f1RacesCompleted > 50) {
      return '"Talento consolidado no automobilismo de ponta com alto ritmo de corrida."'
    }
    if (overall >= 90) {
      return '"Talento excepcional, referência da sua geração no grid."'
    }
    if (overall >= 84) {
      return '"Piloto de alto calibre técnico, disputando posições de destaque."'
    }
    if (driver.isAcademyProspect || driver.age <= 21) {
      return '"Jovem promessa com curva de evolução acelerada e grande potencial."'
    }
    return '"Profissional veloz com experiência e prontidão competitiva imediata."'
  }, [driver, overall])

  if (!driver) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Activity className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Nenhum piloto selecionado</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Clique em qualquer piloto da lista para inspecionar ficha técnica rápida, estatísticas de
          F1 e ações de mercado.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="driver-side-panel"
      className={`bg-white border border-slate-200/90 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden ${
        isMobileModal ? 'w-full' : 'w-full'
      }`}
    >
      {/* Topo do painel com botão fechar se for modal ou mobile */}
      <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-50/60 to-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <CountryFlag code={driver.nationality} className="text-xl" />
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate leading-tight tracking-tight">
              {driver.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 font-medium truncate">
              {teamLogo && (
                <img
                  src={teamLogo}
                  alt={driver.teamName || 'Equipe'}
                  className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
                />
              )}
              <span className="truncate">{driver.teamName || 'Sem equipe (Livre no mercado)'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {driverNumber && (
            <span className="font-mono font-black text-slate-900 text-lg px-2 py-0.5 bg-slate-100 rounded-lg border border-slate-200">
              #{driverNumber}
            </span>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo Rolável do Painel */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* POSTER VERTICAL DO PILOTO INTEIRO (Proporção vertical clássica do jogo) */}
        <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] max-h-72 rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-950 flex items-center justify-center">
          <DriverPoster
            name={driver?.name || ''}
            driverId={driver?.id}
            visualIdentity={
              visualIdentity ||
              (driver as any)?.procedural_data?.visualIdentity ||
              (driver as any)?.visualIdentity ||
              null
            }
            aspectRatio="tall"
            className="w-full h-full object-cover object-top"
          />
          {/* Badge flutuante de Categoria */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white border border-white/10 shadow-sm">
            <span>{categoryLabel}</span>
          </div>
        </div>

        {/* Citação sintética de status */}
        <div className="text-center italic text-[11px] text-slate-500 px-2 py-0.5 font-serif">
          {quoteText}
        </div>

        {/* Tabela de Dados Básicos do Perfil */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Idade</span>
            <span className="font-semibold text-slate-800">{driver.age} anos</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Categoria atual</span>
            <span className="font-semibold text-slate-800">{categoryLabel}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Status</span>
            <div className="flex items-center gap-1">
              {isContracted ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[10px] px-1.5 py-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
                  {contractStatusLabel}
                </Badge>
              ) : (
                <Badge className="bg-sky-50 text-sky-700 border-sky-200 font-medium text-[10px] px-1.5 py-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block mr-1" />
                  {contractStatusLabel}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Disponibilidade</span>
            <span
              className={`font-semibold ${isMarketFree ? 'text-emerald-600' : 'text-slate-500'}`}
            >
              {isMarketFree ? 'Disponível' : 'Indisponível'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Superlicença</span>
            <div className="flex items-center gap-1">
              {hasSuperlicense ? (
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sim
                </span>
              ) : (
                <span className="font-bold text-rose-500 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" /> Não
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
            <span className="text-slate-500 font-medium">Contrato</span>
            <span className="font-semibold text-slate-800">
              {isContracted && driver.contractEnd ? `Até ${driver.contractEnd}` : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 font-medium">Valor de mercado</span>
            <span className="font-mono font-bold text-slate-900">
              {driver.salaryUsd > 0
                ? formatUsdCurrency(driver.salaryUsd, 'full')
                : marketRange.displayRange}
            </span>
          </div>
        </div>

        {/* ESTATÍSTICAS DE FÓRMULA 1 — SOMENTE F1 */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <span className="text-[#E10600] font-black text-sm">F1</span>
              <span>Estatísticas na Fórmula 1</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Somente F1 oficial</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                GPs
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {f1CareerStats.races}
              </div>
            </div>

            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                Vitórias
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {f1CareerStats.wins}
              </div>
            </div>

            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                Poles
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {f1CareerStats.poles}
              </div>
            </div>

            <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                Títulos
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {f1CareerStats.championships}
              </div>
            </div>
          </div>
        </div>

        {/* ATRIBUTOS RESUMIDOS (Ritmo, Consistência, Feedback Técnico, Potencial) */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Atributos Gerais</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Resumo do perfil</span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {/* Bloco de Overall */}
            <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm border border-slate-800">
              <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">GER</span>
              <span className="text-xl font-black font-mono leading-none mt-0.5">{overall}</span>
            </div>

            {/* Barras de progresso elegantes */}
            <div className="flex-1 space-y-1.5">
              {/* Ritmo */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-medium">Ritmo</span>
                  <span className="font-mono font-bold text-slate-900">{pace}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pace)}%` }}
                  />
                </div>
              </div>

              {/* Consistência */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-medium">Consistência</span>
                  <span className="font-mono font-bold text-slate-900">{consistency}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, consistency)}%` }}
                  />
                </div>
              </div>

              {/* Feedback Técnico */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-medium">Feedback técnico</span>
                  <span className="font-mono font-bold text-slate-900">{feedback}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, feedback)}%` }}
                  />
                </div>
              </div>

              {/* Potencial */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-medium">Potencial</span>
                  <span className="font-mono font-bold text-slate-900">{potentialAvg}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, potentialAvg)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card Situação de Mercado */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
            <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
            <span>Situação de Mercado</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {isContracted
              ? `Piloto sob contrato ativo com ${driver.teamName || 'sua equipe'}. Cláusula de liberação e termos de negociação sujeitos a rescisão acordada.`
              : 'Piloto livre no mercado. Disponível para formalização de contrato imediato ou proposta salarial para a temporada vigente.'}
          </p>
        </div>
      </div>

      {/* RODAPÉ DO PAINEL — BOTÕES DE AÇÃO */}
      <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 bg-white space-y-2">
        <div className="flex items-center gap-2">
          {/* Botão Comparar piloto */}
          <Button
            variant="outline"
            onClick={() => onCompareDriver?.(driver)}
            className="flex-1 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 py-2.5 h-auto cursor-pointer"
          >
            <GitCompare className="w-4 h-4 text-slate-500" />
            <span>Comparar piloto</span>
          </Button>

          {/* Botão Ver perfil completo */}
          <Button
            onClick={() => onOpenFullProfile(driver)}
            className="flex-1 bg-[#E10600] hover:bg-[#c00500] text-white font-bold text-xs flex items-center justify-center gap-1.5 py-2.5 h-auto shadow-sm cursor-pointer"
          >
            <span>Ver perfil completo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Botão contextual de negociação se livre no mercado e não do jogador */}
        {isMarketFree && !isPlayerDriverTeam && (onOpenNegotiation || onOpenContract) && (
          <Button
            onClick={() => {
              if (onOpenNegotiation) {
                onOpenNegotiation(driver)
              } else if (onOpenContract) {
                onOpenContract(driver)
              }
            }}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 py-2 h-9 cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span>Negociar / Oferecer contrato</span>
          </Button>
        )}
      </div>
    </div>
  )
}
export default DriverSidePanel
