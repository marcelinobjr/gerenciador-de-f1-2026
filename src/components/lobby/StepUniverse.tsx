import React from 'react'
import {
  Globe,
  Trophy,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Check,
  Flag,
  Users,
  Shield,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UniverseType } from '@/types/career-wizard'

interface StepUniverseProps {
  universeType: UniverseType
  onSelectUniverse: (type: UniverseType) => void
  onNext: () => void
  onBack: () => void
}

export function StepUniverse({
  universeType,
  onSelectUniverse,
  onNext,
  onBack,
}: StepUniverseProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 sm:py-8 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="text-center space-y-2 pb-4 border-b border-[#1F2733]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] text-xs font-mono font-bold uppercase">
          <Globe className="w-3.5 h-3.5" /> Etapa 2 // Universo do Jogo
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
          Escolha o Formato do Campeonato
        </h2>
        <p className="text-xs sm:text-sm text-[#8B95A7] max-w-2xl mx-auto">
          Você deseja competir no grid oficial de 2026 pré-calibrado ou prefere selecionar
          livremente as 12 escuderias do seu próprio campeonato?
        </p>
      </div>

      {/* Duas Opções de Universo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OPÇÃO A: CAMPEONATO 2026 */}
        <Card
          onClick={() => onSelectUniverse('championship_2026')}
          className={`bg-[#11161F] transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
            universeType === 'championship_2026'
              ? 'border-[#E10600] ring-2 ring-[#E10600]/30 shadow-xl shadow-[#E10600]/10'
              : 'border-[#1F2733] hover:border-[#8B95A7]/60'
          }`}
        >
          {universeType === 'championship_2026' && (
            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center shadow-md">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] flex items-center justify-center shadow-inner">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#E10600] uppercase font-bold tracking-wider">
                  Opção A • Grid Padrão
                </span>
                <h3 className="text-xl font-bold text-[#F5F7FA]">Campeonato 2026</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#8B95A7] leading-relaxed">
                O grid oficial da temporada 2026 com as 12 equipes homologadas (Mercedes, Ferrari,
                McLaren, Red Bull, Racing Bulls, Alpine, Audi, Haas, Williams, Aston Martin,
                Andretti e Cadillac), calendário com 24 GPs e regras oficiais do novo regulamento.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Escuderias:</span>
                <strong className="text-[#F5F7FA]">12 Equipes Oficiais</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Pilotos Titulares:</span>
                <strong className="text-[#F5F7FA]">24 Pilotos Reais</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Calendário:</span>
                <strong className="text-cyan-400">24 Grandes Prêmios</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Próximo Passo:</span>
                <span className="text-amber-400">Escolha sua Equipe</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OPÇÃO B: CAMPEONATO PERSONALIZADO */}
        <Card
          onClick={() => onSelectUniverse('custom_championship')}
          className={`bg-[#11161F] transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
            universeType === 'custom_championship'
              ? 'border-cyan-500 ring-2 ring-cyan-500/30 shadow-xl shadow-cyan-500/10'
              : 'border-[#1F2733] hover:border-[#8B95A7]/60'
          }`}
        >
          {universeType === 'custom_championship' && (
            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-md">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-inner">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
                  Opção B • Grid Sob Medida
                </span>
                <h3 className="text-xl font-bold text-[#F5F7FA]">Campeonato Personalizado</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#8B95A7] leading-relaxed">
                Monte seu próprio grid de exatas 12 equipes, escolhidas livremente dentro da base de
                28 escuderias disponíveis do jogo (Porsche, Lamborghini, BYD, Toyota, Lotus, Penske,
                Jordan, Copersucar e outras lendas).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Escuderias:</span>
                <strong className="text-cyan-400">Exatamente 12 Selecionadas</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Base Disponível:</span>
                <strong className="text-[#F5F7FA]">28 Equipes Históricas & Modernas</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Equipe Própria:</span>
                <strong className="text-emerald-400">Opção "+ Criar Minha Equipe"</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7]">Próximo Passo:</span>
                <span className="text-amber-400">Tela "Monte seu Grid"</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Navegação */}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Manager
        </Button>

        <Button
          type="button"
          onClick={onNext}
          className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-[#E10600]/25 flex items-center gap-1.5"
        >
          Continuar para{' '}
          {universeType === 'championship_2026' ? 'Escolha da Equipe' : 'Montagem do Grid'}{' '}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
