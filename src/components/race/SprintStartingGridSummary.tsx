/**
 * src/components/race/SprintStartingGridSummary.tsx
 *
 * RACE-SPRINT-SLOTS-01B3C-UI: Componente visual dedicado para renderização
 * do Grid Oficial da Corrida Sprint a partir EXCLUSIVAMENTE de SPRINT_STARTING_GRID.
 *
 * INVARIANTES:
 * 1. FONTE EXCLUSIVA: SPRINT_STARTING_GRID persistido. Não lê STARTING_GRID do GP,
 *    não lê SQ1/SQ2/SQ3, não lê SPRINT_QUALIFYING_RESULT no React.
 * 2. ZERO CÁLCULO ESPORTIVO: Apenas apresentação tabular idêntica em estilo ao Grid Oficial.
 * 3. 24 PARTICIPANTES: P1 a P24 bijetivo, contínuo, sem pilotos duplicados.
 * 4. SEM PENALIDADES INVENTADAS: Nesta versão não há penalidades pré-sprint homologadas.
 * 5. ESTADOS: Loading, Not Ready ("Grid Sprint ainda não definido"), Available, Error.
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ShieldAlert, Clock } from 'lucide-react'
import {
  raceQualifyingOrchestratorService,
  type SprintStartingGridState,
} from '@/services/raceQualifyingOrchestratorService'

export interface SprintStartingGridSummaryProps {
  sprintGrid: SprintStartingGridState | null
  loading?: boolean
  error?: string | null
}

/**
 * Reader explícito e canônico para SPRINT_STARTING_GRID persistido.
 * Garante fonte única e isolamento absoluto contra STARTING_GRID da corrida principal.
 */
export async function readSprintStartingGrid(
  careerId: string,
  seasonId: string,
  round: number,
): Promise<SprintStartingGridState | null> {
  return raceQualifyingOrchestratorService.loadPersistedSprintStartingGrid(
    careerId,
    seasonId,
    round,
  )
}

export const SprintStartingGridSummary: React.FC<SprintStartingGridSummaryProps> = ({
  sprintGrid,
  loading = false,
  error = null,
}) => {
  if (error) {
    return (
      <Card
        className="border border-red-500/30 bg-red-500/5 p-6 text-center space-y-2"
        data-testid="sprint-grid-error"
      >
        <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-sm">
          <ShieldAlert className="h-5 w-5" />
          <span>Erro ao carregar o Grid de Largada da Sprint</span>
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
      </Card>
    )
  }

  const isGridReady = sprintGrid?.status === 'SPRINT_GRID_READY'
  const gridEntries = isGridReady && sprintGrid?.grid ? sprintGrid.grid : []

  return (
    <Card className="border-purple-500/20" data-testid="sprint-starting-grid-summary">
      <CardHeader className="py-3 px-4 bg-purple-950/10 border-b border-border/40 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Grid de Largada da Corrida Sprint (P1 – P24)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Ordem oficial de largada para a Corrida Sprint derivada EXCLUSIVAMENTE de
            SPRINT_STARTING_GRID persistido.
          </CardDescription>
        </div>
        {isGridReady && gridEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-purple-500/50 text-purple-400 font-bold text-[10px] uppercase font-mono"
            >
              SPRINT_STARTING_GRID
            </Badge>
            <Badge className="bg-emerald-600 text-white font-bold text-xs font-mono">
              {gridEntries.length} CARROS BIJETIVO
            </Badge>
          </div>
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
                <th className="px-4 py-3 text-center">Qualificação Sprint</th>
                <th className="px-4 py-3 text-right">Melhor Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-xs text-muted-foreground"
                    data-testid="sprint-grid-loading"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 animate-spin text-purple-400" />
                      <span>Carregando grid de largada oficial da Sprint...</span>
                    </div>
                  </td>
                </tr>
              ) : !isGridReady || gridEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-xs text-muted-foreground"
                    data-testid="sprint-grid-not-ready"
                  >
                    Grid Sprint ainda não definido (aguardando conclusão da Qualificação Sprint).
                  </td>
                </tr>
              ) : (
                gridEntries.map((row) => (
                  <tr
                    key={`sprint_grid_row_${row.gridPosition}_${row.driverId}`}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`sprint-grid-row-${row.gridPosition}`}
                  >
                    {/* Posição de largada Sprint */}
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
                    <td className="px-4 py-3 font-sans text-muted-foreground">{row.teamName}</td>

                    {/* Posição pura na classificação Sprint (sem badges de penalidade pré-sprint inventadas) */}
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">
                          P{row.qualifyingPosition}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          ({row.eliminationPhase})
                        </span>
                      </div>
                    </td>

                    {/* Melhor Tempo registrado */}
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {row.formattedQualifyingTime || '-:--.---'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default SprintStartingGridSummary
