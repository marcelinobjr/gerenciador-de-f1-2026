import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, LogOut, User, Calendar, ShieldCheck } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/formatters'
import { MANAGER_AVATAR_ASSETS, getTeamLogoUrl } from '@/lib/lobby-assets'
import { cn } from '@/lib/utils'

export interface TopbarProps {
  onOpenMobileMenu: () => void
  user: any
  team: any
  season: any
  onLogout: () => void
  className?: string
}

// Limite regulamentar do Cost Cap FIA 2026 (R$ 215M)
const COST_CAP_LIMIT = 215000000

export function Topbar({ onOpenMobileMenu, user, team, season, onLogout, className }: TopbarProps) {
  const navigate = useNavigate()

  const currentRound = season?.current_round ?? 1
  const totalRounds = season?.total_rounds ?? 24
  const seasonYear = season?.year ?? 2026

  const teamColor = team?.color || '#E10600'
  const teamName = team?.name || 'AUDI F1 TEAM'

  // Orçamento disponível
  const budget = team?.budget ?? 150000000

  // Cost Cap e % de teto de gastos
  const costCapSpent = team?.cost_cap_spent ?? 0
  const costCapPct = Math.min(100, Math.round((costCapSpent / COST_CAP_LIMIT) * 100))

  // Confiança da diretoria / equipe (calculada a partir da força ou moral média)
  const confidence = useMemo(() => {
    const raw = team?.strength ?? 75
    return Math.min(100, Math.max(30, raw))
  }, [team?.strength])

  // Data do jogo dinâmica baseada na rodada atual (calendário F1)
  const gameDateFormatted = useMemo(() => {
    // Calculamos uma data no ano da temporada
    // Início em 15 de Março e cada rodada soma ~2 semanas
    const baseDate = new Date(seasonYear, 2, 12 + (currentRound - 1) * 14)
    const weekdays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ]
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const weekday = weekdays[baseDate.getDay()]
    const day = baseDate.getDate()
    const month = months[baseDate.getMonth()]
    return `${weekday}, ${day} ${month}`
  }, [seasonYear, currentRound])

  // Manager avatar e nome
  const managerName = team?.manager_name || user?.name || 'Team Principal'
  const managerProfile = team?.manager_profile

  // Encontrar foto do avatar selecionado no wizard ou fallback
  const managerAvatarUrl = useMemo(() => {
    if (managerProfile?.avatarNumber) {
      const match = MANAGER_AVATAR_ASSETS.find((a) => a.number === managerProfile.avatarNumber)
      if (match) return match.dropboxUrl
    }
    if (managerProfile?.avatarId) {
      const match = MANAGER_AVATAR_ASSETS.find((a) => a.id === managerProfile.avatarId)
      if (match) return match.dropboxUrl
    }
    return MANAGER_AVATAR_ASSETS[0].dropboxUrl
  }, [managerProfile])

  // Logo da equipe (se oficial)
  const teamLogoUrl = useMemo(() => {
    if (team?.team_key) return getTeamLogoUrl(team.team_key)
    return undefined
  }, [team?.team_key])

  // SVG ring de progresso para o teto de gastos
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (costCapPct / 100) * circumference

  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-16 w-full bg-[#0E1218]/95 backdrop-blur-md border-b border-[#1C2330] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-3 select-none text-[#F5F7FA]',
        className,
      )}
    >
      {/* Lado Esquerdo: Hambúrguer mobile + Logo / Nome da Equipe */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenMobileMenu}
          className="lg:hidden w-8 h-8 text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29] shrink-0"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2.5 min-w-0">
          {teamLogoUrl ? (
            <img
              src={teamLogoUrl}
              alt={teamName}
              className="w-7 h-7 object-contain shrink-0 filter drop-shadow"
            />
          ) : (
            <div
              className="w-6 h-6 rounded flex items-center justify-center font-black text-[11px] text-white shrink-0 shadow-sm"
              style={{ backgroundColor: teamColor }}
            >
              F1
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="font-extrabold text-sm text-white tracking-tight uppercase truncate">
              {teamName}
            </span>
            <span className="text-[10px] font-mono text-[#8B95A7] truncate">
              Sede de Corrida • {team?.engine_supplier || 'Audi'} Power
            </span>
          </div>
        </div>
      </div>

      {/* Lado Direito: Métricas ricas do save */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Métrica 1: Temporada e Rodada */}
        <div className="hidden md:flex flex-col items-end leading-tight pr-1">
          <span className="text-[10px] font-mono uppercase text-[#8B95A7] tracking-wider">
            Temporada {seasonYear}
          </span>
          <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />
            Rodada {currentRound} / {totalRounds}
          </span>
        </div>

        {/* Métrica 2: Data atual do jogo */}
        <div className="hidden lg:flex flex-col items-end leading-tight border-l border-[#1C2330] pl-3">
          <span className="text-[10px] font-mono uppercase text-[#8B95A7] flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#E10600]" />
            Data Atual
          </span>
          <span className="text-xs font-mono font-bold text-[#CBD5E1]">{gameDateFormatted}</span>
        </div>

        {/* Métrica 3: Orçamento Disponível */}
        <div className="hidden sm:flex flex-col items-end leading-tight border-l border-[#1C2330] pl-3">
          <span className="text-[10px] font-mono uppercase text-[#8B95A7] tracking-wider">
            Orçamento
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {formatCurrency(budget)}
          </span>
        </div>

        {/* Métrica 4: Teto de Gastos com anel de progresso SVG */}
        <div className="hidden xl:flex items-center gap-2 border-l border-[#1C2330] pl-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r={radius} stroke="#1E293B" strokeWidth="2.5" fill="none" />
              <circle
                cx="14"
                cy="14"
                r={radius}
                stroke={costCapPct > 90 ? '#EF4444' : costCapPct > 70 ? '#F59E0B' : '#00A6FB'}
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] font-mono font-bold text-white">
              {costCapPct}%
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-mono uppercase text-[#8B95A7]">Teto FIA</span>
            <span className="text-[11px] font-mono font-semibold text-[#CBD5E1]">
              {formatCurrency(costCapSpent)}
            </span>
          </div>
        </div>

        {/* Métrica 5: Confiança da Diretoria (%) */}
        <div className="hidden md:flex flex-col items-end leading-tight border-l border-[#1C2330] pl-3">
          <span className="text-[10px] font-mono uppercase text-[#8B95A7] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            Confiança
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-12 h-1.5 rounded-full bg-[#1C2330] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${confidence}%`,
                  backgroundColor:
                    confidence >= 70 ? '#10B981' : confidence >= 45 ? '#F59E0B' : '#EF4444',
                }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-white">{confidence}%</span>
          </div>
        </div>

        {/* Sino de Notificações com badge */}
        <div className="border-l border-[#1C2330] pl-2 sm:pl-3">
          <NotificationBell currentRound={currentRound} userId={user?.id} />
        </div>

        {/* Avatar do Manager + Nome ("Team Principal") com Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-[#141B24] hover:bg-[#1C2533] border border-[#232D3F] transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#E10600]"
              aria-label="Menu do Team Principal"
            >
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#1E293B] border border-white/20 shrink-0">
                <img
                  src={managerAvatarUrl}
                  alt={managerName}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    // Fallback para inicial
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>

              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-white max-w-[120px] truncate">
                  {managerName}
                </span>
                <span className="text-[10px] font-mono text-[#E10600] uppercase font-bold tracking-wider">
                  Team Principal
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 bg-[#0F141C] border-[#1F2733] text-[#F5F7FA] shadow-2xl p-1.5 rounded-xl"
          >
            <DropdownMenuLabel className="font-normal px-2.5 py-2">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold text-white">{managerName}</p>
                <p className="text-[11px] text-[#8B95A7] font-mono">{teamName}</p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-cyan-400 font-mono">
                  <span>Temporada {seasonYear}</span>
                  <span>•</span>
                  <span>R{currentRound}/24</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-[#1F2733]" />

            <DropdownMenuItem
              onClick={() => navigate('/team')}
              className="cursor-pointer text-xs text-[#CBD5E1] hover:text-white hover:bg-[#18202E] rounded-lg px-2.5 py-2"
            >
              <User className="w-3.5 h-3.5 mr-2 text-cyan-400" />
              <span>Gerenciar Equipe</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#1F2733]" />

            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg px-2.5 py-2"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              <span>Sair da Carreira</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default Topbar
