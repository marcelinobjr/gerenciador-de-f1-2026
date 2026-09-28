/**
 * src/components/race/SprintQualifyingPhaseTabs.tsx
 *
 * RACE-SPRINT-SLOTS-01B: Visualizador das subfases SQ1 -> SQ2 -> SQ3 do Slot 2 (Quali Sprint).
 * Reutiliza estritamente o componente QualifyingPhaseView sem duplicar visual ou lógica esportiva.
 */

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QualifyingPhaseView } from './QualifyingPhaseView'
import type {
  QualifyingPhaseExecutionState,
  SprintQualifyingResultState,
  SprintStartingGridState,
} from '@/services/raceQualifyingOrchestratorService'

export interface SprintQualifyingPhaseTabsProps {
  sq1State: QualifyingPhaseExecutionState | null
  sq2State: QualifyingPhaseExecutionState | null
  sq3State: QualifyingPhaseExecutionState | null
  sprintResult?: SprintQualifyingResultState | null
  sprintGrid?: SprintStartingGridState | null
  loading?: boolean
  error?: string | null
}

export const SprintQualifyingPhaseTabs: React.FC<SprintQualifyingPhaseTabsProps> = ({
  sq1State,
  sq2State,
  sq3State,
  sprintResult,
  sprintGrid,
  loading = false,
  error = null,
}) => {
  const [activeTab, setActiveTab] = React.useState<string>('sq1')

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-muted/60 p-1">
          <TabsTrigger value="sq1" className="text-xs">
            SQ1 {sq1State?.isCompleted && '✓'}
          </TabsTrigger>
          <TabsTrigger value="sq2" className="text-xs" disabled={!sq1State?.isCompleted}>
            SQ2 {sq2State?.isCompleted && '✓'}
          </TabsTrigger>
          <TabsTrigger value="sq3" className="text-xs" disabled={!sq2State?.isCompleted}>
            SQ3 {sq3State?.isCompleted && '✓'}
          </TabsTrigger>
          <TabsTrigger value="result" className="text-xs" disabled={!sprintResult}>
            Resultado Sprint {sprintResult && '✓'}
          </TabsTrigger>
          <TabsTrigger value="grid" className="text-xs" disabled={!sprintGrid}>
            Grid da Sprint {sprintGrid && '✓'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sq1" className="mt-4">
          <QualifyingPhaseView phase="SQ1" state={sq1State} loading={loading} error={error} />
        </TabsContent>

        <TabsContent value="sq2" className="mt-4">
          <QualifyingPhaseView phase="SQ2" state={sq2State} loading={loading} error={error} />
        </TabsContent>

        <TabsContent value="sq3" className="mt-4">
          <QualifyingPhaseView phase="SQ3" state={sq3State} loading={loading} error={error} />
        </TabsContent>

        <TabsContent value="result" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Resultado Oficial da Qualificação Sprint</span>
                <Badge variant="outline">24 Pilotos</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Classificação pura P1..P24 formada pelas três fases eliminatórias da Sprint (SQ3,
                SQ2, SQ1).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Pos</th>
                      <th className="px-4 py-3">Piloto</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-3 py-3 text-center">Fase</th>
                      <th className="px-4 py-3 text-right">Melhor Volta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {sprintResult?.results && sprintResult.results.length > 0 ? (
                      sprintResult.results.map((entry) => (
                        <tr key={`sprint_res_${entry.driverId}`} className="hover:bg-muted/30">
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {entry.position === 1 ? '🥇 P1' : `P${entry.position}`}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {entry.driverName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{entry.teamName}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                entry.eliminationPhase === 'SQ3'
                                  ? 'border-purple-500/40 text-purple-600'
                                  : entry.eliminationPhase === 'SQ2'
                                    ? 'border-amber-500/40 text-amber-500'
                                    : 'border-red-500/40 text-red-500'
                              }
                            >
                              {entry.eliminationPhase}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold">
                            {entry.formattedPhaseBestTime || '-:--.---'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          Resultado da Qualificação Sprint ainda não consolidado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grid" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Grid de Largada da Corrida Sprint</span>
                <Badge className="bg-emerald-600 text-white text-xs">Grid Oficial</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Ordem oficial de largada para a Corrida Sprint derivada da Quali Sprint.
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
                      <th className="px-3 py-3 text-center">Quali SQ</th>
                      <th className="px-4 py-3 text-right">Tempo SQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {sprintGrid?.grid && sprintGrid.grid.length > 0 ? (
                      sprintGrid.grid.map((entry) => (
                        <tr key={`sprint_grid_${entry.driverId}`} className="hover:bg-muted/30">
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                            {entry.gridPosition === 1 ? '🥇 P1' : `P${entry.gridPosition}`}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {entry.driverName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{entry.teamName}</td>
                          <td className="px-3 py-3 text-center font-mono text-xs">
                            {entry.eliminationPhase} (P{entry.qualifyingPosition})
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {entry.formattedQualifyingTime || '-:--.---'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          Grid de largada da Sprint ainda não formado.
                        </td>
                      </tr>
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

export default SprintQualifyingPhaseTabs
