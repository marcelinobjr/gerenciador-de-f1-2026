/**
 * IMPLEMENTAÇÃO Nº 6B — CARD DE BRIEFING PRÉ-CORRIDA
 * PreRaceDriverBriefingCard
 *
 * Utiliza getDriverPreRaceContext (preparado na 6A) para gerar:
 * 1 a 2 linhas por piloto da equipe com:
 * - Expectativa de resultado
 * - Nível de confiança
 * - Preocupação principal / Tensão
 * - Opinião sobre a estratégia e Track Fit
 */

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, ShieldAlert, Award, Sparkles, TrendingUp } from 'lucide-react'
import { DriverModel, TeamModel } from '@/types/f1'
import { driverRelationshipService } from '@/services/driverRelationshipService'
import { DriverHelmet } from '@/components/DriverHelmet'

export interface PreRaceDriverBriefingCardProps {
  drivers: DriverModel[]
  team?: TeamModel | null
  round: number
  seasonYear: number
  circuitName: string
  gridPositions?: Record<string, number>
}

export function PreRaceDriverBriefingCard({
  drivers,
  team,
  round,
  seasonYear,
  circuitName,
  gridPositions = {},
}: PreRaceDriverBriefingCardProps) {
  const titulars = drivers.filter((d) => d.team_id === team?.id && d.role !== 'reserva')

  if (titulars.length === 0) return null

  return (
    <Card className="relative z-10 bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333] shadow-xl overflow-hidden font-mono">
      <CardHeader className="pb-3 border-b border-[#1A2333] bg-[#0C111C]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">
                PSICOLOGIA DE CORRIDA // BRIEFING
              </span>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <span>Declarações Pré-Corrida dos Pilotos</span>
                <Badge className="bg-slate-800 text-slate-300 text-[10px]">6A / 6B Engine</Badge>
              </CardTitle>
            </div>
          </div>
          <span className="text-xs text-slate-400">{circuitName}</span>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {titulars.map((driver) => {
            const gridPos = gridPositions[driver.id] || 8
            const preContext = driverRelationshipService.getDriverPreRaceContext(
              driver.id,
              circuitName,
              round,
              seasonYear,
            )
            const bundle = driverRelationshipService.getOrCreatePsychologyBundle(driver)
            const traits = bundle.traits
            const emotional = bundle.emotionalState
            const confidenceRating =
              emotional.confidence >= 70 ? 'Alta' : emotional.confidence < 45 ? 'Baixa' : 'Média'

            // Formatação de fala autêntica do piloto para o pré-corrida
            let driverQuote = ''
            if (gridPos <= 3) {
              if (traits.ambition >= 75) {
                driverQuote = `"Largando no top 3, nosso único objetivo hoje é a vitória. O carro tem ritmo e vou colocar pressão logo na curva 1."`
              } else {
                driverQuote = `"Ótima posição de largada. Precisamos de uma saída limpa e gerenciar o ritmo para garantir um pódio seguro para a equipe."`
              }
            } else if (gridPos <= 8) {
              if (emotional.frustration >= 60) {
                driverQuote = `"P${gridPos} não era onde queríamos estar, mas a corrida é longa. Se a estratégia da equipe acertar a janela, dá para avançar."`
              } else {
                driverQuote = `"Acho que hoje dá para lutar por um bom top 5. O acerto do carro está equilibrado para stints longos."`
              }
            } else {
              if (traits.resilience >= 70) {
                driverQuote = `"Largamos atrás, mas tudo pode acontecer nesta pista. Precisamos ser inteligentes na largada e limitar danos."`
              } else {
                driverQuote = `"Fim de semana difícil até aqui. Precisamos de uma estratégia agressiva para tentar beliscar algum ponto."`
              }
            }

            return (
              <div
                key={driver.id}
                className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DriverHelmet driver={driver} teamColor={team?.color} size="sm" />
                    <div>
                      <span className="font-bold text-white block">{driver.name}</span>
                      <span className="text-[10px] text-slate-400">Largada: P{gridPos}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        confidenceRating === 'Alta'
                          ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                          : confidenceRating === 'Baixa'
                            ? 'border-red-500/40 text-red-300 bg-red-500/10'
                            : 'border-slate-700 text-slate-300'
                      }`}
                    >
                      Confiança: {confidenceRating}
                    </Badge>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#070A11] border border-slate-800/60 text-cyan-200 italic leading-relaxed text-[11px]">
                  {driverQuote}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 text-slate-400">
                  <div>
                    <span className="text-slate-400 block font-semibold">Alvo Esperado:</span>
                    <span className="text-slate-200">
                      P{preContext.expectedPositionRange.target} (
                      {preContext.expectedPositionRange.min}-{preContext.expectedPositionRange.max})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Tensão Emocional:</span>
                    <span className="text-amber-300/90">{emotional.emotionalTension}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
