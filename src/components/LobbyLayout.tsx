import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, RotateCcw, Volume2, VolumeX, Shield, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useToast } from '@/hooks/use-toast'
import { SettingsModal } from '@/components/SettingsModal'

export function LobbyLayout() {
  const { user, team, season, logout, resetGame, refreshTeamAndSeason, careerPhase } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [soundEnabled, setSoundEnabled] = useState(true)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleResetCareer = async () => {
    if (!user) return
    setResetting(true)
    try {
      await resetGame()
      await refreshTeamAndSeason()
      setResetModalOpen(false)
      toast({
        title: 'Carreira reiniciada',
        description: 'Sua carreira foi zerada com sucesso. Você pode criar um novo jogo.',
      })
      navigate('/lobby')
    } catch (err: any) {
      toast({
        title: 'Erro ao reiniciar carreira',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setResetting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F5F7FA] flex flex-col selection:bg-[#E10600] selection:text-white font-sans antialiased">
      {/* Topbar do Lobby */}
      <header className="h-16 border-b border-[#1F2733] bg-[#11161F]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        {/* Logo / Marca */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/lobby')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#E10600] flex items-center justify-center font-black text-white text-xs tracking-tighter shadow-md shadow-[#E10600]/30 group-hover:scale-105 transition-transform">
              F1
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm tracking-tight text-[#F5F7FA]">
                  MANAGER
                </span>
                <span className="text-xs font-mono font-bold text-[#E10600]">2026</span>
              </div>
              <span className="text-[10px] font-mono text-[#8B95A7] tracking-wider uppercase block">
                Ambiente Lobby
              </span>
            </div>
          </div>
        </div>

        {/* Status do Usuário / Ações Rápidas */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicador de Carreira Ativa */}
          {team && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#161D29] border border-[#1F2733] text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: team.color || '#E10600' }}
              />
              <span className="text-[#8B95A7] font-mono">Save Ativo:</span>
              <strong className="text-[#F5F7FA] truncate max-w-[140px]">{team.name}</strong>
            </div>
          )}

          {/* Toggle Som */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled((v) => !v)}
            className="text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29] h-9 w-9"
            title={soundEnabled ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-red-400" />
            )}
          </Button>

          {/* Voltar ao Jogo (se já tiver carreira ativa salva) */}
          {team && (
            <Button
              type="button"
              size="sm"
              onClick={() => navigate('/')}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-9 px-3 text-xs shadow-md shadow-emerald-500/20 hidden md:flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-black" /> Voltar ao Pit Wall
            </Button>
          )}

          {/* Resetar Carreira (se existir save) */}
          {team && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(true)}
              className="border-[#1F2733] text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 px-2.5 text-xs flex items-center gap-1.5"
              title="Apagar save da carreira e recomeçar"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reiniciar Carreira</span>
            </Button>
          )}

          {/* Logout */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29] h-9 w-9"
            title="Encerrar sessão"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal do Lobby (Wizard ou Rota Filha) */}
      <main className="flex-1 flex flex-col">
        <Outlet context={{ openSettingsModal: () => setSettingsModalOpen(true) }} />
      </main>

      {/* Rodapé do Lobby */}
      <footer className="border-t border-[#1F2733] bg-[#11161F]/60 py-3 px-6 text-center text-xs font-mono text-[#8B95A7] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>F1 MANAGER 2026 • Fase 2 (Wizard de Criação de Carreira) • v0.0.143</span>
        <span>FIA Formula 1 World Championship™ Simulation • Skip Cloud</span>
      </footer>

      {/* Modal de Confirmação de Reset de Carreira */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-400" /> Confirmar Reinício de Carreira
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Esta ação removerá todos os dados da carreira atual no servidor.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs leading-relaxed text-[#8B95A7]">
            <p>
              Você está prestes a apagar permanentemente a escuderia{' '}
              <strong className="text-[#F5F7FA]">{team?.name}</strong>, incluindo pilotos, peças,
              patrocinadores e histórico de corridas de 2026.
            </p>
            <p className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
              Esta ação não pode ser desfeita. Após o reinício, você voltará à tela inicial para
              iniciar um Novo Jogo.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetting}
              onClick={() => setResetModalOpen(false)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={resetting}
              onClick={handleResetCareer}
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              {resetting ? 'Apagando Carreira...' : 'Sim, Reiniciar do Zero'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Configurações Gerais */}
      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        user={user}
        team={team}
        season={season}
        onOpenResetDialog={() => setResetModalOpen(true)}
        onLogout={handleLogout}
        isResetting={resetting}
      />
    </div>
  )
}
