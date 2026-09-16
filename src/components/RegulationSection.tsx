import React, { useState } from 'react'
import {
  TechnicalRegulation,
  RegulationTimelineState,
  RegulationStatus,
  RegulationType,
  RegulationSeverity,
  formatKnowledgeTransferTierLabel,
} from '@/types/canonical-regulations'
import { regulationService, regulationTimelineService } from '@/services/regulationService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ShieldAlert,
  Calendar,
  Layers,
  HelpCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  Sliders,
} from 'lucide-react'

interface RegulationSectionProps {
  timeline: RegulationTimelineState
  currentSeasonYear: number
  onTimelineChange?: (updatedTimeline: RegulationTimelineState) => void
}

export const RegulationSection: React.FC<RegulationSectionProps> = ({
  timeline,
  currentSeasonYear,
}) => {
  const [selectedRegulation, setSelectedRegulation] = useState<TechnicalRegulation | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const activeReg = regulationTimelineService.getActiveRegulation(timeline)
  const announcedRegs = regulationTimelineService.getAnnouncedRegulations(timeline)
  const proposedRegs = regulationTimelineService.getProposedRegulations(timeline)
  const supersededRegs = regulationTimelineService.getSupersededRegulations(timeline)

  const handleOpenDetail = (reg: TechnicalRegulation) => {
    setSelectedRegulation(reg)
    setDetailOpen(true)
  }

  // Ordenar regulamentos pela temporada efetiva
  const sortedRegulations = [...timeline.regulations].sort(
    (a, b) => a.effectiveSeason - b.effectiveSeason,
  )

  const getStatusBadge = (status: RegulationStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            EM VIGOR (ACTIVE)
          </Badge>
        )
      case 'ANNOUNCED':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono">
            <Clock className="w-3 h-3 mr-1" />
            CONFIRMADO (ANNOUNCED)
          </Badge>
        )
      case 'PROPOSED':
        return (
          <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-[10px] font-mono">
            <HelpCircle className="w-3 h-3 mr-1" />
            EM DEBATE (PROPOSED)
          </Badge>
        )
      case 'SUPERSEDED':
        return (
          <Badge className="bg-zinc-700/40 text-zinc-400 border border-zinc-700 text-[10px] font-mono">
            SUBSTITUÍDO (SUPERSEDED)
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-mono">
            CANCELADO
          </Badge>
        )
    }
  }

  const getTypeBadge = (type: RegulationType) => {
    switch (type) {
      case 'TECHNICAL_DIRECTIVE':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 font-mono">
            Diretiva Técnica
          </span>
        )
      case 'MINOR_REGULATION_CHANGE':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/50 font-mono">
            Ajuste Anual (Minor)
          </span>
        )
      case 'MAJOR_REGULATION_CHANGE':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50 font-mono">
            Revisão Estrutural (Major)
          </span>
        )
      case 'NEW_TECHNICAL_ERA':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50 font-mono font-bold">
            NOVA ERA TÉCNICA
          </span>
        )
    }
  }

  const getSeverityBadge = (sev: RegulationSeverity) => {
    switch (sev) {
      case 'LOW':
        return <span className="text-[10px] text-zinc-400 font-mono">Impacto Baixo</span>
      case 'MEDIUM':
        return <span className="text-[10px] text-sky-400 font-mono">Impacto Médio</span>
      case 'HIGH':
        return <span className="text-[10px] text-amber-400 font-mono">Impacto Alto</span>
      case 'EXTREME':
        return <span className="text-[10px] text-red-400 font-mono font-bold">Impacto Crítico</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA SEÇÃO DE REGULAMENTOS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-[#0C1017] via-[#101622] to-[#0A0D14] border border-[#1E2638] shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-wide uppercase font-mono">
              Governança Técnica & Linha do Tempo FIA
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              Temporada Vigente: {currentSeasonYear}
            </span>
          </div>
          <p className="text-xs text-[#8B98A5] max-w-2xl">
            Acompanhamento canônico das regras técnicas em vigor e deliberações futuras da FIA. Toda
            grande mudança é anunciada com antecedência para planejamento de fábrica e retenção de
            conhecimento técnico.
          </p>
        </div>
      </div>

      {/* TIMELINE PRINCIPAL (REGRA 24) */}
      <Card className="bg-[#0A0E17]/90 border border-[#1F2739] shadow-xl">
        <CardHeader className="pb-3 border-b border-[#1A2234]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                Linha do Tempo Regulatória Oficial
              </CardTitle>
              <CardDescription className="text-xs text-[#8B98A5] mt-0.5">
                Regulamentos ativos, confirmados e propostos ordenados por ano de vigência.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#8B98A5]">
              <span>Ativo: {activeReg?.name ? '1' : '0'}</span>
              <span>•</span>
              <span className="text-amber-400">Confirmados: {announcedRegs.length}</span>
              <span>•</span>
              <span className="text-cyan-400">Em Debate: {proposedRegs.length}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-amber-500 before:to-zinc-700">
            {sortedRegulations.map((reg) => {
              const isActive = reg.status === 'ACTIVE'
              const isFuture = reg.status === 'ANNOUNCED' && reg.effectiveSeason > currentSeasonYear
              const isProposed = reg.status === 'PROPOSED'

              return (
                <div key={reg.regulationId} className="relative group">
                  {/* Ponto na timeline */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-transform duration-200 group-hover:scale-125 ${
                      isActive
                        ? 'bg-emerald-500 border-emerald-300 ring-4 ring-emerald-500/20'
                        : isFuture
                          ? 'bg-amber-500 border-amber-300 ring-4 ring-amber-500/20'
                          : isProposed
                            ? 'bg-cyan-500 border-cyan-300 ring-4 ring-cyan-500/20'
                            : 'bg-zinc-700 border-zinc-500'
                    }`}
                  />

                  {/* Card do Regulamento */}
                  <div
                    onClick={() => handleOpenDetail(reg)}
                    className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[#0E1522]/90 border-emerald-500/40 hover:border-emerald-400 shadow-md shadow-emerald-950/20'
                        : isFuture
                          ? 'bg-[#14120E]/90 border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/20'
                          : 'bg-[#0E121A]/70 border-[#1F2739] hover:border-[#2D3A54]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-white font-mono tracking-tight">
                          {reg.effectiveSeason}
                        </span>
                        <span className="text-zinc-500 font-mono">•</span>
                        {getTypeBadge(reg.category)}
                        {getStatusBadge(reg.status)}
                      </div>
                      <div className="flex items-center gap-3">
                        {getSeverityBadge(reg.severity)}
                        <span className="text-[11px] text-cyan-400 group-hover:translate-x-0.5 transition-transform font-medium flex items-center gap-0.5">
                          Ver Detalhes <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-1.5">
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {reg.name}
                      </h4>
                      <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-2">
                        {reg.publicDescription}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#8B98A5]">
                      <div className="flex items-center gap-3">
                        <span>Anúncio: {reg.announcementSeason}</span>
                        <span>•</span>
                        <span>Vigência: {reg.effectiveSeason}</span>
                        <span>•</span>
                        <span>Incerteza: {reg.uncertainty}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400">Áreas Afetadas:</span>
                        <span className="text-zinc-200 font-semibold">
                          {reg.affectedDomains.length} domínios
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* MODAL DE DETALHES DO REGULAMENTO (REGRA 25) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl bg-[#0B0F19] border border-[#20293D] text-white p-6 rounded-2xl max-h-[85vh] overflow-y-auto">
          {selectedRegulation && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                    TEMPORADA {selectedRegulation.effectiveSeason}
                  </span>
                  <span className="text-zinc-500">•</span>
                  {getTypeBadge(selectedRegulation.category)}
                  {getStatusBadge(selectedRegulation.status)}
                </div>
                <DialogTitle className="text-lg font-black text-white font-mono tracking-tight leading-snug">
                  {selectedRegulation.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#8B98A5]">
                  {selectedRegulation.publicDescription}
                </DialogDescription>
              </DialogHeader>

              {/* METADADOS GERAIS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center text-xs">
                <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1D273B]">
                  <span className="text-[10px] text-[#8B98A5] block">ANÚNCIO</span>
                  <strong className="text-white text-sm block">
                    {selectedRegulation.announcementSeason}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1D273B]">
                  <span className="text-[10px] text-[#8B98A5] block">ENTRADA EM VIGOR</span>
                  <strong className="text-emerald-400 text-sm block">
                    {selectedRegulation.effectiveSeason}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1D273B]">
                  <span className="text-[10px] text-[#8B98A5] block">SEVERIDADE</span>
                  <strong className="text-amber-400 text-sm block">
                    {selectedRegulation.severity}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1D273B]">
                  <span className="text-[10px] text-[#8B98A5] block">INCERTEZA</span>
                  <strong className="text-cyan-400 text-sm block">
                    {selectedRegulation.uncertainty}
                  </strong>
                </div>
              </div>

              {/* EXPLICABILIDADE CANÔNICA DE IMPACTO (REGRA 30) */}
              {(() => {
                const explanation = regulationService.explainRegulationImpact(selectedRegulation)
                return (
                  <div className="space-y-4">
                    {/* Veredito Geral */}
                    <div className="p-3.5 rounded-xl bg-[#121A2B] border border-[#1F2C46] flex items-start gap-3">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wide">
                          Veredito da Diretoria Técnica
                        </span>
                        <p className="text-xs text-[#CBD5E1] leading-relaxed">
                          {explanation.generalVerdict}
                        </p>
                      </div>
                    </div>

                    {/* Tabela Qualitativa de Knowledge Transfer (REGRA 25: Sem números crus) */}
                    <div>
                      <h5 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Transferabilidade de Conhecimento por Domínio Técnico
                      </h5>

                      <div className="space-y-2">
                        {explanation.domains.map((dom) => (
                          <div
                            key={dom.domainId}
                            className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                              dom.isAffected
                                ? 'bg-[#151219]/70 border-amber-500/20'
                                : 'bg-[#0E131E]/60 border-[#1B2436]'
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{dom.domainName}</span>
                                {dom.isAffected && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                    Afetado
                                  </span>
                                )}
                                {dom.priority !== 'LOW' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono">
                                    Prioridade: {dom.priority}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#94A3B8]">{dom.summaryText}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <span className="text-[#8B98A5]">Knowledge Transfer:</span>
                              <span
                                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                  dom.transferabilityTier === 'VERY_HIGH' ||
                                  dom.transferabilityTier === 'HIGH'
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                    : dom.transferabilityTier === 'MODERATE'
                                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                                      : 'bg-red-950/60 text-red-300 border border-red-800/40'
                                }`}
                              >
                                {formatKnowledgeTransferTierLabel(dom.transferabilityTier)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailOpen(false)}
                  className="bg-[#121826] border-[#20293D] text-white hover:bg-[#1A2234] text-xs font-mono"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
