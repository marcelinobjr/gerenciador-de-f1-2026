import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import { SettingsModal } from '@/components/SettingsModal'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleResetGame = async () => {
    setIsResetting(true)
    try {
      await resetGame()
      setResetDialogOpen(false)
      setMobileDrawerOpen(false)
      toast({
        title: 'Jogo reiniciado com sucesso',
        description:
          'Todo o progresso anterior foi zerado. Escolha ou crie sua nova equipe no Lobby!',
      })
      navigate('/lobby', { replace: true })
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

  const handleLogout = () => {
    logout()
    navigate('/auth', { replace: true })
  }

  const isFullWidthPage = location.pathname === '/' || location.pathname === '/race'
  const teamName = team?.name || 'Audi F1 Team'
  const seasonYear = season?.year || 2026

  return (
    <div className="min-h-screen flex bg-[#07090D] text-[#F5F7FA]">
      {/* 1. Sidebar desktop fixa à esquerda (≥ lg) */}
      <div className="hidden lg:block shrink-0 sticky top-0 h-screen z-40">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          team={team}
          season={season}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* 2. Mobile Drawer (< lg) usando Sheet shadcn */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[270px] bg-[#0A0D12] border-[#1C2330] text-[#F5F7FA] sm:max-w-[280px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de Navegação F1 Manager</SheetTitle>
          </SheetHeader>
          <Sidebar
            collapsed={false}
            team={team}
            season={season}
            onOpenSettings={() => {
              setMobileDrawerOpen(false)
              setSettingsOpen(true)
            }}
            onLogout={handleLogout}
            onItemClick={() => setMobileDrawerOpen(false)}
            className="w-full h-full border-r-0"
          />
        </SheetContent>
      </Sheet>

      {/* 3. Coluna Principal: Topbar fixa + Conteúdo + Rodapé */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#07090D]">
        {/* Topbar Fina com métricas em tempo real */}
        <Topbar
          onOpenMobileMenu={() => setMobileDrawerOpen(true)}
          user={user}
          team={team}
          season={season}
          onLogout={handleLogout}
        />

        {/* Área de Conteúdo Principal */}
        <main
          className={`flex-1 w-full ${
            location.pathname === '/'
              ? 'w-full px-2.5 sm:px-4 lg:px-5 py-2.5 sm:py-3'
              : isFullWidthPage
                ? 'max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-6'
                : 'max-w-[1200px] mx-auto px-4 sm:px-6 py-6 md:py-8'
          }`}
        >
          <Outlet />
        </main>

        {/* Rodapé aprovado: "Audi F1 Team | Temporada 2026" à esquerda, "FASTER. SMARTER. TOGETHER." à direita */}
        <footer className="w-full border-t border-[#1C2330] bg-[#090C12] py-4 text-xs text-[#8B95A7] mt-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white tracking-wider uppercase">{teamName}</span>
              <span className="text-[#334155]">|</span>
              <span className="text-[#94A3B8]">Temporada {seasonYear}</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#64748B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />
              <span>FASTER. SMARTER. TOGETHER.</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal de Configurações */}
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

      {/* Reset Confirmation AlertDialog */}
      <AlertDialog
        open={resetDialogOpen}
        onOpenChange={(open) => !isResetting && setResetDialogOpen(open)}
      >
        <AlertDialogContent className="bg-[#0F141C] border-[#1F2733] text-[#F5F7FA] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Reiniciar Progresso do Jogo?</span>
            </div>
            <AlertDialogTitle className="text-lg font-bold text-white">
              Deseja zerar sua carreira nesta temporada?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs text-[#8B95A7] space-y-2 mt-2 font-normal leading-relaxed">
                <p>
                  Esta ação é <strong className="text-[#EF4444]">irreversível</strong> e apagará
                  todos os dados da sua escuderia atual:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[#CBD5E1]">
                  <li>Sua equipe atual e orçamento acumulado</li>
                  <li>Temporada {seasonYear} e resultados de todas as corridas</li>
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
    </div>
  )
}
