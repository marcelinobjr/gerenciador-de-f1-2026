import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Flag, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

interface CanonicalRaceInitializationPanelProps {
  raceState: CanonicalRaceState
  onResetGrid?: () => void
}

export const CanonicalRaceInitializationPanel: React.FC<CanonicalRaceInitializationPanelProps> = ({
  raceState,
  onResetGrid,
}) => {
  const poleDriver = raceState.drivers.find((d) => d.gridPosition === 1) || raceState.drivers[0]
  const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)

  return (
    <div className="space-y-6">
      {/* Banner de Homologação da Inicialização da Corrida V2 (FW2.1E-A) */}
      <Card className="bg-[#0F172A] text-white border-none shadow-md overflow-hidden rounded-2xl relative">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[#E10600]/30 to-transparent pointer-events-none" />
        <CardContent className="p-6 relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase">
                FW2.1E-A • RACE INITIALIZATION HOMOLOGADA
              </Badge>
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-500/40 text-[10px]"
              >
                ESTADO CANÔNICO ATIVO (24 CARROS)
              </Badge>
            </div>
            {onResetGrid && (
              <button
                type="button"
                onClick={onResetGrid}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-2"
              >
                Revisar Grid Oficial
              </button>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Flag className="w-6 h-6 text-emerald-400" />
              {raceState.circuitName} — Procedimento de Largada V2
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl">
              O estado canônico da Corrida V2 foi inicializado consumindo diretamente o grid oficial
              homologado da qualificação (Q1, Q2 e Q3). Posições P1–P24 e pilotos estão travados
              para a largada oficial com integridade de combustível, pneus e mecânica.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Pole Position
              </span>
              <span className="font-extrabold text-amber-400 text-sm">
                {poleDriver?.driverName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Total de Voltas
              </span>
              <span className="font-extrabold text-white text-sm">
                {raceState.totalLaps} voltas
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Condição da Pista
              </span>
              <span className="font-extrabold text-emerald-400 text-sm">
                {raceState.weather === 'seco'
                  ? 'Pista Seca'
                  : raceState.weather === 'chuva_fraca'
                    ? 'Chuva Fraca'
                    : 'Chuva Forte'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Pilotos da Sua Equipe
              </span>
              <span className="font-extrabold text-white text-sm">
                {playerDrivers.map((d) => `P${d.gridPosition} ${d.driverName}`).join(' • ')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela do Grid Canônico de Largada (P1 a P24) */}
      <Card className="bg-white border border-[#E2E8F0] shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Grid de Largada Canônico P1–P24 (Estado Inicial da Prova)
            </CardTitle>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Entidade canônica única por piloto com combustível inicial (100kg), pneu homologado e
              P1–P24 contínuo.
            </p>
          </div>
          <Badge className="bg-[#059669] text-white text-[10px] font-bold">
            24 CARROS CONFIRMADOS
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]/50 text-[10px]">
                  <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                  <th className="py-2.5 px-3">Piloto</th>
                  <th className="py-2.5 px-3">Equipe</th>
                  <th className="py-2.5 px-3 text-center">Pneu Largada</th>
                  <th className="py-2.5 px-3 text-center">Combustível</th>
                  <th className="py-2.5 px-3 text-center">Condição</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {raceState.drivers.map((driver) => {
                  const logoUrl = getTeamReducedLogoUrl(driver.teamName || driver.teamId)

                  return (
                    <tr
                      key={`canonical_race_${driver.driverId}`}
                      className={`transition-colors ${
                        driver.isPlayer
                          ? 'bg-red-50/70 hover:bg-red-50 font-bold border-l-4 border-l-[#E10600]'
                          : 'hover:bg-slate-50 text-[#0F172A]'
                      }`}
                    >
                      {/* Posição */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                            driver.gridPosition === 1
                              ? 'bg-amber-400 text-black shadow-xs font-black'
                              : driver.gridPosition <= 3
                                ? 'bg-slate-200 text-[#0F172A]'
                                : driver.gridPosition <= 10
                                  ? 'bg-slate-100 text-[#334155]'
                                  : 'bg-slate-50 text-[#64748B]'
                          }`}
                        >
                          P{driver.gridPosition}
                        </span>
                      </td>

                      {/* Piloto */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              driver.isPlayer
                                ? 'text-[#0F172A] font-extrabold'
                                : 'text-[#1E293B] font-medium'
                            }
                          >
                            {driver.driverName}
                          </span>
                          {driver.isPlayer && (
                            <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 uppercase font-black">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Equipe */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={driver.teamName}
                              className="w-5 h-5 rounded-sm object-contain bg-white border border-[#E2E8F0] p-0.5 shrink-0"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: driver.teamColor || '#94A3B8' }}
                            />
                          )}
                          <span
                            className="truncate max-w-[120px] text-xs font-semibold"
                            style={{ color: driver.teamColor }}
                          >
                            {driver.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Pneu */}
                      <td className="py-2 px-3 text-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold uppercase border-slate-300"
                        >
                          {driver.tyreCompound}
                        </Badge>
                      </td>

                      {/* Combustível */}
                      <td className="py-2 px-3 text-center text-slate-700 font-bold">
                        {driver.fuel.toFixed(1)} kg
                      </td>

                      {/* Condição Mecânica */}
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">
                        {driver.carCondition}%
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center">
                        <Badge className="bg-emerald-600 text-white text-[9px] uppercase font-bold">
                          Pronto
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
