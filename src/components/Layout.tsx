import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Flag,
  LayoutDashboard,
  Users,
  Wrench,
  BadgePercent,
  Trophy,
  LogOut,
  Menu,
  X,
  Gauge,
  RotateCcw,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
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
    { name: 'Classificação', path: '/standings', icon: Trophy },
  ]

  const handleLogout = () => {
    logout()
    navigate('/auth', { replace: true })
  }

  const currentRound = season?.current_round ?? 1
  const totalRounds = season?.total_rounds ?? 24

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0E14] text-[#F5F7FA]">
      {/* Top Navbar */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          scrolled
            ? 'bg-[#0B0E14]/90 backdrop-blur-md border-b border-[#1F2733] shadow-md shadow-black/40'
            : 'bg-[#0B0E14] border-b border-[#1F2733]/60'
        }`}
      >
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E10600] to-[#FF6B35] flex items-center justify-center text-white shadow-md shadow-[#E10600]/30 group-hover:scale-105 transition-transform">
                <Flag className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-wider leading-none text-[#F5F7FA] flex items-center gap-1.5">
                  F1 <span className="text-[#E10600]">2026</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8B95A7]">
                  {team?.name || 'Escuderia Brasil'}
                </span>
              </div>
            </NavLink>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'text-[#F5F7FA] font-semibold bg-[#11161F]'
                      : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#11161F]/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#E10600]' : 'text-[#8B95A7]'}`} />
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#E10600] rounded-full animate-fade-in" />
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Right Status Indicator & Actions */}
          <div className="flex items-center gap-3">
            {/* Round indicator badge */}
            <div className="flex items-center gap-1.5 bg-[#11161F] border border-[#1F2733] px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#00A6FB] animate-pulse" />
              <span className="font-mono text-xs font-bold text-[#F5F7FA]">
                R{currentRound}/{totalRounds}
              </span>
            </div>

            {/* Reset Game button (desktop) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              disabled={isResetting}
              className="hidden md:flex text-[#8B95A7] hover:text-amber-400 hover:bg-amber-500/10 gap-1.5 text-xs font-medium border border-transparent hover:border-amber-500/30 transition-colors"
              title="Reiniciar jogo (zerar progresso)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
              Reiniciar Jogo
            </Button>

            {/* Logout button (desktop) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hidden md:flex text-[#8B95A7] hover:text-[#EF4444] hover:bg-red-950/20 gap-1.5 text-xs font-medium"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </Button>

            {/* Mobile Hamburger Drawer */}
            <div className="md:hidden">
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
                      <div className="w-7 h-7 rounded-md bg-[#E10600] flex items-center justify-center text-white">
                        <Flag className="w-3.5 h-3.5" />
                      </div>
                      <SheetTitle className="text-base font-bold text-[#F5F7FA]">
                        F1 2026 Manager
                      </SheetTitle>
                    </div>
                    <p className="text-xs text-[#8B95A7] font-mono mt-1">
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
                              ? 'bg-[#E10600] text-white shadow-md'
                              : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#1F2733]'
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
                      <span className="font-semibold text-[#F5F7FA]">
                        {user?.name || user?.email}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2 border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold"
                      disabled={isResetting}
                      onClick={() => setResetDialogOpen(true)}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reiniciar Jogo
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

      {/* Main Content Area: centered max-width 1100px */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 md:py-8">
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

      {/* Footer */}
      <footer className="w-full border-t border-[#1F2733] bg-[#0B0E14] py-6 text-center text-xs text-[#8B95A7]">
        <div className="max-w-[1100px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <p>
            F1 Manager 2026 • <span className="text-[#F5F7FA]">Temporada 2026</span>
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Regras F1 2026 (50/50 Híbrido, Aero Ativa, Modo Overtake)</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setResetDialogOpen(true)}
              className="text-[#8B95A7] hover:text-amber-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Reiniciar carreira
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
