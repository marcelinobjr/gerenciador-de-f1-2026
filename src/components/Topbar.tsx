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
import { getTeamLogoUrl } from '@/lib/lobby-assets'
import { cn } from '@/lib/utils'
import apexLogoImg from '@/assets/apex-gp-manager-logo-3bf8a.jpg'

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
    const month = months[baseDate.getMonth()].toUpperCase()
    return `${day} ${month} ${seasonYear} — ${weekday}`
  }, [seasonYear, currentRound])

  // Manager avatar e nome
  const managerName = team?.manager_name || user?.name || 'Team Principal'

  // Iniciais do manager para fallback estilizado inline
  const managerInitials = useMemo(() => {
    const raw = (managerName || 'Team Principal').trim().split(/\s+/)
    if (!raw.length || !raw[0]) return 'TP'
    if (raw.length === 1) return raw[0].slice(0, 2).toUpperCase()
    return (raw[0][0] + raw[raw.length - 1][0]).toUpperCase()
  }, [managerName])

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
        'sticky top-0 z-30 h-14 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-3 select-none text-[#1E293B] shadow-sm',
        className,
      )}
    >
      {/* Lado Esquerdo: Hambúrguer mobile + APEX GP Manager Brand / Logo */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenMobileMenu}
          className="lg:hidden w-8 h-8 text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-100 shrink-0"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={apexLogoImg}
            alt="APEX GP Manager"
            className="w-8 h-8 rounded-lg object-cover border border-[#E2E8F0] shadow-xs shrink-0"
          />

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm text-[#0F172A] tracking-tight uppercase truncate">
                APEX <span className="text-[#E10600]">GP</span> MANAGER
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-[#475569] border border-neutral-200">
                {teamName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Direito: Métricas ricas do save */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Métrica 1: Temporada e Rodada */}
        <div className="hidden md:flex flex-col items-end leading-tight pr-1">
          <span className="text-[10px] font-medium uppercase text-[#64748B]">
            Temporada {seasonYear}
          </span>
          <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />
            Rodada {currentRound} / {totalRounds}
          </span>
        </div>

        {/* Métrica 2: Data atual do jogo */}
        <div className="hidden lg:flex flex-col items-end leading-tight border-l border-[#E2E8F0] pl-3">
          <span className="text-xs font-semibold text-[#334155] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            {gameDateFormatted}
          </span>
        </div>

        {/* Métrica 3: Orçamento Disponível */}
        <div className="hidden sm:flex flex-col items-end leading-tight border-l border-[#E2E8F0] pl-3">
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 font-mono">
            {`US$ ${(budget / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`}
          </span>
          <span className="text-[10px] text-[#64748B] font-medium">Orçamento</span>
        </div>

        {/* Métrica 4: Teto de Gastos com anel de progresso SVG */}
        <div className="hidden xl:flex items-center gap-2 border-l border-[#E2E8F0] pl-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r={radius} stroke="#E2E8F0" strokeWidth="2.5" fill="none" />
              <circle
                cx="14"
                cy="14"
                r={radius}
                stroke="#10B981"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] font-bold text-[#0F172A] font-mono">
              {costCapPct}%
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-bold text-[#0F172A] font-mono">{costCapPct}%</span>
            <span className="text-[9px] uppercase text-[#64748B] font-medium">Teto de gastos</span>
          </div>
        </div>

        {/* Métrica 5: Confiança da Diretoria (%) */}
        <div className="hidden md:flex items-center gap-2 border-l border-[#E2E8F0] pl-3">
          <span className="text-amber-500 text-sm">★</span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-bold text-[#0F172A] font-mono">{confidence}%</span>
            <span className="text-[9px] uppercase text-[#64748B] font-medium">Confiança</span>
          </div>
        </div>

        {/* Sino de Notificações com badge */}
        <div className="border-l border-[#E2E8F0] pl-2 sm:pl-3">
          <NotificationBell currentRound={currentRound} userId={user?.id} />
        </div>

        {/* Avatar do Manager + Nome com Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-[#CBD5E1] transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#E10600]"
              aria-label="Menu do Team Principal"
            >
              <div
                className="relative w-8 h-8 rounded-full overflow-hidden bg-neutral-200 border border-neutral-300 shrink-0 flex items-center justify-center"
                data-html2canvas-ignore="true"
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-xs font-black text-white uppercase select-none shadow-sm"
                  style={{ backgroundColor: teamColor || '#E10600' }}
                  title={managerName}
                >
                  {managerInitials}
                </div>
              </div>

              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-[#0F172A] max-w-[120px] truncate">
                  {managerName}
                </span>
                <span className="text-[10px] text-[#64748B] font-medium tracking-tight">
                  Team Principal
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 bg-white border-[#E2E8F0] text-[#0F172A] shadow-xl p-1.5 rounded-xl"
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
              className="cursor-pointer text-xs text-[#334155] hover:text-[#0F172A] hover:bg-neutral-100 rounded-lg px-2.5 py-2"
            >
              <User className="w-3.5 h-3.5 mr-2 text-cyan-600" />
              <span>Gerenciar Equipe</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#E2E8F0]" />

            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-2.5 py-2"
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
