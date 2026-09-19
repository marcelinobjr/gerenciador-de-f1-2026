import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Wrench,
  Radio,
  Fuel,
  Disc,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Flame,
  Zap,
} from 'lucide-react'
import type { SimDriverEntry } from '@/pages/race/types'
import type { DriverModel } from '@/types/f1'
import { DriverPoster } from '@/components/DriverPoster'
import { TIRE_SPECS, isTireInCliff } from '@/lib/f1-tire-system'
import type { LiveTacticalMode } from '@/pages/race/RaceOperationsCockpit'
import type { LivePaceOrder } from '@/components/race/LiveTelemetryTable'

interface DriverLiveOperationsPanelProps {
  slotNumber: 1 | 2
  driver: DriverModel | null
  car: SimDriverEntry | null
  totalLaps: number
  tacticalMode: LiveTacticalMode
  paceOrder: LivePaceOrder
  onChangeTacticalMode: (driverId: string, mode: LiveTacticalMode) => void
  onChangePaceOrder: (driverId: string, order: LivePaceOrder) => void
  onCallBox: (driverId: string) => void
  onOpenRadio: (driverId: string) => void
  mechanicalIssues: Array<{
    driverId: string
    name: string
    severity: 'minor' | 'moderate' | 'severe'
    isDnf?: boolean
  }>
  partsCondition?: Array<{
    id: string
    name: string
    condition: number
  }>
}

export const DriverLiveOperationsPanel: React.FC<DriverLiveOperationsPanelProps> = ({
  slotNumber,
  driver,
  car,
  totalLaps,
  tacticalMode,
  paceOrder,
  onChangeTacticalMode,
  onChangePaceOrder,
  onCallBox,
  onOpenRadio,
  mechanicalIssues,
  partsCondition = [],
}) => {
  if (!car || !driver) {
    return (
      <Card className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 text-center text-slate-500">
        <p className="font-semibold text-slate-700">Carro {slotNumber} — Não escalado</p>
        <p className="text-xs mt-1">Nenhum piloto configurado para esta vaga.</p>
      </Card>
    )
  }

  // 1. Dados Básicos do Piloto
  const driverNumber = (driver as any).driver_number || (slotNumber === 1 ? 16 : 55)
  const driverName = car.driverName || driver.name
  const position = car.position || 0
  const gapFront = car.gapToFront || '—'
  const lastLap =
    car.lastLapTime || (car.lastLapTimeSec ? `${car.lastLapTimeSec.toFixed(3)}s` : '—')

  // 2. Pneus
  const compound = car.tireCompound || 'medio'
  const compSpec = TIRE_SPECS[compound] || TIRE_SPECS.medio
  const lapsOnTire = car.lapsOnCurrentTire || 0
  const tireWearPct = Math.min(100, Math.max(0, car.tireWear || 5)) // Desgaste 0 -> 100
  const tireConditionRemainingPct = Math.max(0, 100 - tireWearPct) // Condição restante 100 -> 0

  const cliffInfo = isTireInCliff(compound, lapsOnTire, car.wearMultiplier || 1.0, 6)
  const isInCliff =
    cliffInfo.inCliff || Boolean(car.cliffStatus && car.cliffStatus.isCliffReached > 0)

  // 3. Combustível
  const fuelPct = Math.max(0, car.fuelRemaining !== undefined ? Math.round(car.fuelRemaining) : 100)
  // Carga estimada em kg (tanque padrão F1 2026 ~100-110kg)
  const fuelKg = ((fuelPct / 100) * 105).toFixed(1)
  const currentLap =
    car.lapsOnCurrentTire !== undefined
      ? Math.max(1, position > 0 ? totalLaps - Math.round(totalLaps * (fuelPct / 100)) : 1)
      : 1
  const lapsRemaining = Math.max(0, totalLaps - currentLap)
  // Consumo por volta conforme modo tático
  const fuelBurnRate =
    tacticalMode === 'attack' || paceOrder === 'empurrar'
      ? 2.15
      : tacticalMode === 'save_fuel' || paceOrder === 'segurar'
        ? 1.4
        : 1.75
  const neededFuelPct = lapsRemaining * fuelBurnRate
  const fuelMarginPct = fuelPct - neededFuelPct
  const isFuelCritical = fuelMarginPct < -3.0

  // 4. Carro / Dano / Integridade
  const driverIssues = mechanicalIssues.filter((iss) => iss.driverId === car.driverId && !iss.isDnf)
  const hasWingDmg = Boolean(car.hasWingDamage)
  // Identificar peças críticas (condição < 40%)
  const brokenParts = partsCondition.filter((p) => p.condition < 40)
  const avgPartCondition =
    partsCondition.length > 0
      ? Math.round(partsCondition.reduce((acc, p) => acc + p.condition, 0) / partsCondition.length)
      : 88

  return (
    <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
      {/* Cabeçalho do Piloto com Foto, Nome e Posição */}
      <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Foto/Pôster do Piloto */}
          <div className="w-11 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-xs relative">
            <DriverPoster
              name={driverName}
              driverId={car.driverId}
              className="w-full h-full object-cover object-top"
            />
            <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white font-mono text-[9px] font-black px-1 rounded-tl">
              #{driverNumber}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-900 text-white font-mono text-[10px] px-1.5 py-0 uppercase">
                Carro {slotNumber}
              </Badge>
              <span className="font-mono text-xs text-slate-500 font-bold">#{driverNumber}</span>
            </div>
            <CardTitle className="text-sm font-bold text-slate-900 mt-0.5 leading-tight">
              {driverName}
            </CardTitle>
            <p className="text-[10px] text-slate-500 font-medium truncate">{car.teamName}</p>
          </div>
        </div>

        {/* Posição e Intervalo */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Pos</span>
            <span className="font-mono text-lg font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {car.dnf ? 'DNF' : `P${position}`}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5 space-x-1">
            <span>
              Frente: <strong className="text-slate-800">{gapFront}</strong>
            </span>
            <span>·</span>
            <span>
              Volta: <strong className="text-slate-800">{lastLap}</strong>
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 flex-1 text-xs">
        {/* SEÇÃO 1: PNEUS (Composto, Voltas, Condição Restante vs Desgaste) */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[11px]">
              <Disc className="w-3.5 h-3.5 text-amber-500" />
              Pneus: {compSpec.name} ({compound.toUpperCase()})
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {lapsOnTire} voltas de uso
            </span>
          </div>

          {/* Dupla barra: Condição Restante e Desgaste Acumulado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">Condição Restante:</span>
              <span
                className={`font-mono font-bold ${
                  tireConditionRemainingPct < 25
                    ? 'text-red-600'
                    : tireConditionRemainingPct < 50
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                }`}
              >
                {tireConditionRemainingPct}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  tireConditionRemainingPct < 25
                    ? 'bg-red-500'
                    : tireConditionRemainingPct < 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${tireConditionRemainingPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>
                Desgaste Acumulado: <strong className="text-slate-700">{tireWearPct}%</strong>
              </span>
              {isInCliff ? (
                <Badge className="bg-red-600 text-white font-mono text-[9px] px-1.5 py-0 animate-pulse">
                  CLIFF ATINGIDO
                </Badge>
              ) : tireWearPct > 70 ? (
                <span className="text-amber-600 font-bold">Desgaste Elevado</span>
              ) : (
                <span className="text-emerald-700">Faixa Segura</span>
              )}
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: COMBUSTÍVEL (kg, %, margem projetada estimada e alertas) */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[11px]">
              <Fuel className="w-3.5 h-3.5 text-cyan-600" />
              Combustível a Bordo
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-700">
              {fuelKg} kg ({fuelPct}%)
            </span>
          </div>

          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                fuelPct < 15 ? 'bg-red-500' : fuelPct < 35 ? 'bg-amber-500' : 'bg-cyan-600'
              }`}
              style={{ width: `${fuelPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help flex items-center gap-1">
                    Margem projetada:
                    <strong
                      className={fuelMarginPct >= 0 ? 'text-emerald-600' : 'text-red-600 font-bold'}
                    >
                      {fuelMarginPct >= 0
                        ? `+${fuelMarginPct.toFixed(1)}%`
                        : `${fuelMarginPct.toFixed(1)}%`}
                    </strong>
                    <span className="text-[9px] text-slate-400">(est.)</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs bg-slate-900 text-white max-w-[220px]">
                  Estimativa considerando consumo médio e voltas restantes para completar o GP.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isFuelCritical ? (
              <Badge className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> ECONOMIZAR
              </Badge>
            ) : fuelMarginPct < 2.0 ? (
              <span className="text-amber-600 font-medium">Margem Justa</span>
            ) : (
              <span className="text-emerald-700 font-medium">Carga Suficiente</span>
            )}
          </div>
        </div>

        {/* SEÇÃO 3: CONDIÇÃO DO CARRO / PROBLEMAS TÉCNICOS */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
              Condição & Integridade Técnica
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-600">
              Integridade {avgPartCondition}%
            </span>
          </div>

          {/* Status real do carro: detecta danos e problemas reais */}
          {hasWingDmg || driverIssues.length > 0 || brokenParts.length > 0 ? (
            <div className="space-y-1.5 pt-0.5">
              {hasWingDmg && (
                <div className="p-1.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[11px] flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Asa Dianteira com Danos
                  </span>
                  <Badge className="bg-amber-600 text-white text-[9px] px-1 py-0">
                    Reparo no Box
                  </Badge>
                </div>
              )}

              {driverIssues.map((iss, iIdx) => (
                <div
                  key={iIdx}
                  className="p-1.5 rounded bg-red-50 border border-red-300 text-red-800 text-[11px] flex items-center justify-between"
                >
                  <span className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    {iss.name} ({iss.severity})
                  </span>
                  <span className="text-[10px] font-bold text-red-700">Falha Mecânica</span>
                </div>
              ))}

              {brokenParts.map((bp) => (
                <div
                  key={bp.id}
                  className="p-1.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] flex items-center justify-between"
                >
                  <span>
                    Peça: <strong>{bp.name}</strong>
                  </span>
                  <span className="font-mono font-bold text-red-600">
                    {bp.condition}% integridade
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sem problemas detectados no carro até o momento.</span>
            </div>
          )}
        </div>

        {/* SEÇÃO 4: CONTROLE DE RITMO & TÁTICA DO PILOTO */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span>Ordem de Ritmo:</span>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => onChangePaceOrder(car.driverId, 'segurar')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  paceOrder === 'segurar'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Segurar
              </button>
              <button
                type="button"
                onClick={() => onChangePaceOrder(car.driverId, 'normal')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  paceOrder === 'normal'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => onChangePaceOrder(car.driverId, 'empurrar')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  paceOrder === 'empurrar'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Empurrar
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span>Modo Tático:</span>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => onChangeTacticalMode(car.driverId, 'attack')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  tacticalMode === 'attack'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ataque
              </button>
              <button
                type="button"
                onClick={() => onChangeTacticalMode(car.driverId, 'normal')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  tacticalMode === 'normal'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Padrão
              </button>
              <button
                type="button"
                onClick={() => onChangeTacticalMode(car.driverId, 'save_fuel')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  tacticalMode === 'save_fuel'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Eco
              </button>
            </div>
          </div>
        </div>

        {/* SEÇÃO 5: BOTÕES DE OPERAÇÃO RÁPIDA (RÁDIO + CHAMAR BOXES) */}
        <div className="pt-2 grid grid-cols-2 gap-2 border-t border-slate-200">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenRadio(car.driverId)}
            className="border-slate-300 text-slate-800 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 h-8.5"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            Rádio Pit Wall
          </Button>

          <Button
            size="sm"
            onClick={() => onCallBox(car.driverId)}
            disabled={car.dnf}
            className="bg-[#E10600] hover:bg-[#C10500] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 h-8.5 shadow-sm"
          >
            <Wrench className="w-3.5 h-3.5" />
            Box Este Giro
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
