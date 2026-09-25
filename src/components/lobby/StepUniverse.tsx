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
      <div className="text-center space-y-2 pb-4 border-b border-[#E2E8F0]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-50 border border-red-200 text-[#E10600] text-xs font-mono font-bold uppercase">
          <Globe className="w-3.5 h-3.5" /> Etapa 2 // Universo do Jogo
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
          Escolha o Formato do Campeonato
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl mx-auto">
          Você deseja competir no grid oficial de 2026 pré-calibrado ou prefere selecionar
          livremente as 12 escuderias do seu próprio campeonato?
        </p>
      </div>

      {/* Duas Opções de Universo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OPÇÃO A: CAMPEONATO 2026 */}
        <Card
          onClick={() => onSelectUniverse('championship_2026')}
          className={`bg-white transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xs ${
            universeType === 'championship_2026'
              ? 'border-[#E10600] ring-2 ring-red-100 shadow-md'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-neutral-50/50'
          }`}
        >
          {universeType === 'championship_2026' && (
            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center shadow-md">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 text-[#E10600] flex items-center justify-center shadow-xs">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#E10600] uppercase font-bold tracking-wider">
                  Opção A • Grid Padrão
                </span>
                <h3 className="text-xl font-bold text-[#0F172A]">Campeonato 2026</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                O grid oficial da temporada 2026 com as 12 equipes homologadas (Mercedes, Ferrari,
                McLaren, Red Bull, Racing Bulls, Alpine, Audi, Haas, Williams, Aston Martin,
                Andretti e Cadillac), calendário com 24 GPs e regras oficiais do novo regulamento.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Escuderias:</span>
                <strong className="text-[#0F172A]">12 Equipes Oficiais</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Pilotos Titulares:</span>
                <strong className="text-[#0F172A]">24 Pilotos Reais</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Calendário:</span>
                <strong className="text-cyan-700">24 Grandes Prêmios</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Próximo Passo:</span>
                <span className="text-amber-700">Escolha sua Equipe</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OPÇÃO B: CAMPEONATO PERSONALIZADO */}
        <Card
          onClick={() => onSelectUniverse('custom_championship')}
          className={`bg-white transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xs ${
            universeType === 'custom_championship'
              ? 'border-cyan-600 ring-2 ring-cyan-100 shadow-md'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-neutral-50/50'
          }`}
        >
          {universeType === 'custom_championship' && (
            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center shadow-md">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center shadow-xs">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-cyan-700 uppercase font-bold tracking-wider">
                  Opção B • Grid Sob Medida
                </span>
                <h3 className="text-xl font-bold text-[#0F172A]">Campeonato Personalizado</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                Monte seu próprio grid de exatas 12 equipes, escolhidas livremente dentro da base de
                28 escuderias disponíveis do jogo (Porsche, Lamborghini, BYD, Toyota, Lotus, Penske,
                Jordan, Copersucar e outras lendas).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Escuderias:</span>
                <strong className="text-cyan-700">Exatamente 12 Selecionadas</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Base Disponível:</span>
                <strong className="text-[#0F172A]">28 Equipes Históricas & Modernas</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Equipe Própria:</span>
                <strong className="text-emerald-700">Opção "+ Criar Minha Equipe"</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Próximo Passo:</span>
                <span className="text-amber-700">Tela "Monte seu Grid"</span>
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
          className="border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Manager
        </Button>

        <Button
          type="button"
          onClick={onNext}
          className="bg-[#E10600] hover:bg-[#C60500] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-red-200 flex items-center gap-1.5"
        >
          Continuar para{' '}
          {universeType === 'championship_2026' ? 'Escolha da Equipe' : 'Montagem do Grid'}{' '}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
