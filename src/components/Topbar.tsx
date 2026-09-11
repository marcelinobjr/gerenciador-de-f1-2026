import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut, ChevronRight, User } from 'lucide-react'
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
import { ROUTE_TITLE_MAP } from '@/components/Sidebar'
import { cn } from '@/lib/utils'

export interface TopbarProps {
  onOpenMobileMenu: () => void
  user: any
  team: any
  season: any
  onLogout: () => void
  className?: string
}

export function Topbar({ onOpenMobileMenu, user, team, season, onLogout, className }: TopbarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const currentRound = season?.current_round ?? 1
  const currentPageTitle = ROUTE_TITLE_MAP[location.pathname] || 'Race Operations'
  const teamColor = team?.primary_color || '#E10600'

  const userInitial = (user?.name?.[0] || user?.email?.[0] || 'J').toUpperCase()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-14 w-full bg-[#11161F]/80 backdrop-blur-md border-b border-[#1F2733] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-3 select-none transition-colors duration-150',
        className,
      )}
    >
      {/* Lado Esquerdo: Hambúrguer (mobile) + Breadcrumb da página ativa */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Botão Hambúrguer Mobile */}
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

        {/* Breadcrumb / Contexto da Página Atual */}
        <div className="flex items-center gap-1.5 min-w-0 text-xs sm:text-sm">
          <span className="hidden sm:inline-block text-[#8B95A7] font-medium shrink-0">
            F1 Manager
          </span>
          <ChevronRight className="hidden sm:inline-block w-3.5 h-3.5 text-[#6A768A] shrink-0" />
          <h1 className="font-bold text-[#F5F7FA] truncate tracking-tight text-xs sm:text-sm">
            {currentPageTitle}
          </h1>
        </div>
      </div>

      {/* Lado Direito: Notificações + Avatar do Usuário com Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Sino de Notificações com dropdown nativo */}
        <NotificationBell currentRound={currentRound} userId={user?.id} />

        {/* Separador sutil */}
        <div className="h-5 w-[1px] bg-[#1F2733]" />

        {/* Avatar e Menu de Usuário (com Logout) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full bg-[#161D29] hover:bg-[#1F2733] border border-[#1F2733] hover:border-[#2C3849] transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#E10600]"
              aria-label="Menu do usuário"
            >
              {/* Avatar circular */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white uppercase shrink-0 shadow-inner"
                style={{ backgroundColor: teamColor }}
              >
                {userInitial}
              </div>

              {/* Nome do usuário (desktop) */}
              <div className="hidden md:flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-[#F5F7FA] max-w-[120px] truncate">
                  {user?.name || user?.email?.split('@')[0] || 'Chefe'}
                </span>
                <span className="text-[10px] text-[#8B95A7] truncate">
                  {team?.name || 'Escuderia'}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 bg-[#11161F] border-[#1F2733] text-[#F5F7FA] shadow-2xl p-1.5 rounded-xl"
          >
            <DropdownMenuLabel className="font-normal px-2.5 py-2">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold leading-none text-white">
                  {user?.name || 'Chefe de Equipe'}
                </p>
                <p className="text-[11px] leading-none text-[#8B95A7] font-mono truncate">
                  {user?.email || '—'}
                </p>
                <div className="pt-1 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: teamColor }}
                  />
                  <span className="text-[10px] text-[#8B95A7] font-medium truncate">
                    {team?.name || 'Equipe F1 2026'}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-[#1F2733]" />

            <DropdownMenuItem
              onClick={() => navigate('/team')}
              className="cursor-pointer text-xs text-[#8B95A7] hover:text-white hover:bg-[#161D29] focus:bg-[#161D29] focus:text-white rounded-lg px-2.5 py-2"
            >
              <User className="w-3.5 h-3.5 mr-2 text-cyan-400" />
              <span>Perfil da Minha Equipe</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#1F2733]" />

            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 rounded-lg px-2.5 py-2"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              <span>Sair da Conta</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
