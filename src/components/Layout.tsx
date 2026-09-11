import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Shield,
  Wrench,
  BadgePercent,
  Trophy,
  LogOut,
  Menu,
  X,
  Gauge,
  Calendar,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Settings,
} from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
import { SettingsModal } from '@/components/SettingsModal'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

export default function Layout() {
  const { user, team, season, logout, resetGame } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleResetGame = async () => {
    setIsResetting(true)
    try {
      await resetGame()
      setResetDialogOpen(false)
      setMobileOpen(false)
      toast({
        title: 'Jogo reiniciado com sucesso',
        description: 'Todo o progresso anterior foi zerado. Escolha ou crie sua nova equipe!',
      })
      navigate('/selecionar-equipe', { replace: true })
    } catch (err: any) {
      console.error('Erro ao reiniciar jogo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao reiniciar o jogo',
        description: err?.message || 'Não foi possível apagar os dados do jogo. Tente novamente.',
      })
    } finally {
      setIsResetting(false)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { name: 'Painel', path: '/', icon: LayoutDashboard },
    { name: 'Equipe', path: '/team', icon: Users },
    { name: 'Carro', path: '/car', icon: Wrench },
    { name: 'Patrocínios', path: '/sponsors', icon: BadgePercent },
    { name: 'Corrida', path: '/race', icon: Gauge },
    { name: 'Calendário', path: '/calendario', icon: Calendar },
    { name: 'Classificação', path: '/standings', icon: Trophy },
    { name: 'Equipes', path: '/teams', icon: Shield },
  ]
  const handleLogout = () => {
    logout()
    navigate('/auth', { replace: true })
  }

  const currentRound = season?.current_round ?? 1
  const totalRounds = season?.total_rounds ?? 24

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0E14] text-[#F5F7FA]">
      {/* Top Navbar — Camada 1 com blur controlado e sem bordas espalhafatosas */}
      <header
        className={`sticky top-0 z-40 w-full transition-colors duration-150 ${
          scrolled
            ? 'bg-[#11161F]/95 backdrop-blur-md border-b border-[#1F2733] shadow-md shadow-black/40'
            : 'bg-[#11161F]/90 backdrop-blur-sm border-b border-[#1F2733]'
        }`}
      >
        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand: F1 vermelho + 2026 e nome da equipe embaixo */}
          <div className="flex items-center gap-3 shrink-0">
            <NavLink to="/" className="flex items-center gap-2.5 group">
              {/* F1 Icon / Logo Red Ribbon */}
              <div className="relative flex items-center">
                <svg viewBox="0 0 140 40" className="h-7 w-auto" fill="none">
                  {/* F1 emblem shape */}
                  <path
                    d="M 10 32 L 28 8 L 48 8 L 40 18 L 32 18 L 30 21 L 44 21 L 36 32 L 26 32 L 28 29 L 20 29 L 18 32 Z"
                    fill="#E10600"
                  />
                  <path d="M 52 8 L 62 8 L 44 32 L 34 32 Z" fill="#E10600" />
                  {/* Speed streak */}
                  <path d="M 64 12 L 72 12 L 68 18 L 60 18 Z" fill="#E10600" opacity="0.9" />
                  <path d="M 58 22 L 66 22 L 62 28 L 54 28 Z" fill="#E10600" opacity="0.8" />
                  {/* 2026 text */}
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

              <div className="flex flex-col">
                <span className="eyebrow text-[#8B95A7] group-hover:text-white transition-colors leading-none">
                  {team?.name || 'AUDI F1 TEAM'}
                </span>
              </div>
            </NavLink>
          </div>

          {/* Desktop Nav Items: Botões discretos de navegação */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-[#161D29] text-white border border-[#E10600]'
                      : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${isActive ? 'text-[#E10600]' : 'text-[#8B95A7]'}`}
                  />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Right Section: Sino + Engrenagem de Configurações + Avatar + Temporada 2026 */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Sino de Notificações */}
            <NotificationBell currentRound={currentRound} userId={user?.id} />

            {/* Engrenagem / Menu de Configurações (Abre modal com seções Conta e Carreira) */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 rounded-lg bg-[#161D29] border border-[#1F2733] text-[#8B95A7] hover:text-white hover:border-[#2C3849] flex items-center justify-center transition-colors cursor-pointer"
              title="Configurações (Conta & Carreira)"
              aria-label="Abrir configurações"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Avatar circular */}
            <div className="w-8 h-8 rounded-full bg-[#161D29] border border-[#1F2733] flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
              {user?.name?.[0] || user?.email?.[0] || 'J'}
            </div>

            {/* Status Temporada + Barra de Progresso */}
            <div className="hidden sm:flex flex-col gap-1 min-w-[130px]">
              <div className="flex items-center justify-between text-[11px] leading-none">
                <span className="text-[#8B95A7] text-[10px]">Temporada 2026</span>
                <span className="font-num text-white font-bold text-xs tabular-nums">
                  R{currentRound}/{totalRounds}
                </span>
              </div>
              <div className="w-full bg-[#161D29] border border-[#1F2733] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#E10600] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (currentRound / totalRounds) * 100)}%` }}
                />
              </div>
            </div>

            {/* Mobile Hamburger Drawer */}
            <div className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#8B95A7] hover:text-[#F5F7FA]"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA] p-6 w-[280px]"
                >
                  <SheetHeader className="text-left mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-[#E10600] flex items-center justify-center text-white font-bold text-xs">
                        F1
                      </div>
                      <SheetTitle className="text-base font-bold text-[#F5F7FA]">
                        F1 Manager 2026
                      </SheetTitle>
                    </div>
                    <p className="text-xs text-[#8B95A7] mt-1">
                      {team?.name || 'Escuderia'} • Rodada {currentRound}/{totalRounds}
                    </p>
                  </SheetHeader>

                  <div className="flex flex-col gap-2">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const isActive = location.pathname === item.path
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-[#161D29] border border-[#E10600] text-white'
                              : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.name}
                        </NavLink>
                      )
                    })}
                  </div>

                  <div className="mt-8 pt-6 border-t border-[#1F2733] space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#8B95A7]">
                      <span>Usuário logado:</span>
                      <span className="font-semibold text-[#F5F7FA] truncate max-w-[150px]">
                        {user?.name || user?.email}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2 border-[#1F2733] bg-[#161D29] hover:bg-[#1c2534] text-white text-xs font-semibold"
                      onClick={() => {
                        setMobileOpen(false)
                        setSettingsOpen(true)
                      }}
                    >
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Configurações
                    </Button>

                    <Button
                      variant="destructive"
                      className="w-full flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold"
                      onClick={() => {
                        setMobileOpen(false)
                        handleLogout()
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      Encerrar Sessão
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area: full width on dashboard ("/") to match the cockpit mockup, max-width 1100px on inner pages */}
      <main
        className={`flex-1 w-full ${
          location.pathname === '/'
            ? 'max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-8 py-4 md:py-6'
            : 'max-w-[1100px] mx-auto px-4 sm:px-6 py-6 md:py-8'
        }`}
      >
        <Outlet />
      </main>

      {/* Reset Confirmation AlertDialog */}
      <AlertDialog
        open={resetDialogOpen}
        onOpenChange={(open) => !isResetting && setResetDialogOpen(open)}
      >
        <AlertDialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Reiniciar Progresso do Jogo?</span>
            </div>
            <AlertDialogTitle className="text-lg font-bold text-[#F5F7FA]">
              Deseja zerar sua carreira nesta temporada?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs text-[#8B95A7] space-y-2 mt-2 font-normal leading-relaxed">
                <p>
                  Esta ação é <strong className="text-[#EF4444]">irreversível</strong> e apagará
                  todos os dados da sua escuderia atual:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[#F5F7FA]">
                  <li>Sua equipe atual e orçamento acumulado</li>
                  <li>Temporada 2026 e resultados de todas as corridas</li>
                  <li>Patrocínios ativos e peças desenvolvidas no P&D</li>
                  <li>Contratos de pilotos (eles voltam disponíveis para o mercado)</li>
                  <li>Histórico de comunicados e eventos</li>
                </ul>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] mt-2">
                  ✓ <strong>Sua conta e login serão mantidos</strong> ({user?.email}). Você será
                  direcionado para escolher ou criar uma nova equipe imediatamente.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={isResetting}
              className="bg-[#0B0E14] border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#1F2733]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleResetGame()
              }}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reiniciando...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Sim, reiniciar jogo
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Modal (Configurações: Conta e Carreira) */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user}
        team={team}
        season={season}
        onOpenResetDialog={() => setResetDialogOpen(true)}
        onLogout={handleLogout}
        isResetting={isResetting}
      />

      {/* Footer discreto — Nome do jogo + Temporada 2026 + Jogo de gerenciamento pessoal */}
      <footer className="w-full border-t border-[#1F2733] bg-[#0B0E14] py-5 text-center text-xs text-[#8B95A7]">
        <div className="max-w-[1100px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium text-[#F5F7FA]">
            F1 Manager 2026 <span className="text-[#8B95A7] font-normal">• Temporada 2026</span>
          </p>
          <p className="text-[11px] text-[#8B95A7]">
            Jogo de gerenciamento pessoal — regras oficiais da F1 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
