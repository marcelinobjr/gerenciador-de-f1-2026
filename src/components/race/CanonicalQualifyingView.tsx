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
  type SprintQualifyingResultState,
  type SprintStartingGridState,
} from '@/services/raceQualifyingOrchestratorService'
import { raceQualifyingService, QualifyingWeekendState } from '@/services/raceQualifyingService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, FastForward, Flag, ArrowDown, Trophy, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { QualifyingPhaseView } from './QualifyingPhaseView'

export interface CanonicalQualifyingViewProps {
  careerId: string
  seasonId: string
  round: number
  variant?: 'MAIN_QUALIFYING' | 'SPRINT_QUALIFYING'
  state?: QualifyingWeekendState
  onStateUpdate?: (newState: QualifyingWeekendState) => void
  onAdvanceToRace?: () => void
  onAdvanceToSprint?: () => void
}

export const CanonicalQualifyingView: React.FC<CanonicalQualifyingViewProps> = ({
  careerId,
  seasonId,
  round,
  variant = 'MAIN_QUALIFYING',
  state: legacyState,
  onStateUpdate,
  onAdvanceToRace,
  onAdvanceToSprint,
}) => {
  const isSprint = variant === 'SPRINT_QUALIFYING'
  const [activeTab, setActiveTab] = useState<string>(isSprint ? 'sq1' : 'q1')
  const [sq1State, setSq1State] = useState<QualifyingPhaseExecutionState | null>(null)
  const [sq2State, setSq2State] = useState<QualifyingPhaseExecutionState | null>(null)
  const [sq3State, setSq3State] = useState<QualifyingPhaseExecutionState | null>(null)
  const [sprintResult, setSprintResult] = useState<SprintQualifyingResultState | null>(null)
  const [sprintGrid, setSprintGrid] = useState<SprintStartingGridState | null>(null)
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
    setLoading(true)
    try {
      if (isSprint) {
        const [sq1, sq2, sq3, sResult, sGrid] = await Promise.all([
          raceQualifyingOrchestratorService.loadPersistedPhaseState(
            'SQ1',
            careerId,
            seasonId,
            round,
          ),
          raceQualifyingOrchestratorService.loadPersistedPhaseState(
            'SQ2',
            careerId,
            seasonId,
            round,
          ),
          raceQualifyingOrchestratorService.loadPersistedPhaseState(
            'SQ3',
            careerId,
            seasonId,
            round,
          ),
          raceQualifyingOrchestratorService.loadPersistedSprintQualifyingResult(
            careerId,
            seasonId,
            round,
          ),
          raceQualifyingOrchestratorService.loadPersistedSprintStartingGrid(
            careerId,
            seasonId,
            round,
          ),
        ])

        setSq1State(sq1)
        setSq2State(sq2)
        setSq3State(sq3)
        setSprintResult(sResult)
        setSprintGrid(sGrid)

        if (sGrid?.status === 'SPRINT_GRID_READY') {
          setActiveTab('grid')
        } else if (sq3?.isCompleted) {
          setActiveTab('sq3')
        } else if (sq2?.isCompleted) {
          setActiveTab('sq2')
        } else {
          setActiveTab('sq1')
        }
      } else {
        const [q1, q2, q3, gQuali, grid] = await Promise.all([
          raceQualifyingOrchestratorService.loadPersistedPhaseState(
            'Q1',
            careerId,
            seasonId,
            round,
          ),
          raceQualifyingOrchestratorService.loadPersistedPhaseState(
            'Q2',
            careerId,
            seasonId,
            round,
          ),
          raceQualifyingOrchestratorService.loadPersistedPhaseState(
            'Q3',
            careerId,
            seasonId,
            round,
          ),
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

        // Validação estrita de integridade do STARTING_GRID:
        // Se status é GRID_READY, deve ter exatamente os participantes previstos, posições contínuas P1..N sem duplicados
        if (grid?.status === 'GRID_READY') {
          if (!grid.grid || grid.grid.length === 0) {
            setError('Erro de integridade do grid: lista de posições vazia em GRID_READY.')
          } else {
            const driverIds = new Set(grid.grid.map((g) => g.driverId))
            if (driverIds.size !== grid.grid.length) {
              setError(
                'Erro de integridade do grid: pilotos duplicados detectados no STARTING_GRID.',
              )
            }
          }
          setActiveTab('grid')
        } else if (q3?.isCompleted) {
          setActiveTab('q3')
        } else if (q2?.isCompleted) {
          setActiveTab('q2')
        } else {
          setActiveTab('q1')
        }
      }
    } catch (err) {
      console.warn('[CanonicalQualifyingView] Erro ao carregar dados persistidos:', err)
      setError('Falha ao carregar resultados oficiais da classificação.')
    } finally {
      setLoading(false)
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

      {/* Tabs com as 4 visualizações canônicas requeridas + Resultado Global */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="q1">
            Q1 {q1Results.length > 0 ? `(${q1Results.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="q2" disabled={!isQ1Complete}>
            Q2 {isQ1Complete ? `(${q2Results.length || 18})` : '(Bloqueado)'}
          </TabsTrigger>
          <TabsTrigger value="q3" disabled={!isQ2Complete}>
            Q3 {isQ2Complete ? `(${q3Results.length || 10})` : '(Bloqueado)'}
          </TabsTrigger>
          <TabsTrigger value="result" disabled={!globalQuali}>
            Resultado {globalQuali ? '(P1–P24)' : '(Bloqueado)'}
          </TabsTrigger>
          <TabsTrigger value="grid" disabled={!isGridReady}>
            Grid Oficial {isGridReady ? '(P1–P24)' : '(Bloqueado)'}
          </TabsTrigger>
        </TabsList>
        {/* ABA Q1 */}
        <TabsContent value="q1" className="mt-4">
          <QualifyingPhaseView phase="Q1" state={q1State} loading={loading} />
        </TabsContent>

        {/* ABA Q2 */}
        <TabsContent value="q2" className="mt-4">
          <QualifyingPhaseView phase="Q2" state={q2State} loading={loading} />
        </TabsContent>

        {/* ABA Q3 */}
        <TabsContent value="q3" className="mt-4">
          <QualifyingPhaseView phase="Q3" state={q3State} loading={loading} />
        </TabsContent>

        {/* ABA RESULTADO DA CLASSIFICAÇÃO (QUALIFYING_RESULT PERSISTIDO P1–P24) */}
        <TabsContent value="result" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span>Resultado Oficial da Classificação (P1 – P24)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Classificação pura obtida em pista (QUALIFYING_RESULT) antes de aplicação das
                  penalidades de grid.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {globalQuali?.results.length || 0} Pilotos
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
                      <th className="px-4 py-3 text-center">Fase de Eliminação</th>
                      <th className="px-3 py-3 text-right">Acerto TL</th>
                      <th className="px-4 py-3 text-right">Melhor Volta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {!globalQuali || globalQuali.results.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          Resultado da classificação ainda não concluído.
                        </td>
                      </tr>
                    ) : (
                      globalQuali.results.map((r) => (
                        <tr
                          key={`global_quali_${r.position}_${r.driverId}`}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {r.position === 1 ? '🥇 P1' : `P${r.position}`}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.driverName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.teamName}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                r.eliminationPhase === 'Q3'
                                  ? 'border-purple-500/30 text-purple-600 text-xs'
                                  : r.eliminationPhase === 'Q2'
                                    ? 'border-amber-500/30 text-amber-500 text-xs'
                                    : 'border-red-500/30 text-red-500 text-xs'
                              }
                            >
                              {r.eliminationPhase}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {r.setup !== undefined ? `${r.setup.toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold">
                            {r.formattedPhaseBestTime || '-:--.---'}
                          </td>
                        </tr>
                      ))
                    )}
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
              {isGridReady && finalGridList.length > 0 && (
                <Badge className="bg-emerald-600 text-white font-bold text-xs">
                  {finalGridList.length} CARROS BIJETIVO
                </Badge>
              )}
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
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          Carregando grid de largada oficial...
                        </td>
                      </tr>
                    ) : !isGridReady || finalGridList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          Grid oficial ainda não definido (aguardando conclusão do Qualifying).
                        </td>
                      </tr>
                    ) : (
                      finalGridList.map((row) => {
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
                              {row.hasPenalty || row.qualifyingPosition !== row.gridPosition ? (
                                <div>
                                  <span className="font-semibold text-foreground block">
                                    Larga P{row.gridPosition} / Q: P{row.qualifyingPosition}
                                  </span>
                                  <span className="text-[11px] text-amber-500 font-medium block">
                                    Classificou: P{row.qualifyingPosition} / Larga: P
                                    {row.gridPosition}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    ({row.eliminationPhase})
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-foreground block">
                                    P{row.qualifyingPosition}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    ({row.eliminationPhase})
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Penalidade aplicada */}
                            <td className="px-4 py-3 text-center">
                              {row.hasPenalty ? (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <Badge
                                    variant="destructive"
                                    className="text-xs flex items-center justify-center gap-1 mx-auto w-fit font-bold"
                                  >
                                    <ArrowDown className="h-3 w-3" />+{row.totalPenaltyPositions}{' '}
                                    posições
                                    {diff > 0 ? ` (-${diff})` : ''}
                                  </Badge>
                                  {row.penaltyReason && (
                                    <span className="text-[10px] text-red-500/90 font-medium block">
                                      {row.penaltyReason}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>

                            {/* Melhor Volta */}
                            <td className="px-4 py-3 text-right font-mono text-xs">
                              {row.formattedQualifyingTime}
                            </td>
                          </tr>
                        )
                      })
                    )}
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
