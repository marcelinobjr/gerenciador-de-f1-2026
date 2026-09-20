import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Fuel, Gauge, ArrowRight, CornerDownLeft, Disc, AlertTriangle } from 'lucide-react'
import type { QualifyingCarState } from '@/types/canonical-qualifying-types'

export interface QualifyingCarCockpitCardProps {
  car: QualifyingCarState
  carNumber: 1 | 2
  teamColor: string
  isSessionRunning: boolean
  isSessionCompleted: boolean
  onOrderExitTrack: () => void
  onRequestBox: () => void
}

export const QualifyingCarCockpitCard: React.FC<QualifyingCarCockpitCardProps> = ({
  car,
  carNumber,
  teamColor,
  isSessionRunning,
  isSessionCompleted,
  onOrderExitTrack,
  onRequestBox,
}) => {
  const isInGarage = car.status === 'garage'
  const isOutOrIn = car.status === 'out_lap' || car.status === 'in_lap'
  const isFlying = car.status === 'flying_lap'
  const isEliminated = car.isEliminated || car.status === 'eliminated'

  let statusBadge = (
    <Badge className="bg-slate-100 text-[#475569] hover:bg-slate-100 text-[10px] font-bold">
      NA GARAGEM
    </Badge>
  )
  if (isEliminated) {
    statusBadge = (
      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px] font-black border border-rose-300">
        ELIMINADO
      </Badge>
    )
  } else if (isFlying) {
    statusBadge = (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-black animate-pulse">
        VOLTA RÁPIDA (FLYING LAP)
      </Badge>
    )
  } else if (car.status === 'out_lap') {
    statusBadge = (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px] font-bold">
        OUT LAP (VOLTA DE SAÍDA)
      </Badge>
    )
  } else if (car.status === 'in_lap') {
    statusBadge = (
      <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 text-[10px] font-bold">
        IN LAP (ENTRANDO NO BOX)
      </Badge>
    )
  } else if (car.status === 'classified') {
    statusBadge = (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-black">
        CLASSIFICADO
      </Badge>
    )
  }

  return (
    <Card className="bg-white border border-[#E2E8F0] shadow-xs rounded-2xl overflow-hidden flex flex-col justify-between">
      <div>
        <CardHeader className="py-3 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-6 rounded-full"
              style={{ backgroundColor: teamColor || '#E10600' }}
            />
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] block">
                CARRO {carNumber} • #{car.driverNumber || carNumber}
              </span>
              <CardTitle className="text-sm font-black text-[#0F172A]">{car.driverName}</CardTitle>
            </div>
          </div>
          <div>{statusBadge}</div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Informações da Volta e Desempenho */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                Melhor Marca (Quali)
              </span>
              <div className="text-base font-black text-[#0F172A] mt-0.5 font-mono">
                {car.bestLapTime || '--:--.---'}
              </div>
              <span className="text-[10px] text-[#64748B] block mt-0.5">
                Volta #{car.bestLapNumber || '-'} • {car.bestLapCompound || 'macio'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                Última Volta
              </span>
              <div className="text-base font-black text-[#334155] mt-0.5 font-mono">
                {car.lastLapTime || '--:--.---'}
              </div>
              <span className="text-[10px] text-[#64748B] block mt-0.5">
                Total: {car.totalLaps} volta(s)
              </span>
            </div>
          </div>

          {/* Progresso dentro da volta ao vivo */}
          {!isInGarage && !isEliminated && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-[#64748B] flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-[#E10600]" />
                  Progresso na Pista
                </span>
                <span className="text-[#0F172A] font-mono">
                  {Math.round(car.currentLapProgressPct || 0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E10600] transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, car.currentLapProgressPct || 0)}%` }}
                />
              </div>
            </div>
          )}

          {/* Telemetria de Garagem / Box: Pneu e Combustível */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <Disc
                className={`w-4 h-4 ${
                  car.currentCompound === 'macio'
                    ? 'text-[#E10600]'
                    : car.currentCompound === 'medio'
                      ? 'text-amber-500'
                      : 'text-slate-500'
                }`}
              />
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                  Pneu Instalado
                </span>
                <div className="text-xs font-black text-[#0F172A] capitalize">
                  {car.currentCompound}{' '}
                  <span className="text-[#64748B] font-mono">({car.tyreWear}% uso)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                  Combustível
                </span>
                <div className="text-xs font-black text-[#0F172A] font-mono">
                  {car.fuelKg} kg{' '}
                  <span className="text-[#64748B] text-[10px] font-normal">
                    (~{Math.floor(car.fuelKg / 1.7)} voltas)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status de Parc Fermé / Congelamento de Setup */}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] flex items-center justify-between text-[#64748B]">
            <span className="font-semibold">Parc Fermé Ativo:</span>
            <span className="font-mono text-[#0F172A] font-bold">
              Asa D:{car.setup?.frontWing || 6} / T:{car.setup?.rearWing || 6} • Susp:
              {car.setup?.suspension || 6} • Diff:{car.setup?.differential || 50}%
            </span>
          </div>
        </CardContent>
      </div>

      {/* Ações operacionais do piloto na qualificação */}
      <div className="p-4 pt-0">
        {isInGarage ? (
          <Button
            type="button"
            disabled={isSessionCompleted || isEliminated}
            onClick={onOrderExitTrack}
            className="w-full text-xs font-black bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs gap-2 h-9"
          >
            <ArrowRight className="w-4 h-4" />
            ENVIAR PARA A PISTA (TENTATIVA)
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={isSessionCompleted || isEliminated || car.pitRequested}
            onClick={onRequestBox}
            className={`w-full text-xs font-bold gap-2 h-9 border-[#CBD5E1] ${
              car.pitRequested
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            <CornerDownLeft className="w-4 h-4" />
            {car.pitRequested ? 'RETORNO AOS BOXES CONFIRMADO' : 'CHAMAR AOS BOXES (ABORTAR/BOX)'}
          </Button>
        )}
      </div>
    </Card>
  )
}
