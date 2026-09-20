import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, AlertCircle, Clock, ShieldAlert } from 'lucide-react'
import type { QualifyingTimeEntry, QualifyingStageId } from '@/types/canonical-qualifying-types'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

export interface QualifyingLeaderboardTableProps {
  stageId: QualifyingStageId
  entries: QualifyingTimeEntry[]
  playerTeamName?: string
  playerTeamColor?: string
}

export const QualifyingLeaderboardTable: React.FC<QualifyingLeaderboardTableProps> = ({
  stageId,
  entries,
  playerTeamName,
  playerTeamColor,
}) => {
  const rules = CANONICAL_QUALIFYING_RULES[stageId]
  const cutoffPos = rules.advancingCount // Q1: 18, Q2: 10

  // Identificar margem de risco para os carros do jogador
  const playerEntries = entries.filter((e) => e.isPlayer)
  const cutoffEntry = entries.find((e) => e.position === cutoffPos)
  const firstEliminatedEntry = entries.find((e) => e.position === cutoffPos + 1)

  return (
    <Card className="bg-white border border-[#E2E8F0] shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="py-3 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#E10600]" />
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
              Classificação Ao Vivo — {stageId.toUpperCase()}
              <Badge className="bg-[#0F172A] text-white text-[10px] font-bold">
                {entries.length} Pilotos
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Zona de Corte: P1 a P{cutoffPos} avançam para{' '}
              {stageId === 'q1' ? 'o Q2' : stageId === 'q2' ? 'o Q3' : 'o Top 10'} • P
              {cutoffPos + 1}+ eliminados
            </p>
          </div>
        </div>

        {/* Indicador de Risco de Eliminação dos Pilotos do Jogador */}
        {playerEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {playerEntries.map((p) => {
              const isSafe = p.position <= cutoffPos && p.bestLapSec > 0
              let marginText = ''

              if (p.bestLapSec > 0) {
                if (isSafe && firstEliminatedEntry && firstEliminatedEntry.bestLapSec > 0) {
                  const margin = firstEliminatedEntry.bestLapSec - p.bestLapSec
                  marginText = `Margem p/ corte: +${margin.toFixed(3)}s`
                } else if (!isSafe && cutoffEntry && cutoffEntry.bestLapSec > 0) {
                  const deficit = p.bestLapSec - cutoffEntry.bestLapSec
                  marginText = `Atrás do corte: +${deficit.toFixed(3)}s`
                }
              }

              return (
                <div
                  key={p.driverId}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                    isSafe
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800 animate-pulse'
                  }`}
                >
                  {isSafe ? (
                    <Clock className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                  )}
                  <span>
                    {p.driverName} (P{p.position})
                  </span>
                  {marginText && (
                    <span className="font-mono text-[10px] opacity-90">({marginText})</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]/50 text-[10px]">
                <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                <th className="py-2.5 px-3">Piloto</th>
                <th className="py-2.5 px-3">Equipe</th>
                <th className="py-2.5 px-3">Pneu</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Voltas</th>
                <th className="py-2.5 px-3">Melhor Volta</th>
                <th className="py-2.5 px-3 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {entries.map((row, idx) => {
                const isEliminationZone = row.position > cutoffPos
                const isCutoffLine = row.position === cutoffPos
                const logoUrl = getTeamReducedLogoUrl(row.teamName || row.teamId)

                return (
                  <React.Fragment key={`${row.position}_${row.driverId}`}>
                    <tr
                      className={`transition-colors duration-150 ${
                        row.isPlayer
                          ? 'bg-red-50/70 hover:bg-red-50 font-bold border-l-4 border-l-[#E10600]'
                          : isEliminationZone
                            ? 'bg-rose-50/30 hover:bg-rose-50/50 text-[#64748B]'
                            : 'hover:bg-slate-50 text-[#0F172A]'
                      }`}
                    >
                      {/* Posição */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                            row.position === 1
                              ? 'bg-amber-400 text-black shadow-xs'
                              : row.position <= 3
                                ? 'bg-slate-200 text-[#0F172A]'
                                : isEliminationZone
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-[#334155]'
                          }`}
                        >
                          {row.position}
                        </span>
                      </td>

                      {/* Piloto */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              row.isPlayer
                                ? 'text-[#0F172A] font-extrabold'
                                : 'text-[#1E293B] font-medium'
                            }
                          >
                            {row.driverName}
                          </span>
                          {row.isPlayer && (
                            <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 uppercase font-black tracking-tight">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Equipe com Logo Reduzida Canônica */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={row.teamName}
                              className="w-5 h-5 rounded-sm object-contain bg-white border border-[#E2E8F0] p-0.5 shrink-0"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.teamColor || '#94A3B8' }}
                            />
                          )}
                          <span
                            className="truncate max-w-[120px] text-xs font-semibold"
                            style={{ color: row.teamColor }}
                          >
                            {row.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Composto */}
                      <td className="py-2 px-3 text-capitalize text-[11px]">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[#334155] uppercase font-bold text-[10px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              row.compound === 'macio'
                                ? 'bg-[#E10600]'
                                : row.compound === 'medio'
                                  ? 'bg-amber-400'
                                  : 'bg-slate-400'
                            }`}
                          />
                          {row.compound}
                        </span>
                      </td>

                      {/* Status do Carro */}
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            row.status === 'flying_lap'
                              ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                              : row.status === 'out_lap' || row.status === 'in_lap'
                                ? 'bg-amber-100 text-amber-800'
                                : isEliminationZone
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-[#64748B]'
                          }`}
                        >
                          {row.status === 'flying_lap'
                            ? 'EM VOLTA'
                            : row.status === 'out_lap'
                              ? 'OUT LAP'
                              : row.status === 'in_lap'
                                ? 'IN LAP'
                                : row.status === 'classified'
                                  ? 'CLASSIFICADO'
                                  : row.status === 'eliminated'
                                    ? 'ELIMINADO'
                                    : 'BOX'}
                        </span>
                      </td>

                      {/* Voltas */}
                      <td className="py-2 px-3 text-center text-[#64748B] font-bold">
                        {row.laps || 0}
                      </td>

                      {/* Melhor Volta */}
                      <td className="py-2 px-3 font-bold text-[#0F172A]">
                        {row.bestLapTime || '--:--.---'}
                      </td>

                      {/* Gap */}
                      <td className="py-2 px-3 text-right font-bold text-[#64748B] tabular-nums">
                        {row.gap}
                      </td>
                    </tr>

                    {/* Linha divisória de Zona de Corte / Eliminação */}
                    {isCutoffLine && (
                      <tr className="bg-[#FFF1F2] border-y-2 border-dashed border-[#F43F5E]">
                        <td colSpan={8} className="py-1 px-3 text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#E11D48] flex items-center justify-center gap-1.5 font-sans">
                            <AlertCircle className="w-3.5 h-3.5 text-[#E11D48]" />
                            LINHA DE CORTE FIA — ZONA DE ELIMINAÇÃO DO {stageId.toUpperCase()} (P
                            {cutoffPos + 1}+ ELIMINADOS)
                          </span>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
