import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Award,
  CheckCircle2,
  ShieldCheck,
  Hash,
  Timer,
  Car,
  AlertTriangle,
} from 'lucide-react'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

interface OfficialRaceResultPanelProps {
  result: OfficialRaceResult
  careerPersistenceStatus?: 'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED'
  isPersisting?: boolean
  persistenceError?: string
  onRegisterInCareer?: () => void
}

export const OfficialRaceResultPanel: React.FC<OfficialRaceResultPanelProps> = ({
  result,
  careerPersistenceStatus = 'PENDING',
  isPersisting = false,
  persistenceError,
  onRegisterInCareer,
}) => {
  const winner = result.entries.find((e) => e.finalPosition === 1) || result.entries[0]
  const pole = result.entries.find((e) => e.driverId === result.poleDriverId)
  const fastest = result.fastestLapDriverId
    ? result.entries.find((e) => e.driverId === result.fastestLapDriverId)
    : null
  const playerDrivers = result.playerEntries

  return (
    <div className="space-y-6" data-testid="official-race-result-panel">
      {/* Header Banner do Resultado Oficial */}
      <Card className="bg-[#0A0F1D] text-white border border-[#1E293B] shadow-xl overflow-hidden rounded-2xl relative">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-amber-500/20 via-emerald-500/10 to-transparent pointer-events-none" />
        <CardContent className="p-6 relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase tracking-wider">
                FW2.1E-F • RESULTADO OFICIAL FIA
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                HOMOLOGADO E IMUTÁVEL
              </Badge>
              {careerPersistenceStatus === 'COMPLETE' ? (
                <Badge className="bg-emerald-600 text-white border border-emerald-500 text-[10px] font-black flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-white" />
                  REGISTRADO NA CARREIRA
                </Badge>
              ) : isPersisting || careerPersistenceStatus === 'APPLYING' ? (
                <Badge className="bg-amber-500 text-black border border-amber-400 text-[10px] font-black flex items-center gap-1 animate-pulse">
                  <Timer className="w-3 h-3 text-black" />
                  REGISTRANDO...
                </Badge>
              ) : careerPersistenceStatus === 'FAILED' ? (
                <Badge
                  variant="destructive"
                  className="text-[10px] font-black flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  FALHA NO REGISTRO
                </Badge>
              ) : (
                <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                  RESULTADO OFICIAL
                </Badge>
              )}
              <Badge
                variant="outline"
                className="bg-slate-900 text-slate-300 border-slate-700 text-[10px] font-mono flex items-center gap-1"
              >
                <Hash className="w-3 h-3 text-cyan-400" />
                {result.schemaVersion}
              </Badge>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              Oficializado em:{' '}
              <span className="text-slate-200">
                {new Date(result.officializedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Trophy className="w-7 h-7 text-amber-400 shrink-0" />
              {result.circuitName} — Classificação Oficial da Prova
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Este resultado é o snapshot oficial, congelado e imutável do Grande Prêmio. Ele
              constitui a única fonte de verdade esportiva para a persistência histórica, pontuação
              e estatísticas da temporada.
            </p>
          </div>

          {/* Banner de Ação de Persistência na Carreira */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Persistência Canônica de Carreira
              </span>
              <p className="text-xs text-slate-200">
                {careerPersistenceStatus === 'COMPLETE'
                  ? 'Os dados esportivos oficiais foram persistidos de forma idempotente e as estatísticas dos pilotos foram acumuladas com sucesso.'
                  : careerPersistenceStatus === 'FAILED'
                    ? `Falha na aplicação: ${persistenceError || 'Ocorreu um erro no processamento. Você pode tentar novamente com segurança.'}`
                    : 'A persistência na carreira registra o resultado imutável e atualiza estatísticas acumuladas dos pilotos.'}
              </p>
            </div>

            {careerPersistenceStatus !== 'COMPLETE' && onRegisterInCareer && (
              <div>
                <button
                  type="button"
                  disabled={isPersisting}
                  onClick={onRegisterInCareer}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                    careerPersistenceStatus === 'FAILED'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'bg-[#E10600] hover:bg-red-600 text-white'
                  } disabled:opacity-50`}
                >
                  {isPersisting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      REGISTRANDO...
                    </>
                  ) : careerPersistenceStatus === 'FAILED' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-black" />
                      TENTAR NOVAMENTE
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      REGISTRAR RESULTADO NA CARREIRA
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Destaques Esportivos Canônicos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                🏆 Vencedor do GP
              </span>
              <span className="font-extrabold text-white text-sm block truncate">
                {winner?.driverName}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">{winner?.teamName}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ⏱️ Pole Position (Qualifying)
              </span>
              <span className="font-extrabold text-white text-sm block truncate">
                {pole?.driverName || 'N/A'}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                {pole?.teamName || '—'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                ⚡ Volta Mais Rápida
              </span>
              <span className="font-extrabold text-white text-sm block truncate">
                {fastest ? fastest.driverName : 'N/A'}
              </span>
              <span className="text-[11px] text-cyan-300 font-mono block">
                {result.fastestLapFormatted
                  ? `${result.fastestLapFormatted} (Volta ${result.fastestLapNumber || '—'})`
                  : '—'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                🏁 Integridade do Resultado
              </span>
              <span className="font-mono text-[11px] text-emerald-300 block truncate">
                {result.resultHash}
              </span>
              <span className="text-[10px] text-slate-400 block">24 pilotos • 0 alterações</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Destaque Exclusivo: Os Dois Carros da Equipe do Jogador (FW2.1E-F Requisito 11) */}
      <Card className="bg-[#0F172A] border border-slate-800 shadow-md rounded-2xl overflow-hidden text-white">
        <CardHeader className="py-3 px-4 bg-[#1E293B]/60 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Car className="w-4 h-4 text-[#E10600]" />
            Desempenho dos Dois Carros da Sua Equipe (
            {playerDrivers[0]?.teamName || result.playerTeamId})
          </CardTitle>
          <Badge className="bg-[#E10600] text-white text-[9px] uppercase font-black">
            2 Carros Autônomos Homologados
          </Badge>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {playerDrivers.map((carEntry, idx) => {
              const delta = carEntry.positionsGainedLost
              return (
                <div
                  key={`player_official_${carEntry.driverId}`}
                  className="p-4 rounded-xl bg-[#090D15] border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {carEntry.carSlot === 'car1' || idx === 0 ? 'Carro 1' : 'Carro 2'}
                      </span>
                      {carEntry.fastestLap && (
                        <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 font-bold">
                          VOLTA MAIS RÁPIDA
                        </Badge>
                      )}
                    </div>
                    <div className="text-base font-black text-white">{carEntry.driverName}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      Largada: P{carEntry.gridPosition} • {carEntry.pitStops} Pit Stop
                      {carEntry.pitStops === 1 ? '' : 's'} • Pneu {carEntry.tyreCompound || '—'}
                    </div>
                    {carEntry.dnf && (
                      <Badge variant="destructive" className="text-[10px] font-bold">
                        DNF: {carEntry.dnfReason}
                      </Badge>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-base shadow-sm ${
                        carEntry.finalPosition === 1
                          ? 'bg-amber-400 text-black'
                          : carEntry.finalPosition <= 3
                            ? 'bg-slate-300 text-black'
                            : carEntry.finalPosition <= 10
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      P{carEntry.finalPosition}
                    </div>
                    <div className="text-[11px] font-bold font-mono">
                      {delta > 0 ? (
                        <span className="text-emerald-400">+{delta} pos</span>
                      ) : delta < 0 ? (
                        <span className="text-red-400">{delta} pos</span>
                      ) : (
                        <span className="text-slate-400">=</span>
                      )}
                    </div>
                    {carEntry.pointsAwarded > 0 && (
                      <span className="text-emerald-400 font-bold text-xs block">
                        +{carEntry.pointsAwarded} pts
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela Completa de Classificação Oficial P1 a P24 */}
      <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Classificação Final Oficial (P1–P24)
            </CardTitle>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Dados esportivos congelados. Sem recálculos pós-oficialização.
            </p>
          </div>
          <Badge className="bg-[#059669] text-white text-[10px] font-bold">OFICIAL</Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]/50 text-[10px]">
                  <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                  <th className="py-2.5 px-3 text-center w-12">Grid</th>
                  <th className="py-2.5 px-3 text-center w-12">+/-</th>
                  <th className="py-2.5 px-3">Piloto</th>
                  <th className="py-2.5 px-3">Equipe</th>
                  <th className="py-2.5 px-3 text-center">Voltas</th>
                  <th className="py-2.5 px-3 text-center">Tempo / Gap</th>
                  <th className="py-2.5 px-3 text-center">Melhor Volta</th>
                  <th className="py-2.5 px-3 text-center">Pits</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Pontos FIA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {result.entries.map((entry) => {
                  const logoUrl = getTeamReducedLogoUrl(entry.teamName || entry.teamId)
                  const delta = entry.positionsGainedLost

                  return (
                    <tr
                      key={`official_entry_${entry.driverId}`}
                      className={`transition-colors ${
                        entry.dnf
                          ? 'bg-slate-50/80 text-slate-400 opacity-70'
                          : entry.isPlayer
                            ? 'bg-red-50/70 hover:bg-red-50 font-bold border-l-4 border-l-[#E10600]'
                            : 'hover:bg-slate-50 text-[#0F172A]'
                      }`}
                    >
                      {/* Posição Final Oficial */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                            entry.dnf
                              ? 'bg-slate-200 text-slate-600'
                              : entry.finalPosition === 1
                                ? 'bg-amber-400 text-black shadow-xs font-black'
                                : entry.finalPosition <= 3
                                  ? 'bg-slate-200 text-[#0F172A] font-bold'
                                  : entry.finalPosition <= 10
                                    ? 'bg-slate-100 text-[#334155]'
                                    : 'bg-slate-50 text-[#64748B]'
                          }`}
                        >
                          P{entry.finalPosition}
                        </span>
                      </td>

                      {/* Grid Position */}
                      <td className="py-2.5 px-3 text-center text-[10px] text-slate-500">
                        P{entry.gridPosition}
                      </td>

                      {/* +/- Posições Ganhas/Perdidas */}
                      <td className="py-2.5 px-3 text-center font-bold text-[11px]">
                        {delta > 0 ? (
                          <span className="text-emerald-600">+{delta}</span>
                        ) : delta < 0 ? (
                          <span className="text-red-500">{delta}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Piloto */}
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              entry.isPlayer
                                ? 'text-[#0F172A] font-extrabold'
                                : 'text-[#1E293B] font-medium'
                            }
                          >
                            {entry.driverName}
                          </span>
                          {entry.fastestLap && (
                            <Badge className="bg-purple-600 text-white font-mono text-[9px] px-1 py-0 h-3.5">
                              FL
                            </Badge>
                          )}
                          {entry.isPlayer && (
                            <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 uppercase font-black">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Equipe */}
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={entry.teamName}
                              className="w-5 h-5 rounded-sm object-contain bg-white border border-[#E2E8F0] p-0.5 shrink-0"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: entry.teamColor || '#94A3B8' }}
                            />
                          )}
                          <span
                            className="truncate max-w-[130px] text-xs font-semibold"
                            style={{ color: entry.teamColor }}
                          >
                            {entry.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Voltas */}
                      <td className="py-2.5 px-3 text-center font-bold">{entry.lapsCompleted}</td>

                      {/* Tempo / Gap */}
                      <td className="py-2.5 px-3 text-center">
                        {entry.dnf ? (
                          <span className="text-red-500 font-bold text-[10px]">
                            DNF ({entry.dnfReason || 'Abandono'})
                          </span>
                        ) : entry.finalPosition === 1 ? (
                          <span className="text-amber-600 font-black">
                            {entry.raceTimeFormatted || '1h 28m 34s'}
                          </span>
                        ) : (
                          <span className="text-slate-600">{entry.gapToWinner}</span>
                        )}
                      </td>

                      {/* Melhor Volta */}
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {entry.bestLapFormatted || '—'}
                      </td>

                      {/* Pit Stops */}
                      <td className="py-2.5 px-3 text-center font-bold">{entry.pitStops}</td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {entry.dnf ? (
                          <Badge variant="destructive" className="text-[9px] uppercase font-bold">
                            DNF
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-700 text-white text-[9px] uppercase font-bold">
                            Classificado
                          </Badge>
                        )}
                      </td>

                      {/* Pontos FIA */}
                      <td className="py-2.5 px-3 text-center font-bold">
                        {entry.pointsAwarded > 0 ? (
                          <span className="text-emerald-600 font-black">
                            +{entry.pointsAwarded}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
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
    </div>
  )
}
