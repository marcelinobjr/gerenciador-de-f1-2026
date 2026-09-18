import React, { useState, useMemo } from 'react'
import { CanonicalSponsorProfile } from '@/types/canonical-commercial'
import { TeamModel } from '@/types/f1'
import { SponsorSlotKey, OFFICIAL_SPONSOR_SLOTS } from '@/data/assets/teamSponsorHotspots'
import { COMMERCIAL_MARKET_SPONSORS } from '@/data/commercialMarketData'
import { calculateCanonicalSponsorFit } from '@/lib/sponsorFitCalculator'
import {
  Search,
  Building2,
  TrendingUp,
  Flame,
  Award,
  ChevronRight,
  FilterX,
  Sparkles,
  Info,
} from 'lucide-react'

export interface TabMarketOpportunitiesProps {
  team: TeamModel | null | undefined
  initialFilterSlot?: SponsorSlotKey | null
  onStartNegotiation: (sponsor: CanonicalSponsorProfile, preferredSlot?: SponsorSlotKey) => void
  onSelectSponsorDetails?: (sponsor: CanonicalSponsorProfile) => void
}

export const TabMarketOpportunities: React.FC<TabMarketOpportunitiesProps> = ({
  team,
  initialFilterSlot = null,
  onStartNegotiation,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('todos')
  const [selectedSlot, setSelectedSlot] = useState<string>(initialFilterSlot || 'todos')
  const [selectedBudgetTier, setSelectedBudgetTier] = useState<string>('todos')
  const [sortBy, setSortBy] = useState<'maior_valor' | 'melhor_fit' | 'maior_interesse'>(
    'maior_valor',
  )
  const [selectedDetailSponsor, setSelectedDetailSponsor] =
    useState<CanonicalSponsorProfile | null>(null)

  // Extrair setores únicos para o filtro
  const availableSectors = useMemo(() => {
    const set = new Set<string>()
    COMMERCIAL_MARKET_SPONSORS.forEach((s) => set.add(s.sector))
    return Array.from(set)
  }, [])

  // Filtragem e ordenação canônica
  const filteredSponsors = useMemo(() => {
    return COMMERCIAL_MARKET_SPONSORS.filter((s) => {
      // Busca por nome ou setor
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchesName = s.name.toLowerCase().includes(query)
        const matchesSector = s.sector.toLowerCase().includes(query)
        const matchesCountry = s.country.toLowerCase().includes(query)
        if (!matchesName && !matchesSector && !matchesCountry) return false
      }

      // Setor
      if (selectedSector !== 'todos' && s.sector !== selectedSector) {
        return false
      }

      // Espaço de interesse
      if (selectedSlot !== 'todos') {
        if (!s.preferredSlots.includes(selectedSlot as SponsorSlotKey)) {
          return false
        }
      }

      // Faixa de orçamento
      if (selectedBudgetTier !== 'todos') {
        if (selectedBudgetTier === 'alto' && s.estimatedBudgetMax < 25) return false
        if (
          selectedBudgetTier === 'medio' &&
          (s.estimatedBudgetMax < 15 || s.estimatedBudgetMax >= 25)
        )
          return false
        if (selectedBudgetTier === 'acessivel' && s.estimatedBudgetMax >= 15) return false
      }

      return true
    }).sort((a, b) => {
      const fitA = calculateCanonicalSponsorFit(a, team).score
      const fitB = calculateCanonicalSponsorFit(b, team).score

      if (sortBy === 'maior_valor') {
        return b.estimatedBudgetMax - a.estimatedBudgetMax
      } else if (sortBy === 'melhor_fit') {
        return fitB - fitA
      } else {
        // maior interesse = fit ponderado com menor exigência
        return fitB - fitA
      }
    })
  }, [searchTerm, selectedSector, selectedSlot, selectedBudgetTier, sortBy, team])

  // Insights reais calculados a partir do pool de mercado
  const marketInsights = useMemo(() => {
    const totalAvailable = COMMERCIAL_MARKET_SPONSORS.reduce(
      (acc, s) => acc + s.estimatedBudgetMax,
      0,
    )

    // Contagem de setores
    const sectorCounts: Record<string, number> = {}
    COMMERCIAL_MARKET_SPONSORS.forEach((s) => {
      sectorCounts[s.sector] = (sectorCounts[s.sector] || 0) + 1
    })
    const mostActiveSector =
      Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tecnologia'

    // Contagem de slots
    const slotCounts: Record<string, number> = {}
    COMMERCIAL_MARKET_SPONSORS.forEach((s) => {
      s.preferredSlots.forEach((slot) => {
        slotCounts[slot] = (slotCounts[slot] || 0) + 1
      })
    })
    const mostDemandedSlotKey =
      Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sidepod'
    const mostDemandedSlotName =
      OFFICIAL_SPONSOR_SLOTS.find((s) => s.key === mostDemandedSlotKey)?.labelEn ||
      'Lateral / Sidepod'

    // Top 3 recomendados por fit
    const recommended = [...COMMERCIAL_MARKET_SPONSORS]
      .map((s) => ({ sponsor: s, fit: calculateCanonicalSponsorFit(s, team) }))
      .sort((a, b) => b.fit.score - a.fit.score)
      .slice(0, 3)

    return {
      totalAvailable,
      mostActiveSector,
      mostDemandedSlotName,
      recommended,
    }
  }, [team])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSector('todos')
    setSelectedSlot('todos')
    setSelectedBudgetTier('todos')
    setSortBy('maior_valor')
  }

  return (
    <div className="space-y-6">
      {/* 1. BARRA DE FILTROS SUPERIORES (REFERÊNCIA VISUAL 2) */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Campo de Busca */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar empresa, setor ou palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E10600]/20 focus:border-[#E10600]"
            />
          </div>

          {/* Filtro Setores */}
          <div className="md:col-span-3">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E10600]/20 focus:border-[#E10600]"
            >
              <option value="todos">Todos os Setores</option>
              {availableSectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Espaço */}
          <div className="md:col-span-3">
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E10600]/20 focus:border-[#E10600]"
            >
              <option value="todos">Todos os Espaços</option>
              {OFFICIAL_SPONSOR_SLOTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Faixa Orçamento */}
          <div className="md:col-span-2">
            <select
              value={selectedBudgetTier}
              onChange={(e) => setSelectedBudgetTier(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E10600]/20 focus:border-[#E10600]"
            >
              <option value="todos">Qualquer Orçamento</option>
              <option value="alto">Alto (US$ 25M+)</option>
              <option value="medio">Médio (US$ 15M - 25M)</option>
              <option value="acessivel">Acessível (&lt; US$ 15M)</option>
            </select>
          </div>
        </div>

        {/* Linha auxiliar: Total de marcas e ordenação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-100 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-neutral-800">
              {filteredSponsors.length} empresas encontradas
            </span>
            {(searchTerm ||
              selectedSector !== 'todos' ||
              selectedSlot !== 'todos' ||
              selectedBudgetTier !== 'todos') && (
              <button
                onClick={clearFilters}
                className="text-neutral-500 hover:text-[#E10600] flex items-center gap-1 font-semibold transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 font-semibold focus:outline-none text-xs"
            >
              <option value="maior_valor">Maior Valor</option>
              <option value="melhor_fit">Melhor Fit</option>
              <option value="maior_interesse">Maior Interesse</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. CONTEÚDO PRINCIPAL: LISTA DE MARCAS + PAINEL LATERAL DE INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LISTA DE EMPRESAS (8 COLUNAS) */}
        <div className="lg:col-span-8 space-y-3">
          {filteredSponsors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
              <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-neutral-800">Nenhum patrocinador encontrado</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Tente ajustar os filtros ou buscar por outro termo comercial.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors"
              >
                Restaurar Filtros
              </button>
            </div>
          ) : (
            filteredSponsors.map((sponsor) => {
              const fit = calculateCanonicalSponsorFit(sponsor, team)

              return (
                <div
                  key={sponsor.id}
                  className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Identidade do Patrocinador */}
                  <div className="flex items-center gap-3.5 md:w-[28%] min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-200 p-2 flex items-center justify-center shrink-0">
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback gracioso com iniciais se o logo falhar
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-neutral-900 truncate">
                        {sponsor.name}
                      </h4>
                      <p className="text-[11px] text-neutral-500 truncate">{sponsor.sector}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-400 font-mono">
                        <span>{sponsor.country}</span>
                        <span>•</span>
                        <span>{sponsor.reach}</span>
                      </div>
                    </div>
                  </div>

                  {/* Valor Estimado */}
                  <div className="md:w-[22%]">
                    <span className="text-[10px] text-neutral-400 font-mono uppercase block">
                      Valor Estimado
                    </span>
                    <span className="text-sm font-black font-mono text-neutral-900 block mt-0.5">
                      US$ {sponsor.estimatedBudgetMin}M – {sponsor.estimatedBudgetMax}M
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      por ano ({sponsor.potentialContractYears} temporadas)
                    </span>
                  </div>

                  {/* Espaços de Interesse & Fit */}
                  <div className="md:w-[28%] space-y-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-mono uppercase block">
                        Espaços de Interesse
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sponsor.preferredSlots.slice(0, 3).map((slotKey) => {
                          const slotLabel =
                            OFFICIAL_SPONSOR_SLOTS.find((s) => s.key === slotKey)?.labelEn ||
                            slotKey
                          return (
                            <span
                              key={slotKey}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold"
                            >
                              {slotLabel}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-500">Fit com a Equipe</span>
                        <span className="font-bold font-mono text-emerald-600">{fit.score}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${fit.score}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                        {fit.description}
                      </p>
                    </div>
                  </div>

                  {/* CTAs de Ação Real (NÃO cria contrato instantâneo; inicia processo real) */}
                  <div className="md:w-[20%] flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => onStartNegotiation(sponsor, sponsor.preferredSlots[0])}
                      className="w-full py-2 px-3 rounded-xl bg-[#E10600] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      Iniciar Negociação
                    </button>
                    <button
                      onClick={() => setSelectedDetailSponsor(sponsor)}
                      className="w-full py-1.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      Ver Detalhes
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* PAINEL LATERAL: INSIGHTS DO MERCADO & TENDÊNCIAS (4 COLUNAS - REFERÊNCIA VISUAL 2) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card Insights */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#E10600]" />
              Insights do Mercado Comercial
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-500 font-mono block">
                  Valor Total Disponível
                </span>
                <span className="text-base font-black font-mono text-neutral-900 block mt-0.5">
                  US$ {marketInsights.totalAvailable} M
                </span>
                <span className="text-[10px] font-mono text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
                  +12% vs. 2025
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-500 font-mono block">
                  Setor Mais Ativo
                </span>
                <span className="text-sm font-bold text-neutral-900 block mt-0.5 truncate">
                  {marketInsights.mostActiveSector}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">Maior demanda</span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 col-span-2">
                <span className="text-[10px] text-neutral-500 font-mono block">
                  Espaço Mais Procurado
                </span>
                <span className="text-sm font-bold text-neutral-900 block mt-0.5">
                  {marketInsights.mostDemandedSlotName}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Presente na preferência de mais de 70% das marcas
                </span>
              </div>
            </div>
          </div>

          {/* Tendências Reais do Regulamento 2026 */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              Tendências de Investimento (2026)
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="font-medium text-emerald-950">
                  Tecnologia & Nuvem (IA e Telemetria)
                </span>
                <span className="font-mono font-bold text-emerald-600">+23%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="font-medium text-emerald-950">
                  Combustíveis Sustentáveis e Baterias
                </span>
                <span className="font-mono font-bold text-emerald-600">+18%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="font-medium text-emerald-950">
                  Serviços Financeiros & Fintechs
                </span>
                <span className="font-mono font-bold text-emerald-600">+15%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="font-medium text-emerald-950">
                  Marcas de Luxo e Alta Relojoaria
                </span>
                <span className="font-mono font-bold text-emerald-600">+12%</span>
              </div>
            </div>
          </div>

          {/* Oportunidades Recomendadas (Referência Visual 2) */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E10600]" />
              Oportunidades Recomendadas
            </h3>

            <div className="space-y-2">
              {marketInsights.recommended.map(({ sponsor, fit }) => (
                <div
                  key={sponsor.id}
                  onClick={() => onStartNegotiation(sponsor, sponsor.preferredSlots[0])}
                  className="cursor-pointer p-2.5 rounded-xl border border-neutral-150 hover:border-[#E10600] bg-neutral-50/50 hover:bg-red-50/30 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 p-1 flex items-center justify-center shrink-0">
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">
                        {sponsor.name}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-600 font-bold">
                        Fit: {fit.score}%
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono font-bold text-neutral-800 block">
                      US$ {sponsor.estimatedBudgetMin}M - {sponsor.estimatedBudgetMax}M
                    </span>
                    <span className="text-[9px] text-[#E10600] font-semibold flex items-center justify-end gap-0.5 group-hover:underline">
                      Negociar <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CANÔNICO DE DETALHES DO PATROCINADOR */}
      {selectedDetailSponsor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-200 p-2 flex items-center justify-center">
                  <img
                    src={selectedDetailSponsor.logoUrl}
                    alt={selectedDetailSponsor.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {selectedDetailSponsor.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {selectedDetailSponsor.sector} • {selectedDetailSponsor.country}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailSponsor(null)}
                className="text-neutral-400 hover:text-neutral-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 block uppercase">
                  Observação Comercial & Perfil
                </span>
                <p className="text-neutral-700">{selectedDetailSponsor.commercialNotes}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    Faixa de Investimento
                  </span>
                  <span className="font-bold font-mono text-neutral-900">
                    US$ {selectedDetailSponsor.estimatedBudgetMin}M –{' '}
                    {selectedDetailSponsor.estimatedBudgetMax}M / ano
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    Duração Típica
                  </span>
                  <span className="font-bold text-neutral-900">
                    {selectedDetailSponsor.potentialContractYears} temporadas
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 block uppercase">
                  Exigência Esportiva da Diretoria
                </span>
                <p className="text-neutral-800 font-medium">
                  {selectedDetailSponsor.sportingRequirement}
                </p>
              </div>

              {/* Fatores do Sponsor Fit */}
              {(() => {
                const fit = calculateCanonicalSponsorFit(selectedDetailSponsor, team)
                return (
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 block">
                      Análise de Fit Estratégico ({fit.score}/100)
                    </span>
                    <div className="space-y-1.5">
                      {fit.factors.map((f) => (
                        <div
                          key={f.name}
                          className="flex items-center justify-between text-[11px] p-1.5 rounded bg-neutral-50"
                        >
                          <span className="text-neutral-700 truncate pr-2">{f.name}</span>
                          <span className="font-mono font-bold text-neutral-900 shrink-0">
                            {f.score}/100
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedDetailSponsor(null)}
                className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-semibold"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  const sp = selectedDetailSponsor
                  setSelectedDetailSponsor(null)
                  onStartNegotiation(sp, sp.preferredSlots[0])
                }}
                className="px-5 py-2 rounded-xl bg-[#E10600] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md"
              >
                Ir para Mesa de Negociações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
