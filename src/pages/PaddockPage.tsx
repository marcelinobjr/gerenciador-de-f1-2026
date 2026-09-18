import React, { useState, useMemo } from 'react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { ALL_GRID_TEAMS_DATABASE, OFFICIAL_2026_GRID_KEYS } from '@/lib/grid-teams-database'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { getTeamCarPhotoUrl } from '@/lib/team-car-photo-resolver'
import {
  INITIAL_GRID_FACILITIES,
  DEFAULT_CUSTOM_TEAM_FACILITIES,
} from '@/data/initial-team-facilities'
import {
  Search,
  Trophy,
  Shield,
  Building2,
  CheckCircle2,
  MinusCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Gauge,
  Factory,
  Compass,
  Wind,
  Layers,
  Monitor,
  Activity,
  Wrench,
  GraduationCap,
  Sparkles,
  Car,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export type TeamFilterTab = 'todas' | 'no_campeonato' | 'fora_campeonato'

export interface UnifiedPaddockTeam {
  id: string
  key: string
  name: string
  shortName: string
  color: string
  engine: string // fornecedor atual ou previsto se cadastrado, senão "A definir"
  country: string
  flag: string
  headquarters: string
  category: string
  historySummary: string
  currentSituation: string
  competitivenessVerdict: string
  difficulty: string
  boardPressure: string
  initialObjective: string
  specialTraits: string[]
  // Características técnicas e organizacionais
  carRating: number | null
  engineeringRating: number | null
  operationsRating: number | null
  prestigeRating: number | null
  cultureRating: number | null
  potentialRating: number | null
  budget: number | null
  isPlayer: boolean
  inCurrentSeason: boolean
  // Dados de classificação oficial FIA da temporada atual
  position: number | null // null para não participantes
  points: number | null // null para não participantes
  wins: number | null // null para não participantes
  podiums: number | null // null para não participantes
  hasOfficialPointsRecord: boolean // true se a equipe participante possui pontos ou já computou classificação
}

export default function PaddockPage() {
  const { team: playerTeam, season, constructorStandings, loading } = useUnifiedSeason()

  const seasonYear = season?.year || 2026

  // 1. Identificar chaves ou IDs canônicos inscritos na temporada atual
  const participatingKeys = useMemo<Set<string>>(() => {
    const keys = new Set<string>()

    // Chaves padrão da temporada atual
    OFFICIAL_2026_GRID_KEYS.forEach((k) => keys.add(k.toLowerCase().trim()))

    // Se o jogador configurou uma equipe customizada ou grid customizado
    if (playerTeam) {
      if (playerTeam.team_key) {
        keys.add(playerTeam.team_key.toLowerCase().trim())
      }
      if (playerTeam.name) {
        keys.add(playerTeam.name.toLowerCase().trim())
      }
      if (playerTeam.id) {
        keys.add(playerTeam.id.toLowerCase().trim())
      }
    }

    // Se houver custom_grid_teams gravado na temporada/save do jogador
    if (playerTeam?.custom_grid_teams && Array.isArray(playerTeam.custom_grid_teams)) {
      playerTeam.custom_grid_teams.forEach((cg: any) => {
        const itemKey = cg?.key || cg?.id || cg?.name
        if (itemKey) keys.add(String(itemKey).toLowerCase().trim())
      })
    }

    // Se houver classificação canônica de construtores ativa
    if (constructorStandings && constructorStandings.length > 0) {
      constructorStandings.forEach((cs) => {
        if (cs.id) keys.add(cs.id.toLowerCase().trim())
        if (cs.name) keys.add(cs.name.toLowerCase().trim())
      })
    }

    return keys
  }, [playerTeam, constructorStandings])

  // 2. Mapeamento de classificação canônica por equipe (lookup rápido)
  const standingsMap = useMemo(() => {
    const map = new Map<string, { rank: number; points: number; wins: number; podiums: number }>()

    if (constructorStandings && constructorStandings.length > 0) {
      constructorStandings.forEach((c, index) => {
        const rank = index + 1
        const stats = {
          rank,
          points: c.points ?? 0,
          wins: c.wins ?? 0,
          podiums: c.podiums ?? 0,
        }
        if (c.id) {
          map.set(c.id.toLowerCase().trim(), stats)
          map.set(c.id.toLowerCase().replace(/[^a-z0-9]/g, ''), stats)
          map.set(c.id.toLowerCase().replace(/^ai_/, ''), stats)
        }
        if (c.name) {
          map.set(c.name.toLowerCase().trim(), stats)
          map.set(c.name.toLowerCase().replace(/[^a-z0-9]/g, ''), stats)
        }
      })
    }

    return map
  }, [constructorStandings])

  // Verifica se o campeonato já possui qualquer resultado ou pontuação oficial registrada
  const seasonHasOfficialResults = useMemo(() => {
    if (!constructorStandings || constructorStandings.length === 0) return false
    return constructorStandings.some(
      (c) => (c.points ?? 0) > 0 || (c.wins ?? 0) > 0 || (c.podiums ?? 0) > 0,
    )
  }, [constructorStandings])

  // 3. Montar a lista canônica das 28 equipes estruturadas
  const allTeams = useMemo<UnifiedPaddockTeam[]>(() => {
    const list: UnifiedPaddockTeam[] = []

    ALL_GRID_TEAMS_DATABASE.forEach((struct) => {
      const isPlayer =
        (playerTeam?.team_key && playerTeam.team_key === struct.key) ||
        (playerTeam?.name &&
          playerTeam.name.toLowerCase().trim() === struct.name.toLowerCase().trim())

      // Inscrição na temporada atual
      const isParticipating =
        isPlayer ||
        participatingKeys.has(struct.key.toLowerCase().trim()) ||
        participatingKeys.has(struct.name.toLowerCase().trim()) ||
        OFFICIAL_2026_GRID_KEYS.includes(struct.key)

      // Se participante, buscar classificação canônica da temporada
      let standingInfo: { rank: number; points: number; wins: number; podiums: number } | null =
        null
      if (isParticipating) {
        standingInfo =
          (isPlayer && playerTeam?.id
            ? standingsMap.get(playerTeam.id.toLowerCase().trim())
            : null) ||
          (isPlayer && playerTeam?.name
            ? standingsMap.get(playerTeam.name.toLowerCase().trim())
            : null) ||
          standingsMap.get(struct.key.toLowerCase().trim()) ||
          standingsMap.get(struct.name.toLowerCase().trim()) ||
          standingsMap.get(struct.shortName.toLowerCase().trim()) ||
          standingsMap.get(struct.key.replace(/[^a-z0-9]/g, '')) ||
          null

        // Se ainda não encontrou mas a equipe está no grid oficial, verificar se foi incluída no constructorStandings com prefixo "ai_"
        if (!standingInfo) {
          standingInfo = standingsMap.get(`ai_${struct.key}`) || null
        }
      }

      // Motor cadastrado ou previsto
      let engineDisplay = 'A definir'
      if (isPlayer && playerTeam?.engine_supplier) {
        engineDisplay = playerTeam.engine_supplier
      } else if (struct.engine && struct.engine.trim() !== '') {
        engineDisplay = struct.engine
      }

      list.push({
        id: isPlayer && playerTeam?.id ? playerTeam.id : struct.key,
        key: struct.key,
        name: isPlayer && playerTeam?.name ? playerTeam.name : struct.name,
        shortName: struct.shortName,
        color: isPlayer && playerTeam?.color ? playerTeam.color : struct.color,
        engine: engineDisplay,
        country: struct.country || 'Internacional',
        flag: struct.flag || '🏁',
        headquarters: struct.headquarters || 'Sede não cadastrada',
        category: struct.category || 'Não informado',
        historySummary: struct.historySummary || '',
        currentSituation: struct.currentSituation || '',
        competitivenessVerdict: struct.competitivenessVerdict || '',
        difficulty: struct.difficulty || '',
        boardPressure: struct.boardPressure || '',
        initialObjective: struct.initialObjective || '',
        specialTraits: struct.specialTraits || [],
        carRating: struct.carRating ?? null,
        engineeringRating: struct.engineeringRating ?? null,
        operationsRating: struct.operationsRating ?? null,
        prestigeRating: struct.prestigeRating ?? null,
        cultureRating: struct.cultureRating ?? null,
        potentialRating: struct.potentialRating ?? null,
        budget: struct.budget ?? null,
        isPlayer,
        inCurrentSeason: isParticipating,
        position: isParticipating ? (standingInfo ? standingInfo.rank : 0) : null,
        points: isParticipating ? (standingInfo ? standingInfo.points : 0) : null,
        wins: isParticipating ? (standingInfo ? standingInfo.wins : 0) : null,
        podiums: isParticipating ? (standingInfo ? standingInfo.podiums : 0) : null,
        hasOfficialPointsRecord: isParticipating && standingInfo !== null,
      })
    })

    return list
  }, [playerTeam, participatingKeys, standingsMap])

  // Contagens dinâmicas
  const totalCount = allTeams.length
  const participatingCount = useMemo(
    () => allTeams.filter((t) => t.inCurrentSeason).length,
    [allTeams],
  )
  const nonParticipatingCount = totalCount - participatingCount

  // Filtros e busca
  const [filterTab, setFilterTab] = useState<TeamFilterTab>('todas')
  const [searchTerm, setSearchTerm] = useState('')

  // Lista filtrada e ordenada conforme especificação
  const filteredTeams = useMemo(() => {
    let result = allTeams

    // Filtro de aba
    if (filterTab === 'no_campeonato') {
      result = result.filter((t) => t.inCurrentSeason)
    } else if (filterTab === 'fora_campeonato') {
      result = result.filter((t) => !t.inCurrentSeason)
    }

    // Busca textual por nome
    const query = searchTerm.toLowerCase().trim()
    if (query !== '') {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.shortName.toLowerCase().includes(query) ||
          t.country.toLowerCase().includes(query) ||
          t.engine.toLowerCase().includes(query),
      )
    }

    return result
  }, [allTeams, filterTab, searchTerm])

  // Separar em dois grupos no filtro TODAS
  const participantsGroup = useMemo(() => {
    const list = filteredTeams.filter((t) => t.inCurrentSeason)
    // Ordem da classificação canônica FIA; se sem posição definida ainda (empate 0), mantém por pontuação/vitórias ou ordem original da FIA
    return [...list].sort((a, b) => {
      const posA = a.position && a.position > 0 ? a.position : 999
      const posB = b.position && b.position > 0 ? b.position : 999
      if (posA !== posB) return posA - posB
      return (b.points ?? 0) - (a.points ?? 0)
    })
  }, [filteredTeams])

  const nonParticipantsGroup = useMemo(() => {
    const list = filteredTeams.filter((t) => !t.inCurrentSeason)
    // Ordem alfabética por nome
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [filteredTeams])

  // 4. Seleção da equipe para o painel lateral e controle de expansão de infraestrutura
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null)
  const [isFacilitiesExpanded, setIsFacilitiesExpanded] = useState(false)
  const [carImageLoading, setCarImageLoading] = useState(false)

  // Seleção inicial automática: equipe do jogador se visível, senão a primeira disponível
  const activeSelectedTeam = useMemo(() => {
    if (filteredTeams.length === 0) return null

    if (selectedTeamKey) {
      const found = filteredTeams.find((t) => t.key === selectedTeamKey)
      if (found) return found
    }

    // Procura a equipe do jogador entre as visíveis
    const playerInFiltered = filteredTeams.find((t) => t.isPlayer)
    if (playerInFiltered) return playerInFiltered

    // Senão, primeira participante do grupo se houver
    if (participantsGroup.length > 0) return participantsGroup[0]

    return filteredTeams[0]
  }, [filteredTeams, selectedTeamKey, participantsGroup])

  const handleSelectTeam = (teamItem: UnifiedPaddockTeam) => {
    if (selectedTeamKey !== teamItem.key) {
      setCarImageLoading(true)
      setSelectedTeamKey(teamItem.key)
    }
  }

  // Obter instalações da equipe ativa a partir do catálogo canônico existente
  const activeTeamFacilities = useMemo(() => {
    if (!activeSelectedTeam) return null
    const norm = activeSelectedTeam.key.toLowerCase().replace(/[^a-z0-9]/g, '')
    return INITIAL_GRID_FACILITIES[norm] || DEFAULT_CUSTOM_TEAM_FACILITIES
  }, [activeSelectedTeam])

  // Obter foto oficial do carro para a equipe ativa
  const activeCarPhotoUrl = useMemo(() => {
    if (!activeSelectedTeam) return null
    return (
      getTeamCarPhotoUrl(activeSelectedTeam.key) ||
      getTeamCarPhotoUrl(activeSelectedTeam.name) ||
      getTeamCarPhotoUrl(activeSelectedTeam.shortName)
    )
  }, [activeSelectedTeam])

  // Renderizar linha individual da tabela
  const renderTeamRow = (teamItem: UnifiedPaddockTeam) => {
    const isSelected = activeSelectedTeam?.key === teamItem.key
    const reducedLogo = getTeamReducedLogoUrl(teamItem.name) || getTeamReducedLogoUrl(teamItem.key)

    // Formatação de colunas conforme participação canônica
    const isParticipating = teamItem.inCurrentSeason
    const posText = isParticipating
      ? teamItem.position && teamItem.position > 0
        ? `${teamItem.position}º`
        : '—'
      : '—'
    const pointsText = isParticipating ? (teamItem.points !== null ? teamItem.points : '—') : '—'
    const winsText = isParticipating ? (teamItem.wins !== null ? teamItem.wins : '—') : '—'
    const podiumsText = isParticipating ? (teamItem.podiums !== null ? teamItem.podiums : '—') : '—'

    return (
      <tr
        key={teamItem.key}
        data-testid={`team-row-${teamItem.key}`}
        onClick={() => handleSelectTeam(teamItem)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSelectTeam(teamItem)
          }
        }}
        tabIndex={0}
        aria-selected={isSelected}
        role="row"
        className={`relative cursor-pointer transition-colors border-b border-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#E10600] focus:z-10 ${
          isSelected ? 'bg-red-50/80 font-medium' : 'bg-white hover:bg-neutral-50/80'
        }`}
      >
        {/* Barra lateral vermelha de seleção ativa */}
        {isSelected && (
          <td className="p-0 w-0">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#E10600]" aria-hidden="true" />
          </td>
        )}

        {/* POS */}
        <td className="py-2.5 px-3 text-center w-12 text-xs font-mono font-bold text-[#64748B]">
          {posText}
        </td>

        {/* EQUIPE (emblema reduzido + nome) */}
        <td className="py-2.5 px-3 min-w-[180px]">
          <div className="flex items-center gap-2.5">
            {reducedLogo ? (
              <img
                src={reducedLogo}
                alt={`Emblema ${teamItem.name}`}
                className="w-5 h-5 object-contain shrink-0"
                loading="lazy"
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                style={{ backgroundColor: teamItem.color }}
              >
                {teamItem.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-[#0F172A]">{teamItem.name}</span>
              {teamItem.isPlayer && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#E10600] text-white shrink-0">
                  SUA EQUIPE
                </span>
              )}
            </div>
          </div>
        </td>

        {/* MOTOR */}
        <td className="py-2.5 px-3 text-xs text-[#475569] truncate">
          <span className="inline-block max-w-[120px] truncate" title={teamItem.engine}>
            {teamItem.engine}
          </span>
        </td>

        {/* PONTOS */}
        <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-[#0F172A] w-20">
          {pointsText}
        </td>

        {/* VITÓRIAS */}
        <td className="py-2.5 px-3 text-center text-xs font-mono font-semibold text-[#64748B] w-20">
          {winsText}
        </td>

        {/* PÓDIOS */}
        <td className="py-2.5 px-3 text-center text-xs font-mono font-semibold text-[#64748B] w-20">
          {podiumsText}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6 pb-16 antialiased text-[#0F172A] select-none">
      {/* 1. CABEÇALHO OFICIAL */}
      <div className="border-b border-[#E2E8F0] pb-4">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0F172A] flex items-center gap-2">
          <span>EQUIPES</span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-100 text-[#475569] border border-neutral-200">
            UNIVERSO F1 {seasonYear}
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] mt-1">
          Conheça as equipes do universo APEX GP, compare suas características e acompanhe sua
          participação na temporada.
        </p>
      </div>

      {/* 2. FILTROS E BUSCA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
        {/* Abas de Filtro de Participação */}
        <div className="inline-flex items-center p-1 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            data-testid="filter-tab-todas"
            onClick={() => setFilterTab('todas')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'todas'
                ? 'bg-[#E10600] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            Todas ({totalCount})
          </button>
          <button
            type="button"
            data-testid="filter-tab-no-campeonato"
            onClick={() => setFilterTab('no_campeonato')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'no_campeonato'
                ? 'bg-[#E10600] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            No campeonato ({participatingCount})
          </button>
          <button
            type="button"
            data-testid="filter-tab-fora-campeonato"
            onClick={() => setFilterTab('fora_campeonato')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'fora_campeonato'
                ? 'bg-[#E10600] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            Fora do campeonato ({nonParticipatingCount})
          </button>
        </div>

        {/* Campo de Busca por Nome */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            data-testid="team-search-input"
            placeholder="Buscar equipe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#E10600] focus:ring-1 focus:ring-[#E10600]"
          />
        </div>
      </div>

      {/* 3. LAYOUT PRINCIPAL: LISTA (ESQUERDA) + PAINEL BÁSICO (DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: LISTA DE EQUIPES (8 COLUNAS NO DESKTOP) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-full bg-neutral-100" />
              ))}
            </div>
          ) : filteredTeams.length === 0 ? (
            /* Estado vazio honesto quando busca/filtro não encontram nada */
            <div
              data-testid="empty-teams-state"
              className="p-12 text-center flex flex-col items-center justify-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-[#64748B]">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">Nenhuma equipe encontrada</h3>
                <p className="text-xs text-[#64748B] max-w-sm">
                  Nenhum registro corresponde aos critérios selecionados. Verifique a digitação ou
                  selecione outro filtro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterTab('todas')
                  setSearchTerm('')
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-[#0F172A] transition-colors"
              >
                Limpar filtros e busca
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    <th className="py-2.5 px-3 text-center w-12">POS</th>
                    <th className="py-2.5 px-3">EQUIPE</th>
                    <th className="py-2.5 px-3">MOTOR</th>
                    <th className="py-2.5 px-3 text-right w-20">PONTOS</th>
                    <th className="py-2.5 px-3 text-center w-20">VITÓRIAS</th>
                    <th className="py-2.5 px-3 text-center w-20">PÓDIOS</th>
                  </tr>
                </thead>

                <tbody>
                  {/* SE FILTRO FOR "TODAS", DIVIDIR EM DOIS GRUPOS CLAROS */}
                  {filterTab === 'todas' ? (
                    <>
                      {/* GRUPO 1: NO CAMPEONATO */}
                      {participantsGroup.length > 0 && (
                        <>
                          <tr className="bg-[#F8FAFC] border-y border-[#E2E8F0]">
                            <td
                              colSpan={6}
                              className="py-2 px-3 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider"
                            >
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>EQUIPES NO CAMPEONATO</span>
                                  <span className="text-[10px] font-mono text-[#64748B] font-normal normal-case">
                                    — Participando da temporada {seasonYear}
                                  </span>
                                </span>
                                <span className="font-mono text-[10px] font-bold text-[#64748B]">
                                  {participantsGroup.length}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {participantsGroup.map(renderTeamRow)}
                        </>
                      )}

                      {/* GRUPO 2: FORA DO CAMPEONATO */}
                      {nonParticipantsGroup.length > 0 && (
                        <>
                          <tr className="bg-[#F8FAFC] border-y border-[#E2E8F0]">
                            <td
                              colSpan={6}
                              className="py-2 px-3 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider"
                            >
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                  <span>EQUIPES FORA DO CAMPEONATO</span>
                                  <span className="text-[10px] font-mono text-[#64748B] font-normal normal-case">
                                    — Não participando da temporada {seasonYear}
                                  </span>
                                </span>
                                <span className="font-mono text-[10px] font-bold text-[#64748B]">
                                  {nonParticipantsGroup.length}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {nonParticipantsGroup.map(renderTeamRow)}
                        </>
                      )}
                    </>
                  ) : (
                    /* FILTROS ESPECÍFICOS (NO CAMPEONATO OU FORA DO CAMPEONATO) */
                    filteredTeams.map(renderTeamRow)
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: PAINEL BÁSICO DE CONSULTA (5 COLUNAS NO DESKTOP) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-4">
          <div
            data-testid="team-detail-panel"
            className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-5"
          >
            {activeSelectedTeam ? (
              <>
                {/* Cabeçalho do Painel */}
                <div className="flex items-start gap-3.5 pb-4 border-b border-[#F1F5F9]">
                  {(() => {
                    const panelLogo =
                      getTeamReducedLogoUrl(activeSelectedTeam.name) ||
                      getTeamReducedLogoUrl(activeSelectedTeam.key)
                    return panelLogo ? (
                      <img
                        src={panelLogo}
                        alt={`Emblema ${activeSelectedTeam.name}`}
                        className="w-12 h-12 object-contain shrink-0 rounded-lg p-1 bg-neutral-50 border border-neutral-200"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center font-black text-sm text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: activeSelectedTeam.color }}
                      >
                        {activeSelectedTeam.name.substring(0, 2).toUpperCase()}
                      </div>
                    )
                  })()}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-[#0F172A] truncate">
                        {activeSelectedTeam.name}
                      </h2>
                      {activeSelectedTeam.isPlayer && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#E10600] text-white shrink-0">
                          SUA EQUIPE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1">
                      <span>{activeSelectedTeam.flag}</span>
                      <span>{activeSelectedTeam.country}</span>
                    </div>
                  </div>
                </div>

                {/* Situação na Temporada Atual */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    SITUAÇÃO NA TEMPORADA {seasonYear}
                  </div>
                  {activeSelectedTeam.inCurrentSeason ? (
                    <div
                      data-testid="status-badge-active"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>NO CAMPEONATO</span>
                    </div>
                  ) : (
                    <div
                      data-testid="status-badge-inactive"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-neutral-100 text-[#64748B] border border-neutral-200"
                    >
                      <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>FORA DO CAMPEONATO</span>
                    </div>
                  )}
                </div>

                {/* Bloco de Desempenho / Estatísticas da Temporada */}
                {activeSelectedTeam.inCurrentSeason ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                      ESTATÍSTICAS OFICIAIS FIA
                    </div>

                    {!seasonHasOfficialResults && (activeSelectedTeam.points ?? 0) === 0 ? (
                      <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 flex items-start gap-2 text-xs text-[#64748B]">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>Ainda sem resultados nesta temporada.</span>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Posição no Mundial */}
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <span className="text-[10px] font-mono font-semibold uppercase text-[#64748B] block">
                          Posição
                        </span>
                        <div className="font-mono text-base font-black text-[#0F172A] mt-0.5">
                          {activeSelectedTeam.position && activeSelectedTeam.position > 0
                            ? `${activeSelectedTeam.position}º Lugar`
                            : '—'}
                        </div>
                      </div>

                      {/* Pontos */}
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <span className="text-[10px] font-mono font-semibold uppercase text-[#64748B] block">
                          Pontos
                        </span>
                        <div className="font-mono text-base font-black text-[#0F172A] mt-0.5">
                          {activeSelectedTeam.points !== null
                            ? `${activeSelectedTeam.points} pts`
                            : '—'}
                        </div>
                      </div>

                      {/* Vitórias */}
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <span className="text-[10px] font-mono font-semibold uppercase text-[#64748B] block">
                          Vitórias
                        </span>
                        <div className="font-mono text-base font-black text-[#0F172A] mt-0.5">
                          {activeSelectedTeam.wins !== null ? activeSelectedTeam.wins : '—'}
                        </div>
                      </div>

                      {/* Pódios */}
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <span className="text-[10px] font-mono font-semibold uppercase text-[#64748B] block">
                          Pódios
                        </span>
                        <div className="font-mono text-base font-black text-[#0F172A] mt-0.5">
                          {activeSelectedTeam.podiums !== null ? activeSelectedTeam.podiums : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mensagem clara para não participantes */
                  <div
                    data-testid="non-participating-notice"
                    className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-[#64748B] leading-relaxed"
                  >
                    Esta equipe não disputa a temporada atual.
                  </div>
                )}

                {/* B. FOTO DO CARRO: imagem horizontal logo abaixo do cabeçalho */}
                <div className="space-y-1.5" data-testid="car-photo-section">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    <span>MONOPOSTO {seasonYear}</span>
                    <span className="text-[9px] font-normal normal-case text-[#94A3B8]">
                      Vista lateral homologada
                    </span>
                  </div>

                  <div className="w-full h-44 sm:h-48 rounded-lg border border-[#E2E8F0] bg-neutral-50/80 flex items-center justify-center overflow-hidden p-2 relative group">
                    {activeCarPhotoUrl ? (
                      <img
                        key={activeSelectedTeam.key}
                        src={activeCarPhotoUrl}
                        alt={`Monoposto ${activeSelectedTeam.name}`}
                        data-testid="team-car-image"
                        className={`w-full h-full object-contain transition-opacity duration-200 ${
                          carImageLoading ? 'opacity-50' : 'opacity-100'
                        }`}
                        loading="lazy"
                        onLoad={() => setCarImageLoading(false)}
                        onError={() => setCarImageLoading(false)}
                      />
                    ) : (
                      /* Fallback neutro identificado sem imagem quebrada */
                      <div
                        data-testid="car-photo-fallback"
                        className="flex flex-col items-center justify-center gap-1.5 text-center p-4 text-[#94A3B8]"
                      >
                        <Car className="w-8 h-8 stroke-1 text-[#CBD5E1]" />
                        <span className="text-xs font-semibold text-[#64748B]">
                          Imagem do carro indisponível
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          Asset aguardando inclusão no catálogo oficial
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* D. PERFIL DA EQUIPE: informações institucionais disponíveis */}
                <div
                  className="space-y-2.5 pt-2 border-t border-[#F1F5F9] text-xs"
                  data-testid="team-profile-section"
                >
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>PERFIL DA EQUIPE</span>
                  </div>

                  <div className="space-y-1.5 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                    <div className="flex justify-between items-start gap-2 py-0.5">
                      <span className="text-[#64748B] shrink-0">Tipo / Categoria:</span>
                      <span className="font-semibold text-[#0F172A] text-right">
                        {activeSelectedTeam.category}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-2 py-0.5">
                      <span className="text-[#64748B] shrink-0">Fornecedor de Motor:</span>
                      <span className="font-bold text-[#0F172A] text-right">
                        {activeSelectedTeam.inCurrentSeason
                          ? activeSelectedTeam.engine
                          : activeSelectedTeam.engine === 'A definir'
                            ? 'A definir'
                            : `${activeSelectedTeam.engine} (Previsto)`}
                      </span>
                    </div>

                    <div className="flex justify-between items-start gap-2 py-0.5">
                      <span className="text-[#64748B] shrink-0">Sede Operacional:</span>
                      <span
                        className="font-medium text-[#0F172A] text-right truncate max-w-[200px]"
                        title={activeSelectedTeam.headquarters}
                      >
                        {activeSelectedTeam.headquarters}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-2 py-0.5">
                      <span className="text-[#64748B] shrink-0">País de Origem:</span>
                      <span className="font-medium text-[#0F172A] flex items-center gap-1">
                        <span>{activeSelectedTeam.flag}</span>
                        <span>{activeSelectedTeam.country}</span>
                      </span>
                    </div>

                    {activeSelectedTeam.historySummary && (
                      <div className="pt-2 mt-1 border-t border-[#E2E8F0] text-[11px] text-[#475569] leading-relaxed">
                        <span className="font-bold text-[#0F172A] block text-[10px] uppercase font-mono mb-0.5">
                          Herança & Histórico:
                        </span>
                        {activeSelectedTeam.historySummary}
                      </div>
                    )}

                    {activeSelectedTeam.currentSituation && (
                      <div className="pt-1.5 text-[11px] text-[#475569] leading-relaxed">
                        <span className="font-bold text-[#0F172A] block text-[10px] uppercase font-mono mb-0.5">
                          Situação & Liderança:
                        </span>
                        {activeSelectedTeam.currentSituation}
                      </div>
                    )}
                  </div>
                </div>

                {/* E. CARACTERÍSTICAS: dados técnicos e organizacionais existentes */}
                <div
                  className="space-y-2.5 pt-2 border-t border-[#F1F5F9] text-xs"
                  data-testid="team-characteristics-section"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    <span className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>CARACTERÍSTICAS TÉCNICAS</span>
                    </span>
                    <span className="text-[9px] font-normal normal-case text-[#94A3B8]">
                      {activeSelectedTeam.inCurrentSeason
                        ? 'Temporada atual'
                        : 'Catálogo de referência'}
                    </span>
                  </div>

                  {/* Barras de Rating /100 existentes */}
                  <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                    {/* Monoposto / Carro */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-[#64748B]">Desempenho do Carro</span>
                        <span className="font-mono font-bold text-[#0F172A]">
                          {activeSelectedTeam.carRating !== null
                            ? `${activeSelectedTeam.carRating}/100`
                            : 'Não informado'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E10600] rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, activeSelectedTeam.carRating ?? 0))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Engenharia / Desenvolvimento */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-[#64748B]">Capacidade de Engenharia</span>
                        <span className="font-mono font-bold text-[#0F172A]">
                          {activeSelectedTeam.engineeringRating !== null
                            ? `${activeSelectedTeam.engineeringRating}/100`
                            : 'Não informado'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-700 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, activeSelectedTeam.engineeringRating ?? 0))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Operações de Pista & Pit Stop */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-[#64748B]">Excelência Operacional</span>
                        <span className="font-mono font-bold text-[#0F172A]">
                          {activeSelectedTeam.operationsRating !== null
                            ? `${activeSelectedTeam.operationsRating}/100`
                            : 'Não informado'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, activeSelectedTeam.operationsRating ?? 0))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Prestígio / Marca */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-[#64748B]">Prestígio Internacional</span>
                        <span className="font-mono font-bold text-[#0F172A]">
                          {activeSelectedTeam.prestigeRating !== null
                            ? `${activeSelectedTeam.prestigeRating}/100`
                            : 'Não informado'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, activeSelectedTeam.prestigeRating ?? 0))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Pontos Fortes / Traits Especiais */}
                    {activeSelectedTeam.specialTraits &&
                      activeSelectedTeam.specialTraits.length > 0 && (
                        <div className="pt-2 mt-1 border-t border-[#E2E8F0]">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] block mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Pontos Fortes & Identidade</span>
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {activeSelectedTeam.specialTraits.map((trait, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-white text-[#334155] border border-neutral-200 shadow-2xs"
                              >
                                {trait}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* F. INFRAESTRUTURA: bloco compacto com instalações canônicas */}
                <div
                  className="space-y-2 pt-2 border-t border-[#F1F5F9] text-xs"
                  data-testid="team-infrastructure-section"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <Factory className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>INFRAESTRUTURA ({activeTeamFacilities ? '9 Instalações' : '—'})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFacilitiesExpanded((prev) => !prev)}
                      className="text-[11px] font-semibold text-[#E10600] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isFacilitiesExpanded ? 'Recolher' : 'Ver detalhes'}</span>
                      {isFacilitiesExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {activeTeamFacilities ? (
                    <div className="space-y-1 bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                      {/* Principais instalações sempre visíveis em linha compacta */}
                      <div className="grid grid-cols-3 gap-2 text-center py-1">
                        <div className="p-1.5 bg-white rounded border border-[#E2E8F0]">
                          <span className="text-[10px] text-[#64748B] block truncate">Fábrica</span>
                          <span className="font-mono text-xs font-bold text-[#0F172A]">
                            Nível {activeTeamFacilities.factory}/5
                          </span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-[#E2E8F0]">
                          <span className="text-[10px] text-[#64748B] block truncate">
                            Túnel Vento
                          </span>
                          <span className="font-mono text-xs font-bold text-[#0F172A]">
                            Nível {activeTeamFacilities.wind_tunnel}/5
                          </span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-[#E2E8F0]">
                          <span className="text-[10px] text-[#64748B] block truncate">
                            Simulador
                          </span>
                          <span className="font-mono text-xs font-bold text-[#0F172A]">
                            Nível {activeTeamFacilities.simulator}/5
                          </span>
                        </div>
                      </div>

                      {/* Seção expansível com as 9 instalações canônicas */}
                      {isFacilitiesExpanded && (
                        <div className="pt-2 mt-1 border-t border-[#E2E8F0] space-y-1.5">
                          {[
                            { name: 'Fábrica Operacional', level: activeTeamFacilities.factory },
                            { name: 'Centro de Design', level: activeTeamFacilities.design_centre },
                            { name: 'Cluster CFD', level: activeTeamFacilities.cfd },
                            { name: 'Túnel de Vento', level: activeTeamFacilities.wind_tunnel },
                            {
                              name: 'Manufatura & Produção',
                              level: activeTeamFacilities.manufacturing,
                            },
                            { name: 'Simulador Dinâmico', level: activeTeamFacilities.simulator },
                            {
                              name: 'Centro de Operações',
                              level: activeTeamFacilities.operations_centre,
                            },
                            {
                              name: 'Centro de Pit Stop',
                              level: activeTeamFacilities.pitstop_center,
                            },
                            {
                              name: 'Academia de Jovens Pilotos',
                              level: activeTeamFacilities.youth_academy,
                            },
                          ].map((fac, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-[11px] py-0.5"
                            >
                              <span className="text-[#475569]">{fac.name}</span>
                              <div className="flex items-center gap-1">
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map((dot) => (
                                    <span
                                      key={dot}
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        dot <= fac.level ? 'bg-[#E10600]' : 'bg-neutral-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="font-mono font-semibold text-[#0F172A] ml-1.5 w-7 text-right">
                                  {fac.level}/5
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#64748B] italic p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                      Infraestrutura não informada
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Estado vazio quando nada está selecionado */
              <div className="py-12 text-center text-xs text-[#64748B]">
                Nenhuma equipe selecionada.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
