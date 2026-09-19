import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  RotateCcw,
  Fuel,
  Disc,
  Gauge,
  Activity,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react'
import type { PracticeCarLiveState, PracticeStint } from '@/types/practice-session'
import { PRACTICE_PROGRAMS } from '@/types/practice-preparation'
import { formatTireName } from '@/lib/f1-tire-system'

interface PracticeCarCockpitCardProps {
  car: PracticeCarLiveState
  carNumber: 1 | 2
  teamColor?: string
  carImageUrl?: string
  currentStint?: PracticeStint
  isSessionRunning: boolean
  isSessionCompleted: boolean
  onOrderExitTrack: () => void
  onRequestBox: () => void
}

const TRACK_STATUS_LABELS: Record<
  PracticeCarLiveState['status'],
  { label: string; badgeClass: string }
> = {
  garage: {
    label: 'NA GARAGEM',
    badgeClass: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
  },
  out_lap: {
    label: 'SAINDO DOS BOXES (OUT LAP)',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
  },
  flying_lap: {
    label: 'EM PISTA (VOLTA RÁPIDA)',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-black',
  },
  in_lap: {
    label: 'ENTRANDO NOS BOXES (IN LAP)',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40 animate-pulse',
  },
}

export const PracticeCarCockpitCard: React.FC<PracticeCarCockpitCardProps> = ({
  car,
  carNumber,
  teamColor = '#00A6FB',
  carImageUrl,
  currentStint,
  isSessionRunning,
  isSessionCompleted,
  onOrderExitTrack,
  onRequestBox,
}) => {
  const statusConfig = TRACK_STATUS_LABELS[car.status]
  const programMeta = PRACTICE_PROGRAMS[car.program] || PRACTICE_PROGRAMS.car_setup

  const isCarInGarage = car.status === 'garage'
  const isCarOnTrack = !isCarInGarage

  return (
    <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-4 font-mono">
      {/* 1. TOPO DO CARRO: PILOTO, NÚMERO, CARRO E STATUS ATUAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A2333] pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-black"
            style={{ backgroundColor: teamColor }}
          >
            #{carNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-white">{car.driverName}</h4>
              <Badge className="bg-[#141B26] text-[#BAC4D6] border-[#222E42] text-[10px] py-0 px-1.5 font-bold">
                Carro {carNumber}
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A7]">
              Programa ativo: <span className="text-white font-bold">{programMeta.title}</span>
            </p>
          </div>
        </div>

        {/* STATUS ATUAL («O QUE ESTE CARRO ESTÁ FAZENDO AGORA?») */}
        <div className="flex items-center gap-2">
          <Badge
            className={`text-[10px] font-bold px-2.5 py-1 tracking-wider ${statusConfig.badgeClass}`}
          >
            {statusConfig.label}
          </Badge>
          {car.pitRequested && isCarOnTrack && car.status !== 'in_lap' && (
            <Badge className="bg-amber-600/30 text-amber-300 border-amber-500/50 text-[9px] font-bold animate-pulse">
              Box Solicitado
            </Badge>
          )}
        </div>
      </div>

      {/* 2. BARRA DE PROGRESSO DA FASE DA VOLTA */}
      {isCarOnTrack && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#8B95A7]">
            <span>Progresso no trecho</span>
            <span className="text-cyan-400 font-bold">
              {Math.round(car.currentLapProgressPct || 0)}%
            </span>
          </div>
          <Progress value={car.currentLapProgressPct || 0} className="h-1.5 bg-[#141B26]" />
        </div>
      )}

      {/* 3. QUADRICULADO DE TELEMETRIA BÁSICA E CONSUMO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* Pneu & Desgaste */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
            <span className="flex items-center gap-1">
              <Disc className="w-3 h-3 text-amber-400" />
              Pneu
            </span>
            <span
              className={`font-bold ${
                car.tyreWear >= 70
                  ? 'text-red-400'
                  : car.tyreWear >= 45
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {car.tyreWear}%
            </span>
          </div>
          <div className="text-xs font-bold text-white capitalize">
            {formatTireName(car.currentCompound).split(' ')[0]}
          </div>
          <Progress
            value={car.tyreWear}
            className={`h-1 bg-[#141B26] ${
              car.tyreWear >= 70 ? '[&>div]:bg-red-500' : '[&>div]:bg-cyan-500'
            }`}
          />
        </div>

        {/* Combustível */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
            <span className="flex items-center gap-1">
              <Fuel className="w-3 h-3 text-cyan-400" />
              Combustível
            </span>
            <span className="text-white font-bold">{car.fuelKg} kg</span>
          </div>
          <div className="text-[11px] font-bold text-cyan-300">
            ~{Math.max(0, Math.round(car.fuelKg / 1.65))} voltas
          </div>
          <Progress
            value={Math.min(100, (car.fuelKg / 100) * 100)}
            className="h-1 bg-[#141B26] [&>div]:bg-cyan-400"
          />
        </div>

        {/* Voltas no Stint / Totais */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="text-[10px] text-[#8B95A7] flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" />
            Voltas
          </div>
          <div className="text-xs font-black text-white">
            {car.lapsInStint}{' '}
            <span className="text-[10px] text-[#8B95A7] font-normal">no stint</span>
          </div>
          <div className="text-[10px] text-[#8B95A7]">
            Total: <span className="text-white font-bold">{car.totalLaps}</span>
          </div>
        </div>

        {/* Melhor / Última Volta */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="text-[10px] text-[#8B95A7] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            Melhor Marca
          </div>
          <div className="text-xs font-black text-emerald-400">
            {car.bestLapTime || '--:--.---'}
          </div>
          <div className="text-[10px] text-[#8B95A7]">
            Última: <span className="text-white font-mono">{car.lastLapTime || '--:--.---'}</span>
          </div>
        </div>
      </div>

      {/* 4. SETUP DO CARRO (SNAPSHOT CONHECIDO DA 4A — FAIXA ABERTA "?" CONFORME ESCOPO) */}
      <div className="p-3 rounded-xl bg-[#0E1521]/60 border border-[#1A2436] flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#8B95A7]">
          <Wrench className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-white">Setup Mecânico:</span>
          <span>Asa D: {car.setup.frontWing}</span>
          <span>• Asa T: {car.setup.rearWing}</span>
          <span>• Susp: {car.setup.suspension}</span>
          <span>• Dif: {car.setup.differential}%</span>
        </div>
        <div className="text-[10px] text-[#8B95A7] italic">
          Faixa conhecida: <span className="text-cyan-400 font-bold">?</span> (4C)
        </div>
      </div>

      {/* 5. AÇÕES TÁTICAS DO CARRO («SAIR PARA A PISTA» OU «CHAMAR AOS BOXES») */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {isCarInGarage ? (
          <Button
            type="button"
            disabled={!isSessionRunning || isSessionCompleted || car.fuelKg < 2}
            onClick={onOrderExitTrack}
            className="w-full bg-[#00A6FB] hover:bg-[#0092DC] text-[#090D15] font-black text-xs h-10 shadow-lg flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            SAIR PARA A PISTA
          </Button>
        ) : (
          <Button
            type="button"
            disabled={
              !isSessionRunning || isSessionCompleted || car.pitRequested || car.status === 'in_lap'
            }
            onClick={onRequestBox}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs h-10 shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {car.pitRequested ? 'BOX SOLICITADO...' : 'CHAMAR AOS BOXES'}
          </Button>
        )}
      </div>
    </Card>
  )
}
