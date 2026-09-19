import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Wrench, Radio, Activity, RefreshCw } from 'lucide-react'
import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import type { TeamModel, DriverModel } from '@/types/f1'
import type { LivePaceOrder } from '@/components/race/LiveTelemetryTable'
import { LiveStandingsTable, type LapRecord } from '@/components/race/LiveStandingsTable'
import { DriverLiveOperationsPanel } from '@/components/race/DriverLiveOperationsPanel'
import { TeamActionsCard, type TeamActionExecutionResult } from '@/components/race/TeamActionsCard'
import { LiveRaceFeed } from '@/components/race/LiveRaceFeed'

export type LiveTacticalMode = 'attack' | 'normal' | 'save_fuel'

export interface RaceOperationsCockpitProps {
  isRaceSession: boolean
  liveRaceState: {
    inProgress: boolean
    currentLap: number
    totalLaps: number
    weather: any
    grid: SimDriverEntry[]
  } | null
  gpInfo: {
    name: string
    circuit: string
    country?: string
    flag?: string
    laps: number
    tireAbrasiveness?: number
  }
  puPoolStatus?: {
    leastWear: number
  }
  currentSetup?: {
    pu_electric_ratio?: number
  }
  team: TeamModel | null
  drivers?: DriverModel[]
  handleStartRace: () => void
  isSimulatingSession: boolean
  isDone: boolean
  simSpeed: number
  setSimSpeed: (speed: number) => void
  isRacePaused: boolean
  onTogglePause: () => void
  handleOpenForcePitModal: (driverId?: string) => void
  onOpenPitWallRadio?: (driverId: string) => void
  raceResults: any
  liveEvents: LiveRaceEvent[]
  playerCarTactics: Record<string, LiveTacticalMode>
  handleChangeTacticalMode: (driverId: string, mode: LiveTacticalMode) => void
  playerPaceOrders: Record<string, LivePaceOrder>
  handleChangePaceOrder: (driverId: string, order: LivePaceOrder) => void
  teamOrders?: any[]
  penalties?: any[]
  mechanicalIssues?: any[]
  teamOrderProposal?: any
  handleApplyTeamOrder?: () => void
  lapHistory?: Record<string, LapRecord[]>
  pauseReason?: string | null
  partsCondition?: Array<{ id: string; name: string; condition: number }>
}

export const RaceOperationsCockpit: React.FC<RaceOperationsCockpitProps> = ({
  isRaceSession,
  liveRaceState,
  gpInfo,
  team,
  drivers = [],
  handleStartRace,
  isSimulatingSession,
  isDone,
  simSpeed,
  setSimSpeed,
  isRacePaused,
  onTogglePause,
  handleOpenForcePitModal,
  onOpenPitWallRadio,
  raceResults,
  liveEvents,
  playerCarTactics,
  handleChangeTacticalMode,
  playerPaceOrders,
  handleChangePaceOrder,
  mechanicalIssues = [],
  lapHistory = {},
  pauseReason,
  partsCondition = [],
}) => {
  const [selectedCompareDriverId, setSelectedCompareDriverId] = useState<string | null>(null)
  const [lastTeamOrderResult, setLastTeamOrderResult] = useState<TeamActionExecutionResult | null>(
    null,
  )

  if (!isRaceSession) return null

  const grid = liveRaceState?.grid || []
  const currentLap = liveRaceState?.currentLap || 1
  const totalLaps = liveRaceState?.totalLaps || gpInfo.laps

  // Identifica pilotos do jogador
  const playerCars = grid.filter((g) => g.isPlayer)
  const car1 = playerCars[0] || null
  const car2 = playerCars[1] || null

  const driver1Model = drivers.find((d) => d.id === car1?.driverId) || drivers[0] || null
  const driver2Model = drivers.find((d) => d.id === car2?.driverId) || drivers[1] || null

  const handleExecuteTeamOrder = (result: TeamActionExecutionResult) => {
    setLastTeamOrderResult(result)
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE CONTROLE DA CORRIDA CLARA E STICKY: PLAY / PAUSE, VELOCIDADES 1x / 2x / 4x, ESTADO */}
      <Card className="sticky top-2 z-30 bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-xl p-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Controles de Simulação */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isSimulatingSession && !liveRaceState?.inProgress && !isDone ? (
              <Button
                size="sm"
                onClick={handleStartRace}
                className="bg-[#E10600] hover:bg-[#C10500] text-white font-extrabold text-xs px-4 h-9 shadow-sm flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-current" />
                LARGADA // INICIAR CORRIDA
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={onTogglePause}
                  disabled={isDone}
                  className={`font-black text-xs px-4 h-9 shadow-sm flex items-center gap-1.5 transition-all ${
                    isRacePaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                  }`}
                >
                  {isRacePaused ? (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      RETOMAR (PLAY)
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      PAUSAR (PAUSE)
                    </>
                  )}
                </Button>

                {/* Seletores de Velocidade (1x, 2x, 4x) */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                  {[1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSimSpeed(spd)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                        simSpeed === spd
                          ? 'bg-white text-[#E10600] border border-slate-200 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status da Corrida */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-500">Estado:</span>
              {isDone ? (
                <Badge className="bg-slate-200 text-slate-800 border-slate-300">ENCERRADA</Badge>
              ) : isRacePaused ? (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 animate-pulse">
                  PAUSADA {pauseReason ? `(${pauseReason})` : ''}
                </Badge>
              ) : liveRaceState?.inProgress ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  EM ANDAMENTO
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                  AGUARDANDO LARGADA
                </Badge>
              )}
            </div>
          </div>

          {/* Indicador de Volta e Botão Rápido de Box */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-md border border-slate-200">
              Volta {currentLap}/{totalLaps}
            </span>

            <Button
              size="sm"
              onClick={() => handleOpenForcePitModal()}
              disabled={!liveRaceState?.inProgress || isDone}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider px-3 h-8.5 shadow-sm flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5" />
              Chamar aos Boxes
            </Button>
          </div>
        </div>
      </Card>

      {/* GRID DE DUAS COLUNAS PRINCIPAIS (DESKTOP CONFORME ESPECIFICAÇÃO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =========================================================================
            COLUNA ESQUERDA (~48% = 6/12 cols no lg):
            1. Classificação ao Vivo (posições dinâmicas, variação, tooltips, pneus, gaps)
            2. Tempos por Volta — Nossos Pilotos (P1, P2, Delta, seletor de outro competidor)
           ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          <LiveStandingsTable
            grid={grid}
            currentLap={currentLap}
            totalLaps={totalLaps}
            playerDriverIds={drivers.map((d) => d.id)}
            lapHistory={lapHistory}
            selectedCompareDriverId={selectedCompareDriverId}
            onSelectCompareDriverId={setSelectedCompareDriverId}
            onSelectRowDriver={(dId) => {
              if (onOpenPitWallRadio) {
                onOpenPitWallRadio(dId)
              }
            }}
          />

          {/* Feed de Eventos e Rádio da Corrida abaixo da Classificação */}
          <div className="mt-4">
            <LiveRaceFeed
              events={liveEvents}
              currentLap={currentLap}
              totalLaps={totalLaps}
              isRaceSession={isRaceSession}
              canForcePit={!raceResults && !!liveRaceState?.inProgress}
              onOpenForcePit={() => handleOpenForcePitModal()}
              teamColor={team?.color || '#E10600'}
            />
          </div>
        </div>

        {/* =========================================================================
            COLUNA DIREITA (~52% = 6/12 cols no lg):
            1. Painel Operacional do Piloto 1 (Foto, nome, # esportivo, pneus, combustível, integridade, rádio, box)
            2. Painel Operacional do Piloto 2 (Independente)
            3. Ações de Equipe (Team Orders com destinatário explícito P1/P2)
           ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* Painel do Carro 1 */}
          <DriverLiveOperationsPanel
            slotNumber={1}
            driver={driver1Model}
            car={car1}
            totalLaps={totalLaps}
            tacticalMode={car1 ? playerCarTactics[car1.driverId] || 'normal' : 'normal'}
            paceOrder={car1 ? playerPaceOrders[car1.driverId] || 'normal' : 'normal'}
            onChangeTacticalMode={handleChangeTacticalMode}
            onChangePaceOrder={handleChangePaceOrder}
            onCallBox={(dId) => handleOpenForcePitModal(dId)}
            onOpenRadio={(dId) => {
              if (onOpenPitWallRadio) onOpenPitWallRadio(dId)
            }}
            mechanicalIssues={mechanicalIssues}
            partsCondition={partsCondition}
          />

          {/* Painel do Carro 2 */}
          <DriverLiveOperationsPanel
            slotNumber={2}
            driver={driver2Model}
            car={car2}
            totalLaps={totalLaps}
            tacticalMode={car2 ? playerCarTactics[car2.driverId] || 'normal' : 'normal'}
            paceOrder={car2 ? playerPaceOrders[car2.driverId] || 'normal' : 'normal'}
            onChangeTacticalMode={handleChangeTacticalMode}
            onChangePaceOrder={handleChangePaceOrder}
            onCallBox={(dId) => handleOpenForcePitModal(dId)}
            onOpenRadio={(dId) => {
              if (onOpenPitWallRadio) onOpenPitWallRadio(dId)
            }}
            mechanicalIssues={mechanicalIssues}
            partsCondition={partsCondition}
          />

          {/* Bloco de Ações de Equipe (Team Orders Canônicas com destinatário P1/P2) */}
          <TeamActionsCard
            drivers={drivers}
            grid={grid}
            currentLap={currentLap}
            round={1}
            season={2026}
            team={team}
            onExecuteOrder={handleExecuteTeamOrder}
            lastOrderResult={lastTeamOrderResult}
          />
        </div>
      </div>
    </div>
  )
}
