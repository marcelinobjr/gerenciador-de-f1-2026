import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Flag, LogOut, User, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

/**
 * LobbyLayout: Layout independente para o ambiente de Pré-Jogo (Lobby / Criação de Equipe).
 * - Sem Sidebar de carreira
 * - Sem Topbar de carreira (sem orçamento, sem temporada, sem patrocinador, sem status de equipe)
 * - Cabeçalho limpo com identificação do jogo, usuário e ações básicas de logout/configurações da conta
 */
export function LobbyLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [accountModalOpen, setAccountModalOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0E14] text-[#F5F7FA]">
      {/* Topbar simplificada do Lobby */}
      <header className="sticky top-0 z-40 w-full h-14 bg-[#11161F] border-b border-[#1F2733] px-4 sm:px-6 flex items-center justify-between">
        {/* Identificação do jogo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#E10600] text-white shadow-md shadow-[#E10600]/20 font-bold">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#F5F7FA]">
                F1 MANAGER
              </span>
              <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/30">
                2026
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#8B95A7] hidden sm:block">
              LOBBY // PRÉ-TEMPORADA
            </p>
          </div>
        </div>

        {/* Informações da Conta & Ações */}
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] hover:border-[#8B95A7]/40 text-xs transition-colors cursor-pointer"
              title="Configurações da conta"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium text-[#F5F7FA] max-w-[120px] sm:max-w-[180px] truncate">
                {user.name || user.email}
              </span>
              <Settings className="w-3 h-3 text-[#8B95A7] ml-0.5" />
            </button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-xs text-[#8B95A7] hover:text-red-400 hover:bg-red-500/10 h-8 px-2.5 flex items-center gap-1.5"
            title="Encerrar sessão"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Conteúdo principal do Lobby */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Rodapé discreto do Lobby */}
      <footer className="w-full border-t border-[#1F2733] bg-[#0B0E14] py-4 text-center text-xs text-[#8B95A7]">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium text-[#F5F7FA]">
            F1 Manager 2026{' '}
            <span className="text-[#8B95A7] font-normal">
              • Pré-Temporada & Criação de Carreira
            </span>
          </p>
          <p className="text-[11px] text-[#8B95A7]">
            FIA Formula One World Championship™ 2026 Management
          </p>
        </div>
      </footer>

      {/* Modal de Configurações Básicas de Conta no Lobby */}
      <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA] max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" /> Conta do Jogador
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Informações do usuário conectado no sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-2">
              <div>
                <span className="text-[10px] text-[#8B95A7] uppercase block">Nome</span>
                <span className="text-[#F5F7FA] font-medium font-sans">
                  {user?.name || 'Chefe de Equipe'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#8B95A7] uppercase block">E-mail</span>
                <span className="text-[#F5F7FA] font-sans break-all">{user?.email || '—'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1F2733] flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAccountModalOpen(false)}
              className="border-[#1F2733] text-[#8B95A7] text-xs"
            >
              Fechar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white text-xs flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair da Conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LobbyLayout
