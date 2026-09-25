import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  RotateCcw,
  FolderOpen,
  Settings as SettingsIcon,
  Flag,
  Shield,
  Trophy,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { TeamModel } from '@/types/f1'

interface StepStartProps {
  hasExistingCareer: boolean
  existingTeam: TeamModel | null
  onStartNewGame: () => void
  onOpenSettings: () => void
}

export function StepStart({
  hasExistingCareer,
  existingTeam,
  onStartNewGame,
  onOpenSettings,
}: StepStartProps) {
  const navigate = useNavigate()
  const [loadGameModalOpen, setLoadGameModalOpen] = useState(false)

  const handleContinueCareer = () => {
    navigate('/')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 sm:py-12 animate-fade-in-up">
      {/* Hero Banner */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 border border-red-200 text-[#E10600] text-xs font-mono font-bold uppercase tracking-widest shadow-xs">
          <Flag className="w-3.5 h-3.5" /> FIA FORMULA ONE WORLD CHAMPIONSHIP™ 2026
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0F172A]">
          APEX GP <span className="text-[#E10600]">Manager</span>
        </h1>

        <p className="text-base sm:text-lg text-[#64748B] max-w-2xl mx-auto leading-relaxed">
          Assuma o posto máximo de Chefe de Equipe. Comande o novo regulamento híbrido 50/50,
          desenvolva tecnologia de ponta e leve sua escuderia à glória mundial.
        </p>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
        {/* NOVO JOGO (Ação principal para quem não tem carreira ou quer recomeçar) */}
        <Card
          onClick={onStartNewGame}
          className="bg-white border-[#E2E8F0] hover:border-[#E10600] transition-all duration-300 cursor-pointer group shadow-sm hover:shadow-md relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-2xl pointer-events-none group-hover:bg-red-100 transition-colors" />
          <CardContent className="p-6 sm:p-8 space-y-4 flex flex-col justify-between h-full relative z-10">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#E10600] text-white flex items-center justify-center shadow-md shadow-red-200 group-hover:scale-105 transition-transform">
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </div>
              <h2 className="text-2xl font-black text-[#0F172A] group-hover:text-[#E10600] transition-colors">
                Novo Jogo
              </h2>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Inicie o assistente de carreira. Escolha seu perfil de manager, selecione entre o
                Campeonato 2026 ou Campeonato Personalizado de 12 equipes e calibre as diretrizes.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                className="w-full bg-[#E10600] hover:bg-[#C60500] text-white font-bold h-11 text-sm shadow-md shadow-red-200"
              >
                Criar Nova Carreira
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CONTINUAR CARREIRA (Se existir save) */}
        {hasExistingCareer && existingTeam ? (
          <Card
            onClick={handleContinueCareer}
            className="bg-white border-emerald-300 hover:border-emerald-500 transition-all duration-300 cursor-pointer group shadow-sm hover:shadow-md relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-100 transition-colors" />
            <CardContent className="p-6 sm:p-8 space-y-4 flex flex-col justify-between h-full relative z-10">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform">
                    <RotateCcw className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    Carreira Ativa
                  </span>
                </div>
                <h2 className="text-2xl font-black text-[#0F172A] group-hover:text-emerald-700 transition-colors">
                  Continuar Carreira
                </h2>
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Escuderia:</span>
                    <strong className="text-[#0F172A] font-sans flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: existingTeam.color || '#E10600' }}
                      />
                      {existingTeam.name}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Motor:</span>
                    <span className="text-cyan-700 font-sans font-medium">
                      {existingTeam.engine_supplier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 text-sm shadow-md shadow-emerald-200"
                >
                  Voltar ao Pit Wall
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Card Informativo para usuário sem carreira */
          <Card className="bg-white border-[#E2E8F0] flex flex-col justify-between shadow-xs">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] text-[#64748B] flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F172A]">Sua Jornada Começa Aqui</h2>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Você ainda não possui uma carreira ativa salva. Ao clicar em{' '}
                <strong className="text-[#0F172A]">Novo Jogo</strong>, você assumirá uma das equipes
                consagradas da F1 ou criará a sua própria escuderia.
              </p>
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Compatibilidade total com o regulamento híbrido 2026.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Secondary Actions: Carregar Jogo (preparado) & Configurações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setLoadGameModalOpen(true)}
          className="bg-white border-[#CBD5E1] hover:border-[#64748B] text-[#0F172A] font-medium h-12 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs"
        >
          <FolderOpen className="w-4 h-4 text-cyan-600" />
          Carregar Jogo Salvo
          <span className="text-[10px] font-mono text-[#64748B] uppercase px-1.5 py-0.2 rounded bg-[#F1F5F9]">
            Em breve
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onOpenSettings}
          className="bg-white border-[#CBD5E1] hover:border-[#64748B] text-[#0F172A] font-medium h-12 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs"
        >
          <SettingsIcon className="w-4 h-4 text-amber-600" />
          Configurações Gerais
        </Button>
      </div>

      {/* Modal Carregar Jogo (Preparado para suporte futuro a múltiplos slots de save) */}
      <Dialog open={loadGameModalOpen} onOpenChange={setLoadGameModalOpen}>
        <DialogContent className="bg-white border-[#E2E8F0] text-[#0F172A] max-w-md shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#0F172A]">
              <FolderOpen className="w-5 h-5 text-cyan-600" /> Carregar Jogo Salvo
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Gerenciamento de saves e slots de carreira.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-[#64748B]">
              <p className="text-[#0F172A] font-semibold">Slot Principal (Nuvem Skip Cloud):</p>
              {hasExistingCareer && existingTeam ? (
                <div className="flex items-center justify-between font-mono pt-1 text-xs">
                  <span className="text-[#0F172A] font-bold">{existingTeam.name}</span>
                  <span className="text-emerald-700 font-semibold">Ativo</span>
                </div>
              ) : (
                <p className="text-[11px] italic">Nenhum save ativo encontrado.</p>
              )}
            </div>

            <p className="text-[11px] text-[#64748B] leading-relaxed">
              O suporte a múltiplos slots locais e carregamento manual de arquivos de backup será
              disponibilizado nas próximas atualizações de gerenciamento.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLoadGameModalOpen(false)}
              className="border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9]"
            >
              Fechar
            </Button>
            {hasExistingCareer && (
              <Button
                type="button"
                size="sm"
                onClick={handleContinueCareer}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Continuar Save Ativo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
