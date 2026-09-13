import React from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  Sparkles,
  Trophy,
  User,
  Globe,
  Sliders,
  Shield,
  Loader2,
  AlertCircle,
  Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { NewGameConfig } from '@/types/career-wizard'

interface StepReviewProps {
  config: NewGameConfig
  isSubmitting: boolean
  onConfirmCreateCareer: () => void
  onBack: () => void
  onCancel: () => void
}

export function StepReview({
  config,
  isSubmitting,
  onConfirmCreateCareer,
  onBack,
  onCancel,
}: StepReviewProps) {
  const { manager, managerProfile, universeType, selectedTeams, playerTeam, careerSettings } =
    config

  // Nome e detalhes da equipe escolhida
  const teamDisplayName = playerTeam.isCustom
    ? playerTeam.customName || 'Minha Escuderia'
    : playerTeam.officialTeam?.name || 'Equipe Oficial'

  const teamColor = playerTeam.isCustom
    ? playerTeam.customColor || '#00A6FB'
    : playerTeam.officialTeam?.color || '#E10600'

  const teamEngine = playerTeam.isCustom
    ? playerTeam.customEngine || 'Mercedes'
    : playerTeam.officialTeam?.engine || 'Mercedes'

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 sm:py-8 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="text-center space-y-2 pb-4 border-b border-[#1F2733]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold uppercase">
          <CheckCircle2 className="w-3.5 h-3.5" /> Etapa Final // Revisão do Contrato
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
          Revisão Final da Carreira
        </h2>
        <p className="text-xs sm:text-sm text-[#8B95A7] max-w-2xl mx-auto">
          Confira o resumo das suas escolhas antes da assinatura definitiva do contrato. Nenhuma
          alteração no banco de dados foi feita até aqui.
        </p>
      </div>

      <div className="space-y-4">
        {/* Bloco 1: Manager & Perfil */}
        <Card className="bg-[#11161F] border-[#1F2733] shadow-lg">
          <CardHeader className="pb-3 border-b border-[#1F2733]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#E10600]" />
                <CardTitle className="text-sm font-bold text-[#F5F7FA] uppercase font-mono">
                  Chefe de Equipe
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-[#E10600] border-[#E10600]/30"
              >
                {managerProfile.archetype}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-[#8B95A7] text-[10px] uppercase block">Nome:</span>
              <strong className="text-[#F5F7FA] text-sm font-sans">{manager.name}</strong>
              <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                {manager.nationality} {manager.age ? `• ${manager.age} anos` : ''}
              </span>
            </div>

            <div>
              <span className="text-[#8B95A7] text-[10px] uppercase block">Perfil Escolhido:</span>
              <strong className="text-cyan-400 text-sm font-sans">{managerProfile.title}</strong>
              <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                {managerProfile.specialty}
              </span>
            </div>

            <div>
              <span className="text-[#8B95A7] text-[10px] uppercase block">Bônus & Fraqueza:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {managerProfile.bonuses.map((b, i) => (
                  <Badge
                    key={i}
                    className="bg-emerald-500/10 text-emerald-400 text-[9px] py-0 px-1.5"
                  >
                    {b.attribute} +{b.value}
                  </Badge>
                ))}
                <Badge className="bg-red-500/10 text-red-400 text-[9px] py-0 px-1.5">
                  {managerProfile.weakness.attribute} {managerProfile.weakness.value}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Escuderia do Jogador & Universo */}
        <Card className="bg-[#11161F] border-[#1F2733] shadow-lg">
          <CardHeader className="pb-3 border-b border-[#1F2733]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-cyan-400" />
                <CardTitle className="text-sm font-bold text-[#F5F7FA] uppercase font-mono">
                  Sua Escuderia & Campeonato
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-cyan-400 border-cyan-500/30"
              >
                {universeType === 'championship_2026'
                  ? 'CAMPEONATO 2026'
                  : 'CAMPEONATO PERSONALIZADO'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow shrink-0"
                style={{ backgroundColor: teamColor }}
              >
                {teamDisplayName.slice(0, 3).toUpperCase()}
              </div>
              <div>
                <span className="text-[#8B95A7] text-[10px] uppercase block">Escuderia:</span>
                <strong className="text-[#F5F7FA] text-sm font-sans">{teamDisplayName}</strong>
                <span className="text-[10px] text-cyan-400 block mt-0.5">Motor {teamEngine}</span>
              </div>
            </div>

            <div>
              <span className="text-[#8B95A7] text-[10px] uppercase block">Grid Selecionado:</span>
              <strong className="text-[#F5F7FA] text-sm font-sans">
                {selectedTeams.length} Escuderias
              </strong>
              <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                {universeType === 'championship_2026'
                  ? 'Grid Oficial de 2026'
                  : 'Grid Customizado 12/12'}
              </span>
            </div>

            <div>
              <span className="text-[#8B95A7] text-[10px] uppercase block">Pilotos Titulares:</span>
              {playerTeam.isCustom ? (
                <span className="text-amber-400 text-xs font-sans block mt-1">
                  A contratar pós-criação na aba Equipe
                </span>
              ) : (
                <div className="space-y-0.5 mt-0.5 text-[11px] font-sans text-[#F5F7FA]">
                  <div>1. {playerTeam.officialTeam?.driver1.name}</div>
                  <div>2. {playerTeam.officialTeam?.driver2.name}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bloco 3: Grid das 12 Equipes do Campeonato */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-2">
            <span className="text-[10px] font-mono text-[#8B95A7] uppercase">
              As 12 Escuderias do Campeonato:
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {selectedTeams.map((team, idx) => {
                const isUserTeam =
                  (!playerTeam.isCustom && playerTeam.teamKey === team.key) ||
                  (playerTeam.isCustom && idx === 0)

                return (
                  <div
                    key={team.key}
                    className={`p-2 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                      isUserTeam
                        ? 'bg-[#161D29] border-[#E10600] text-white shadow-sm'
                        : 'bg-[#0B0E14] border-[#1F2733] text-[#8B95A7]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="truncate text-[11px] font-sans font-medium">
                      {team.shortName || team.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bloco 4: Configurações da Carreira */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-3 border-b border-[#1F2733]/60">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <CardTitle className="text-sm font-bold text-[#F5F7FA] uppercase font-mono">
                Regras & Dificuldade
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-[#0B0E14] border border-[#1F2733]">
              <span className="text-[#8B95A7] text-[10px] uppercase block">Dificuldade IA:</span>
              <strong className="text-cyan-400 text-xs uppercase">
                {careerSettings.aiDifficulty}
              </strong>
            </div>
            <div className="p-2.5 rounded bg-[#0B0E14] border border-[#1F2733]">
              <span className="text-[#8B95A7] text-[10px] uppercase block">Mercado:</span>
              <strong className="text-emerald-400 text-xs uppercase">
                {careerSettings.marketBehavior}
              </strong>
            </div>
            <div className="p-2.5 rounded bg-[#0B0E14] border border-[#1F2733]">
              <span className="text-[#8B95A7] text-[10px] uppercase block">Eventos/Crises:</span>
              <strong className="text-amber-400 text-xs uppercase">
                {careerSettings.eventFrequency}
              </strong>
            </div>
            <div className="p-2.5 rounded bg-[#0B0E14] border border-[#1F2733]">
              <span className="text-[#8B95A7] text-[10px] uppercase block">Velocidade P&D:</span>
              <strong className="text-purple-400 text-xs uppercase">
                {careerSettings.devSpeed}
              </strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Caixa de Confirmação Final */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#E10600]/15 via-[#11161F] to-emerald-500/15 border border-[#1F2733] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-base font-bold text-[#F5F7FA] flex items-center justify-center sm:justify-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Pronto para assumir o comando?
          </h4>
          <p className="text-xs text-[#8B95A7]">
            Ao clicar em <strong>COMEÇAR CARREIRA</strong>, seu save será criado definitivamente no
            backend Skip Cloud e o pit wall da F1 2026 será aberto.
          </p>
        </div>

        <Button
          type="button"
          disabled={isSubmitting}
          onClick={onConfirmCreateCareer}
          className="w-full sm:w-auto bg-[#E10600] hover:bg-[#FF2E25] text-white font-extrabold text-sm h-12 px-8 shadow-xl shadow-[#E10600]/30 shrink-0 uppercase tracking-wider"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Homologando Carreira...
            </>
          ) : (
            'COMEÇAR CARREIRA'
          )}
        </Button>
      </div>

      {/* Botões de Ação Inferiores (Voltar / Cancelar) */}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onBack}
          className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar às Configurações
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onCancel}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs sm:text-sm"
        >
          Cancelar e Descartar Escolhas
        </Button>
      </div>
    </div>
  )
}
