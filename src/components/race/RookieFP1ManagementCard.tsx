import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  UserCheck,
  Users,
  ShieldAlert,
} from 'lucide-react'
import type {
  RookieTeamRequirement,
  RookieEligibilityCheck,
  RookieTemporaryFP1Assignment,
} from '@/types/rookie-practice'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import type { DriverModel } from '@/types/f1'

interface RookieFP1ManagementCardProps {
  seasonId: string
  round: number
  teamId: string
  teamDrivers: DriverModel[]
  allDriversCatalog?: DriverModel[]
  activeAssignmentCar1: RookieTemporaryFP1Assignment | null
  activeAssignmentCar2: RookieTemporaryFP1Assignment | null
  onAssignRookie: (
    carId: 'car1' | 'car2',
    rookie: RookieEligibilityCheck,
    originalDriver: DriverModel,
  ) => void
  onClearAssignment: (carId: 'car1' | 'car2') => void
  isSessionRunning: boolean
  isSessionCompleted: boolean
}

export const RookieFP1ManagementCard: React.FC<RookieFP1ManagementCardProps> = ({
  seasonId,
  round,
  teamId,
  teamDrivers,
  allDriversCatalog = [],
  activeAssignmentCar1,
  activeAssignmentCar2,
  onAssignRookie,
  onClearAssignment,
  isSessionRunning,
  isSessionCompleted,
}) => {
  const req: RookieTeamRequirement = RookiePracticeRequirementService.getTeamRequirement(
    seasonId,
    teamId,
  )
  const remainingRounds = Math.max(0, 24 - round + 1)

  // Seleção de novato via modal
  const [selectedCarForModal, setSelectedCarForModal] = useState<'car1' | 'car2' | null>(null)

  const primaryDrivers = teamDrivers.filter((d) => d.role !== 'reserva').slice(0, 2)
  const originalDriver1 = primaryDrivers[0]
  const originalDriver2 = primaryDrivers[1]

  const rosterOptions = RookiePracticeRequirementService.getRosterRookieOptions(
    teamDrivers,
    allDriversCatalog,
    teamId,
  )

  // Alerta visual de urgência quando restam poucas rodadas e há pendência
  const isUrgentCar1 = req.car1.remaining > 0 && remainingRounds <= 6
  const isUrgentCar2 = req.car2.remaining > 0 && remainingRounds <= 6
  const hasPendingOverall = req.remainingTotal > 0

  return (
    <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-4 font-mono">
      {/* CABEÇALHO DO BLOCO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1A2333] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Obrigação Regulamentar de Piloto Novato (TL1)
              </h3>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5">
                FIA Regra 2026
              </Badge>
            </div>
            <p className="text-[11px] text-[#8B95A7]">
              Exigência: 4 sessões obrigatórias por temporada (2 por carro) com novatos (≤ 2 GPs
              disputados).
            </p>
          </div>
        </div>

        {/* CONTADOR TOTAL DA EQUIPE */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase text-[#8B95A7] font-bold block">
              TOTAL DA EQUIPE
            </span>
            <span className="text-lg font-black text-white">
              {req.completedTotal}{' '}
              <span className="text-xs text-[#8B95A7] font-normal">de 4 cumpridas</span>
            </span>
          </div>
          <Badge
            className={`text-xs px-2.5 py-1 font-black ${
              req.isCompliant
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {req.isCompliant ? 'CONFORME (4/4)' : `${req.remainingTotal} RESTANTE(S)`}
          </Badge>
        </div>
      </div>

      {/* ALERTAS REGULAMENTARES PENDENTES */}
      {hasPendingOverall && (isUrgentCar1 || isUrgentCar2) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold block">
              Alerta Regulamentar FIA — Poucas Rodadas Restantes:
            </span>
            {isUrgentCar1 && (
              <p className="text-[11px] text-amber-200">
                • Carro 1 ainda precisa ceder {req.car1.remaining} sessão(ões) de TL1 a novatos
                (restam {remainingRounds} GPs na temporada).
              </p>
            )}
            {isUrgentCar2 && (
              <p className="text-[11px] text-amber-200">
                • Carro 2 ainda precisa ceder {req.car2.remaining} sessão(ões) de TL1 a novatos
                (restam {remainingRounds} GPs na temporada).
              </p>
            )}
          </div>
        </div>
      )}

      {/* CARDS DOS DOIS CARROS (CARRO 1 E CARRO 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARRO 1 */}
        <div className="p-3.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs font-black text-white uppercase">Carro 1 — Assento #1</span>
            </div>
            <span className="text-xs font-bold text-[#BAC4D6]">
              {req.car1.completed} de 2 cumpridas ({req.car1.remaining} restante)
            </span>
          </div>

          <div className="text-xs text-[#8B95A7]">
            Titular Homologado:{' '}
            <span className="text-white font-bold">{originalDriver1?.name || 'Piloto 1'}</span>
          </div>

          {activeAssignmentCar1 ? (
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-black">
                  ROOKIE ESCALADO
                </Badge>
                <span className="text-xs font-black text-emerald-400">
                  {activeAssignmentCar1.rookieDriverName}
                </span>
              </div>
              {!isSessionRunning && !isSessionCompleted && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onClearAssignment('car1')}
                  className="h-6 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                >
                  Restaurar Titular
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#8B95A7]">
                {req.car1.remaining > 0
                  ? 'Assento pode ser cedido no TL1'
                  : 'Cota do Carro 1 concluída (2/2)'}
              </span>
              {!isSessionRunning && !isSessionCompleted && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCarForModal('car1')}
                  className="h-7 text-xs border-[#2A374A] bg-[#141B26] hover:bg-[#1C2636] text-cyan-300"
                >
                  Escalar Novato...
                </Button>
              )}
            </div>
          )}
        </div>

        {/* CARRO 2 */}
        <div className="p-3.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-black text-white uppercase">Carro 2 — Assento #2</span>
            </div>
            <span className="text-xs font-bold text-[#BAC4D6]">
              {req.car2.completed} de 2 cumpridas ({req.car2.remaining} restante)
            </span>
          </div>

          <div className="text-xs text-[#8B95A7]">
            Titular Homologado:{' '}
            <span className="text-white font-bold">{originalDriver2?.name || 'Piloto 2'}</span>
          </div>

          {activeAssignmentCar2 ? (
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-black">
                  ROOKIE ESCALADO
                </Badge>
                <span className="text-xs font-black text-emerald-400">
                  {activeAssignmentCar2.rookieDriverName}
                </span>
              </div>
              {!isSessionRunning && !isSessionCompleted && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onClearAssignment('car2')}
                  className="h-6 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                >
                  Restaurar Titular
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#8B95A7]">
                {req.car2.remaining > 0
                  ? 'Assento pode ser cedido no TL1'
                  : 'Cota do Carro 2 concluída (2/2)'}
              </span>
              {!isSessionRunning && !isSessionCompleted && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCarForModal('car2')}
                  className="h-7 text-xs border-[#2A374A] bg-[#141B26] hover:bg-[#1C2636] text-amber-300"
                >
                  Escalar Novato...
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE SELEÇÃO DE NOVATO ELEGÍVEL */}
      {selectedCarForModal && (
        <Dialog open={!!selectedCarForModal} onOpenChange={() => setSelectedCarForModal(null)}>
          <DialogContent className="max-w-xl bg-[#090D15] border-[#1F2733] text-white font-mono">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-white">
                <Users className="w-5 h-5 text-emerald-400" />
                Escalar Piloto Novato — {selectedCarForModal === 'car1' ? 'Carro 1' : 'Carro 2'}
              </DialogTitle>
              <p className="text-xs text-[#8B95A7]">
                Apenas pilotos com ≤ 2 Grandes Prêmios disputados na carreira são elegíveis como
                novatos para o TL1.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* ELEGÍVEIS */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Pilotos Novatos Elegíveis (
                  {rosterOptions.eligible.length})
                </span>

                {rosterOptions.eligible.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#0E1521] border border-[#1A2436] text-xs text-[#8B95A7]">
                    Nenhum piloto novato elegível disponível no plantel.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rosterOptions.eligible.map((item) => {
                      // Impede escalar o mesmo piloto nos dois carros simultaneamente
                      const isOccupyingOtherCar =
                        (selectedCarForModal === 'car1' &&
                          activeAssignmentCar2?.rookieDriverId === item.driverId) ||
                        (selectedCarForModal === 'car2' &&
                          activeAssignmentCar1?.rookieDriverId === item.driverId)

                      return (
                        <div
                          key={item.driverId}
                          className="p-3 rounded-xl bg-[#0E1521] border border-[#1A2436] flex items-center justify-between hover:border-emerald-500/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">
                                {item.driverName}
                              </span>
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px]">
                                {item.careerGPs} GP(s)
                              </Badge>
                              {item.role && (
                                <span className="text-[10px] text-[#8B95A7] uppercase">
                                  ({item.role})
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-emerald-400">{item.reason}</span>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            disabled={isOccupyingOtherCar}
                            onClick={() => {
                              const original =
                                selectedCarForModal === 'car1' ? originalDriver1 : originalDriver2
                              if (original) {
                                onAssignRookie(selectedCarForModal, item, original)
                              }
                              setSelectedCarForModal(null)
                            }}
                            className={`h-8 text-xs font-bold ${
                              isOccupyingOtherCar
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isOccupyingOtherCar ? 'Em uso no outro carro' : 'Escalar no TL1'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* INELEGÍVEIS (TRANSPARÊNCIA REGULAMENTAR) */}
              {rosterOptions.ineligible.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#1A2436]">
                  <span className="text-[11px] font-black uppercase text-[#8B95A7] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Pilotos Inelegíveis
                    (Transparência FIA)
                  </span>
                  <div className="space-y-1.5">
                    {rosterOptions.ineligible.map((item) => (
                      <div
                        key={item.driverId}
                        className="p-2.5 rounded-lg bg-[#080C14] border border-[#141C2A] flex items-center justify-between text-xs opacity-60"
                      >
                        <div>
                          <span className="font-bold text-[#BAC4D6]">{item.driverName}</span>
                          <span className="text-[10px] text-[#8B95A7] ml-2">
                            ({item.careerGPs} GPs disputados)
                          </span>
                          <p className="text-[10px] text-rose-400">{item.reason}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-rose-900/40 text-rose-400 text-[9px]"
                        >
                          Inelegível
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedCarForModal(null)}
                className="text-xs text-[#8B95A7]"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
