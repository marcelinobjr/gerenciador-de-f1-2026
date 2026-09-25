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
      {/* Quadro de Rumores Ativos no Paddock (LIGHT-UI-01C) */}
      {rumors.length > 0 && (
        <Card className="bg-white border-[#E2E8F0] shadow-sm">
          <CardHeader className="py-3 px-4 border-b border-[#F1F5F9]">
            <CardTitle className="text-xs uppercase font-mono font-bold tracking-wider text-amber-700 flex items-center gap-2">
              <Radio className="w-4 h-4 animate-pulse text-amber-600" />
              Silly Season &bull; Radar de Rumores do Paddock ({seasonYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {rumors.slice(0, 4).map((rumor) => (
              <div
                key={rumor.id}
                className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] font-mono text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A] text-xs">{rumor.headline}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold ${
                      rumor.credibility === 'strong'
                        ? 'border-red-200 text-red-700 bg-red-50'
                        : rumor.credibility === 'credible'
                          ? 'border-amber-200 text-amber-700 bg-amber-50'
                          : 'border-[#CBD5E1] text-[#64748B] bg-white'
                    }`}
                  >
                    {rumor.credibility === 'strong'
                      ? 'Forte'
                      : rumor.credibility === 'credible'
                        ? 'Provável'
                        : 'Especulação'}
                  </Badge>
                </div>
                <p className="text-[#64748B] text-[11px] leading-relaxed">{rumor.details}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabela do Grid — Piloto 1 × Piloto 2 × Reserva */}
      <Card className="bg-white border-[#E2E8F0] shadow-sm">
        <CardHeader className="py-3.5 px-4 border-b border-[#F1F5F9] flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono font-bold text-[#0F172A] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#E10600]" />
            Grid da F1 {seasonYear + 1} &bull; Mapeamento de Vagas e Contratos Futuros
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-[#CBD5E1] text-[#64748B] bg-white"
          >
            {isPublicView ? 'Visão Pública (Paddock)' : 'Painel de Bastidores (Truth)'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Escuderia</th>
                <th className="py-3 px-4 font-bold">Assento 1 ({seasonYear + 1})</th>
                <th className="py-3 px-4 font-bold">Assento 2 ({seasonYear + 1})</th>
                <th className="py-3 px-4 font-bold">Piloto Reserva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {gridStatus.map((team) => (
                <tr key={team.teamId} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-3 px-4 font-bold text-[#0F172A] flex items-center gap-2">
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
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : team.seat1.status === 'expiring' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      )}
                      <span
                        className={
                          team.seat1.status === 'confirmed'
                            ? 'text-[#0F172A] font-medium'
                            : team.seat1.status === 'expiring'
                              ? 'text-amber-700 font-medium'
                              : 'text-[#94A3B8] italic'
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
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : team.seat2.status === 'expiring' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      )}
                      <span
                        className={
                          team.seat2.status === 'confirmed'
                            ? 'text-[#0F172A] font-medium'
                            : team.seat2.status === 'expiring'
                              ? 'text-amber-700 font-medium'
                              : 'text-[#94A3B8] italic'
                        }
                      >
                        {team.seat2.publicDisplay}
                      </span>
                    </div>
                  </td>

                  {/* Reserva */}
                  <td className="py-3 px-4 text-[#64748B] text-[11px]">
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
