import React from 'react'
import {
  Sliders,
  ChevronRight,
  ChevronLeft,
  Bot,
  Zap,
  TrendingUp,
  Gauge,
  Calendar,
  Flag,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CareerSettings } from '@/types/career-wizard'

interface StepCareerSettingsProps {
  settings: CareerSettings
  onUpdateSettings: (settings: Partial<CareerSettings>) => void
  onNext: () => void
  onBack: () => void
}

export function StepCareerSettings({
  settings,
  onUpdateSettings,
  onNext,
  onBack,
}: StepCareerSettingsProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 sm:py-8 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="text-center space-y-2 pb-4 border-b border-[#1F2733]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] text-xs font-mono font-bold uppercase">
          <Sliders className="w-3.5 h-3.5" /> Etapa 4 // Diretrizes da Carreira
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
          Configurações da Carreira
        </h2>
        <p className="text-xs sm:text-sm text-[#8B95A7] max-w-2xl mx-auto">
          Defina o nível de desafio, o comportamento do mercado de pilotos, a agressividade dos
          eventos da fábrica e os formatos de prova.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Dificuldade da IA */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono uppercase text-[#F5F7FA] font-bold flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" /> Dificuldade da IA
              </Label>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-cyan-400 border-cyan-500/30"
              >
                {settings.aiDifficulty.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A7]">
              Impacta ritmo de corrida e eficiência de desenvolvimento das escuderias rivais.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'easy', label: 'Fácil', desc: 'Rivais erram mais e têm ritmo conservador' },
                { id: 'normal', label: 'Normal', desc: 'Ritmo equilibrado e realista de 2026' },
                { id: 'hard', label: 'Difícil', desc: 'Rivalidade intensa por cada décimo' },
                { id: 'expert', label: 'Expert', desc: 'Estratégia e ritmo cirúrgicos das IAs' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => onUpdateSettings({ aiDifficulty: opt.id as any })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.aiDifficulty === opt.id
                      ? 'border-[#E10600] bg-[#E10600]/10 text-white shadow-md'
                      : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#8B95A7]/60'
                  }`}
                >
                  <strong className="text-xs font-bold block text-[#F5F7FA]">{opt.label}</strong>
                  <span className="text-[10px] text-[#8B95A7] line-clamp-2 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 2. Comportamento do Mercado */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono uppercase text-[#F5F7FA] font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Mercado de Pilotos
              </Label>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-emerald-400 border-emerald-500/30"
              >
                {settings.marketBehavior.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A7]">
              Frequência de demissões, transferências e novidades na silly season.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'conservative', label: 'Conservador', desc: 'Poucas trocas' },
                { id: 'dynamic', label: 'Dinâmico', desc: 'Padrão da F1' },
                { id: 'chaotic', label: 'Caótico', desc: 'Muitas danças' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => onUpdateSettings({ marketBehavior: opt.id as any })}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    settings.marketBehavior === opt.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-md'
                      : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#8B95A7]/60'
                  }`}
                >
                  <strong className="text-xs font-bold block text-[#F5F7FA]">{opt.label}</strong>
                  <span className="text-[10px] text-[#8B95A7] block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 3. Frequência de Eventos / Conflitos */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono uppercase text-[#F5F7FA] font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Eventos & Crises
              </Label>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-amber-400 border-amber-500/30"
              >
                {settings.eventFrequency.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A7]">
              Frequência de atritos de pilotos, falhas de peças e dilemas de diretoria.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'low', label: 'Baixa', desc: 'Paz na fábrica' },
                { id: 'normal', label: 'Normal', desc: 'Equilíbrio' },
                { id: 'high', label: 'Alta', desc: 'Dilemas constantes' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => onUpdateSettings({ eventFrequency: opt.id as any })}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    settings.eventFrequency === opt.id
                      ? 'border-amber-500 bg-amber-500/10 text-white shadow-md'
                      : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#8B95A7]/60'
                  }`}
                >
                  <strong className="text-xs font-bold block text-[#F5F7FA]">{opt.label}</strong>
                  <span className="text-[10px] text-[#8B95A7] block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Velocidade de Desenvolvimento */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono uppercase text-[#F5F7FA] font-bold flex items-center gap-2">
                <Gauge className="w-4 h-4 text-purple-400" /> Velocidade de P&D
              </Label>
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-purple-400 border-purple-500/30"
              >
                {settings.devSpeed === 'normal' ? 'NORMAL' : 'ACELERADA'}
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A7]">
              Tempo de produção e upgrades de túnel de vento na fábrica.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'normal', label: 'Normal', desc: 'Ciclo padrão de 3-5 rodadas por peça' },
                {
                  id: 'accelerated',
                  label: 'Acelerada',
                  desc: 'Upgrades rápidos para testes dinâmicos',
                },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => onUpdateSettings({ devSpeed: opt.id as any })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.devSpeed === opt.id
                      ? 'border-purple-500 bg-purple-500/10 text-white shadow-md'
                      : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#8B95A7]/60'
                  }`}
                >
                  <strong className="text-xs font-bold block text-[#F5F7FA]">{opt.label}</strong>
                  <span className="text-[10px] text-[#8B95A7] line-clamp-2 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Formato de Temporada & Sprint (Preparado para expansão futura) */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F2733] pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-[#F5F7FA] uppercase tracking-wider font-mono">
                Estrutura de Temporada & Finais de Semana
              </h3>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-[#1F2733] text-[#8B95A7]"
            >
              24 Rodadas Padrão
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            {/* Formato de Temporada */}
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2">
              <span className="text-[#8B95A7] text-[10px] uppercase">Formato do Calendário:</span>
              <div className="flex items-center justify-between">
                <strong className="text-[#F5F7FA] text-sm">24 GPs (Oficial FIA 2026)</strong>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                  Padrão
                </Badge>
              </div>
              <p className="text-[10px] text-[#8B95A7] font-sans leading-relaxed">
                Calendário global de 24 circuitos (Bahrein a Abu Dhabi). Opções de calendário curto
                ou customizado estarão disponíveis em updates futuros.
              </p>
            </div>

            {/* Toggle de Corrida Sprint */}
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[#8B95A7] text-[10px] uppercase">
                  Finais de Semana Sprint:
                </span>
                <div className="flex items-center justify-between pt-1">
                  <strong className="text-[#F5F7FA] text-sm">Formato Sprint FIA</strong>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ sprintEnabled: !settings.sprintEnabled })}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                      settings.sprintEnabled
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#161D29] text-[#8B95A7] border border-[#1F2733]'
                    }`}
                  >
                    {settings.sprintEnabled ? 'Habilitado (6 GPs)' : 'Desabilitado'}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#8B95A7] font-sans leading-relaxed">
                Garante corridas curtas pontuadas nas sextas/sábados de etapas selecionadas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Navegação */}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar à Equipe
        </Button>

        <Button
          type="button"
          onClick={onNext}
          className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-[#E10600]/25 flex items-center gap-1.5"
        >
          Continuar para Revisão <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
