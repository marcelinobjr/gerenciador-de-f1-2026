import React, { useState } from 'react'
import {
  Trophy,
  Shield,
  PlusCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Building2,
  Users,
  Gauge,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CAR_MODEL_ASSETS } from '@/lib/lobby-assets'
import { formatCurrency } from '@/lib/formatters'
import { GridTeamDefinition, PlayerChosenTeam } from '@/types/career-wizard'

interface StepOfficialTeamSelectionProps {
  officialTeams: GridTeamDefinition[]
  playerTeam: PlayerChosenTeam
  onSelectOfficialTeam: (team: GridTeamDefinition) => void
  onSelectCustomPlaceholder: (customData: {
    name: string
    color: string
    engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
    carDesign?: string
  }) => void
  onNext: () => void
  onBack: () => void
}

export function StepOfficialTeamSelection({
  officialTeams,
  playerTeam,
  onSelectOfficialTeam,
  onSelectCustomPlaceholder,
  onNext,
  onBack,
}: StepOfficialTeamSelectionProps) {
  const [activeTab, setActiveTab] = useState<'official' | 'custom'>(
    playerTeam.isCustom ? 'custom' : 'official',
  )

  // Estado do formulário de equipe própria placeholder
  const [customName, setCustomName] = useState(playerTeam.customName || '')
  const [customEngine, setCustomEngine] = useState<
    'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
  >(playerTeam.customEngine || 'Mercedes')
  const [customColor, setCustomColor] = useState(playerTeam.customColor || '#00A6FB')
  const [selectedCarModel, setSelectedCarModel] = useState<string>(
    playerTeam.customCarDesign || 'Carro1',
  )

  const isCustomValid = customName.trim().length >= 3

  const handleApplyCustom = () => {
    if (!isCustomValid) return
    onSelectCustomPlaceholder({
      name: customName.trim(),
      color: customColor,
      engine: customEngine,
      carDesign: selectedCarModel,
    })
    onNext()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6 sm:py-8 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="text-center space-y-2 pb-4 border-b border-[#1F2733]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] text-xs font-mono font-bold uppercase">
          <Trophy className="w-3.5 h-3.5" /> Etapa 3 // Campeonato 2026
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">Escolha sua Equipe</h2>
        <p className="text-xs sm:text-sm text-[#8B95A7] max-w-2xl mx-auto">
          Comande uma das 12 escuderias oficiais da temporada 2026 com seus pilotos reais ou
          registre uma equipe própria no grid.
        </p>
      </div>

      {/* Tabs: Equipes Oficiais vs "+ Criar Minha Equipe" */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#11161F] border border-[#1F2733] h-12 p-1">
          <TabsTrigger
            value="official"
            className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            12 Equipes Oficiais de 2026
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="data-[state=active]:bg-[#00A6FB] data-[state=active]:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />+ Criar Minha Equipe
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: 12 EQUIPES OFICIAIS */}
        <TabsContent value="official" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {officialTeams.map((team) => {
              const isSelected = !playerTeam.isCustom && playerTeam.teamKey === team.key

              return (
                <Card
                  key={team.key}
                  onClick={() => onSelectOfficialTeam(team)}
                  className={`bg-[#11161F] transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                      ? 'border-[#E10600] ring-2 ring-[#E10600]/30 shadow-xl shadow-[#E10600]/10'
                      : 'border-[#1F2733] hover:border-[#8B95A7]/60'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {team.logoUrl ? (
                          <div className="w-10 h-10 rounded-lg bg-[#0B0E14] border border-[#1F2733] p-1.5 flex items-center justify-center shrink-0">
                            <img
                              src={team.logoUrl}
                              alt={team.name}
                              className="max-w-full max-h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <span
                            className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center font-bold text-xs shadow text-white"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.name.slice(0, 3).toUpperCase()}
                          </span>
                        )}

                        <div>
                          <CardTitle className="text-base font-bold text-[#F5F7FA]">
                            {team.name}
                          </CardTitle>
                          <span className="text-xs font-mono text-[#8B95A7]">
                            {team.country} {team.flag} • Motor {team.engine}
                          </span>
                        </div>
                      </div>

                      {/* Força */}
                      <div className="text-right shrink-0">
                        <div className="flex items-baseline justify-end gap-1 font-mono">
                          <span className="text-2xl font-black text-[#F5F7FA]">
                            {team.strengthRating.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-[#8B95A7]">/10</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono px-1.5 py-0 h-4 border-[#1F2733] text-[#8B95A7]"
                        >
                          Força {team.strength}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs">
                    {/* Situação e Competitividade */}
                    <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733]/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-cyan-400 font-bold uppercase">
                          {team.competitivenessVerdict}
                        </span>
                        <span className="text-[#8B95A7]">
                          Pressão: <strong>{team.boardPressure}</strong>
                        </span>
                      </div>
                      <p className="text-[#F5F7FA] text-[11px] leading-relaxed">
                        {team.currentSituation}
                      </p>
                    </div>

                    {/* Escalação 2026 */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[#8B95A7]">
                        <span>Escalação (2 Titulares + 1 Reserva):</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono">
                        <div className="p-1.5 rounded bg-[#161D29]/70 border border-[#1F2733] flex items-center justify-between">
                          <span className="text-[#F5F7FA] font-bold truncate text-[10px]">
                            {team.driver1.flag} {team.driver1.name}
                          </span>
                          <span className="text-cyan-400 text-[10px] ml-1 shrink-0">
                            {team.driver1.speed} VEL
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-[#161D29]/70 border border-[#1F2733] flex items-center justify-between">
                          <span className="text-[#F5F7FA] font-bold truncate text-[10px]">
                            {team.driver2.flag} {team.driver2.name}
                          </span>
                          <span className="text-cyan-400 text-[10px] ml-1 shrink-0">
                            {team.driver2.speed} VEL
                          </span>
                        </div>
                      </div>
                      <div className="p-1 rounded bg-[#161D29]/40 border border-[#1F2733]/60 flex items-center justify-between font-mono text-[10px]">
                        <span className="text-amber-400 font-bold truncate">
                          Reserva: {team.reserveDriver.flag} {team.reserveDriver.name}
                        </span>
                        <span className="text-[#8B95A7]">
                          {team.reserveDriver.speed} VEL • 2 FPs/ano
                        </span>
                      </div>
                    </div>

                    {/* Orçamento e Objetivo */}
                    <div className="flex justify-between items-center pt-1 font-mono text-xs text-[#8B95A7] border-t border-[#1F2733]/60">
                      <span>Orçamento Base:</span>
                      <strong className="text-emerald-400">{formatCurrency(team.budget)}</strong>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 border-t border-[#1F2733]/60">
                    <Button
                      type="button"
                      onClick={() => onSelectOfficialTeam(team)}
                      className={`w-full text-xs h-8 font-bold transition-colors ${
                        isSelected
                          ? 'bg-[#E10600] text-white hover:bg-[#FF2E25]'
                          : 'bg-[#161D29] hover:bg-[#E10600] text-[#F5F7FA] hover:text-white border border-[#1F2733]'
                      }`}
                    >
                      {isSelected ? 'Equipe Selecionada' : `Assumir ${team.shortName}`}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* TAB 2: CRIAR MINHA EQUIPE (+ Placeholder Funcional) */}
        <TabsContent value="custom" className="space-y-6 pt-4">
          <Card className="bg-[#11161F] border-[#1F2733] max-w-2xl mx-auto shadow-xl">
            <CardHeader>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#00A6FB]/10 border border-[#00A6FB]/30 text-[#00A6FB] text-xs font-mono font-bold uppercase w-fit">
                <Sparkles className="w-3.5 h-3.5" /> Equipe Própria Estreante
              </div>
              <CardTitle className="text-xl font-bold text-[#F5F7FA]">
                Placeholder Funcional de Equipe Personalizada
              </CardTitle>
              <p className="text-xs text-[#8B95A7]">
                Configure sua escuderia para ingressar no campeonato. A customização visual avançada
                (livery detalhada) será expandida em etapa posterior.
              </p>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Nome */}
              <div className="space-y-2">
                <Label
                  htmlFor="customTeamName"
                  className="text-xs font-mono uppercase text-[#8B95A7]"
                >
                  Nome da Nova Escuderia *
                </Label>
                <Input
                  id="customTeamName"
                  placeholder="Ex: Escuderia Brasil, Andretti Global..."
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-[#0B0E14] border-[#1F2733] text-[#F5F7FA] text-sm focus-visible:ring-[#00A6FB]"
                />
              </div>

              {/* Cor Principal */}
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-[#8B95A7]">
                  Cor Principal da Identidade
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer bg-transparent border border-[#1F2733] p-1"
                  />
                  <span className="font-mono text-xs text-[#8B95A7]">{customColor}</span>
                  <div
                    className="px-3 py-1 rounded text-xs font-bold text-white shadow"
                    style={{ backgroundColor: customColor }}
                  >
                    {customName || 'Sua Equipe'}
                  </div>
                </div>
              </div>

              {/* Escolha do Modelo de Carro (Carro1 a Carro5 preparados no Dropbox) */}
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-[#8B95A7]">
                  Design Conceitual do Monoposto (Carro 1 a 5)
                </Label>
                <div className="grid grid-cols-5 gap-2">
                  {CAR_MODEL_ASSETS.map((car) => {
                    const isCarSelected = selectedCarModel === car.id
                    return (
                      <button
                        type="button"
                        key={car.id}
                        onClick={() => setSelectedCarModel(car.id)}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          isCarSelected
                            ? 'border-[#00A6FB] bg-[#00A6FB]/20 text-white shadow-md'
                            : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#8B95A7]/60'
                        }`}
                      >
                        <span className="text-xs font-bold block">{car.id}</span>
                        <span className="text-[9px] font-mono block text-[#8B95A7]">Conceito</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Fornecedor de Motor */}
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-[#8B95A7]">
                  Unidade de Potência 50/50 Híbrida
                </Label>
                <RadioGroup
                  value={customEngine}
                  onValueChange={(val) => setCustomEngine(val as any)}
                  className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                >
                  {ENGINE_SUPPLIERS.map((eng) => (
                    <div
                      key={eng.name}
                      onClick={() => setCustomEngine(eng.name)}
                      className={`p-2.5 rounded-lg border cursor-pointer text-xs ${
                        customEngine === eng.name
                          ? 'border-[#00A6FB] bg-[#00A6FB]/10 text-white'
                          : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-[#F5F7FA]">{eng.name}</strong>
                        <RadioGroupItem value={eng.name} id={eng.name} />
                      </div>
                      <span className="text-[10px] font-mono text-[#8B95A7] block mt-1">
                        {eng.power} Potência • {eng.reliability}% Conf.
                      </span>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Aviso Estreante */}
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono space-y-1 text-[#8B95A7]">
                <div className="text-amber-400 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Condições da Estreante:
                </div>
                <p>
                  Orçamento inicial de R$ 135M • Força inicial 35 • Contratação de pilotos
                  pós-início.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleApplyCustom}
                disabled={!isCustomValid}
                className="w-full bg-[#00A6FB] hover:bg-[#0090DA] text-white font-bold h-10 shadow-lg shadow-[#00A6FB]/25"
              >
                Definir e Selecionar Equipe Própria
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Barra de Navegação */}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Universo
        </Button>

        <Button
          type="button"
          onClick={onNext}
          disabled={!playerTeam.teamKey && !playerTeam.isCustom}
          className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-[#E10600]/25 flex items-center gap-1.5"
        >
          Continuar para Configurações <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
