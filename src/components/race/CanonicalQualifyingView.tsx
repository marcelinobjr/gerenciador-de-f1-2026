/**
 * src/components/race/CanonicalQualifyingView.tsx
 *
 * Componente canônico de UI para visualização e controle do Qualifying (Q1 -> Q2 -> Q3 -> GRID_READY).
 * Consome diretamente o raceQualifyingService sem calcular tempos no React.
 * Exibe tempos das tentativas, eliminados/classificados em cada fase e grid de largada após penalidades.
 */

import React, { useState } from 'react'
import {
  raceQualifyingService,
  QualifyingWeekendState,
  QualifyingDriverResult,
  formatLapTimeMs,
} from '@/services/raceQualifyingService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, FastForward, CheckCircle2, AlertTriangle, Flag, ArrowDown } from 'lucide-react'

interface CanonicalQualifyingViewProps {
  careerId: string
  seasonId: string
  round: number
  state: QualifyingWeekendState
  onStateUpdate?: (newState: QualifyingWeekendState) => void
  onAdvanceToRace?: () => void
}

export const CanonicalQualifyingView: React.FC<CanonicalQualifyingViewProps> = ({
  careerId,
  seasonId,
  round,
  state: initialState,
  onStateUpdate,
  onAdvanceToRace,
}) => {
  const [state, setState] = useState<QualifyingWeekendState>(initialState)
  const [activeTab, setActiveTab] = useState<string>('session')

  const updateState = (newState: QualifyingWeekendState) => {
    setState({ ...newState })
    onStateUpdate?.(newState)
  }

  const handleRunQ1 = () => {
    const updated = raceQualifyingService.executeQ1(careerId, seasonId, round)
    updateState(updated)
  }

  const handleRunQ2 = () => {
    const updated = raceQualifyingService.executeQ2(careerId, seasonId, round)
    updateState(updated)
  }

  const handleRunQ3 = () => {
    const updated = raceQualifyingService.executeQ3(careerId, seasonId, round)
    updateState(updated)
  }

  const handleRunFull = () => {
    const updated = raceQualifyingService.executeFullQualifying(careerId, seasonId, round)
    updateState(updated)
  }

  // Ordena para visualização por posição ou fase
  const sortedByQuali = [...state.results].sort((a, b) => {
    if (a.qualifyingPosition && b.qualifyingPosition) {
      return a.qualifyingPosition - b.qualifyingPosition
    }
    return (a.q1TimeMs ?? 999999) - (b.q1TimeMs ?? 999999)
  })

  const sortedByStartingGrid = [...state.results].sort((a, b) => {
    return a.startingGridPosition - b.startingGridPosition
  })

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'READY_FOR_Q1':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Pronto para Q1
          </Badge>
        )
      case 'Q1':
        return (
          <Badge variant="default" className="bg-blue-600">
            Q1 em Andamento
          </Badge>
        )
      case 'Q2':
        return (
          <Badge variant="default" className="bg-indigo-600">
            Q2 em Andamento
          </Badge>
        )
      case 'Q3':
        return (
          <Badge variant="default" className="bg-purple-600">
            Q3 Disputa Pole
          </Badge>
        )
      case 'GRID_READY':
        return (
          <Badge variant="default" className="bg-emerald-600">
            Grid Consolidado
          </Badge>
        )
      default:
        return <Badge variant="secondary">{phase}</Badge>
    }
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
                {getPhaseBadge(state.phase)}
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
              {state.phase === 'READY_FOR_Q1' && (
                <Button onClick={handleRunQ1} size="sm" className="bg-primary hover:bg-primary/90">
                  <Play className="h-4 w-4 mr-1.5" />
                  Iniciar Q1
                </Button>
              )}
              {state.phase === 'Q2' && (
                <Button
                  onClick={handleRunQ2}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Iniciar Q2
                </Button>
              )}
              {state.phase === 'Q3' && (
                <Button
                  onClick={handleRunQ3}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Disputar Q3 (Pole)
                </Button>
              )}
              {!state.isComplete && (
                <Button
                  onClick={handleRunFull}
                  size="sm"
                  variant="outline"
                  className="border-border/60"
                >
                  <FastForward className="h-4 w-4 mr-1.5" />
                  Simular Restante
                </Button>
              )}
              {state.isComplete && onAdvanceToRace && (
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

      {/* Tabs: Tabela Geral de Sessões vs Grid Final de Largada */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="session">Tempos Q1 / Q2 / Q3</TabsTrigger>
          <TabsTrigger value="grid" disabled={!state.isComplete}>
            Grid de Largada {state.isComplete ? '' : '(Bloqueado)'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tempos por Fase */}
        <TabsContent value="session" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Pos</th>
                      <th className="px-4 py-3">Piloto / Equipe</th>
                      <th className="px-3 py-3 text-right">Acerto (TL)</th>
                      <th className="px-4 py-3 text-right">Q1 (18)</th>
                      <th className="px-4 py-3 text-right">Q2 (10)</th>
                      <th className="px-4 py-3 text-right">Q3 (Pole)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {sortedByQuali.map((driver: QualifyingDriverResult, index: number) => {
                      const pos = driver.qualifyingPosition || index + 1
                      const isElimQ1 = driver.eliminatedInPhase === 'Q1'
                      const isElimQ2 = driver.eliminatedInPhase === 'Q2'
                      const isQ3Top = pos <= 10 && state.phase === 'GRID_READY'

                      return (
                        <tr
                          key={driver.driverId}
                          className={`hover:bg-muted/30 transition-colors ${
                            isElimQ1
                              ? 'bg-red-500/5 text-muted-foreground'
                              : isElimQ2
                                ? 'bg-amber-500/5'
                                : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {pos}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{driver.driverName}</div>
                            <div className="text-xs text-muted-foreground">{driver.teamName}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {driver.setup.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {formatLapTimeMs(driver.q1TimeMs)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {driver.q2TimeMs ? (
                              formatLapTimeMs(driver.q2TimeMs)
                            ) : isElimQ1 ? (
                              <span className="text-xs text-red-500/70 italic">Eliminado Q1</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-medium">
                            {driver.q3TimeMs ? (
                              formatLapTimeMs(driver.q3TimeMs)
                            ) : isElimQ1 || isElimQ2 ? (
                              <span className="text-xs text-muted-foreground/60 italic">-</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isElimQ1 && (
                              <Badge
                                variant="outline"
                                className="text-xs border-red-500/30 text-red-500"
                              >
                                Eliminado Q1
                              </Badge>
                            )}
                            {isElimQ2 && (
                              <Badge
                                variant="outline"
                                className="text-xs border-amber-500/30 text-amber-500"
                              >
                                Eliminado Q2
                              </Badge>
                            )}
                            {isQ3Top && (
                              <Badge variant="default" className="text-xs bg-emerald-600">
                                {pos === 1 ? 'Pole Position' : `Top 10 (P${pos})`}
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

        {/* Tab 2: Grid de Largada Definitivo após Penalidades */}
        <TabsContent value="grid" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Grid de Largada Oficial</CardTitle>
              <CardDescription>
                Posições finais após aplicação do regulamento desportivo e penalidades de trocas de
                unidade de potência.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-16 text-center">Grid</th>
                      <th className="px-4 py-3">Piloto</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-4 py-3 text-center">Quali Pura</th>
                      <th className="px-4 py-3 text-center">Penalidade</th>
                      <th className="px-4 py-3 text-right">Melhor Tempo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {sortedByStartingGrid.map((driver: QualifyingDriverResult) => {
                      const hasPenalty = (driver.gridPenaltyPositions ?? 0) > 0
                      const diff = driver.startingGridPosition - driver.qualifyingPosition

                      return (
                        <tr key={driver.driverId} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center font-mono font-bold text-sm bg-primary/5">
                            P{driver.startingGridPosition}
                          </td>
                          <td className="px-4 py-3 font-semibold">{driver.driverName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{driver.teamName}</td>
                          <td className="px-4 py-3 text-center font-mono text-xs">
                            P{driver.qualifyingPosition}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasPenalty ? (
                              <Badge
                                variant="destructive"
                                className="text-xs flex items-center justify-center gap-1 mx-auto w-fit"
                              >
                                <ArrowDown className="h-3 w-3" />+{driver.gridPenaltyPositions} pos
                                ({diff > 0 ? `-${diff}` : '0'})
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {formatLapTimeMs(driver.bestTimeMs)}
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
