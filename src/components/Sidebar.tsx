import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wrench,
  Cpu,
  Building2,
  DollarSign,
  Flag,
  Trophy,
  Users2,
  BookOpen,
  Settings,
  Save,
  FolderOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Info,
  Map,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import apexLogoImg from '@/assets/apex-gp-manager-logo-3bf8a.jpg'

export interface SidebarNavGroup {
  id: string
  label: string
  items: {
    name: string
    path: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    isNotice?: boolean
    noticeTitle?: string
    noticeDesc?: string
  }[]
}

/**
 * As 10 áreas oficiais da Carreira F1 2026:
 * SEÇÃO GESTÃO:
 * 1. Central (/)
 * 2. Equipe (/team)
 * 3. Carro (/car)
 * 4. Pistas (/pistas — 24 circuitos canônicos, perfis técnicos, Track Fit)
 * 5. Desenvolvimento (/car?tab=pd — P&D, peças, engenharia)
 * 6. Infraestrutura (/infraestrutura — fábrica, simulador, túnel de vento)
 * 7. Comercial & Finanças (/sponsors — patrocinadores, receitas, despesas, teto)
 *
 * SEÇÃO COMPETIÇÃO:
 * 8. Fim de Semana (/race — treinos, qualy, sprint, corrida)
 * 9. Campeonato (/standings — calendário, classificação, resultados)
 * 10. Paddock (/paddock — todas as equipes, pilotos, staff, mercado, rumores, comparação)
 * 11. Histórico (/historico — temporadas passadas, recordes, títulos, arquivo)
 */

export interface NavSection {
  title: string
  items: {
    name: string
    path: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    isNotice?: boolean
    noticeTitle?: string
    noticeDesc?: string
  }[]
}

export const CAREER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'PRINCIPAL',
    items: [
      { name: 'Central', path: '/', icon: LayoutDashboard },
      { name: 'Equipe', path: '/team', icon: Users },
      { name: 'Pilotos', path: '/pilotos', icon: Users2 },
      { name: 'Carro', path: '/car', icon: Wrench },
    ],
  },
  {
    title: 'PERFORMANCE',
    items: [
      {
        name: 'Desenvolvimento',
        path: '/car',
        icon: Cpu,
        isNotice: true,
        noticeTitle: 'Desenvolvimento (P&D & Engenharia)',
        noticeDesc:
          'O fluxo de engenharia aerodinâmica, CFD e fabricação rápida é operado através do painel de Carro & Peças. Você pode aprimorar qualquer componente do monoposto.',
      },
      {
        name: 'Infraestrutura',
        path: '/infraestrutura',
        icon: Building2,
      },
      { name: 'Fim de Semana', path: '/race', icon: Flag },
      { name: 'Pistas', path: '/pistas', icon: Map },
    ],
  },
  {
    title: 'GESTÃO',
    items: [
      { name: 'Comercial & Finanças', path: '/sponsors', icon: DollarSign },
      { name: 'Paddock', path: '/paddock', icon: Users },
      { name: 'Campeonato', path: '/standings', icon: Trophy },
      { name: 'Histórico', path: '/historico', icon: BookOpen },
    ],
  },
]
// Lista plana para compatibilidade de rotas
export const CAREER_NAV_ITEMS = CAREER_NAV_SECTIONS.flatMap((s) => s.items)

export const ROUTE_TITLE_MAP: Record<string, string> = {
  '/': 'Central de Operações',
  '/team': 'Equipe',
  '/pilotos': 'Pilotos da Temporada',
  '/car': 'Carro e Peças',
  '/pistas': 'Circuitos da Temporada',
  '/infraestrutura': 'Infraestrutura & Instalações',
  '/sponsors': 'Comercial & Finanças',
  '/race': 'Fim de Semana',
  '/calendario': 'Calendário Oficial',
  '/standings': 'Campeonato Mundial',
  '/paddock': 'Paddock Oficial',
  '/historico': 'Histórico',
  '/teams': 'Grid da Temporada',
}

export interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  team?: any
  season?: any
  onOpenSettings: () => void
  onLogout?: () => void
  className?: string
  onItemClick?: () => void
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  team,
  season,
  onOpenSettings,
  onLogout,
  className,
  onItemClick,
}: SidebarProps) {
  const location = useLocation()
  const { toast } = useToast()
  const [noticeModal, setNoticeModal] = useState<{
    open: boolean
    title: string
    description: string
  }>({
    open: false,
    title: '',
    description: '',
  })

  const teamColor = team?.color || '#E10600'
  const teamName = team?.name || 'AUDI F1 TEAM'

  const handleSaveGame = () => {
    toast({
      title: 'Progresso Salvo no Skip Cloud',
      description: `Temporada ${season?.year || 2026} • Rodada ${season?.current_round || 1} sincronizada em tempo real com o backend.`,
    })
  }

  const handleLoadGame = () => {
    toast({
      title: 'Sessão Ativa Sincronizada',
      description:
        'Seus dados são salvos continuamente. Para reiniciar ou trocar de carreira, utilize as Configurações.',
    })
  }

  return (
    <aside
      className={cn(
        'h-screen flex flex-col bg-[#11161C] border-r border-[#1F2732] select-none transition-[width] duration-200 ease-in-out text-[#F5F7FA]',
        collapsed ? 'w-16' : 'w-[244px]',
        className,
      )}
    >
      {/* Topo da Sidebar: Logo oficial APEX GP Manager */}
      <div className="h-16 px-3.5 border-b border-[#1F2732] flex items-center justify-between shrink-0 bg-[#0D1117]">
        <NavLink
          to="/"
          onClick={onItemClick}
          className="flex items-center gap-2.5 overflow-hidden group focus:outline-none min-w-0"
          title="APEX GP Manager"
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <img
              src={apexLogoImg}
              alt="APEX GP Manager Logo"
              className="w-9 h-9 rounded-lg object-cover border border-[#2A3442] shadow-sm"
            />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black tracking-tight text-white uppercase truncate">
                APEX <span className="text-[#E10600]">GP</span>
              </span>
              <span className="text-[10px] font-mono tracking-wider text-[#94A3B8] font-semibold truncate">
                MANAGER
              </span>
            </div>
          )}
        </NavLink>

        {/* Botão recolher/expandir no desktop */}
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

      {/* 10 Áreas da Carreira agrupadas por GESTÃO e COMPETIÇÃO */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {CAREER_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2.5 pt-1 pb-1 text-[9px] font-mono font-bold tracking-wider text-[#64748B] uppercase">
                {section.title}
              </div>
            )}

            <nav className="space-y-0.5">
              {section.items.map((item, idx) => {
                const Icon = item.icon
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path))

                const handleClick = (e: React.MouseEvent) => {
                  if (item.isNotice) {
                    setNoticeModal({
                      open: true,
                      title: item.noticeTitle || item.name,
                      description: item.noticeDesc || '',
                    })
                  }
                  if (onItemClick) onItemClick()
                }

                const navItemContent = (
                  <NavLink
                    key={`${item.name}-${idx}`}
                    to={item.path}
                    onClick={handleClick}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-lg text-xs font-semibold transition-all duration-150',
                      collapsed ? 'justify-center h-9 w-9 mx-auto px-0' : 'px-2.5 py-2 w-full',
                      isActive
                        ? 'bg-[#E10600] text-white shadow-md font-bold'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#1A222C]',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] rounded-r-full bg-white" />
                    )}

                    <Icon
                      className={cn(
                        'shrink-0 transition-colors',
                        collapsed ? 'w-4 h-4' : 'w-4 h-4',
                        isActive ? 'text-white' : 'text-[#8B95A7]',
                      )}
                    />

                    {!collapsed && (
                      <span className="truncate tracking-tight flex-1 text-left font-medium">
                        {item.name}
                      </span>
                    )}

                    {!collapsed && item.isNotice && (
                      <span className="text-[8px] font-mono uppercase bg-[#1E293B] text-[#94A3B8] px-1 py-0.2 rounded border border-[#334155]">
                        INFO
                      </span>
                    )}
                  </NavLink>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={`${item.name}-${idx}`} delayDuration={100}>
                      <TooltipTrigger asChild>{navItemContent}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="bg-[#11161F] border-[#1F2733] text-white text-xs font-semibold px-2.5 py-1"
                      >
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return navItemContent
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Seção Inferior: Configurações, Salvar Jogo, Carregar Jogo, Sair */}
      <div className="p-2 border-t border-[#1C2330] bg-[#0B0E14] shrink-0 space-y-0.5">
        {/* Configurações */}
        <button
          type="button"
          onClick={() => {
            if (onItemClick) onItemClick()
            onOpenSettings()
          }}
          className={cn(
            'flex items-center gap-3 w-full rounded-lg text-xs font-semibold text-[#8B95A7] hover:text-white hover:bg-[#121822] transition-colors',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-3 py-2',
          )}
          title="Configurações (Conta & Carreira)"
        >
          <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
          {!collapsed && <span className="truncate font-medium">Configurações</span>}
        </button>

        {/* Salvar Jogo */}
        <button
          type="button"
          onClick={handleSaveGame}
          className={cn(
            'flex items-center gap-3 w-full rounded-lg text-xs font-semibold text-[#8B95A7] hover:text-white hover:bg-[#121822] transition-colors',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-3 py-2',
          )}
          title="Salvar Jogo na Nuvem"
        >
          <Save className="w-4 h-4 text-emerald-400 shrink-0" />
          {!collapsed && <span className="truncate font-medium">Salvar Jogo</span>}
        </button>

        {/* Carregar Jogo */}
        <button
          type="button"
          onClick={handleLoadGame}
          className={cn(
            'flex items-center gap-3 w-full rounded-lg text-xs font-semibold text-[#8B95A7] hover:text-white hover:bg-[#121822] transition-colors',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-3 py-2',
          )}
          title="Carregar Save Atual"
        >
          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          {!collapsed && <span className="truncate font-medium">Carregar Jogo</span>}
        </button>

        {/* Sair */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              'flex items-center gap-3 w-full rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-3 py-2',
            )}
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate font-medium">Sair</span>}
          </button>
        )}

        {/* Rodapé da Sidebar com o slogan aprovado: "PEOPLE / CARS / RESULTS" */}
        {!collapsed && (
          <div className="pt-2 mt-1 border-t border-[#1C2330]/60 text-left px-2">
            <span className="text-[9px] font-mono font-black italic tracking-wider text-rose-500/70 block">
              PEOPLE
            </span>
            <span className="text-[9px] font-mono font-black italic tracking-wider text-neutral-400 block">
              CARS
            </span>
            <span className="text-[9px] font-mono font-black italic tracking-wider text-neutral-500 block">
              RESULTS
            </span>
          </div>
        )}
      </div>

      {/* Modal Informativo para Desenvolvimento (mantido conforme requisito) */}
      <Dialog
        open={noticeModal.open}
        onOpenChange={(open) => setNoticeModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="bg-[#0F141C] border-[#1F2733] text-[#F5F7FA] max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] flex items-center justify-center mb-2">
              <Cpu className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-white uppercase tracking-tight">
              {noticeModal.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#94A3B8] leading-relaxed pt-2">
              {noticeModal.description}
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-[#141B26] border border-[#1F2733] flex items-start gap-2.5 text-xs text-[#CBD5E1]">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              O fluxo de pesquisa & desenvolvimento de novos pacotes aerodinâmicos e melhorias
              estruturais é conduzido na tela <strong>Carro e Peças</strong>, agora potencializado
              pelo nível da sua <strong>Fábrica & CFD</strong>.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

export default Sidebar
