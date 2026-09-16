import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { DriverHelmet } from '@/components/DriverHelmet'
import { Disc, Fuel, Gauge, Layers, Play, Sliders, Zap } from 'lucide-react'
import type { WeekendSession } from '@/types/race-events'
import type { DriverModel, TeamModel, TireCompound, SessionSetupModel } from '@/types/f1'
import type { DriverRaceStrategy } from '@/types/f1'

export interface TrackEngineeringAndStrategySectionProps {
  sessKey: WeekendSession
  isRaceSession: boolean
  isDone: boolean
  isSimulatingSession: boolean
  currentSetup: SessionSetupModel
  updateCurrentSetup: (field: keyof SessionSetupModel, value: any) => void
  handleSaveSetup: () => void
  gpInfo: {
    circuit: string
    laps: number
    downforceIdeal?: number
    suspensionIdeal?: number
  }
  raceInitialFuelPct: number
  setRaceInitialFuelPct: (val: number) => void
  setupFeedback: any
  weather: any
  tireStock: Record<TireCompound, number>
  drivers: DriverModel[]
  team: TeamModel | null
  getStrategyForDriver: (d: DriverModel) => DriverRaceStrategy
  calculateDriverTireWearProfile: (d: DriverModel) => any
  updateDriverStartCompound: (driverId: string, compound: TireCompound) => void
  addDriverPitStop: (driverId: string) => void
  updateDriverPitStop: (
    driverId: string,
    pitId: string,
    field: 'lap' | 'compound',
    value: any,
  ) => void
  removeDriverPitStop: (driverId: string, pitId: string) => void
  handleStartRace: () => void
  simSpeed: number
  setSimSpeed: (speed: number) => void
  autoSimulateWithoutPause: boolean
  setAutoSimulateWithoutPause: (val: boolean) => void
  handleRunSession: (session: WeekendSession) => void
}

export const TrackEngineeringAndStrategySection: React.FC<
  TrackEngineeringAndStrategySectionProps
> = ({
  sessKey,
  isRaceSession,
  isDone,
  isSimulatingSession,
  currentSetup,
  updateCurrentSetup,
  handleSaveSetup,
  gpInfo,
  raceInitialFuelPct,
  setRaceInitialFuelPct,
  setupFeedback,
  weather,
  tireStock,
  drivers,
  team,
  getStrategyForDriver,
  calculateDriverTireWearProfile,
  updateDriverStartCompound,
  addDriverPitStop,
  updateDriverPitStop,
  removeDriverPitStop,
  handleStartRace,
  simSpeed,
  setSimSpeed,
  autoSimulateWithoutPause,
  setAutoSimulateWithoutPause,
  handleRunSession,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] lg:col-span-2 shadow-xl">
        <CardHeader className="pb-3 border-b border-[#1A2333]">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
            OFICINA DE ENGENHARIA DE PISTA
          </span>
          <CardTitle className="text-base font-black text-white flex items-center justify-between mt-0.5">
            <span className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#E10600]" />
              Configuração do Carro — {sessKey.toUpperCase()}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveSetup}
              className="border-[#1A2333] text-xs h-8 text-[#00A6FB] hover:bg-[#080C14]"
            >
              Salvar Setup
            </Button>
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
            Ajuste fino de aerodinâmica ativa, suspensão mecânica e gestão do trem de força híbrido
            para {gpInfo.circuit}.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Slider 1: Wing Downforce */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#00A6FB]" /> Nível da Asa (Pressão Aerodinâmica):
              </span>
              <Badge variant="outline" className="border-[#1F2733] text-[#00A6FB]">
                Nível {currentSetup.wing_level}/10 •{' '}
                {currentSetup.wing_level <= 3
                  ? 'Baixo Arrasto (Monza)'
                  : currentSetup.wing_level >= 8
                    ? 'Alta Carga (Mônaco)'
                    : 'Misto Médio'}
              </Badge>
            </div>
            <Slider
              value={[currentSetup.wing_level]}
              min={1}
              max={10}
              step={1}
              onValueChange={(val) => updateCurrentSetup('wing_level', val[0])}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
              <span>1 (Mínimo arrasto em retas)</span>
              <span>Ideal do circuito: {gpInfo.downforceIdeal || 6}</span>
              <span>10 (Máxima aderência em curvas)</span>
            </div>
          </div>

          {/* Slider 2: Suspension Stiffness */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-400" /> Rigidez da Suspensão:
              </span>
              <Badge variant="outline" className="border-[#1F2733] text-emerald-400">
                Nível {currentSetup.suspension_stiffness}/10 •{' '}
                {currentSetup.suspension_stiffness <= 4
                  ? 'Macia (Absorve zebras)'
                  : currentSetup.suspension_stiffness >= 8
                    ? 'Rígida (Alta estabilidade)'
                    : 'Equilibrada'}
              </Badge>
            </div>
            <Slider
              value={[currentSetup.suspension_stiffness]}
              min={1}
              max={10}
              step={1}
              onValueChange={(val) => updateCurrentSetup('suspension_stiffness', val[0])}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
              <span>1 (Macia / menos desgaste)</span>
              <span>Ideal do circuito: {gpInfo.suspensionIdeal || 6}</span>
              <span>10 (Rígida / mais resposta)</span>
            </div>
          </div>

          {/* Slider 3: 50/50 Power Unit Balance */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" /> Balanço de Potência 50/50 (Elétrico MGU-K
                vs Combustão V6):
              </span>
              <Badge variant="outline" className="border-[#1F2733] text-amber-400">
                {currentSetup.pu_electric_ratio}% Elétrico / {100 - currentSetup.pu_electric_ratio}%
                V6
              </Badge>
            </div>
            <Slider
              value={[currentSetup.pu_electric_ratio]}
              min={20}
              max={80}
              step={5}
              onValueChange={(val) => updateCurrentSetup('pu_electric_ratio', val[0])}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
              <span>20% (Conservador / poupa motor)</span>
              <span>50% (Padrão Oficial FIA 2026)</span>
              <span>80% (Pico elétrico agressivo / alto desgaste)</span>
            </div>
          </div>

          {/* ITEM 1: Carga Inicial de Combustível (90% a 110%) */}
          {isRaceSession && (
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1E293B] space-y-2.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-cyan-400" /> Carga Inicial de Combustível (Briefing
                  Pré-Corrida):
                </span>
                <Badge
                  className={`font-mono text-xs ${
                    raceInitialFuelPct < 100
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : raceInitialFuelPct > 100
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {raceInitialFuelPct}% Tanque (
                  {raceInitialFuelPct < 100
                    ? `${((100 - raceInitialFuelPct) * -0.025).toFixed(2)}s/volta (leve)`
                    : raceInitialFuelPct > 100
                      ? `+${((raceInitialFuelPct - 100) * 0.02).toFixed(2)}s/volta (pesado)`
                      : 'Carga Ideal 100%'}
                  )
                </Badge>
              </div>
              <Slider
                value={[raceInitialFuelPct]}
                min={90}
                max={110}
                step={1}
                onValueChange={(val) => {
                  setRaceInitialFuelPct(val[0])
                  updateCurrentSetup('initial_fuel_load', val[0])
                }}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                <span className="text-amber-400">
                  90% (Carro mais leve até -0.25s/v, alto risco de falta)
                </span>
                <span className="text-emerald-400">100% (Padrão seguro)</span>
                <span className="text-blue-400">110% (Pesado, folga total)</span>
              </div>
            </div>
          )}

          {/* Feedback de Engenharia */}
          <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E293B] space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Retorno da Engenharia // Telemetria de Setup
                </span>
              </div>
              <Badge
                variant="outline"
                className={`text-xs font-mono ${
                  setupFeedback.verdict === 'ideal'
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                    : setupFeedback.verdict === 'bom'
                      ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                      : setupFeedback.verdict === 'desajustado'
                        ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                        : 'border-red-500/50 text-red-400 bg-red-500/10'
                }`}
              >
                Índice de Acerto: {setupFeedback.overallScore}% • {setupFeedback.title}
              </Badge>
            </div>

            <p className="text-xs text-[#8B95A7] leading-relaxed">{setupFeedback.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733] space-y-1">
                <span className="text-[#8B95A7] font-bold block uppercase text-[10px]">
                  Asa & Arrasto Aerodinâmico
                </span>
                <p className="text-slate-300 leading-normal">{setupFeedback.wingFeedback.text}</p>
              </div>

              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733] space-y-1">
                <span className="text-[#8B95A7] font-bold block uppercase text-[10px]">
                  Suspensão & Zebras
                </span>
                <p className="text-slate-300 leading-normal">
                  {setupFeedback.suspensionFeedback.text}
                </p>
              </div>

              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733] space-y-1">
                <span className="text-[#8B95A7] font-bold block uppercase text-[10px]">
                  Trem de Força 50/50
                </span>
                <p className="text-slate-300 leading-normal">{setupFeedback.puFeedback.text}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tire & Pit Stop Strategy Choice */}
      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] flex flex-col justify-between shadow-xl">
        <CardHeader className="pb-3 border-b border-[#1A2333]">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00A6FB] block">
            ESTRATÉGIA OPERACIONAL
          </span>
          <CardTitle className="text-base font-black text-white flex items-center justify-between mt-0.5">
            <span className="flex items-center gap-2">
              <Disc className="w-5 h-5 text-yellow-400" />
              {isRaceSession ? 'Estratégia de Corrida (Até 4 Pits por Piloto)' : 'Pneu da Sessão'}
            </span>
            {isRaceSession && (
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-cyan-500/40 text-cyan-300"
              >
                FIA 2026 • Individual por Piloto
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            {isRaceSession
              ? 'Defina o pneu de largada (seco ou chuva) e até 4 paradas programadas independentes para cada piloto da sua equipe.'
              : 'Escolha o composto a ser utilizado durante esta sessão de testes.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-[11px] font-mono space-y-1">
            <div className="flex items-center justify-between text-[#8B95A7]">
              <span className="font-bold text-white flex items-center gap-1">
                <Disc className="w-3.5 h-3.5 text-yellow-400" /> Deltas Oficiais (FIA 2026):
              </span>
              <span className="text-[10px] text-cyan-400">Ref: Médio</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 pt-1 text-[10px]">
              <span className="text-red-400">🔴 Macio: -0.75s</span>
              <span className="text-yellow-400">🟡 Médio: 0.00s</span>
              <span className="text-slate-300">⚪ Duro: +0.60s</span>
              <span className="text-emerald-400">🟢 Interm: +3.80s (seco)</span>
              <span className="text-blue-400">🔵 Chuva: +6.50s (seco)</span>
              <span className="text-emerald-300 font-bold">
                ⚡ Clima:{' '}
                {weather === 'seco'
                  ? 'Seco'
                  : weather === 'chuva_fraca'
                    ? 'Chuva Fraca'
                    : 'Chuva Forte'}
              </span>
            </div>
          </div>

          {!isRaceSession ? (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#8B95A7] block">Composto da Sessão:</label>
              <select
                value={currentSetup.tire_compound || 'medio'}
                onChange={(e) =>
                  updateCurrentSetup('tire_compound', e.target.value as TireCompound)
                }
                className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB]"
              >
                <option value="macio">
                  Macio (Vermelho) [-0.75s] — Estoque: {tireStock.macio}
                </option>
                <option value="medio">
                  Médio (Amarelo) [Ref 0.0s] — Estoque: {tireStock.medio}
                </option>
                <option value="duro">Duro (Branco) [+0.60s] — Estoque: {tireStock.duro}</option>
                <option value="intermediario">
                  Intermediário (Verde) — Estoque: {tireStock.intermediario}
                </option>
                <option value="chuva_extrema">
                  Chuva Extrema (Azul) — Estoque: {tireStock.chuva_extrema}
                </option>
              </select>
            </div>
          ) : (
            <div className="space-y-4">
              {drivers
                .filter((d) => d.team_id === team?.id && d.role !== 'reserva')
                .map((driver) => {
                  const strat = getStrategyForDriver(driver)
                  const wearProfile = calculateDriverTireWearProfile(driver)

                  return (
                    <div
                      key={driver.id}
                      className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3 font-mono text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-[#1F2733] pb-2">
                        <div className="flex items-center gap-2">
                          <DriverHelmet driver={driver} teamColor={team?.color} size="sm" />
                          <span className="font-bold text-[#F5F7FA] text-sm flex items-center gap-1.5">
                            {driver.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${wearProfile.badgeColor}`}
                          >
                            Desgaste: {wearProfile.profileName} (x{wearProfile.multiplier})
                          </Badge>
                        </div>
                        <span className="text-[11px] text-[#8B95A7]">
                          {strat.pitStops.length} parada(s) programada(s)
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-[#8B95A7] block font-bold">
                          🟢 Pneu de Largada (Stint 1):
                        </label>
                        <select
                          value={strat.startCompound}
                          onChange={(e) =>
                            updateDriverStartCompound(driver.id, e.target.value as TireCompound)
                          }
                          className="w-full bg-[#11161F] border border-[#1F2733] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                        >
                          <option value="macio">
                            🔴 Macio (Vermelho) — {tireStock.macio} jogos rest.
                          </option>
                          <option value="medio">
                            🟡 Médio (Amarelo) — {tireStock.medio} jogos rest.
                          </option>
                          <option value="duro">
                            ⚪ Duro (Branco) — {tireStock.duro} jogos rest.
                          </option>
                          <option value="intermediario">
                            🟢 Intermediário (Chuva Fraca) — {tireStock.intermediario} rest.
                          </option>
                          <option value="chuva_extrema">
                            🔵 Chuva Extrema (Chuva Forte) — {tireStock.chuva_extrema} rest.
                          </option>
                        </select>
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8B95A7] font-bold">
                            Sequência de Paradas nos Boxes:
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={strat.pitStops.length >= 4}
                            onClick={() => addDriverPitStop(driver.id)}
                            className="h-6 text-[10px] px-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                          >
                            + Adicionar Parada (Max 4)
                          </Button>
                        </div>

                        {strat.pitStops.length === 0 ? (
                          <p className="text-[11px] text-amber-400/90 italic bg-amber-500/10 p-2 rounded border border-amber-500/20">
                            ⚠️ Nenhuma parada planejada! Em pista seca, a FIA exige trocar de
                            composto pelo menos uma vez.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {strat.pitStops.map((pit, pIdx) => (
                              <div
                                key={pit.id}
                                className="p-2 rounded-lg bg-[#11161F] border border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                                    Pit #{pIdx + 1}
                                  </Badge>
                                  <div className="flex items-center gap-1.5 text-xs text-white">
                                    <span>Volta</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={gpInfo.laps - 1}
                                      value={pit.lap}
                                      onChange={(e) =>
                                        updateDriverPitStop(
                                          driver.id,
                                          pit.id,
                                          'lap',
                                          Math.max(
                                            1,
                                            Math.min(
                                              gpInfo.laps - 1,
                                              parseInt(e.target.value) || 1,
                                            ),
                                          ),
                                        )
                                      }
                                      className="w-14 bg-[#0B0E14] border border-[#1F2733] rounded px-1.5 py-0.5 text-center font-bold text-cyan-300"
                                    />
                                    <span className="text-[#8B95A7]">/{gpInfo.laps}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#8B95A7]">Calçar:</span>
                                  <select
                                    value={pit.compound}
                                    onChange={(e) =>
                                      updateDriverPitStop(
                                        driver.id,
                                        pit.id,
                                        'compound',
                                        e.target.value as TireCompound,
                                      )
                                    }
                                    className="bg-[#0B0E14] border border-[#1F2733] rounded px-2 py-1 text-xs text-white focus:outline-none font-mono"
                                  >
                                    <option value="duro">⚪ Duro (+0.60s)</option>
                                    <option value="medio">🟡 Médio (0.0s)</option>
                                    <option value="macio">🔴 Macio (-0.75s)</option>
                                    <option value="intermediario">🟢 Intermediário</option>
                                    <option value="chuva_extrema">🔵 Chuva Extrema</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => removeDriverPitStop(driver.id, pit.id)}
                                    className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 text-xs"
                                    title="Remover parada"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          <div className="pt-2 space-y-2">
            {isRaceSession ? (
              <>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <Button
                    size="lg"
                    onClick={handleStartRace}
                    disabled={isSimulatingSession || isDone}
                    className="flex-1 w-full bg-gradient-to-r from-[#E10600] to-[#FF6B35] hover:from-[#FF2E25] hover:to-[#FF7B48] text-white font-extrabold shadow-lg"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    {isDone ? 'Corrida Concluída' : 'Iniciar Corrida Narrada (Ao Vivo)'}
                  </Button>

                  {!isDone && (
                    <div className="flex items-center gap-1.5 p-1 bg-[#0B0E14] border border-[#1F2733] rounded-lg">
                      <span className="text-[10px] text-[#8B95A7] px-1 font-mono">Velocidade:</span>
                      {[1, 2, 4].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setSimSpeed(spd)}
                          className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                            simSpeed === spd
                              ? 'bg-[#00A6FB] text-[#0B0E14]'
                              : 'text-[#8B95A7] hover:text-white'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!isDone && (
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#8B95A7] px-1">
                    <span>Modo de Corrida:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={autoSimulateWithoutPause}
                        onChange={(e) => setAutoSimulateWithoutPause(e.target.checked)}
                        className="rounded border-[#1F2733] text-[#E10600] focus:ring-0"
                      />
                      <span>Simulação Rápida (sem pausar em incidentes)</span>
                    </label>
                  </div>
                )}
              </>
            ) : (
              <Button
                size="lg"
                onClick={() => handleRunSession(sessKey)}
                disabled={isSimulatingSession}
                className="w-full bg-[#00A6FB] hover:bg-[#0092DC] text-[#0B0E14] font-bold shadow-md"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                {isDone
                  ? `Repetir Stint ${sessKey.toUpperCase()}`
                  : `Executar ${sessKey.toUpperCase()}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
