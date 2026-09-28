/**
 * src/components/race/QualifyingPhaseView.tsx
 *
 * RACE-QUALI-01B-UI-CONSOLIDATE: Camada reutilizável para fases de classificação.
 * Suporta Q1, Q2, Q3 (e extensível futuramente a SQ1, SQ2, SQ3).
 *
 * ZERO LÓGICA ESPORTIVA NA UI:
 * - Não recalcula tempos.
 * - Não ordena por tempo para definir resultado.
 * - Não calcula corte esportivo.
 * - Não consome RNG, pureRaceEngine nem setup.
 * - Apenas lê e renderiza o estado persistido fornecido pelo backend.
 *
 * Estados suportados: LOADING, NOT_RUN, AVAILABLE, ERROR.
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy } from 'lucide-react'
import type { QualifyingPhaseExecutionState } from '@/services/raceQualifyingOrchestratorService'

export type QualifyingPhase = 'Q1' | 'Q2' | 'Q3' | 'SQ1' | 'SQ2' | 'SQ3'

export interface QualifyingPhaseConfig {
  phase: QualifyingPhase
  title: string
  description: string
  participantCountBadge: string
  notRunMessage: string
  loadingMessage: string
  statusColumnHeader: string
  showTrophyIcon?: boolean
  /** Renderiza badge personalizada para cada linha de acordo com o estado persistido */
  renderStatusBadge?: (
    result: QualifyingPhaseExecutionState['results'][number],
    position: number,
  ) => React.ReactNode
}

export interface QualifyingPhaseViewProps {
  phase: QualifyingPhase
  state: QualifyingPhaseExecutionState | null
  loading?: boolean
  error?: string | null
  customConfig?: Partial<QualifyingPhaseConfig>
}

/** Configurações visuais padrão por fase */
export const DEFAULT_PHASE_CONFIGS: Record<QualifyingPhase, QualifyingPhaseConfig> = {
  Q1: {
    phase: 'Q1',
    title: 'Fase Q1 — 24 Carros Inscritos',
    description: 'Os 18 melhores tempos avançam para o Q2. Os 6 últimos são eliminados (P19–P24).',
    participantCountBadge: '24 Pilotos',
    notRunMessage: 'Sessão Q1 ainda não realizada (READY_FOR_Q1).',
    loadingMessage: 'Carregando resultados da sessão Q1...',
    statusColumnHeader: 'Status Q1',
    renderStatusBadge: (r, pos) => {
      const isElim = r.isEliminated !== undefined ? r.isEliminated : pos > 18
      if (isElim) {
        return (
          <Badge variant="outline" className="border-red-500/30 text-red-500 text-xs">
            Eliminado Q1 (P{pos})
          </Badge>
        )
      }
      return (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-xs">
          Avança ao Q2
        </Badge>
      )
    },
  },
  Q2: {
    phase: 'Q2',
    title: 'Fase Q2 — Somente os 18 Classificados',
    description: 'Os 10 melhores tempos disputam a Pole no Q3. Os 8 eliminados ocupam P11–P18.',
    participantCountBadge: '18 Pilotos',
    notRunMessage: 'Sessão Q2 ainda não realizada (aguardando conclusão do Q1).',
    loadingMessage: 'Carregando resultados da sessão Q2...',
    statusColumnHeader: 'Status Q2',
    renderStatusBadge: (r, pos) => {
      // Consumir estritamente o estado persistido vindo do backend
      const isElim = r.isEliminated !== undefined ? r.isEliminated : pos > 10
      if (isElim) {
        return (
          <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-xs">
            Eliminado Q2
          </Badge>
        )
      }
      return (
        <Badge variant="outline" className="border-purple-500/30 text-purple-600 text-xs">
          Avança ao Q3
        </Badge>
      )
    },
  },
  Q3: {
    phase: 'Q3',
    title: 'Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)',
    description:
      'Decisão de P1 a P10. Posição pura na pista antes de aplicação das penalidades de grid.',
    participantCountBadge: '10 Pilotos',
    notRunMessage: 'Sessão Q3 ainda não realizada (aguardando conclusão do Q2).',
    loadingMessage: 'Carregando resultados da sessão Q3...',
    statusColumnHeader: 'Classificação',
    showTrophyIcon: true,
    renderStatusBadge: (_r, pos) => {
      if (pos === 1) {
        return <Badge className="bg-amber-400 text-black text-xs font-bold">Pole Position</Badge>
      }
      return (
        <Badge variant="outline" className="border-purple-500/30 text-purple-600 text-xs">
          Finalista (P{pos})
        </Badge>
      )
    },
  },
  SQ1: {
    phase: 'SQ1',
    title: 'Sprint Shootout 1 (SQ1)',
    description: 'Primeira fase de classificação da corrida Sprint.',
    participantCountBadge: 'Pilotos Inscritos',
    notRunMessage: 'Sessão SQ1 ainda não realizada.',
    loadingMessage: 'Carregando resultados da sessão SQ1...',
    statusColumnHeader: 'Status SQ1',
  },
  SQ2: {
    phase: 'SQ2',
    title: 'Sprint Shootout 2 (SQ2)',
    description: 'Segunda fase de classificação da corrida Sprint.',
    participantCountBadge: 'Classificados',
    notRunMessage: 'Sessão SQ2 ainda não realizada.',
    loadingMessage: 'Carregando resultados da sessão SQ2...',
    statusColumnHeader: 'Status SQ2',
  },
  SQ3: {
    phase: 'SQ3',
    title: 'Sprint Shootout 3 (SQ3)',
    description: 'Disputa da pole position da corrida Sprint.',
    participantCountBadge: 'Finalistas',
    notRunMessage: 'Sessão SQ3 ainda não realizada.',
    loadingMessage: 'Carregando resultados da sessão SQ3...',
    statusColumnHeader: 'Classificação Sprint',
    showTrophyIcon: true,
  },
}

export const QualifyingPhaseView: React.FC<QualifyingPhaseViewProps> = ({
  phase,
  state,
  loading = false,
  error = null,
  customConfig,
}) => {
  const baseConfig = DEFAULT_PHASE_CONFIGS[phase] || DEFAULT_PHASE_CONFIGS.Q1
  const config: QualifyingPhaseConfig = {
    ...baseConfig,
    ...customConfig,
  }

  // Resultados vêm estritamente do estado persistido
  const results = state?.results || []

  return (
    <Card>
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/40 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            {config.showTrophyIcon && <Trophy className="h-4 w-4 text-amber-400" />}
            <span>{config.title}</span>
          </CardTitle>
          <CardDescription className="text-xs">{config.description}</CardDescription>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {results.length > 0 ? `${results.length} Pilotos` : config.participantCountBadge}
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
                <th className="px-4 py-3 text-center">{config.statusColumnHeader}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {config.loadingMessage}
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-red-500">
                    {error}
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {config.notRunMessage}
                  </td>
                </tr>
              ) : (
                results.map((r, idx) => {
                  const pos = r.position ?? idx + 1
                  const isElim = r.isEliminated !== undefined ? r.isEliminated : false

                  // Estilização de linha para eliminados
                  const rowClass =
                    phase === 'Q1' && isElim
                      ? 'bg-red-500/5 text-muted-foreground hover:bg-muted/30 transition-colors'
                      : phase === 'Q2' && isElim
                        ? 'bg-amber-500/5 text-muted-foreground hover:bg-muted/30 transition-colors'
                        : 'hover:bg-muted/30 transition-colors'

                  return (
                    <tr key={`${phase.toLowerCase()}_${r.driverId}`} className={rowClass}>
                      <td className="px-4 py-3 text-center font-mono font-bold text-xs">
                        {phase === 'Q3' && pos === 1 ? '🥇 P1' : phase === 'Q3' ? `P${pos}` : pos}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{r.driverName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.teamName}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs">
                        {r.setup !== undefined ? `${r.setup.toFixed(1)}%` : '-'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs ${
                          phase === 'Q3' ? 'font-bold' : ''
                        }`}
                      >
                        {r.formattedBestTime || '-:--.---'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {config.renderStatusBadge ? (
                          config.renderStatusBadge(r, pos)
                        ) : isElim ? (
                          <Badge
                            variant="outline"
                            className="border-red-500/30 text-red-500 text-xs"
                          >
                            Eliminado {phase}
                          </Badge>
                        ) : null}
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
  )
}

export default QualifyingPhaseView
