import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { LiveTelemetryTable } from '@/components/race/LiveTelemetryTable'
import { LiveRaceFeed } from '@/components/race/LiveRaceFeed'
import { ProgressBar } from '@/components/ProgressBar'
import { Activity, Disc, Fuel, Gauge, Play, Wrench, Zap } from 'lucide-react'
import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent, WeekendSession } from '@/types/race-events'
import type { TeamModel } from '@/types/f1'
import type {
  LiveTacticalMode,
  LivePaceOrder,
  IncidentPenalty,
  LightMechanicalIssue,
} from '@/types/race-interactions'
import type { TeamOrderProposalState, TeamOrderState } from '@/lib/raceDrama'

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
    laps: number
    tireAbrasiveness?: number
  }
  puPoolStatus: {
    leastWear: number
  }
  currentSetup: {
    pu_electric_ratio?: number
  }
  team: TeamModel | null
  handleStartRace: () => void
  isSimulatingSession: boolean
  isDone: boolean
  simSpeed: number
  setSimSpeed: (speed: number) => void
  handleOpenForcePitModal: () => void
  raceResults: any
  liveEvents: LiveRaceEvent[]
  playerCarTactics: Record<string, LiveTacticalMode>
  handleChangeTacticalMode: (driverId: string, mode: LiveTacticalMode) => void
  playerPaceOrders: Record<string, LivePaceOrder>
  handleChangePaceOrder: (driverId: string, order: LivePaceOrder) => void
  teamOrders: TeamOrderState[]
  penalties: IncidentPenalty[]
  mechanicalIssues: LightMechanicalIssue[]
  teamOrderProposal: TeamOrderProposalState | null
  handleApplyTeamOrder: () => void
}

export const RaceOperationsCockpit: React.FC<RaceOperationsCockpitProps> = ({
  isRaceSession,
  liveRaceState,
  gpInfo,
  puPoolStatus,
  currentSetup,
  team,
  handleStartRace,
  isSimulatingSession,
  isDone,
  simSpeed,
  setSimSpeed,
  handleOpenForcePitModal,
  raceResults,
  liveEvents,
  playerCarTactics,
  handleChangeTacticalMode,
  playerPaceOrders,
  handleChangePaceOrder,
  teamOrders,
  penalties,
  mechanicalIssues,
  teamOrderProposal,
  handleApplyTeamOrder,
}) => {
  if (!isRaceSession) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* COLUNA ESQUERDA (~25% = 3/12 cols) — Telemetria do Carro do Jogador */}
      <div className="lg:col-span-3 space-y-4">
        <Card className="bg-[#11161F] border border-[#1F2733] shadow-xl rounded-xl overflow-hidden">
          <CardHeader className="py-2.5 px-3 bg-[#0B0E14] border-b border-[#1F2733]">
            <CardTitle className="text-xs font-bold text-[#F5F7FA] tracking-wide flex items-center justify-between uppercase">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#00A6FB]" />
                Telemetria da Equipe
              </span>
              <span className="font-num text-[10px] text-[#8B95A7]">
                V{liveRaceState?.currentLap || 1}/{liveRaceState?.totalLaps || gpInfo.laps}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-4">
            {/* Carros do Jogador na Pista */}
            {(() => {
              const playerGridCars = liveRaceState?.grid?.filter((g) => g.isPlayer) || []
              if (playerGridCars.length === 0) {
                return (
                  <div className="p-4 text-center text-xs text-[#8B95A7] space-y-1">
                    <p className="font-medium text-[#F5F7FA]">Aguardando largada</p>
                    <p className="text-[11px]">
                      Os dados de telemetria dos dois carros aparecerão aqui durante a prova.
                    </p>
                  </div>
                )
              }

              return playerGridCars.map((car) => {
                const tireWearVal = car.tireWear || 5
                const tireLifePct = Math.max(0, 100 - tireWearVal)
                const fuelVal =
                  car.fuelRemaining !== undefined ? Math.round(car.fuelRemaining) : 100
                const engineHealthVal = puPoolStatus.leastWear
                  ? Math.max(0, 100 - puPoolStatus.leastWear)
                  : 85
                const erRatio = currentSetup.pu_electric_ratio || 50

                return (
                  <div
                    key={car.driverId}
                    className="p-2.5 rounded-lg bg-[#0E131B] border border-[#1F2733] space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-[#1F2733]/60 pb-1.5">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span
                          className="w-1.5 h-3.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: car.teamColor || team?.color || '#E10600',
                          }}
                        />
                        <span className="text-xs font-bold text-[#F5F7FA] truncate">
                          {car.driverName}
                        </span>
                      </div>
                      <span className="font-num text-xs font-bold text-[#00A6FB] px-1.5 py-0.2 rounded bg-[#00A6FB]/10 border border-[#00A6FB]/30">
                        P{car.position}
                      </span>
                    </div>

                    {/* Desgaste de Pneus via ProgressBar padronizada */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#8B95A7] flex items-center gap-1">
                          <Disc className="w-3 h-3 text-yellow-400" /> Pneus (
                          {car.tireCompound?.slice(0, 3).toUpperCase() || 'MED'})
                        </span>
                        <span className="font-num font-bold text-[#F5F7FA]">
                          {tireLifePct}% vida
                        </span>
                      </div>
                      <ProgressBar
                        value={tireLifePct}
                        max={100}
                        showValue={false}
                        size="sm"
                        color={
                          tireLifePct < 25 ? 'danger' : tireLifePct < 50 ? 'warning' : 'success'
                        }
                        trackClassName="bg-[#161D29] border-[#1F2733]"
                      />
                    </div>

                    {/* Combustível via ProgressBar padronizada */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#8B95A7] flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-cyan-400" /> Combustível
                        </span>
                        <span className="font-num font-bold text-[#F5F7FA]">{fuelVal}%</span>
                      </div>
                      <ProgressBar
                        value={fuelVal}
                        max={110}
                        showValue={false}
                        size="sm"
                        color={fuelVal < 15 ? 'danger' : fuelVal < 35 ? 'warning' : 'default'}
                        trackClassName="bg-[#161D29] border-[#1F2733]"
                      />
                    </div>

                    {/* ERS / Balanço Elétrico 50/50 */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#8B95A7] flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" /> ERS MGU-K
                        </span>
                        <span className="font-num font-bold text-amber-300">{erRatio}% deploy</span>
                      </div>
                      <ProgressBar
                        value={erRatio}
                        max={100}
                        showValue={false}
                        size="sm"
                        color="warning"
                        trackClassName="bg-[#161D29] border-[#1F2733]"
                      />
                    </div>

                    {/* Saúde do Motor */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#8B95A7] flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-emerald-400" /> Saúde da PU
                        </span>
                        <span className="font-num font-bold text-[#F5F7FA]">
                          {engineHealthVal}%
                        </span>
                      </div>
                      <ProgressBar
                        value={engineHealthVal}
                        max={100}
                        showValue={false}
                        size="sm"
                        color={
                          engineHealthVal < 35
                            ? 'danger'
                            : engineHealthVal < 60
                              ? 'warning'
                              : 'success'
                        }
                        trackClassName="bg-[#161D29] border-[#1F2733]"
                      />
                    </div>
                  </div>
                )
              })
            })()}
          </CardContent>
        </Card>
      </div>

      {/* COLUNA CENTRAL (~50% = 6/12 cols) — Feed de Rádio + Controlador de Sessão Sticky */}
      <div className="lg:col-span-6 space-y-4">
        {/* Controlador Sticky de Corrida no Topo da Coluna Central */}
        <div className="sticky top-2 z-30 p-3 rounded-xl bg-[#11161F]/95 backdrop-blur-md border border-[#1F2733] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleStartRace}
              disabled={isSimulatingSession || isDone}
              className="bg-[#E10600] hover:bg-[#C10500] text-white font-extrabold shadow-md cursor-pointer flex items-center gap-1.5 h-8 text-xs px-3"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isDone ? 'Corrida Concluída' : 'Simular / Continuar'}
            </Button>

            {!isDone && (
              <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0E131B] border border-[#1F2733]">
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSimSpeed(spd)}
                    className={`px-2 py-0.5 rounded text-[10px] font-num font-bold transition-all cursor-pointer ${
                      simSpeed === spd
                        ? 'bg-[#161D29] text-[#00A6FB] border border-[#1F2733] shadow-sm'
                        : 'text-[#8B95A7] hover:text-[#F5F7FA]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status ao vivo da volta atual */}
          <div className="flex items-center gap-2">
            {liveRaceState && (
              <span className="font-num text-xs font-bold text-[#F5F7FA] px-2 py-1 rounded bg-[#0E131B] border border-[#1F2733]">
                Volta {liveRaceState.currentLap}/{liveRaceState.totalLaps}
              </span>
            )}
            <Button
              size="sm"
              onClick={handleOpenForcePitModal}
              disabled={!liveRaceState?.inProgress || !!raceResults}
              className="h-8 text-xs font-bold uppercase bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1 px-2.5 shadow cursor-pointer disabled:opacity-50"
            >
              <Wrench className="w-3.5 h-3.5" />
              Box
            </Button>
          </div>
        </div>

        {/* Feed de Rádio e Eventos da Corrida */}
        <LiveRaceFeed
          events={liveEvents}
          currentLap={liveRaceState?.currentLap}
          totalLaps={liveRaceState?.totalLaps || gpInfo.laps}
          isRaceSession={isRaceSession}
          canForcePit={!raceResults && !!liveRaceState?.inProgress}
          onOpenForcePit={handleOpenForcePitModal}
          teamColor={team?.color || '#E10600'}
        />
      </div>

      {/* COLUNA DIREITA (~25% = 3/12 cols) — Tabela ao Vivo da Corrida */}
      <div className="lg:col-span-3 space-y-4">
        {liveRaceState && liveRaceState.grid && liveRaceState.grid.length > 0 ? (
          <LiveTelemetryTable
            grid={liveRaceState.grid}
            currentLap={liveRaceState.currentLap}
            totalLaps={liveRaceState.totalLaps}
            trackAbrasiveness={gpInfo.tireAbrasiveness || 6}
            playerCarTactics={playerCarTactics}
            onChangeTacticalMode={handleChangeTacticalMode}
            playerPaceOrders={playerPaceOrders}
            onChangePaceOrder={handleChangePaceOrder}
            isRaceFinished={!liveRaceState.inProgress && !!raceResults}
            teamOrders={teamOrders}
            penalties={penalties}
            mechanicalIssues={mechanicalIssues}
            teamOrderProposal={teamOrderProposal}
            onApplyTeamOrder={handleApplyTeamOrder}
            compact={true}
          />
        ) : (
          <Card className="bg-[#11161F] border border-[#1F2733] shadow-xl rounded-xl p-4">
            <EmptyState
              icon={Activity}
              title="Grid em formação"
              description="A tabela ao vivo com tempos e intervalos por setor será ativada na largada da prova."
            />
          </Card>
        )}
      </div>
    </div>
  )
}
