import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { getCountryFlag } from '@/lib/country-flags'
import {
  PRACTICE_PROGRAMS,
  type PracticeCarPreparation,
  type PracticeProgramType,
  type PracticeCarValidation,
} from '@/types/practice-preparation'
import { calculateEstimatedLaps, calculateKgFromLaps } from '@/services/practicePreparationService'
import type { DriverModel, TireSetItem, TireCompound } from '@/types/f1'
import { formatTireName } from '@/lib/f1-tire-system'
import {
  Car,
  Fuel,
  Disc,
  Sliders,
  Copy,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Target,
  Sparkles,
} from 'lucide-react'

interface PracticeCarPanelProps {
  carNumber: 1 | 2
  carPrep: PracticeCarPreparation
  driver?: DriverModel
  teamName: string
  teamColor: string
  carImageUrl?: string | null
  availableTires: TireSetItem[]
  validation: PracticeCarValidation
  inheritedKnowledge?: import('@/types/practice-session').SetupKnowledgeModel
  onUpdateProgram: (program: PracticeProgramType) => void
  onSelectTyre: (tire: TireSetItem) => void
  onUpdateFuelKg: (kg: number) => void
  onUpdateSetupParam: (
    param: 'frontWing' | 'rearWing' | 'suspension' | 'differential',
    value: number,
  ) => void
  onCopySetupFromOtherCar: () => void
  otherCarNumber: 1 | 2
}

export function PracticeCarPanel({
  carNumber,
  carPrep,
  driver,
  teamName,
  teamColor,
  carImageUrl,
  availableTires,
  validation,
  onUpdateProgram,
  onSelectTyre,
  onUpdateFuelKg,
  onUpdateSetupParam,
  inheritedKnowledge,
  onCopySetupFromOtherCar,
  otherCarNumber,
}: PracticeCarPanelProps) {
  const currentProgramMeta = PRACTICE_PROGRAMS[carPrep.program]

  // Contagem de jogos disponíveis por composto no estoque deste piloto
  const countByCompound = availableTires.reduce<Record<TireCompound, number>>(
    (acc, t) => {
      acc[t.compound] = (acc[t.compound] || 0) + 1
      return acc
    },
    { duro: 0, medio: 0, macio: 0, intermediario: 0, chuva_extrema: 0 },
  )

  const selectedTyre = availableTires.find((t) => t.id === carPrep.tyreSelection?.setId)

  return (
    <Card className="relative z-10 flex flex-col bg-[#090D15]/90 border border-[#1A2333] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Top Banner do Carro */}
      <div
        className="px-5 py-4 border-b border-[#1A2333] flex flex-wrap items-center justify-between gap-3"
        style={{
          background: `linear-gradient(90deg, ${teamColor}15 0%, rgba(9, 13, 21, 0.95) 70%)`,
          borderLeft: `4px solid ${teamColor}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0F1622] border border-[#232F42] flex items-center justify-center font-black font-mono text-sm text-white shadow-inner">
            C{carNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#8B95A7]">
                MONOPOSTO 0{carNumber}
              </span>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] font-bold ${
                  validation.valid
                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                    : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                }`}
              >
                {validation.valid ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> PRONTO
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> PENDENTE
                  </span>
                )}
              </Badge>
            </div>
            <h3 className="text-base font-black text-white font-mono tracking-tight">
              CARRO {carNumber} — {teamName.toUpperCase()}
            </h3>
          </div>
        </div>

        {/* Botão de Copiar Setup */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopySetupFromOtherCar}
            title={`Copiar os 4 parâmetros de setup mecânico/aerodinâmico do Carro ${otherCarNumber}`}
            className="border-[#232F42] bg-[#0E1521] hover:bg-[#162133] text-xs font-mono text-[#BAC4D6] hover:text-white flex items-center gap-1.5 h-8"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            Copiar Setup (Carro {otherCarNumber} → {carNumber})
          </Button>

          {/* Botão Carregar Setup (desabilitado conforme especificação: sem biblioteca nesta etapa) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Biblioteca de setups disponível em etapas futuras"
            className="border-[#1A2333] bg-[#0B0F17] text-xs font-mono text-[#525E75] cursor-not-allowed opacity-60 h-8 flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Carregar Setup
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1 flex flex-col justify-between">
        {/* Bloco 1: Piloto Escalado Real */}
        <div className="p-4 rounded-xl bg-[#0E1420]/80 border border-[#1A2333] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="relative shrink-0">
              <DriverPhotoAvatar
                name={driver?.name || `Piloto ${carNumber}`}
                driverId={driver?.id}
                size="md"
                className="w-14 h-14 rounded-xl border-2 border-[#232F42] shadow-md object-cover"
              />
              <span className="absolute -bottom-1 -right-1 text-base leading-none">
                {getCountryFlag(driver?.nationality)}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00A6FB]">
                  PILOTO TITULAR
                </span>
                <span className="text-xs font-mono font-bold text-[#8B95A7]">
                  #{driver?.age ? (carNumber === 1 ? '1' : '2') : carNumber}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-white font-mono truncate">
                {driver?.name || 'Piloto Não Escalado'}
              </h4>
              <p className="text-xs text-[#8B95A7] font-mono truncate">
                {driver?.nationality || 'Nacionalidade'} • {teamName}
              </p>
            </div>
          </div>

          {/* Miniatura do Monoposto real se disponível */}
          {carImageUrl && (
            <div className="hidden md:flex flex-col items-end shrink-0">
              <span className="text-[9px] font-mono text-[#525E75] uppercase tracking-wider">
                CHASSI 2026
              </span>
              <img
                src={carImageUrl}
                alt={`Carro ${teamName}`}
                className="h-10 object-contain drop-shadow"
              />
            </div>
          )}
        </div>

        {/* Bloco 2: a) Programa de Treino */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-[#8B95A7] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              a) Programa de Treino
            </label>
            <span className="text-[10px] font-mono text-[#00A6FB]">
              Meta de voltas: ~{currentProgramMeta.lapsTarget}v
            </span>
          </div>

          <Select
            value={carPrep.program}
            onValueChange={(val) => onUpdateProgram(val as PracticeProgramType)}
          >
            <SelectTrigger className="w-full bg-[#0E1521] border-[#1F2B3E] text-white font-mono text-xs h-10">
              <SelectValue placeholder="Selecione o programa de treino" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A0E17] border-[#1F2B3E] text-white font-mono text-xs">
              {(Object.keys(PRACTICE_PROGRAMS) as PracticeProgramType[]).map((key) => {
                const prog = PRACTICE_PROGRAMS[key]
                return (
                  <SelectItem key={key} value={key} className="focus:bg-[#162133] focus:text-white">
                    <div className="flex flex-col py-0.5">
                      <span className="font-bold text-white">{prog.title}</span>
                      <span className="text-[10px] text-[#8B95A7]">{prog.subtitle}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {/* Card Objetivo da Sessão derivado automaticamente (sem texto livre) */}
          <div className="p-3 rounded-xl bg-[#090D15] border border-[#162133] text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#8B95A7]">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Objetivo da Sessão (Derivado do Programa)
            </div>
            <p className="text-[#CFD6E4] text-[11px] leading-relaxed">
              {currentProgramMeta.objective}
            </p>
            <p className="text-[10px] text-[#525E75] italic">{currentProgramMeta.description}</p>
          </div>
        </div>

        {/* Bloco 3: b) Pneus — Seleção a partir do estoque REAL do piloto */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-[#8B95A7] flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-amber-400" />
              b) Pneus — Estoque Real do Piloto ({availableTires.length} jogos disponíveis)
            </label>
            {carPrep.tyreSelection && (
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                ✓ Reservado (Não debitado)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { compound: 'macio' as TireCompound, label: 'Macio (C4)', dot: 'bg-red-500' },
              { compound: 'medio' as TireCompound, label: 'Médio (C3)', dot: 'bg-yellow-400' },
              { compound: 'duro' as TireCompound, label: 'Duro (C1)', dot: 'bg-white' },
              {
                compound: 'intermediario' as TireCompound,
                label: 'Inter (Verde)',
                dot: 'bg-emerald-400',
              },
              {
                compound: 'chuva_extrema' as TireCompound,
                label: 'Chuva (Azul)',
                dot: 'bg-blue-500',
              },
            ].map((compDef) => {
              const qty = countByCompound[compDef.compound] || 0
              const isSelected = carPrep.tyreSelection?.compound === compDef.compound
              const disabled = qty <= 0

              // Localiza o primeiro jogo livre desse composto
              const freeSet = availableTires.find((t) => t.compound === compDef.compound)

              return (
                <button
                  key={compDef.compound}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (freeSet) onSelectTyre(freeSet)
                  }}
                  className={`p-2.5 rounded-xl border font-mono text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400'
                      : disabled
                        ? 'border-[#141C2A] bg-[#0A0E17]/40 text-[#404B60] cursor-not-allowed opacity-50'
                        : 'border-[#1F2B3E] bg-[#0E1521] text-[#BAC4D6] hover:bg-[#152030] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${compDef.dot}`} />
                    <span className="font-extrabold text-[11px]">
                      {compDef.label.split(' ')[0]}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">
                    {qty} {qty === 1 ? 'jogo' : 'jogos'}
                  </span>
                </button>
              )
            })}
          </div>

          {validation.errors.tyres && (
            <p className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validation.errors.tyres}
            </p>
          )}

          {selectedTyre && (
            <p className="text-[10px] font-mono text-[#8B95A7]">
              Jogo selecionado: <span className="text-white font-bold">{selectedTyre.id}</span> (
              {formatTireName(selectedTyre.compound)} • Desgaste: {selectedTyre.wear}% • Voltas
              usadas: {selectedTyre.lapsUsed})
            </p>
          )}
        </div>

        {/* Bloco 4: c) Combustível — kg com equivalência em voltas estimadas (~1,65 kg/volta) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-[#8B95A7] flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              c) Combustível
            </label>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-sm font-extrabold text-white">{carPrep.fuelLoad.kg} kg</span>
              <span className="text-xs text-[#00A6FB] font-bold">
                (~{carPrep.fuelLoad.estimatedLaps} voltas estimadas)
              </span>
            </div>
          </div>

          <div className="pt-1">
            <Slider
              value={[carPrep.fuelLoad.kg]}
              min={10}
              max={100}
              step={1}
              onValueChange={(val) => onUpdateFuelKg(val[0])}
              className="py-1"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#525E75]">
            <span>10 kg (~6 voltas - Qualy Sim)</span>
            <span>25 kg (~15 voltas - Padrão TL)</span>
            <span>60 kg (~36 voltas - Stint Longo)</span>
            <span>100 kg (Tanque cheio)</span>
          </div>

          {validation.errors.fuel && (
            <p className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validation.errors.fuel}
            </p>
          )}
        </div>

        {/* Bloco 5: d) Setup — 4 parâmetros + Anti-Spoiler Obrigatório */}
        <div className="space-y-3 p-4 rounded-xl bg-[#090D15]/80 border border-[#1A2333]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-[#8B95A7] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              d) Setup Técnico do Monoposto
            </label>
            {/* Anti-spoiler obrigatório: NUNCA mostrar o valor ideal */}
            <Badge
              variant="outline"
              className={`font-mono text-[10px] flex items-center gap-1 ${
                inheritedKnowledge && inheritedKnowledge.totalStintsAnalyzed > 0
                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                  : 'border-[#222E42] text-[#8B95A7] bg-[#0E1521]'
              }`}
              title="A revelação progressiva do acerto ideal é obtida através de feedback dinâmico na pista."
            >
              <HelpCircle className="w-3 h-3 text-[#525E75]" />
              {inheritedKnowledge && inheritedKnowledge.totalStintsAnalyzed > 0
                ? `Faixa conhecida: Asas [${inheritedKnowledge.frontWing.revealed ? `${inheritedKnowledge.frontWing.minKnown}–${inheritedKnowledge.frontWing.maxKnown}` : '?'}] • Susp [${inheritedKnowledge.suspension.revealed ? `${inheritedKnowledge.suspension.minKnown}–${inheritedKnowledge.suspension.maxKnown}` : '?'}]`
                : 'Faixa conhecida: ?'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono">
            {/* 1. Asa Dianteira (1-10) */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0E1521] border border-[#1A2436]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#BAC4D6] font-bold">Asa Dianteira</span>
                <span className="text-white font-extrabold">{carPrep.setup.frontWing} / 10</span>
              </div>
              <Slider
                value={[carPrep.setup.frontWing]}
                min={1}
                max={10}
                step={1}
                onValueChange={(val) => onUpdateSetupParam('frontWing', val[0])}
              />
              <div className="flex justify-between text-[9px] text-[#525E75]">
                <span>1 (Velocidade)</span>
                <span>10 (Pressão máxima)</span>
              </div>
            </div>

            {/* 2. Asa Traseira (1-10) */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0E1521] border border-[#1A2436]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#BAC4D6] font-bold">Asa Traseira</span>
                <span className="text-white font-extrabold">{carPrep.setup.rearWing} / 10</span>
              </div>
              <Slider
                value={[carPrep.setup.rearWing]}
                min={1}
                max={10}
                step={1}
                onValueChange={(val) => onUpdateSetupParam('rearWing', val[0])}
              />
              <div className="flex justify-between text-[9px] text-[#525E75]">
                <span>1 (Menor arrasto)</span>
                <span>10 (Alta sustentação)</span>
              </div>
            </div>

            {/* 3. Suspensão (1-10) */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0E1521] border border-[#1A2436]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#BAC4D6] font-bold">Suspensão</span>
                <span className="text-white font-extrabold">{carPrep.setup.suspension} / 10</span>
              </div>
              <Slider
                value={[carPrep.setup.suspension]}
                min={1}
                max={10}
                step={1}
                onValueChange={(val) => onUpdateSetupParam('suspension', val[0])}
              />
              <div className="flex justify-between text-[9px] text-[#525E75]">
                <span>1 (Macia / Ondulada)</span>
                <span>10 (Rígida / Asfalto liso)</span>
              </div>
            </div>

            {/* 4. Diferencial (20-80%) */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0E1521] border border-[#1A2436]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#BAC4D6] font-bold">Diferencial</span>
                <span className="text-white font-extrabold">{carPrep.setup.differential}%</span>
              </div>
              <Slider
                value={[carPrep.setup.differential]}
                min={20}
                max={80}
                step={1}
                onValueChange={(val) => onUpdateSetupParam('differential', val[0])}
              />
              <div className="flex justify-between text-[9px] text-[#525E75]">
                <span>20% (Aberto / Contorno)</span>
                <span>80% (Bloqueado / Tração)</span>
              </div>
            </div>
          </div>

          {validation.errors.setup && (
            <p className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validation.errors.setup}
            </p>
          )}
        </div>

        {/* Resumo de Validação do Carro */}
        {!validation.valid && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 space-y-1">
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> O que falta para liberar o Carro {carNumber}:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200">
              {Object.values(validation.errors).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
