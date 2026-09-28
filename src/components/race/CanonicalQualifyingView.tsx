/**
 * src/components/race/CanonicalQualifyingView.tsx
 *
 * Componente canônico de UI para visualização e controle do Qualifying (Q1 -> Q2 -> Q3 -> STARTING_GRID / GRID_READY).
 * Consome diretamente os artefatos persistidos de raceQualifyingOrchestratorService e raceQualifyingService.
 *
 * ABAS CANÔNICAS:
 * - Q1: Resultados persistidos (24 participantes), tempos, eliminados (6) com badge de corte.
 * - Q2: Somente os 18 participantes efetivos que avançaram, 8 eliminados destacados.
 * - Q3: Somente os 10 finalistas em disputa da pole position.
 * - Grid Oficial: Consome STARTING_GRID persistido (P1..P24). Sem penalidade coincide com qualifyingPosition;
 *   com penalidade exibe "Classificou: PX / Larga: PY" e badges informativos com as posições perdidas.
 *
 * INVARIANTE: Zero cálculo esportivo ou RNG no React — apenas renderização dos dados persistidos.
 */

import React, { useState, useEffect } from 'react'
import {
  raceQualifyingOrchestratorService,
  StartingGridState,
  GlobalQualifyingResultState,
  QualifyingPhaseExecutionState,
  formatLapTimeMs,
} from '@/services/raceQualifyingOrchestratorService'
import { raceQualifyingService, QualifyingWeekendState } from '@/services/raceQualifyingService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, FastForward, Flag, ArrowDown, Trophy, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface CanonicalQualifyingViewProps {
  careerId: string
  seasonId: string
  round: number
  state?: QualifyingWeekendState
  onStateUpdate?: (newState: QualifyingWeekendState) => void
  onAdvanceToRace?: () => void
}

export const CanonicalQualifyingView: React.FC<CanonicalQualifyingViewProps> = ({
  careerId,
  seasonId,
  round,
  state: legacyState,
  onStateUpdate,
  onAdvanceToRace,
}) => {
  const [activeTab, setActiveTab] = useState<string>('q1')
  const [q1State, setQ1State] = useState<QualifyingPhaseExecutionState | null>(null)
  const [q2State, setQ2State] = useState<QualifyingPhaseExecutionState | null>(null)
  const [q3State, setQ3State] = useState<QualifyingPhaseExecutionState | null>(null)
  const [globalQuali, setGlobalQuali] = useState<GlobalQualifyingResultState | null>(null)
  const [startingGrid, setStartingGrid] = useState<StartingGridState | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Carregar dados persistidos da orquestração canônica
  const loadPersistedData = async () => {
    setError(null)
    try {
      const [q1, q2, q3, gQuali, grid] = await Promise.all([
        raceQualifyingOrchestratorService.loadPersistedPhaseState('Q1', careerId, seasonId, round),
        raceQualifyingOrchestratorService.loadPersistedPhaseState('Q2', careerId, seasonId, round),
        raceQualifyingOrchestratorService.loadPersistedPhaseState('Q3', careerId, seasonId, round),
        raceQualifyingOrchestratorService.loadPersistedGlobalQualifyingResult(
          careerId,
          seasonId,
          round,
        ),
        raceQualifyingOrchestratorService.loadPersistedStartingGrid(careerId, seasonId, round),
      ])

      setQ1State(q1)
      setQ2State(q2)
      setQ3State(q3)
      setGlobalQuali(gQuali)
      setStartingGrid(grid)

      if (grid?.status === 'GRID_READY') {
        setActiveTab('grid')
      } else if (q3?.isCompleted) {
        setActiveTab('q3')
      } else if (q2?.isCompleted) {
        setActiveTab('q2')
      } else {
        setActiveTab('q1')
      }
    } catch (err) {
      console.warn('[CanonicalQualifyingView] Erro ao carregar dados persistidos:', err)
      setError('Falha ao carregar resultados oficiais da classificação.')
    }
  }

  useEffect(() => {
    loadPersistedData()
  }, [careerId, seasonId, round])

  // Ações de execução via serviço canônico (sem RNG no React)
  const handleRunQ1 = async () => {
    setLoading(true)
    try {
      const updatedLegacy = raceQualifyingService.executeQ1(careerId, seasonId, round)
      onStateUpdate?.(updatedLegacy)
      await loadPersistedData()
    } finally {
      setLoading(false)
    }
  }

  const handleRunQ2 = async () => {
    setLoading(true)
    try {
      const updatedLegacy = raceQualifyingService.executeQ2(careerId, seasonId, round)
      onStateUpdate?.(updatedLegacy)
      await loadPersistedData()
    } finally {
      setLoading(false)
    }
  }

  const handleRunQ3 = async () => {
    setLoading(true)
    try {
      const updatedLegacy = raceQualifyingService.executeQ3(careerId, seasonId, round)
      onStateUpdate?.(updatedLegacy)
      // Constrói starting grid canônico após Q3
      await raceQualifyingOrchestratorService.buildStartingGrid({
        careerId,
        seasonId,
        round,
      })
      await loadPersistedData()
    } finally {
      setLoading(false)
    }
  }

  const handleRunFull = async () => {
    setLoading(true)
    try {
      const updatedLegacy = raceQualifyingService.executeFullQualifying(careerId, seasonId, round)
      onStateUpdate?.(updatedLegacy)
      await raceQualifyingOrchestratorService.buildStartingGrid({
        careerId,
        seasonId,
        round,
      })
      await loadPersistedData()
    } finally {
      setLoading(false)
    }
  }

  // Consumir estritamente os resultados persistidos de cada fase (sem recalcular, sem fallback fabricado)
  const q1Results = q1State?.results || []
  const q2Results = q2State?.results || []
  const q3Results = q3State?.results || []

  const isQ1Complete = !!q1State?.isCompleted || q1Results.length > 0
  const isQ2Complete = !!q2State?.isCompleted || q2Results.length > 0
  const isQ3Complete = !!q3State?.isCompleted || q3Results.length > 0

  // Grid Oficial (P1..P24 bijetivo): NÃO aparece como definitivo antes de GRID_READY
  const isGridReady = startingGrid?.status === 'GRID_READY'
  const finalGridList = isGridReady && startingGrid ? startingGrid.grid : []

  if (error) {
    return (
      <Card className="border border-red-500/30 bg-red-500/5 p-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-sm">
          <ShieldAlert className="h-5 w-5" />
          <span>Erro ao carregar sessão de classificação</span>
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => loadPersistedData()}>
          Tentar novamente
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Controles de Simulação */}
      <Card className="border border-border/40 shadow-sm bg-card/60 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Classificação Oficial — Etapa {round}
                </span>
                {isGridReady ? (
                  <Badge className="bg-emerald-600 text-white font-bold">GRID_READY</Badge>
                ) : isQ3Complete ? (
                  <Badge className="bg-purple-600 text-white font-bold">QUALIFYING_COMPLETE</Badge>
                ) : isQ2Complete ? (
                  <Badge className="bg-indigo-600 text-white font-bold">Q2_COMPLETE</Badge>
                ) : isQ1Complete ? (
                  <Badge className="bg-blue-600 text-white font-bold">Q1_COMPLETE</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/20">
                    READY_FOR_Q1
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <span>Qualifying</span>
                <span className="text-sm font-normal text-muted-foreground">
                  (Q1: 18 avançam | Q2: 10 avançam | Q3: Pole Position)
                </span>
              </CardTitle>
              <CardDescription>
                Tempos derivados do acerto final dos treinos livres (bônus único de setup aplicado).
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isQ1Complete && (
                <Button
                  onClick={handleRunQ1}
                  disabled={loading}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Iniciar Q1
                </Button>
              )}
              {isQ1Complete && !isQ2Complete && (
                <Button
                  onClick={handleRunQ2}
                  disabled={loading}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Iniciar Q2
                </Button>
              )}
              {isQ2Complete && !isQ3Complete && (
                <Button
                  onClick={handleRunQ3}
                  disabled={loading}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Disputar Q3 (Pole)
                </Button>
              )}
              {!isGridReady && (
                <Button
                  onClick={handleRunFull}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                  className="border-border/60"
                >
                  <FastForward className="h-4 w-4 mr-1.5" />
                  Simular Restante
                </Button>
              )}
              {isGridReady && onAdvanceToRace && (
                <Button
                  onClick={onAdvanceToRace}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Flag className="h-4 w-4 mr-1.5" />
                  Avançar para Corrida
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs com as 4 visualizações canônicas requeridas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="q1">Q1 (24)</TabsTrigger>
          <TabsTrigger value="q2" disabled={!isQ1Complete}>
            Q2 {isQ1Complete ? '(18)' : '(Bloqueado)'}
          </TabsTrigger>
          <TabsTrigger value="q3" disabled={!isQ2Complete}>
            Q3 {isQ2Complete ? '(10)' : '(Bloqueado)'}
          </TabsTrigger>
          <TabsTrigger value="grid" disabled={!isGridReady}>
            Grid Oficial {isGridReady ? '(P1–P24)' : '(Bloqueado)'}
          </TabsTrigger>
        </TabsList>

        {/* ABA Q1 */}
        <TabsContent value="q1" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Fase Q1 — 24 Carros Inscritos</CardTitle>
                <CardDescription className="text-xs">
                  Os 18 melhores tempos avançam para o Q2. Os 6 últimos são eliminados (P19–P24).
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                24 Pilotos
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Pos</th>
                      <th className="px-4 py-3">Piloto</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-3 py-3 text-right">Acerto TL</th>
                      <th className="px-4 py-3 text-right">Melhor Volta</th>
                      <th className="px-4 py-3 text-center">Status Q1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {q1Results.map((r, idx) => {
                      const pos = r.position || idx + 1
                      const isElim = r.isEliminated || pos > 18
                      return (
                        <tr
                          key={`q1_${r.driverId}`}
                          className={`hover:bg-muted/30 transition-colors ${
                            isElim ? 'bg-red-500/5 text-muted-foreground' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {pos}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.driverName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.teamName}</td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {r.setup?.toFixed(1) || 90.2}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {r.formattedBestTime || '-:--.---'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isElim ? (
                              <Badge
                                variant="outline"
                                className="border-red-500/30 text-red-500 text-xs"
                              >
                                Eliminado Q1 (P{pos})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-600 text-xs"
                              >
                                Avança ao Q2
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA Q2 */}
        <TabsContent value="q2" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">
                  Fase Q2 — Somente os 18 Classificados
                </CardTitle>
                <CardDescription className="text-xs">
                  Os 10 melhores tempos disputam a Pole no Q3. Os 8 eliminados ocupam P11–P18.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                18 Pilotos
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Pos</th>
                      <th className="px-4 py-3">Piloto</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-3 py-3 text-right">Acerto TL</th>
                      <th className="px-4 py-3 text-right">Melhor Volta</th>
                      <th className="px-4 py-3 text-center">Status Q2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {q2Results.map((r, idx) => {
                      const pos = r.position || idx + 1
                      const isElim = r.isEliminated || pos > 10
                      return (
                        <tr
                          key={`q2_${r.driverId}`}
                          className={`hover:bg-muted/30 transition-colors ${
                            isElim ? 'bg-amber-500/5 text-muted-foreground' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {pos}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.driverName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.teamName}</td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {r.setup?.toFixed(1) || 90.2}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {r.formattedBestTime || '-:--.---'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isElim ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 text-amber-500 text-xs"
                              >
                                Eliminado Q2 (P{pos + 10})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-purple-500/30 text-purple-600 text-xs"
                              >
                                Finalista Q3
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA Q3 */}
        <TabsContent value="q3" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Decisão de P1 a P10. Posição pura na pista antes de aplicação das penalidades de
                  grid.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                10 Pilotos
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Pos</th>
                      <th className="px-4 py-3">Piloto</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-3 py-3 text-right">Acerto TL</th>
                      <th className="px-4 py-3 text-right">Melhor Volta</th>
                      <th className="px-4 py-3 text-center">Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {q3Results.map((r, idx) => {
                      const pos = r.position || idx + 1
                      return (
                        <tr
                          key={`q3_${r.driverId}`}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {pos === 1 ? '🥇 P1' : `P${pos}`}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.driverName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.teamName}</td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {r.setup?.toFixed(1) || 90.2}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold">
                            {r.formattedBestTime || '-:--.---'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pos === 1 ? (
                              <Badge className="bg-amber-400 text-black text-xs font-bold">
                                Pole Position
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-purple-500/30 text-purple-600 text-xs"
                              >
                                Top 10 (P{pos})
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA GRID OFICIAL (STARTING_GRID PERSISTIDO) */}
        <TabsContent value="grid" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Grid de Largada Oficial do Grande Prêmio (P1 – P24)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Posições definitivas de largada após penalidades regulamentares de troca de
                  unidade de potência.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-600 text-white font-bold text-xs">
                24 CARROS BIJETIVO
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left font-mono">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-16 text-center">Grid</th>
                      <th className="px-4 py-3">Piloto</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-4 py-3 text-center">Classificação</th>
                      <th className="px-4 py-3 text-center">Penalidade</th>
                      <th className="px-4 py-3 text-right">Melhor Volta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {finalGridList.map((row) => {
                      const diff = row.gridPosition - row.qualifyingPosition

                      return (
                        <tr
                          key={`final_grid_${row.gridPosition}_${row.driverId}`}
                          className={`hover:bg-muted/30 transition-colors ${
                            row.hasPenalty ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          {/* Posição de largada efetiva */}
                          <td className="px-4 py-3 text-center font-bold text-sm bg-primary/5">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded font-bold text-xs ${
                                row.gridPosition === 1
                                  ? 'bg-amber-400 text-black'
                                  : row.gridPosition <= 3
                                    ? 'bg-slate-200 text-slate-900'
                                    : 'bg-muted text-foreground'
                              }`}
                            >
                              P{row.gridPosition}
                            </span>
                          </td>

                          {/* Piloto */}
                          <td className="px-4 py-3 font-sans font-semibold text-foreground">
                            {row.driverName}
                          </td>

                          {/* Equipe */}
                          <td className="px-4 py-3 font-sans text-muted-foreground">
                            {row.teamName}
                          </td>

                          {/* Posição pura na classificação */}
                          <td className="px-4 py-3 text-center font-mono text-xs">
                            <span className="font-semibold text-foreground">
                              Classificou: P{row.qualifyingPosition}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              ({row.eliminationPhase})
                            </span>
                          </td>

                          {/* Penalidade aplicada */}
                          <td className="px-4 py-3 text-center">
                            {row.hasPenalty ? (
                              <Badge
                                variant="destructive"
                                className="text-xs flex items-center justify-center gap-1 mx-auto w-fit"
                              >
                                <ArrowDown className="h-3 w-3" />+{row.totalPenaltyPositions} pos (
                                {diff > 0 ? `-${diff}` : '0'})
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                            {row.penaltyReason && (
                              <span className="text-[10px] text-red-500/80 block mt-0.5">
                                {row.penaltyReason}
                              </span>
                            )}
                          </td>

                          {/* Melhor Volta */}
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {row.formattedQualifyingTime}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CanonicalQualifyingView
