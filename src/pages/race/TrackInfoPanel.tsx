import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flag, AlertTriangle } from 'lucide-react'
import { CircuitBlueprint } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import pb from '@/lib/pocketbase/client'
import type { CircuitModel, TeamModel } from '@/types/f1'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

export interface TrackInfoPanelProps {
  currentRound: number
  gpInfo: {
    name: string
    circuit: string
    circuitLengthKm: number
    laps: number
    downforceIdeal?: number
    suspensionIdeal?: number
    characteristic: string
  }
  circuits: CircuitModel[]
  defaultAustraliaMap?: string
  puPoolStatus: {
    isCompromised: boolean
    leastWornPu: { id: number; wear: number }
    leastWear: number
    pacePenaltySec: number
  }
  team: TeamModel | null
}

export function TrackInfoPanel({
  currentRound,
  gpInfo,
  circuits,
  defaultAustraliaMap,
  puPoolStatus,
  team,
}: TrackInfoPanelProps) {
  const activeCircuitDb = circuits.find((c) => c.round === currentRound)
  const uploadedPhotoUrl = activeCircuitDb?.photo
    ? pb.files.getUrl(activeCircuitDb, activeCircuitDb.photo)
    : null
  const defaultAsset = currentRound === 1 ? defaultAustraliaMap : null
  const activeCircuitImage = uploadedPhotoUrl || defaultAsset

  // Perfil Técnico Canônico da Fase 0B
  const technicalProfile = resolveCircuitProfile({
    round: currentRound,
    circuitName: `${gpInfo.name} ${gpInfo.circuit}`,
  })

  return (
    <>
      {/* ITEM 5: BANNER DE POOL DE MOTORES COMPROMETIDO */}
      {puPoolStatus.isCompromised && (
        <div className="p-4 rounded-xl bg-amber-950/40 border-2 border-amber-500/70 shadow-lg space-y-2 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider">
              ⚠️ ALERTA FIA: POOL DE MOTORES COMPROMETIDO
            </h4>
          </div>
          <p className="text-xs text-amber-100 font-mono leading-relaxed">
            ⚠️ Todos os motores estão comprometidos (&gt;65% de desgaste) e sua equipe não possui
            margem financeira ou de teto de gastos para introduzir uma nova PU. Você larga
            obrigatoriamente com o motor menos desgastado (PU #{puPoolStatus.leastWornPu.id} com{' '}
            {puPoolStatus.leastWear}% de desgaste). Desempenho reduzido: penalidade de ritmo de +
            {puPoolStatus.pacePenaltySec.toFixed(2)}s/volta (+0,03s por % acima de 65%).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="relative z-10 lg:col-span-1">
          <Card className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] overflow-hidden flex flex-col justify-between h-full shadow-xl">
            <div className="relative w-full aspect-[16/9] max-h-72 bg-[#080B10] overflow-hidden border-b border-[#1F2733]/80 group flex items-center justify-center">
              {activeCircuitImage ? (
                <div className="w-full h-full relative bg-[#0B0E14] overflow-hidden flex items-center justify-center p-2">
                  <CircuitTrackImage
                    src={activeCircuitImage}
                    alt={`Traçado do ${gpInfo.circuit}`}
                    className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/90 via-[#0B0E14]/40 to-black/20 pointer-events-none" />
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <Badge className="bg-[#0B0E14]/85 text-[#F5F7FA] border border-[#1F2733] font-mono text-xs font-bold shadow-md">
                      R{currentRound}/24 • {gpInfo.circuit}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3 z-10">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase block drop-shadow">
                      {uploadedPhotoUrl ? 'Traçado Homologado' : 'Mapa Oficial FIA'}
                    </span>
                    <h4 className="text-sm font-extrabold text-white truncate drop-shadow-md">
                      {gpInfo.name}
                    </h4>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative">
                  <CircuitBlueprint
                    round={currentRound}
                    circuitName={gpInfo.circuit}
                    laps={gpInfo.laps}
                    lengthKm={gpInfo.circuitLengthKm}
                    className="h-full border-none rounded-none !p-3"
                  />
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <Badge className="bg-[#0B0E14]/85 text-[#F5F7FA] border border-[#1F2733] font-mono text-xs font-bold shadow-md">
                      R{currentRound}/24 • {gpInfo.circuit}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#080C14]/80 border-t border-[#1A2333] flex items-center justify-between text-xs font-mono">
              <span className="text-[#8B95A7]">Extensão:</span>
              <span className="text-cyan-400 font-bold">{gpInfo.circuitLengthKm} km</span>
              <span className="text-[#8B95A7] ml-2">Voltas:</span>
              <span className="text-white font-bold">{gpInfo.laps}</span>
            </div>
          </Card>
        </div>

        <div className="relative z-10 lg:col-span-2 space-y-4">
          <Card className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 h-full flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-[#1A2333] pb-2 mb-3">
                <div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                    DIRETRIZES DO AUTÓDROMO
                  </span>
                  <span className="text-xs font-mono font-black text-white uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                    <Flag className="w-4 h-4 text-[#E10600]" /> Parâmetros de Prova & Extensão
                    Oficial
                  </span>
                </div>
                <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border-[#00A6FB]/40 font-mono text-xs">
                  {gpInfo.laps} Voltas Programadas
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                  <span className="text-[10px] text-[#8B95A7] block uppercase">
                    Total de Voltas
                  </span>
                  <strong className="text-base text-white font-bold">{gpInfo.laps} voltas</strong>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">
                    Distância ~305 km
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                  <span className="text-[10px] text-[#8B95A7] block uppercase">
                    Comprimento da Pista
                  </span>
                  <strong className="text-base text-cyan-400 font-bold">
                    {gpInfo.circuitLengthKm} km
                  </strong>
                  <span className="text-[10px] text-[#8B95A7] block mt-0.5">Por volta</span>
                </div>

                <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                  <span className="text-[10px] text-[#8B95A7] block uppercase">
                    Carga Aerodinâmica
                  </span>
                  <strong className="text-base text-amber-400 font-bold">
                    {gpInfo.downforceIdeal}/10
                  </strong>
                  <span className="text-[10px] text-[#8B95A7] block mt-0.5">Ideal recomendada</span>
                </div>

                <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                  <span className="text-[10px] text-[#8B95A7] block uppercase">
                    Rigidez Suspensão
                  </span>
                  <strong className="text-base text-emerald-400 font-bold">
                    {gpInfo.suspensionIdeal}/10
                  </strong>
                  <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                    Trabalho de zebras
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-xs">
                <span className="text-[#8B95A7] font-mono block text-[11px]">
                  Característica Central:
                </span>
                <p className="text-white font-medium mt-0.5 leading-relaxed">
                  {gpInfo.characteristic}
                </p>
              </div>

              {/* PERFIL TÉCNICO CANÔNICO FASE 0B (Cluster & Pesos Chave) */}
              {technicalProfile && (
                <div className="mt-3 p-3 rounded-lg bg-[#080C14]/90 border border-cyan-900/40 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                      Perfil Técnico 2026 // {technicalProfile.clusterLabel}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                    >
                      {technicalProfile.trackType.toUpperCase().replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div className="p-1.5 rounded bg-[#0D131F] border border-[#1A2333]">
                      <span className="text-[#8B95A7] block text-[9px]">Severidade Pneus</span>
                      <span className="font-bold text-amber-400">
                        {technicalProfile.auxiliary.tyreSeverity}/100
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-[#0D131F] border border-[#1A2333]">
                      <span className="text-[#8B95A7] block text-[9px]">Dif. Ultrapassagem</span>
                      <span className="font-bold text-red-400">
                        {technicalProfile.auxiliary.overtakingDifficulty}/100
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-[#0D131F] border border-[#1A2333]">
                      <span className="text-[#8B95A7] block text-[9px]">Desafio Piloto</span>
                      <span className="font-bold text-cyan-300">
                        {technicalProfile.auxiliary.driverChallenge}/100
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-[#0D131F] border border-[#1A2333]">
                      <span className="text-[#8B95A7] block text-[9px]">Prob. Safety Car</span>
                      <span className="font-bold text-emerald-400">
                        {technicalProfile.auxiliary.safetyCarProbability}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(team?.engine_pool_used ?? 1) > 4 && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-950/40 border border-red-500/50 flex items-center gap-2 text-xs font-mono text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  Penalidade FIA no Grid: Equipe excedeu a cota de 4 motores da temporada (PU #
                  {team?.engine_pool_used}). Seus pilotos largarão com penalização de posições!
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
