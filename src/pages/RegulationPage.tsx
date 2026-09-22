import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Timer,
  GraduationCap,
  Trophy,
  Zap,
  Flag,
  Disc,
  Cpu,
  Lock,
  ShieldAlert,
  Award,
  ListOrdered,
  FileCheck,
  Medal,
  Wrench,
  ChevronRight,
  ExternalLink,
  Users,
  Gauge,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { useAuth } from '@/contexts/AuthContext'
import {
  REGULATION_CATEGORIES,
  getRegulationsForSeason,
  searchRegulations,
  auditRegulationCenter,
} from '@/services/regulationCenterService'
import type {
  RegulationDefinition,
  RegulationCategoryId,
  RegulationSourceType,
} from '@/types/regulation-center'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'
import {
  STANDARD_GP_TYRE_ALLOCATION,
  SPRINT_GP_TYRE_ALLOCATION,
  getEventPhysicalCompounds,
} from '@/services/canonicalTyreAllocationService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'

const CATEGORY_ICONS: Record<RegulationCategoryId, React.ComponentType<{ className?: string }>> = {
  fim_de_semana: Calendar,
  treinos_livres: Timer,
  novatos_tl1: GraduationCap,
  qualificacao: Trophy,
  sprint: Zap,
  corrida: Flag,
  pneus: Disc,
  power_unit: Cpu,
  parc_ferme: Lock,
  safety_car_vsc: ShieldAlert,
  pontuacao: Award,
  grid_penalidades: ListOrdered,
  licencas: FileCheck,
  campeonato: Medal,
  regulamento_tecnico: Wrench,
}

export default function RegulationPage() {
  const { season, team, playerDrivers } = useUnifiedSeason()
  const { user } = useAuth()
  const currentSeasonYear = season?.year || 2026
  const currentRound = season?.current_round || 1

  const [selectedCategory, setSelectedCategory] = useState<RegulationCategoryId | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>('reg_rookie_fp1_obligation')

  // Catálogo completo da temporada atual
  const allSeasonRules = useMemo(() => {
    return getRegulationsForSeason(currentSeasonYear)
  }, [currentSeasonYear])

  // Regras filtradas pela busca e categoria
  const filteredRules = useMemo(() => {
    return searchRegulations(allSeasonRules, searchQuery, selectedCategory)
  }, [allSeasonRules, searchQuery, selectedCategory])

  // Regra ativa selecionada para detalhe/contexto
  const activeRule = useMemo(() => {
    if (selectedRuleId) {
      const found = allSeasonRules.find((r) => r.id === selectedRuleId)
      if (found) return found
    }
    return filteredRules[0] || allSeasonRules[0] || null
  }, [selectedRuleId, allSeasonRules, filteredRules])

  // Contexto da Equipe para Novatos no TL1
  const rookieSummary = useMemo(() => {
    const careerId = user?.id || 'default_career'
    const teamId = team?.id || 'audi'
    const seasonId = season?.id || String(currentSeasonYear)
    return RookieTl1PlanningService.getPlanningSummary(careerId, seasonId, teamId)
  }, [user?.id, team?.id, season?.id, currentSeasonYear])

  // Contexto da Equipe para Power Unit
  const engineSupplier = team?.engine_supplier || 'Audi'
  const teamPuSpec = OFFICIAL_POWER_UNITS[engineSupplier] || OFFICIAL_POWER_UNITS.Audi

  // Contexto da Equipe para Pneus na próxima rodada
  const nextGpNomination = useMemo(() => {
    return getEventPhysicalCompounds(currentRound)
  }, [currentRound])

  // Contexto de Licenças dos Pilotos da Equipe
  const driverLicenses = useMemo(() => {
    return (playerDrivers || []).map((drv) => ({
      driver: drv,
      view: canonicalHomologationAdapter.toCanonicalView(drv),
    }))
  }, [playerDrivers])

  // Helper de badges de origem regulamentar
  const renderSourceBadge = (sourceType: RegulationSourceType) => {
    switch (sourceType) {
      case 'OFFICIAL_FIA':
        return (
          <span
            data-testid="badge-source-fia"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200"
          >
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            FIA {currentSeasonYear}
          </span>
        )
      case 'APEX_ADAPTATION':
        return (
          <span
            data-testid="badge-source-apex"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-50 text-amber-800 border border-amber-200"
          >
            <Info className="w-3 h-3 text-amber-600" />
            FIA + APEX
          </span>
        )
      case 'GAME_MECHANIC':
        return (
          <span
            data-testid="badge-source-game"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300"
          >
            <Wrench className="w-3 h-3 text-slate-500" />
            APEX
          </span>
        )
    }
  }

  // Helper de status de implementação
  const renderStatusBadge = (status: RegulationDefinition['status']) => {
    switch (status) {
      case 'IMPLEMENTADO':
        return (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-semibold"
          >
            Em vigor no APEX
          </Badge>
        )
      case 'SUPORTE PARCIAL':
        return (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-semibold"
          >
            Regra regulamentar / suporte parcial no APEX
          </Badge>
        )
      case 'INFORMATIVO':
        return (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-50 text-slate-700 text-[10px] font-semibold"
          >
            Informativo
          </Badge>
        )
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-4 md:p-6 lg:p-8 space-y-6">
      {/* 1. CABEÇALHO */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-[#E10600] rounded-sm" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#0F172A] uppercase">
              REGULAMENTO FIA
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#475569] mt-1 font-medium">
            Temporada {currentSeasonYear} — regras esportivas, técnicas e operacionais.
          </p>
        </div>

        {/* Card discreto de versão e fonte regulamentar */}
        <div className="flex items-center gap-3 self-start md:self-auto bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 shadow-sm">
          <BookOpen className="w-5 h-5 text-[#E10600] shrink-0" />
          <div className="text-left">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              REGULAMENTO DA TEMPORADA
            </span>
            <span className="text-xs font-black text-[#0F172A]">
              FIA F1 {currentSeasonYear} • Sporting & Technical Regulations
            </span>
          </div>
        </div>
      </header>

      {/* 2. BARRA DE BUSCA E CATÁLOGO DE CATEGORIAS */}
      <section className="space-y-4">
        {/* Campo de Busca */}
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar regra por título, termo, novato, pneu, safety car, pontuação..."
            className="pl-10 h-10 bg-white border-[#CBD5E1] text-xs md:text-sm focus-visible:ring-1 focus-visible:ring-[#E10600] focus-visible:border-[#E10600] rounded-lg shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8] hover:text-[#0F172A]"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Categorias em Cards Clicáveis */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              Categorias Regulamentares ({REGULATION_CATEGORIES.length})
            </span>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-bold text-[#E10600] hover:underline"
              >
                Mostrar Todas as Categorias
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`p-2 rounded-lg border text-left transition-all ${
                selectedCategory === 'all'
                  ? 'border-[#E10600] bg-white ring-1 ring-[#E10600] shadow-sm font-bold'
                  : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Todas</div>
              <div className="text-xs text-[#0F172A] font-extrabold truncate">Ver Tudo</div>
            </button>

            {REGULATION_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id] || BookOpen
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-2 rounded-lg border text-left transition-all group ${
                    isSelected
                      ? 'border-[#E10600] bg-white ring-1 ring-[#E10600] shadow-sm'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-[#E10600]' : 'text-[#64748B] group-hover:text-[#0F172A]'
                      }`}
                    />
                    <span className="text-[10px] font-semibold text-[#64748B] truncate">
                      Cat. {cat.order}
                    </span>
                  </div>
                  <div
                    className={`text-xs font-bold truncate ${
                      isSelected ? 'text-[#E10600]' : 'text-[#0F172A]'
                    }`}
                  >
                    {cat.shortLabel}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 3. CONTEÚDO PRINCIPAL: LISTA DE REGRAS + PAINEL CONTEXTUAL DA EQUIPE */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Regras (60% ou 65% da tela) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B]">
              Exibindo <strong>{filteredRules.length}</strong> regra(s) encontrada(s)
            </span>
          </div>

          {filteredRules.length === 0 ? (
            <Card className="p-8 text-center bg-white border-[#E2E8F0] shadow-sm space-y-3">
              <Info className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <h3 className="text-sm font-bold text-[#0F172A]">Nenhuma regra encontrada</h3>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Tente buscar por termos mais genéricos como "rookie", "pneu", "SC", "pontos" ou
                selecione outra categoria.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                }}
                className="text-xs"
              >
                Resetar Filtros
              </Button>
            </Card>
          ) : (
            filteredRules.map((rule) => {
              const isSelected = activeRule?.id === rule.id
              const CategoryIcon = CATEGORY_ICONS[rule.category] || BookOpen

              return (
                <Card
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`p-5 bg-white border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#E10600] shadow-md ring-1 ring-[#E10600]'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm'
                  }`}
                >
                  {/* Cabeçalho da Regra */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <CategoryIcon
                        className={`w-4 h-4 ${isSelected ? 'text-[#E10600]' : 'text-[#64748B]'}`}
                      />
                      <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        {rule.category.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {renderSourceBadge(rule.sourceType)}
                      {renderStatusBadge(rule.status)}
                    </div>
                  </div>

                  {/* Título */}
                  <h2 className="text-base font-extrabold text-[#0F172A] tracking-tight">
                    {rule.title}
                  </h2>

                  {/* Os 3 Pilares Canônicos de Cada Regra */}
                  <div className="mt-4 space-y-3 text-xs">
                    {/* Pilar 1: O QUE DETERMINA */}
                    <div className="p-3 bg-[#F8FAFC] border-l-4 border-blue-500 rounded-r-lg space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        O que determina (Regra Oficial FIA)
                      </div>
                      <p className="text-[#334155] leading-relaxed font-normal">
                        {rule.whatItDetermines}
                      </p>
                    </div>

                    {/* Pilar 2: COMO FUNCIONA NO APEX */}
                    <div className="p-3 bg-[#F8FAFC] border-l-4 border-[#E10600] rounded-r-lg space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#E10600] flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5" />
                        Como funciona no APEX GP Manager
                      </div>
                      <p className="text-[#334155] leading-relaxed font-normal">
                        {rule.apexExplanation}
                      </p>
                    </div>

                    {/* Pilar 3: SITUAÇÃO DA SUA EQUIPE */}
                    {rule.teamSituationNote && (
                      <div className="p-3 bg-amber-50/60 border-l-4 border-amber-500 rounded-r-lg space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Situação da sua equipe ({team?.name || 'Equipe'})
                        </div>
                        <p className="text-amber-900 leading-relaxed font-normal">
                          {rule.teamSituationNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Rodapé da Regra: Metadados Oficiais & CTA de Navegação */}
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-[#64748B]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Fonte Canônica:</span>
                      <span className="text-[#0F172A] font-medium">
                        {rule.sourceMetadata.documentTitle}
                        {rule.sourceMetadata.articleRef
                          ? ` (${rule.sourceMetadata.articleRef})`
                          : ''}
                      </span>
                    </div>

                    {rule.relatedRoute && rule.relatedRouteLabel && (
                      <Link
                        to={rule.relatedRoute}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#E10600] hover:text-red-700 hover:underline shrink-0"
                      >
                        {rule.relatedRouteLabel}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </Card>
              )
            })
          )}
        </div>

        {/* Coluna Direita: PAINEL LATERAL CONTEXTUAL (Quando a regra selecionada tiver estado da equipe) */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
          <Card className="p-4 md:p-5 bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E10600]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                  PAINEL CONTEXTUAL DA EQUIPE
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[#64748B]">
                {team?.name || 'AUDI F1 TEAM'}
              </span>
            </div>

            {/* Painel Contextual Dinâmico conforme a Regra Ativa */}
            {activeRule?.category === 'novatos_tl1' ? (
              /* Contexto de Novatos no TL1 */
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                    OBRIGAÇÃO DE NOVATOS (TL1)
                  </span>
                  <div className="text-sm font-extrabold text-[#0F172A] mt-0.5">
                    Temporada {currentSeasonYear} • Requisito: {rookieSummary.requiredTotal} sessões
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                      Cumpridas no TL1
                    </span>
                    <span className="text-xl font-black text-emerald-600 block mt-0.5">
                      {rookieSummary.completedTotal}/{rookieSummary.requiredTotal}
                    </span>
                    <span className="text-[10px] text-[#64748B]">homologadas</span>
                  </div>

                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                      Planejadas
                    </span>
                    <span className="text-xl font-black text-blue-600 block mt-0.5">
                      {rookieSummary.plannedTotal}
                    </span>
                    <span className="text-[10px] text-[#64748B]">no calendário</span>
                  </div>
                </div>

                {/* Discriminação por assento: Carro 1 e Carro 2 */}
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                    <span className="font-bold text-[#0F172A]">Carro 1:</span>
                    <div className="space-x-1 font-mono">
                      <span className="font-black text-emerald-600">
                        {rookieSummary.car1.completed}/{rookieSummary.car1.required}
                      </span>
                      <span className="text-[#64748B]">
                        ({rookieSummary.car1.planned} planejadas)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A]">Carro 2:</span>
                    <div className="space-x-1 font-mono">
                      <span className="font-black text-emerald-600">
                        {rookieSummary.car2.completed}/{rookieSummary.car2.required}
                      </span>
                      <span className="text-[#64748B]">
                        ({rookieSummary.car2.planned} planejadas)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800 leading-relaxed">
                  Definição canônica: piloto com no máximo 2 GPs de carreira. O crédito só é
                  concedido após a participação real no TL1 com voltas válidas completadas.
                </div>

                <Link to="/calendario" className="block">
                  <Button className="w-full bg-[#E10600] hover:bg-red-700 text-white font-bold text-xs h-9">
                    VER PLANEJAMENTO NO CALENDÁRIO
                  </Button>
                </Link>
              </div>
            ) : activeRule?.category === 'power_unit' ? (
              /* Contexto de Unidade de Potência */
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                    FORNECEDOR HOMOLOGADO
                  </span>
                  <div className="text-sm font-extrabold text-[#0F172A] mt-0.5">
                    {engineSupplier} V6 Turbo-Híbrido 2026
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B]">Potência Canônica:</span>
                    <strong className="text-[#0F172A]">{teamPuSpec.powerRating}/100</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B]">Confiabilidade de Fábrica:</span>
                    <strong className="text-[#0F172A]">{teamPuSpec.reliabilityRating}/100</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B]">Custo de Fornecimento:</span>
                    <strong className="text-[#0F172A]">
                      ${(teamPuSpec.annualCostUsd / 1_000_000).toFixed(1)}M / ano
                    </strong>
                  </div>
                </div>

                <Link to="/infraestrutura" className="block">
                  <Button
                    variant="outline"
                    className="w-full border-[#CBD5E1] text-[#0F172A] font-bold text-xs h-9"
                  >
                    VER INFRAESTRUTURA & MOTOR
                  </Button>
                </Link>
              </div>
            ) : activeRule?.category === 'pneus' ? (
              /* Contexto de Pneus */
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                    ALOCAÇÃO OFICIAL PIRELLI
                  </span>
                  <div className="text-sm font-extrabold text-[#0F172A] mt-0.5">
                    GP Padrão: {STANDARD_GP_TYRE_ALLOCATION.totalSetsPerDriver} jogos por piloto (80
                    pneus)
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Sprint: {SPRINT_GP_TYRE_ALLOCATION.totalSetsPerDriver} jogos por piloto (76
                    pneus)
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                    Próxima Rodada (R{currentRound}) — Compostos Físicos
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Duro:</span>
                    <strong className="text-[#0F172A]">{nextGpNomination.hardPhysical}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Médio:</span>
                    <strong className="text-[#0F172A]">{nextGpNomination.mediumPhysical}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Macio:</span>
                    <strong className="text-[#0F172A]">{nextGpNomination.softPhysical}</strong>
                  </div>
                </div>

                <Link to="/corrida" className="block">
                  <Button
                    variant="outline"
                    className="w-full border-[#CBD5E1] text-[#0F172A] font-bold text-xs h-9"
                  >
                    IR PARA SESSÃO DO GP
                  </Button>
                </Link>
              </div>
            ) : activeRule?.category === 'licencas' ? (
              /* Contexto de Licenças */
              <div className="space-y-3 animate-in fade-in">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                  PILOTOS DA EQUIPE & STATUS DE LICENÇA
                </span>

                <div className="space-y-2 text-xs">
                  {driverLicenses.map(({ driver, view }) => (
                    <div
                      key={driver.id}
                      className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A]">{driver.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono font-bold ${
                            view.licenseStatus === 'nivel_a'
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                              : 'border-amber-300 text-amber-700 bg-amber-50'
                          }`}
                        >
                          {view.licenseStatus === 'nivel_a'
                            ? 'Licença A (Superlicença)'
                            : view.licenseStatus === 'nivel_b'
                              ? 'Licença B (TL1)'
                              : 'Licença C (Base)'}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-[#64748B] flex items-center justify-between">
                        <span>Função: {driver.role || 'Titular'}</span>
                        <span>
                          {view.isEligibleForF1Seat
                            ? 'Elegível para Corrida'
                            : 'Inapto para Corrida Principal'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link to="/pilotos" className="block">
                  <Button
                    variant="outline"
                    className="w-full border-[#CBD5E1] text-[#0F172A] font-bold text-xs h-9"
                  >
                    VER PLANTEL DE PILOTOS
                  </Button>
                </Link>
              </div>
            ) : (
              /* Painel Padrão para regras informativas */
              <div className="space-y-3 text-xs text-[#64748B]">
                <p>
                  Esta regra possui aplicação geral para todas as equipes do campeonato mundial.
                </p>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                  <span className="text-[10px] font-bold text-[#0F172A] uppercase block">
                    Autoridade Regulamentadora
                  </span>
                  <div className="text-xs font-semibold text-[#0F172A]">
                    {activeRule?.sourceMetadata.authority || 'FIA'}
                  </div>
                  <div className="text-[11px]">{activeRule?.sourceMetadata.documentTitle}</div>
                </div>

                {activeRule?.relatedRoute && (
                  <Link to={activeRule.relatedRoute} className="block pt-1">
                    <Button
                      variant="outline"
                      className="w-full border-[#CBD5E1] text-[#0F172A] font-bold text-xs h-9"
                    >
                      {activeRule.relatedRouteLabel || 'IR PARA A SESSÃO RELACIONADA'}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </Card>
        </aside>
      </section>

      {/* 4. CARDS INFERIORES DE RESUMO / ATALHOS RÁPIDOS */}
      <section className="pt-4 border-t border-[#E2E8F0] space-y-3">
        <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
          Acesso Rápido aos Pilares Regulamentares
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card Atalho: PNEUS */}
          <Card
            onClick={() => {
              setSelectedCategory('pneus')
              setSelectedRuleId('reg_tyre_allocation_pirelli')
            }}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-[#E10600] transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">ALOCAÇÃO</span>
              <Disc className="w-4 h-4 text-rose-500" />
            </div>
            <h4 className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#E10600]">
              PNEUS PIRELLI
            </h4>
            <p className="text-[11px] text-[#64748B] mt-1">
              {STANDARD_GP_TYRE_ALLOCATION.totalSetsPerDriver} jogos no GP Padrão (2 Duros, 3
              Médios, 8 Macios, 4 Inters, 3 Wets).
            </p>
          </Card>

          {/* Card Atalho: QUALIFICAÇÃO */}
          <Card
            onClick={() => {
              setSelectedCategory('qualificacao')
              setSelectedRuleId('reg_qualifying_format')
            }}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-[#E10600] transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">SESSÃO</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <h4 className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#E10600]">
              QUALIFICAÇÃO
            </h4>
            <p className="text-[11px] text-[#64748B] mt-1">
              Fases Q1 (18m), Q2 (15m) e Q3 (12m) com eliminação progressiva dos 24 carros.
            </p>
          </Card>

          {/* Card Atalho: PONTUAÇÃO */}
          <Card
            onClick={() => {
              setSelectedCategory('pontuacao')
              setSelectedRuleId('reg_fia_scoring_system')
            }}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-[#E10600] transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">ESPORTIVO</span>
              <Award className="w-4 h-4 text-blue-500" />
            </div>
            <h4 className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#E10600]">
              PONTUAÇÃO FIA
            </h4>
            <p className="text-[11px] text-[#64748B] mt-1">
              Top 10: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 para Pilotos e Construtores.
            </p>
          </Card>

          {/* Card Atalho: SPRINT */}
          <Card
            onClick={() => {
              setSelectedCategory('sprint')
              setSelectedRuleId('reg_sprint_format')
            }}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-[#E10600] transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">FORMATO</span>
              <Zap className="w-4 h-4 text-purple-500" />
            </div>
            <h4 className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#E10600]">
              SPRINT SHOOTOUT
            </h4>
            <p className="text-[11px] text-[#64748B] mt-1">
              Cronograma com 1 TL, alocação de 19 jogos e pontos para o Top 8.
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}
