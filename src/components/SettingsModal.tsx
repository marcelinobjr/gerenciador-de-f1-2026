import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Shield, RotateCcw, LogOut, Mail, Calendar, Layers, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
  team: any
  season: any
  onOpenResetDialog: () => void
  onLogout: () => void
  isResetting?: boolean
}

type SettingsTab = 'conta' | 'carreira'

/**
 * SettingsModal — Menu/Modal de Configurações Race Operations
 * - Seções "Conta" e "Carreira"
 * - Permite visualizar dados do usuário e escuderia
 * - Concentra o gatilho de reset de carreira com segurança (disparando o AlertDialog detalhado)
 * - Logout seguro
 */
export function SettingsModal({
  open,
  onOpenChange,
  user,
  team,
  season,
  onOpenResetDialog,
  onLogout,
  isResetting = false,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('carreira')

  const currentRound = season?.current_round ?? 1
  const totalRounds = season?.total_rounds ?? 24

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA] max-w-lg p-0 overflow-hidden rounded-xl shadow-2xl backdrop-blur-md">
        {/* Header do Modal */}
        <div className="p-5 border-b border-[#1F2733] bg-[#0E131B]">
          <DialogHeader>
            <div className="eyebrow text-[#8B95A7]">APEX GP Manager</div>
            <DialogTitle className="text-xl font-bold tracking-tight text-[#F5F7FA]">
              Configurações
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Gerencie as preferências da sua conta e o progresso da carreira da sua escuderia.
            </DialogDescription>
          </DialogHeader>

          {/* Abas Conta / Carreira */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[#1F2733]/70">
            <button
              type="button"
              onClick={() => setActiveTab('carreira')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                activeTab === 'carreira'
                  ? 'bg-[#161D29] text-white border border-[#2C3849]'
                  : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29]/50 border border-transparent',
              )}
            >
              <Shield className="w-3.5 h-3.5 text-[#E10600]" />
              <span>Carreira & Escuderia</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('conta')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                activeTab === 'conta'
                  ? 'bg-[#161D29] text-white border border-[#2C3849]'
                  : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29]/50 border border-transparent',
              )}
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Conta & Acesso</span>
            </button>
          </div>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'carreira' && (
            <div className="space-y-4">
              {/* Resumo da Escuderia */}
              <div className="p-3.5 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Escuderia Ativa</span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px] font-semibold"
                  >
                    Em Competição
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg border border-[#1F2733] flex items-center justify-center font-bold text-sm text-white shrink-0"
                    style={{ backgroundColor: team?.primary_color || '#E10600' }}
                  >
                    {team?.name?.[0] || 'F1'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-[#F5F7FA] truncate">
                      {team?.name || 'Escuderia F1'}
                    </h4>
                    <p className="text-xs text-[#8B95A7] truncate">
                      Temporada {season?.year || 2026} • Rodada {currentRound} de {totalRounds}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações da Temporada */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733]">
                  <span className="text-[10px] text-[#8B95A7] uppercase block font-medium">
                    Regulamento
                  </span>
                  <strong className="text-[#F5F7FA] text-xs font-semibold block mt-0.5">
                    FIA 2026 (50/50 Híbrido)
                  </strong>
                </div>
                <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733]">
                  <span className="text-[10px] text-[#8B95A7] uppercase block font-medium">
                    Calendário
                  </span>
                  <strong className="font-num text-[#F5F7FA] text-xs font-semibold block mt-0.5 tabular-nums">
                    {totalRounds} Grandes Prêmios
                  </strong>
                </div>
              </div>

              {/* Zona de Reset da Carreira */}
              <div className="pt-3 border-t border-[#1F2733] space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-[#8B95A7]">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Deseja reiniciar sua trajetória nesta temporada? Você pode reiniciar sua
                    carreira a qualquer momento mantendo sua conta de usuário ativa.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    onOpenResetDialog()
                  }}
                  disabled={isResetting}
                  className="w-full flex items-center justify-center gap-2 border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold h-9"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar Carreira (Zerar Temporada)</span>
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'conta' && (
            <div className="space-y-4">
              {/* Dados do Usuário */}
              <div className="p-3.5 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-3">
                <div className="eyebrow">Dados do Chefe de Equipe</div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2.5 text-[#F5F7FA]">
                    <User className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8B95A7] block leading-none">Nome</span>
                      <span className="font-medium">{user?.name || 'Chefe de Equipe'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-[#F5F7FA]">
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8B95A7] block leading-none">E-mail</span>
                      <span className="font-medium font-num tabular-nums">
                        {user?.email || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-[#F5F7FA]">
                    <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-[#8B95A7] block leading-none">
                        Membro desde
                      </span>
                      <span className="font-num tabular-nums">
                        {user?.created
                          ? new Date(user.created).toLocaleDateString('pt-BR')
                          : '2026'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Logout */}
              <div className="pt-2 border-t border-[#1F2733]">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    onOpenChange(false)
                    onLogout()
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold h-9"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Encerrar Sessão</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsModal
