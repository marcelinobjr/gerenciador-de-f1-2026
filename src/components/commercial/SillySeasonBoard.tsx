import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GridSeatStatus, SillySeasonRumor } from '@/types/canonical-driver-market'
import { Shield, Users, Radio, HelpCircle, CheckCircle, Clock } from 'lucide-react'

export interface SillySeasonBoardProps {
  gridStatus: GridSeatStatus[]
  rumors: SillySeasonRumor[]
  seasonYear: number
  isPublicView?: boolean
}

export function SillySeasonBoard({
  gridStatus,
  rumors,
  seasonYear,
  isPublicView = true,
}: SillySeasonBoardProps) {
  return (
    <div className="space-y-6">
      {/* Quadro de Rumores Ativos no Paddock */}
      {rumors.length > 0 && (
        <Card className="bg-[#0B0E14] border-neutral-800">
          <CardHeader className="py-3 px-4 border-b border-neutral-800/80">
            <CardTitle className="text-xs uppercase font-mono font-bold tracking-wider text-amber-400 flex items-center gap-2">
              <Radio className="w-4 h-4 animate-pulse text-amber-500" />
              Silly Season &bull; Radar de Rumores do Paddock ({seasonYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {rumors.slice(0, 4).map((rumor) => (
              <div
                key={rumor.id}
                className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60 font-mono text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{rumor.headline}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold ${
                      rumor.credibility === 'strong'
                        ? 'border-red-500/50 text-red-400 bg-red-950/20'
                        : rumor.credibility === 'credible'
                          ? 'border-amber-500/50 text-amber-400 bg-amber-950/20'
                          : 'border-neutral-600 text-neutral-400 bg-neutral-900'
                    }`}
                  >
                    {rumor.credibility === 'strong'
                      ? 'Forte'
                      : rumor.credibility === 'credible'
                        ? 'Provável'
                        : 'Especulação'}
                  </Badge>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">{rumor.details}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabela do Grid — Piloto 1 × Piloto 2 × Reserva */}
      <Card className="bg-[#0B0E14] border-neutral-800">
        <CardHeader className="py-3.5 px-4 border-b border-neutral-800/80 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-red-500" />
            Grid da F1 {seasonYear + 1} &bull; Mapeamento de Vagas e Contratos Futuros
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-neutral-700 text-neutral-400"
          >
            {isPublicView ? 'Visão Pública (Paddock)' : 'Painel de Bastidores (Truth)'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/40 text-neutral-400 text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Escuderia</th>
                <th className="py-3 px-4 font-bold">Assento 1 ({seasonYear + 1})</th>
                <th className="py-3 px-4 font-bold">Assento 2 ({seasonYear + 1})</th>
                <th className="py-3 px-4 font-bold">Piloto Reserva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {gridStatus.map((team) => (
                <tr key={team.teamId} className="hover:bg-neutral-900/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: team.teamColor }}
                    />
                    <span>{team.teamName}</span>
                  </td>

                  {/* Assento 1 */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {team.seat1.status === 'confirmed' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : team.seat1.status === 'expiring' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      )}
                      <span
                        className={
                          team.seat1.status === 'confirmed'
                            ? 'text-white font-medium'
                            : team.seat1.status === 'expiring'
                              ? 'text-amber-300'
                              : 'text-neutral-500 italic'
                        }
                      >
                        {team.seat1.publicDisplay}
                      </span>
                    </div>
                  </td>

                  {/* Assento 2 */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {team.seat2.status === 'confirmed' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : team.seat2.status === 'expiring' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      )}
                      <span
                        className={
                          team.seat2.status === 'confirmed'
                            ? 'text-white font-medium'
                            : team.seat2.status === 'expiring'
                              ? 'text-amber-300'
                              : 'text-neutral-500 italic'
                        }
                      >
                        {team.seat2.publicDisplay}
                      </span>
                    </div>
                  </td>

                  {/* Reserva */}
                  <td className="py-3 px-4 text-neutral-400 text-[11px]">
                    {team.reserveSeat.publicDisplay}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
