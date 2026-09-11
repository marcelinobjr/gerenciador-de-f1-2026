import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wrench,
  Handshake,
  Flag,
  Calendar,
  Trophy,
  Car,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface SidebarNavGroup {
  id: string
  label: string
  items: {
    name: string
    path: string
    icon: React.ComponentType<{ className?: string }>
  }[]
}

export const SIDEBAR_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: 'gestao',
    label: 'GESTÃO',
    items: [
      { name: 'Painel', path: '/', icon: LayoutDashboard },
      { name: 'Minha Equipe', path: '/team', icon: Users },
      { name: 'Carro & P&D', path: '/car', icon: Wrench },
      { name: 'Patrocínios', path: '/sponsors', icon: Handshake },
    ],
  },
  {
    id: 'competicao',
    label: 'COMPETIÇÃO',
    items: [
      { name: 'Fim de Semana', path: '/race', icon: Flag },
      { name: 'Calendário', path: '/calendario', icon: Calendar },
      { name: 'Classificações', path: '/standings', icon: Trophy },
      { name: 'Histórico', path: '/historico', icon: BookOpen },
      { name: 'Grid', path: '/teams', icon: Car },
    ],
  },
]

export const ROUTE_TITLE_MAP: Record<string, string> = {
  '/': 'Painel de Controle',
  '/team': 'Minha Equipe',
  '/car': 'Carro & P&D',
  '/sponsors': 'Patrocínios',
  '/race': 'Fim de Semana de Corrida',
  '/calendario': 'Calendário Oficial 2026',
  '/standings': 'Classificações do Campeonato',
  '/historico': 'Histórico da Temporada',
  '/teams': 'Grid da Temporada 2026',
}

export interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  team?: any
  season?: any
  onOpenSettings: () => void
  className?: string
  onItemClick?: () => void
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  team,
  season,
  onOpenSettings,
  className,
  onItemClick,
}: SidebarProps) {
  const location = useLocation()

  const currentRound = season?.current_round ?? 1
  const totalRounds = season?.total_rounds ?? 24
  const progressPercent = Math.min(100, Math.max(0, (currentRound / totalRounds) * 100))
  const teamColor = team?.primary_color || '#E10600'

  return (
    <aside
      className={cn(
        'h-screen flex flex-col bg-[#11161F] border-r border-[#1F2733] select-none transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-[230px]',
        className,
      )}
    >
      {/* Topo da Sidebar: Identidade visual do jogo + Logo F1 2026 */}
      <div className="h-16 px-3 border-b border-[#1F2733] flex items-center justify-between shrink-0">
        <NavLink
          to="/"
          onClick={onItemClick}
          className="flex items-center gap-2.5 overflow-hidden group focus:outline-none"
          title="F1 Manager 2026"
        >
          {/* Logo F1 Vermelho */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 140 40" className="h-7 w-auto" fill="none">
              <path
                d="M 10 32 L 28 8 L 48 8 L 40 18 L 32 18 L 30 21 L 44 21 L 36 32 L 26 32 L 28 29 L 20 29 L 18 32 Z"
                fill="#E10600"
              />
              <path d="M 52 8 L 62 8 L 44 32 L 34 32 Z" fill="#E10600" />
              <path d="M 64 12 L 72 12 L 68 18 L 60 18 Z" fill="#E10600" opacity="0.9" />
              <path d="M 58 22 L 66 22 L 62 28 L 54 28 Z" fill="#E10600" opacity="0.8" />
              <text
                x="76"
                y="27"
                fill="#FFFFFF"
                fontFamily="Inter, sans-serif"
                fontWeight="800"
                fontSize="21"
                letterSpacing="0.5"
              >
                2026
              </text>
            </svg>
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="eyebrow text-[#8B95A7] group-hover:text-white transition-colors truncate text-[10px]">
                {team?.name || 'RACE OPERATIONS'}
              </span>
            </div>
          )}
        </NavLink>

        {/* Botão de recolher/expandir (apenas desktop quando toggle fornecido) */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="hidden lg:flex w-6 h-6 rounded-md items-center justify-center text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29] transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Navegação agrupada: GESTÃO e COMPETIÇÃO */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        {SIDEBAR_NAV_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1">
            {/* Eyebrow de grupo (11px uppercase) */}
            {!collapsed ? (
              <div className="px-2.5 mb-1.5 eyebrow text-[11px] text-[#6A768A] tracking-wider">
                {group.label}
              </div>
            ) : (
              <div className="w-full flex justify-center py-1">
                <span className="w-5 h-[1px] bg-[#1F2733]" />
              </div>
            )}

            {/* Itens do grupo */}
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path

                const content = (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onItemClick}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg text-xs font-semibold transition-colors duration-150',
                      collapsed ? 'justify-center h-10 w-10 mx-auto px-0' : 'px-3 py-2.5 w-full',
                      isActive
                        ? 'bg-[#161D29] text-white shadow-sm'
                        : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29]',
                    )}
                  >
                    {/* Barra lateral de destaque (3px na cor da equipe do jogador) para item ativo */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all"
                        style={{ backgroundColor: teamColor }}
                      />
                    )}

                    <Icon
                      className={cn(
                        'shrink-0 transition-colors',
                        collapsed ? 'w-4 h-4' : 'w-4 h-4',
                        isActive ? 'text-white' : 'text-[#8B95A7]',
                      )}
                    />

                    {!collapsed && <span className="truncate tracking-tight">{item.name}</span>}
                  </NavLink>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={item.path} delayDuration={100}>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="bg-[#161D29] border-[#1F2733] text-white text-xs font-semibold px-2.5 py-1"
                      >
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return content
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Rodapé da Sidebar: Indicador de Rodada + Engrenagem de Configurações */}
      <div className="p-3 border-t border-[#1F2733] bg-[#0E131B] shrink-0">
        {!collapsed ? (
          <div className="space-y-3">
            {/* Indicador de Rodada com mini barra de progresso */}
            <div className="p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] leading-none">
                <span className="text-[#8B95A7] text-[10px] font-medium tracking-wide">
                  TEMPORADA 2026
                </span>
                <span className="font-num text-white font-bold text-xs tabular-nums">
                  R{currentRound}/{totalRounds}
                </span>
              </div>
              <div className="w-full bg-[#161D29] border border-[#1F2733]/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: teamColor,
                  }}
                />
              </div>
            </div>

            {/* Botão de Configurações com texto */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#161D29] hover:bg-[#1c2534] border border-[#1F2733] text-xs font-semibold text-[#8B95A7] hover:text-white transition-colors cursor-pointer"
              title="Configurações (Conta & Carreira)"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <span>Configurações</span>
              </div>
              <span className="text-[10px] font-mono text-[#6A768A]">E2-A</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {/* Indicador compacto no modo collapsed */}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div className="w-10 h-10 rounded-lg bg-[#11161F] border border-[#1F2733] flex flex-col items-center justify-center cursor-default">
                  <span className="font-num text-[10px] font-bold text-white tabular-nums">
                    R{currentRound}
                  </span>
                  <span className="text-[8px] text-[#8B95A7]">/{totalRounds}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-[#161D29] border-[#1F2733] text-white text-xs font-semibold px-2.5 py-1"
              >
                Rodada {currentRound} de {totalRounds}
              </TooltipContent>
            </Tooltip>

            {/* Engrenagem de Configurações compacta */}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-10 h-10 rounded-lg bg-[#161D29] hover:bg-[#1c2534] border border-[#1F2733] text-[#8B95A7] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Abrir configurações"
                >
                  <Settings className="w-4 h-4 text-cyan-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-[#161D29] border-[#1F2733] text-white text-xs font-semibold px-2.5 py-1"
              >
                Configurações
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  )
}
