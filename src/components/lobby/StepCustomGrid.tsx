import React, { useState } from 'react'
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Trophy,
  Users,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CAR_MODEL_ASSETS } from '@/lib/lobby-assets'
import { GridTeamDefinition, PlayerChosenTeam } from '@/types/career-wizard'
import { getInitialTeamFacilities } from '@/data/initial-team-facilities'

interface StepCustomGridProps {
  availableDatabaseTeams: GridTeamDefinition[]
  selectedTeams: GridTeamDefinition[]
  playerTeam: PlayerChosenTeam
  onAddTeamToGrid: (team: GridTeamDefinition) => void
  onRemoveTeamFromGrid: (teamKey: string) => void
  onSelectPlayerTeamKey: (teamKey: string) => void
  onSelectCustomPlayerTeam: (customData: {
    name: string
    color: string
    engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
    carDesign?: string
  }) => void
  onNext: () => void
  onBack: () => void
}

export function StepCustomGrid({
  availableDatabaseTeams,
  selectedTeams,
  playerTeam,
  onAddTeamToGrid,
  onRemoveTeamFromGrid,
  onSelectPlayerTeamKey,
  onSelectCustomPlayerTeam,
  onNext,
  onBack,
}: StepCustomGridProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [customTeamModalOpen, setCustomTeamModalOpen] = useState(false)

  // Form de equipe própria placeholder
  const [customName, setCustomName] = useState(playerTeam.customName || '')
  const [customEngine, setCustomEngine] = useState<
    'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
  >(playerTeam.customEngine || 'Mercedes')
  const [customColor, setCustomColor] = useState(playerTeam.customColor || '#00A6FB')
  const [selectedCarModel, setSelectedCarModel] = useState<string>(
    playerTeam.customCarDesign || 'Carro1',
  )
  const [customFacilityPreset, setCustomFacilityPreset] = useState<
    'balanceada' | 'aerodinamica' | 'fabrica'
  >('balanceada')

  const isCustomValid = customName.trim().length >= 3

  const handleConfirmCustomModal = () => {
    if (!isCustomValid) return
    onSelectCustomPlayerTeam({
      name: customName.trim(),
      color: customColor,
      engine: customEngine,
      carDesign: selectedCarModel,
    })
    setCustomTeamModalOpen(false)
  }

  // Filtragem de busca
  const filteredAvailable = availableDatabaseTeams.filter((t) => {
    const isAlreadySelected = selectedTeams.some((s) => s.key === t.key)
    if (isAlreadySelected) return false
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      t.name.toLowerCase().includes(term) ||
      t.country.toLowerCase().includes(term) ||
      t.engine.toLowerCase().includes(term)
    )
  })

  // Regra estrita: exatamente 12 equipes
  const isGridComplete = selectedTeams.length === 12
  const hasPlayerTeamSelected =
    playerTeam.isCustom ||
    (playerTeam.teamKey && selectedTeams.some((t) => t.key === playerTeam.teamKey))

  const canContinue = isGridComplete && hasPlayerTeamSelected

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6 sm:py-8 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="text-center space-y-2 pb-4 border-b border-[#E2E8F0]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-mono font-bold uppercase">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Etapa 3 // Monte seu Grid
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
          Monte seu Campeonato Sob Medida
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-3xl mx-auto">
          Adicione e remova escuderias da base de 28 equipes até totalizar{' '}
          <strong className="text-cyan-700">exatamente 12 equipes</strong>. Em seguida, marque qual
          delas você comandará ou use{' '}
          <strong className="text-emerald-700">+ Criar Minha Equipe</strong>.
        </p>
      </div>

      {/* Barra de Status do Grid (Contador X/12) */}
      <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm ${
              isGridComplete
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
            }`}
          >
            {selectedTeams.length}/12
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-[#0F172A] uppercase flex items-center gap-2">
              <span>Seu Grid: {selectedTeams.length} de 12 equipes</span>
              {isGridComplete ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                  Grid Completo
                </Badge>
              ) : selectedTeams.length < 12 ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]"
                >
                  Faltam {12 - selectedTeams.length}
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  Excedeu o limite (+{selectedTeams.length - 12})
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-[#64748B]">
              {isGridComplete
                ? 'Grid válido! Agora escolha qual das equipes você comandará abaixo.'
                : 'O botão de continuar só é liberado com EXATAMENTE 12 equipes e uma equipe do jogador selecionada.'}
            </p>
          </div>
        </div>

        {/* Botão de Criar Minha Equipe */}
        <Button
          type="button"
          onClick={() => setCustomTeamModalOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-9 shadow-md flex items-center gap-1.5 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> + Criar Minha Equipe
        </Button>
      </div>

      {/* Layout de Duas Colunas: Equipes Disponíveis (Esquerda) vs Seu Campeonato (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA 1: Equipes Disponíveis (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-mono flex items-center gap-2">
              <Trophy className="w-4 h-4 text-cyan-600" /> Base Disponível (
              {filteredAvailable.length})
            </h3>
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
            <Input
              placeholder="Buscar equipe, país ou motor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border-[#CBD5E1] pl-9 text-xs text-[#0F172A] h-9"
            />
          </div>

          {/* Lista com Scroll */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredAvailable.map((team) => (
              <div
                key={team.key}
                className="p-3 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all flex items-center justify-between gap-3 text-xs shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {team.logoUrl ? (
                    <div className="w-8 h-8 rounded bg-[#F8FAFC] border border-[#E2E8F0] p-1 flex items-center justify-center shrink-0">
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        className="max-w-full max-h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <span
                      className="w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-[10px] text-white"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.slice(0, 3).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0">
                    <p className="font-bold text-[#0F172A] truncate">{team.name}</p>
                    <p className="text-[10px] font-mono text-[#64748B]">
                      {team.country} {team.flag} • Motor {team.engine} • Nota {team.strengthRating}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedTeams.length >= 12}
                  onClick={() => onAddTeamToGrid(team)}
                  className="border-[#CBD5E1] text-cyan-700 hover:text-white hover:bg-cyan-600 h-7 px-2.5 text-xs shrink-0 bg-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                </Button>
              </div>
            ))}

            {filteredAvailable.length === 0 && (
              <div className="p-6 text-center text-xs text-[#64748B] border border-dashed border-[#CBD5E1] bg-white rounded-lg">
                Nenhuma equipe disponível encontrada com esse filtro.
              </div>
            )}
          </div>
        </div>

        {/* COLUNA 2: Seu Campeonato (12 Equipes) (7 colunas) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" /> Seu Campeonato ({selectedTeams.length}
              /12)
            </h3>
            <span className="text-[11px] font-mono text-[#64748B]">
              Marque o rádio da equipe que você comandará
            </span>
          </div>

          {/* Equipe própria placeholder se estiver ativa */}
          {playerTeam.isCustom && (
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-300 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow"
                  style={{ backgroundColor: playerTeam.customColor || '#00A6FB' }}
                >
                  PRÓPRIA
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-[#0F172A] text-sm">
                      {playerTeam.customName || 'Minha Escuderia'}
                    </strong>
                    <Badge className="bg-[#00A6FB] text-white text-[9px] py-0 px-1.5">
                      SUA EQUIPE
                    </Badge>
                  </div>
                  <p className="text-[10px] font-mono text-[#64748B]">
                    Motor {playerTeam.customEngine} • Modelo{' '}
                    {playerTeam.customCarDesign || 'Carro1'}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCustomTeamModalOpen(true)}
                className="text-xs text-cyan-700 hover:text-cyan-800 h-8"
              >
                Editar
              </Button>
            </div>
          )}

          {/* Lista das equipes escolhidas */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {selectedTeams.map((team, idx) => {
              const isPlayerChosen = !playerTeam.isCustom && playerTeam.teamKey === team.key

              return (
                <div
                  key={team.key}
                  onClick={() => onSelectPlayerTeamKey(team.key)}
                  className={`p-3 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 text-xs shadow-xs ${
                    isPlayerChosen
                      ? 'bg-red-50/70 border-2 border-[#E10600] shadow-md shadow-red-100'
                      : 'bg-white border border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono text-[#64748B] w-4 text-center">
                      {idx + 1}
                    </span>

                    {/* Radio visual */}
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isPlayerChosen
                          ? 'border-[#E10600] bg-[#E10600]'
                          : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {isPlayerChosen && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    {team.logoUrl ? (
                      <div className="w-8 h-8 rounded bg-[#F8FAFC] border border-[#E2E8F0] p-1 flex items-center justify-center shrink-0">
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <span
                        className="w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-[10px] text-white"
                        style={{ backgroundColor: team.color }}
                      >
                        {team.name.slice(0, 3).toUpperCase()}
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#0F172A] truncate">{team.name}</strong>
                        {isPlayerChosen && (
                          <Badge className="bg-[#E10600] text-white text-[9px] py-0 px-1.5">
                            SUA EQUIPE
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#64748B]">
                        {team.country} {team.flag} • Motor {team.engine} • Nota{' '}
                        {team.strengthRating}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveTeamFromGrid(team.key)
                      }}
                      className="text-[#64748B] hover:text-rose-600 hover:bg-rose-50 h-7 w-7 p-0"
                      title="Remover do campeonato"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {selectedTeams.length === 0 && (
              <div className="p-8 text-center text-xs text-[#64748B] border border-dashed border-[#CBD5E1] bg-white rounded-lg space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                <p>Nenhuma equipe adicionada ao campeonato ainda.</p>
                <p className="text-[11px]">
                  Clique em <strong>+ Adicionar</strong> nas equipes da coluna esquerda até
                  totalizar 12 escuderias.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal "+ Criar Minha Equipe" (Placeholder Funcional) */}
      <Dialog open={customTeamModalOpen} onOpenChange={setCustomTeamModalOpen}>
        <DialogContent className="bg-white border-[#E2E8F0] text-[#0F172A] max-w-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#0F172A]">
              <Sparkles className="w-5 h-5 text-cyan-600" /> Criar Minha Equipe Própria
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Configure o placeholder funcional da sua escuderia para este campeonato personalizado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-mono uppercase text-[#64748B]">
                Nome da Escuderia *
              </Label>
              <Input
                placeholder="Ex: Escuderia Brasil, Lotus F1..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-white border-[#CBD5E1] text-xs text-[#0F172A]"
              />
            </div>

            {/* Cor */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-mono uppercase text-[#64748B]">
                Cor da Identidade
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-10 h-8 rounded bg-white border border-[#CBD5E1] cursor-pointer p-0.5"
                />
                <span className="font-mono text-xs text-[#64748B]">{customColor}</span>
              </div>
            </div>

            {/* Modelo do Carro */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-mono uppercase text-[#64748B]">
                Design do Monoposto (Carro 1 a 5)
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {CAR_MODEL_ASSETS.map((car) => (
                  <button
                    type="button"
                    key={car.id}
                    onClick={() => setSelectedCarModel(car.id)}
                    className={`p-2 rounded border text-center text-xs font-bold transition-all ${
                      selectedCarModel === car.id
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-700 shadow-xs'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'
                    }`}
                  >
                    {car.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Motor */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-mono uppercase text-[#64748B]">
                Fornecedor de Motor 50/50
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {ENGINE_SUPPLIERS.map((eng) => (
                  <button
                    type="button"
                    key={eng.name}
                    onClick={() => setCustomEngine(eng.name)}
                    className={`p-2 rounded border text-center text-xs font-bold transition-all ${
                      customEngine === eng.name
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-700 shadow-xs'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'
                    }`}
                  >
                    {eng.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCustomTeamModalOpen(false)}
              className="border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmCustomModal}
              disabled={!isCustomValid}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
            >
              Confirmar Minha Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barra de Navegação */}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Universo
        </Button>

        <Button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="bg-[#E10600] hover:bg-[#C60500] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-red-200 flex items-center gap-1.5"
        >
          Continuar para Configurações <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
