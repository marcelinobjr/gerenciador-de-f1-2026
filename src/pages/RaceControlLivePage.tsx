import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Radio, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { raceStrategyService } from '@/services/raceStrategyService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { useToast } from '@/hooks/use-toast'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'
import type { CompleteQualifyingWeekendResult } from '@/types/canonical-qualifying-types'
import { CanonicalRaceInitializationPanel } from '@/components/race/CanonicalRaceInitializationPanel'

export default function RaceControlLivePage() {
  const navigate = useNavigate()
  const { team, season, isLoading: isAuthLoading } = useAuth()
  const { currentRound } = useUnifiedSeason()
  const { toast } = useToast()

  const gpInfo = useMemo(() => {
    const calendarItem = F1_2026_CALENDAR.find((c) => c.round === currentRound)
    return (
      calendarItem || {
        round: currentRound || 1,
        name: 'Grande Prêmio',
        circuit: 'Circuito Internacional',
        country: 'Bahrain',
        laps: 57,
        circuitLengthKm: 5.412,
      }
    )
  }, [currentRound])

  const isSprint = useMemo(() => hasSprintWeekend(currentRound), [currentRound])

  const [canonicalRaceState, setCanonicalRaceState] = useState<CanonicalRaceState | null>(null)
  const [officialRaceResult, setOfficialRaceResult] = useState<OfficialRaceResult | null>(null)
  const [completeQualifyingResult, setCompleteQualifyingResult] =
    useState<CompleteQualifyingWeekendResult | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  // Carregar ou sincronizar sessão canônica idêntica à de /corrida
  useEffect(() => {
    if (isAuthLoading || !team || !season?.id) return

    let isMounted = true
    setIsLoadingSession(true)

    try {
      const canonicalCareerId = resolveCanonicalCareerId(season, team)
      const isSprintTarget = isSprint // Se a corrida for sprint ativa
      const targetVariant = isSprintTarget ? 'SPRINT_RACE' : 'MAIN_RACE'

      // Grid canônico
      const gridResult = isSprintTarget
        ? canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
            season.id,
            currentRound,
          )
        : canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
            season.id,
            currentRound,
          )
      if (isMounted) {
        setCompleteQualifyingResult(gridResult)
      }

      // Resultado oficial se já finalizado
      const official = canonicalRaceResultService.getOfficialRaceResult(
        canonicalCareerId,
        season.year || 2026,
        currentRound,
      )
      if (isMounted && official) {
        setOfficialRaceResult(official)
      }

      // Estado salvo da corrida em andamento
      const savedRace = canonicalRaceInitializationService.readCanonicalRaceState(
        canonicalCareerId,
        season.year || 2026,
        currentRound,
        targetVariant,
      )

      if (isMounted) {
        setCanonicalRaceState(savedRace)
        setIsLoadingSession(false)
      }
    } catch (err: any) {
      if (isMounted) {
        console.error('[RaceControlLivePage] Erro ao carregar corrida:', err)
        setIsLoadingSession(false)
      }
    }

    return () => {
      isMounted = false
    }
  }, [team?.id, season?.id, currentRound, isAuthLoading, isSprint])

  if (isAuthLoading || isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4 font-mono text-white">
        <div className="w-10 h-10 border-4 border-[#e10600] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Sincronizando F1 Race Control ao Vivo...
        </p>
      </div>
    )
  }

  // Se não houver corrida inicializada ainda a partir do grid
  if (!canonicalRaceState && !officialRaceResult) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4 font-mono">
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 space-y-2">
          <div className="flex items-center justify-center gap-2 font-black text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            NENHUMA CORRIDA ATIVA NESTE MOMENTO
          </div>
          <p className="text-xs text-slate-300 font-sans">
            A corrida para o {gpInfo.name} ainda não foi inicializada na esteira do fim de semana.
            Acesse a página principal de Corrida para concluir os treinos livres, a classificação e
            definir a estratégia de largada.
          </p>
        </div>
        <Button
          asChild
          className="bg-[#e10600] hover:bg-[#c00400] text-white font-black text-xs gap-2"
        >
          <Link to="/corrida">
            <ArrowLeft className="w-4 h-4" />← Voltar para Corrida
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-3 py-1.5 space-y-1.5 font-mono">
      {/* BARRA SUPERIOR DE NAVEGAÇÃO DEDICADA */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-[#080d1a] border border-slate-800 text-[11px]">
        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] font-black text-slate-200 hover:text-white hover:bg-slate-800 gap-1.5 font-mono"
          >
            <Link to="/corrida">
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />← Voltar para Corrida
            </Link>
          </Button>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-400" />
              RACE CONTROL AO VIVO — TELA DEDICADA
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{gpInfo.name}</span>
          <span className="text-slate-700">•</span>
          <span className="text-slate-200 font-bold">Rodada {currentRound}/24</span>
        </div>
      </div>

      {/* PAINEL CANÔNICO COM compactMode ATIVADO (COMPACTAÇÃO ESTRUTURAL E FAIXAS HORIZONTAIS) */}
      {canonicalRaceState && (
        <CanonicalRaceInitializationPanel
          raceState={canonicalRaceState}
          compactMode={true}
          hasOfficialResult={!!officialRaceResult}
          onResetGrid={() => {
            navigate('/corrida')
          }}
          onOfficializeRace={() => {
            try {
              const canonicalCareerId = resolveCanonicalCareerId(season, team)
              const stateWithCanonicalId = {
                ...canonicalRaceState,
                careerId: canonicalCareerId,
              }
              const official = canonicalRaceResultService.officializeRace(stateWithCanonicalId)
              setOfficialRaceResult(official)
              toast({
                title: 'Corrida Oficializada com Sucesso',
                description: 'O resultado oficial imutável foi homologado.',
              })
              canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
              canonicalChampionshipService.processAndPersistRoundChampionship(
                canonicalCareerId,
                season?.year || 2026,
                currentRound,
              )
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Falha ao oficializar corrida',
                description: e?.message,
              })
            }
          }}
          onRequestPit={(driverId, compound) => {
            try {
              const nextState = raceStrategyService.requestPitStop(
                canonicalRaceState,
                driverId,
                compound,
              )
              canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
              setCanonicalRaceState(nextState)
              toast({
                title: 'Pit Stop Solicitado',
                description: `Box chamado para a próxima volta (${compound || 'alvo'}).`,
              })
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Falha ao solicitar pit stop',
                description: e?.message,
              })
            }
          }}
          onCancelPit={(driverId) => {
            try {
              const nextState = raceStrategyService.cancelPitRequest(canonicalRaceState, driverId)
              canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
              setCanonicalRaceState(nextState)
              toast({
                title: 'Pit Stop Cancelado',
                description: 'A chamada para os boxes foi cancelada.',
              })
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Falha ao cancelar pit stop',
                description: e?.message,
              })
            }
          }}
          onSetPaceMode={(driverId, mode) => {
            try {
              const nextState = raceStrategyService.setDriverPaceMode(
                canonicalRaceState,
                driverId,
                mode,
              )
              canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
              setCanonicalRaceState(nextState)
            } catch (e: any) {
              console.warn('[RaceControlLivePage] Erro ritmo:', e)
            }
          }}
          onSetTargetCompound={(driverId, comp) => {
            try {
              const nextState = raceStrategyService.setDriverTargetCompound(
                canonicalRaceState,
                driverId,
                comp,
              )
              canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
              setCanonicalRaceState(nextState)
            } catch (e: any) {
              console.warn('[RaceControlLivePage] Erro composto:', e)
            }
          }}
          onTriggerRedFlag={() => {
            try {
              const nextState = canonicalRaceEngineService.triggerRedFlag(canonicalRaceState, {
                reason: 'Bandeira Vermelha — Corrida Suspensa pela Direção de Prova',
              })
              setCanonicalRaceState(nextState)
              toast({
                variant: 'destructive',
                title: '🔴 Bandeira Vermelha Acionada',
                description: 'A corrida foi suspensa. Os carros retornaram aos boxes.',
              })
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Falha ao acionar Bandeira Vermelha',
                description: e?.message,
              })
            }
          }}
          onPrepareRestart={() => {
            try {
              const nextState = canonicalRaceEngineService.prepareRedFlagRestart(canonicalRaceState)
              setCanonicalRaceState(nextState)
              toast({
                title: '🟢 Procedimento de Relargada Ativado',
                description: 'Grid alinhado na ordem congelada.',
              })
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Falha ao preparar relargada',
                description: e?.message,
              })
            }
          }}
          onResumeRace={() => {
            try {
              const nextState =
                canonicalRaceEngineService.resumeRaceAfterRedFlag(canonicalRaceState)
              setCanonicalRaceState(nextState)
              toast({
                title: '🟢 Corrida Reiniciada!',
                description: 'Bandeira verde! A prova recomeçou.',
              })
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Falha ao reiniciar corrida',
                description: e?.message,
              })
            }
          }}
          onChangeSuspensionTyre={(driverId, compound) => {
            try {
              const res = canonicalRaceEngineService.changeTyresDuringSuspension({
                raceState: canonicalRaceState,
                driverId,
                newCompound: compound,
              })
              if (res.success) {
                setCanonicalRaceState(res.updatedState)
                toast({
                  title: 'Pneu Trocado na Suspensão',
                  description: `Composto ${compound.toUpperCase()} instalado no carro.`,
                })
              }
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Erro ao trocar pneus',
                description: e?.message,
              })
            }
          }}
          onAdvanceOneLap={(opts) => {
            try {
              const nextState = canonicalRaceEngineService.advanceOneLap(canonicalRaceState, opts)
              setCanonicalRaceState(nextState)
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Erro ao avançar volta',
                description: e?.message,
              })
            }
          }}
          onSubmitWeatherDecision={(driverId, action, selectedCompound) => {
            try {
              const res = raceStrategyService.submitWeatherDecision({
                raceState: canonicalRaceState,
                driverId,
                action,
                selectedCompound,
              })
              if (res.success) {
                canonicalRaceInitializationService.saveCanonicalRaceState(res.updatedState)
                setCanonicalRaceState(res.updatedState)
                return { success: true }
              }
              return { success: false, error: res.error }
            } catch (err: any) {
              return { success: false, error: err?.message }
            }
          }}
          onAdvanceMultipleLaps={(count) => {
            try {
              const nextState = canonicalRaceEngineService.advanceMultipleLaps(
                canonicalRaceState,
                count,
              )
              setCanonicalRaceState(nextState)
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Erro ao simular voltas',
                description: e?.message,
              })
            }
          }}
          onResetRace={() => {
            try {
              if (!completeQualifyingResult || !team?.id || !season?.id) return
              const canonicalCareerId = resolveCanonicalCareerId(season, team)
              const clearRes = canonicalRaceInitializationService.clearCanonicalRaceState(
                canonicalCareerId,
                season.year || 2026,
                currentRound,
                { raceVariant: isSprint ? 'SPRINT_RACE' : 'MAIN_RACE' },
              )
              if (!clearRes.success) return

              const totalLaps = isSprint
                ? canonicalRaceInitializationService.calculateSprintLaps(
                    gpInfo.circuitLengthKm || 5.8,
                    100,
                    gpInfo.laps || 57,
                  )
                : gpInfo.laps || 57

              const freshRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
                raceVariant: isSprint ? 'SPRINT_RACE' : 'MAIN_RACE',
                careerId: canonicalCareerId,
                season: season.year || 2026,
                round: currentRound,
                circuitName: gpInfo.circuit,
                circuitCountry: gpInfo.country,
                totalLaps,
                playerTeamId: team.id,
                playerTeam: team,
                canonicalQualifyingGrid: completeQualifyingResult.finalGrid,
              })
              setCanonicalRaceState(freshRace)
              toast({
                title: 'Corrida Reiniciada',
                description: 'Estado redefinido a partir do grid oficial.',
              })
            } catch (e: any) {
              console.warn('[RaceControlLivePage] Erro ao resetar:', e)
            }
          }}
        />
      )}
    </div>
  )
}
