import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { advanceWeekendRound } from '@/services/canonicalRoundAdvanceHelper'
import { useAuth } from '@/contexts/AuthContext'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import {
  loadCanonicalRaceSessionContext,
  CanonicalRaceSessionContext,
  RaceSessionResolutionResult,
} from '@/services/canonicalRaceSessionLoader'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { collectRaceDiagnosticData, downloadDiagnosticJson } from '@/utils/raceDiagnosticExport'
import { raceStrategyService } from '@/services/raceStrategyService'
import type {
  CanonicalRaceState,
  OfficialRaceResult,
  DriverPaceMode,
  WeatherDecisionAction,
} from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { RaceTopTenBoard } from '@/components/race/RaceTopTenBoard'
import { RacePlayerDriverCard } from '@/components/race/RacePlayerDriverCard'
import { RaceStrategyPanel } from '@/components/race/RaceStrategyPanel'
import { RaceTeamMessagesFeed } from '@/components/race/RaceTeamMessagesFeed'
import { PreRaceStrategyModalOverlay } from '@/components/race/PreRaceStrategyModalOverlay'
import { CanonicalRaceInitializationPanel } from '@/components/race/CanonicalRaceInitializationPanel'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Play,
  Pause,
  FastForward,
  Flag,
  CloudSun,
  CloudRain,
  Wind,
  Gauge,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Shield,
  CheckCircle2,
  Layers,
} from 'lucide-react'
import type { RacePreparationSnapshot } from '@/types/canonical-race-preparation'

export default function RacePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const { team, season, isLoading: isAuthLoading } = useAuth()
  const { currentRound: contextRound, playerDrivers: catalogDrivers } = useUnifiedSeason()

  const requestedRound = useMemo(() => {
    const raw = searchParams.get('round')
    if (raw) {
      const parsed = parseInt(raw, 10)
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 24) return parsed
    }
    return contextRound || 1
  }, [searchParams, contextRound])

  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [sessionResolution, setSessionResolution] = useState<RaceSessionResolutionResult | null>(
    null,
  )
  const [prepSnapshot, setPrepSnapshot] = useState<RacePreparationSnapshot | null>(null)
  const [showStrategyModal, setShowStrategyModal] = useState(false)
  const [strategyModalCarId, setStrategyModalCarId] = useState<'car1' | 'car2'>('car1')

  // Estados canônicos para Março B e C
  const [canonicalRaceState, setCanonicalRaceState] = useState<CanonicalRaceState | null>(null)
  const [officialRaceResult, setOfficialRaceResult] = useState<OfficialRaceResult | null>(null)
  const [isConfirmingStrategy, setIsConfirmingStrategy] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const [careerPersistenceStatus, setCareerPersistenceStatus] = useState<
    'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED'
  >('PENDING')
  const [isPersistingCareer, setIsPersistingCareer] = useState(false)
  const [careerPersistenceError, setCareerPersistenceError] = useState<string | undefined>(
    undefined,
  )
  const [isOfficializing, setIsOfficializing] = useState(false)
  const [officializeError, setOfficializeError] = useState<string | null>(null)
  const [isAdvancingRound, setIsAdvancingRound] = useState(false)

  // Refs de controle de avanço e timer
  const isAdvancingRef = useRef(false)
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canonicalRaceStateRef = useRef<CanonicalRaceState | null>(null)
  canonicalRaceStateRef.current = canonicalRaceState

  // Limpeza de timers ao desmontar
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
    }
  }, [])

  // Carrega a sessão canônica
  useEffect(() => {
    if (isAuthLoading) return

    let isMounted = true
    setIsLoadingSession(true)

    loadCanonicalRaceSessionContext({
      season,
      team,
      round: requestedRound,
      allPlayerDrivers: catalogDrivers,
    })
      .then((res) => {
        if (!isMounted) return
        setSessionResolution(res)

        if (res.status === 'ready') {
          const ctx = res.context

          // (1) Prioridade 1: Resultado oficial gravado
          const official = canonicalRaceResultService.getOfficialRaceResult(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
            'MAIN_RACE',
          )
          if (official) {
            setOfficialRaceResult(official)
            const isReg = canonicalCareerPersistenceService.isResultRegistered(
              ctx.careerId,
              ctx.seasonYear,
              ctx.round,
              'MAIN_RACE',
            )
            setCareerPersistenceStatus(isReg ? 'COMPLETE' : 'PENDING')
            return
          }

          // (2) Prioridade 2: Corrida em andamento (último checkpoint pausado)
          const inProgressRace = canonicalRaceInitializationService.readCanonicalRaceState(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
            'MAIN_RACE',
          )
          if (inProgressRace) {
            setCanonicalRaceState(inProgressRace)
            return
          }

          // (3) Prioridade 3: Preparação confirmada previamente salva
          let snap = canonicalRacePreparationService.loadSnapshot(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
          )

          const [pDriver1, pDriver2] = ctx.playerDrivers

          // Validar se o snapshot existente condiz com os assentos oficiais atuais
          const snapMatchesSeats =
            snap &&
            snap.cars &&
            snap.cars.length === 2 &&
            snap.cars[0]?.driverId === pDriver1.driverId &&
            snap.cars[1]?.driverId === pDriver2.driverId

          if (!snapMatchesSeats) {
            try {
              snap = canonicalRacePreparationService.createInitialSnapshot({
                careerId: ctx.careerId,
                seasonYear: ctx.seasonYear,
                round: ctx.round,
                teamId: ctx.resolvedTeamKey,
                totalLaps: ctx.totalLaps,
                grid: ctx.finalGrid,
                inventories: ctx.tyreInventories,
              })

              // Garantir que snap.cars[0] corresponda a Carro 1 e snap.cars[1] a Carro 2 segundo pDriver1 e pDriver2
              if (snap && snap.cars && snap.cars.length === 2) {
                const carForD1 = snap.cars.find((c) => c.driverId === pDriver1.driverId)
                const carForD2 = snap.cars.find((c) => c.driverId === pDriver2.driverId)
                if (carForD1 && carForD2) {
                  snap.cars = [
                    { ...carForD1, carId: 'car1' },
                    { ...carForD2, carId: 'car2' },
                  ]
                }
              }

              canonicalRacePreparationService.saveSnapshot(snap)
            } catch (snapErr) {
              console.warn('[RacePage] Erro ao criar snapshot inicial de preparação:', snapErr)
            }
          }

          setPrepSnapshot(snap)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('[RacePage] Erro fatal ao resolver sessão:', err)
        setSessionResolution({
          status: 'error',
          message: err?.message || 'Falha ao resolver contexto canônico da corrida.',
          round: requestedRound,
        })
      })
      .finally(() => {
        if (isMounted) setIsLoadingSession(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthLoading, season?.id, team?.id, requestedRound, catalogDrivers])

  // A) Conexão confirmação → motor em RacePage.tsx
  const handleConfirmAndPrepare = useCallback(async () => {
    if (!sessionResolution || sessionResolution.status !== 'ready') return
    const ctx = sessionResolution.context

    // Guard contra corrida já existente
    const existingRace = canonicalRaceInitializationService.readCanonicalRaceState(
      ctx.careerId,
      ctx.seasonYear,
      ctx.round,
      'MAIN_RACE',
    )
    if (existingRace) {
      setCanonicalRaceState(existingRace)
      setShowStrategyModal(false)
      return
    }

    if (!prepSnapshot) return

    setIsConfirmingStrategy(true)
    try {
      // 1. Validar e salvar snapshot
      canonicalRacePreparationService.saveSnapshot(prepSnapshot)

      // 2. Mapear carPreparations por driverId real
      const carPreparations: Record<string, any> = {}
      for (const car of prepSnapshot.cars) {
        if (car && car.driverId) {
          carPreparations[car.driverId] = {
            carId: car.carId,
            startingTyreSetId: car.startingTyreSetId,
            startingCompound: car.startingCompound,
            initialTyreWear: car.initialTyreWear,
            initialTyreLapsUsed: car.initialTyreLapsUsed,
            startingFuelKg: car.startingFuelKg,
            strategyPlan: car.strategyPlan,
          }
        }
      }

      // 3. Inicializar corrida canônica
      const initialState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: ctx.careerId,
        season: ctx.seasonYear,
        round: ctx.round,
        circuitName: ctx.circuit.name,
        circuitCountry: ctx.circuit.country,
        circuitLengthKm: ctx.circuit.circuitLengthKm,
        totalLaps: ctx.totalLaps,
        playerTeamId: ctx.resolvedTeamKey,
        playerTeam: ctx.playerTeam,
        canonicalQualifyingGrid: ctx.finalGrid,
        carPreparations,
        persistState: true,
      })

      setCanonicalRaceState(initialState)
      setShowStrategyModal(false)
    } catch (err: any) {
      console.error('[RacePage] Erro ao confirmar preparação e inicializar corrida:', err)
      setPersistenceError(err?.message || 'Falha ao inicializar o motor de corrida.')
    } finally {
      setIsConfirmingStrategy(false)
    }
  }, [sessionResolution, prepSnapshot])

  // B) Execução de uma volta real com o motor
  const advanceLap = useCallback(async () => {
    const currentState = canonicalRaceStateRef.current
    if (!currentState || isAdvancingRef.current) return

    // Checar se a corrida encerrou
    if (currentState.status === 'completed' || currentState.currentLap > currentState.totalLaps) {
      setIsPlaying(false)
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
      return
    }

    isAdvancingRef.current = true
    try {
      const nextState = canonicalRaceEngineService.advanceOneLap(currentState, {
        persistState: true,
      })
      setCanonicalRaceState(nextState)

      // Se a corrida acabou nesta volta
      if (nextState.status === 'completed' || nextState.currentLap > nextState.totalLaps) {
        setIsPlaying(false)
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current)
          playbackTimerRef.current = null
        }
      }
    } catch (err: any) {
      console.error('[RacePage] Erro ao avançar volta:', err)
      setIsPlaying(false)
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
      setPersistenceError(err?.message || 'Falha ao gravar checkpoint da corrida no motor.')
    } finally {
      isAdvancingRef.current = false
    }
  }, [])

  // Gerenciamento do loop de PLAY / PAUSE (1x = ~1500ms)
  useEffect(() => {
    if (isPlaying) {
      if (!playbackTimerRef.current) {
        playbackTimerRef.current = setInterval(() => {
          advanceLap()
        }, 1500)
      }
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
    }
  }, [isPlaying, advanceLap])

  const handleTogglePlayPause = useCallback(() => {
    if (!canonicalRaceState) return
    if (
      canonicalRaceState.status === 'completed' ||
      canonicalRaceState.currentLap > canonicalRaceState.totalLaps
    ) {
      return
    }

    if (isPlaying) {
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      // Dispara o primeiro avanço imediatamente se não estiver avançando
      advanceLap()
    }
  }, [canonicalRaceState, isPlaying, advanceLap])

  // C) Oficialização Canônica e Registro na Carreira
  const handleOfficializeRace = useCallback(async () => {
    if (!sessionResolution || sessionResolution.status !== 'ready') return
    const ctx = sessionResolution.context
    const currentState = canonicalRaceStateRef.current

    if (!currentState) {
      setOfficializeError('Estado da corrida não encontrado.')
      return
    }

    // Verificar se já foi oficializada previamente
    const alreadyOfficial = canonicalRaceResultService.getOfficialRaceResult(
      ctx.careerId,
      ctx.seasonYear,
      ctx.round,
      'MAIN_RACE',
    )
    if (alreadyOfficial) {
      setOfficialRaceResult(alreadyOfficial)
      // Assegurar registro da carreira sem duplicar
      try {
        setIsPersistingCareer(true)
        setCareerPersistenceStatus('APPLYING')
        const persistRes =
          await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
            alreadyOfficial,
            { requireBackendSync: true },
          )
        setCareerPersistenceStatus(persistRes.journal.status)
        setIsPersistingCareer(false)
        if (persistRes.success) {
          canonicalChampionshipService.processAndPersistRoundChampionship(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
            alreadyOfficial.playerTeamId,
          )
        } else {
          setCareerPersistenceError(persistRes.error)
        }
      } catch (e: any) {
        setIsPersistingCareer(false)
        setCareerPersistenceStatus('FAILED')
        setCareerPersistenceError(e?.message)
        console.warn('[RacePage] Sync na carreira ao recuperar resultado existente:', e)
      }
      return
    }

    // Apenas pode oficializar se a corrida chegou ao final ou status 'completed'
    if (currentState.status !== 'completed' && currentState.currentLap <= currentState.totalLaps) {
      setOfficializeError('A corrida ainda está em andamento e não pode ser oficializada.')
      return
    }

    setIsOfficializing(true)
    setOfficializeError(null)

    try {
      // 1. Snapshot da corrida com o careerId canônico
      const stateToOfficialize: CanonicalRaceState = {
        ...currentState,
        careerId: ctx.careerId,
      }

      // 2. Chamar canonicalRaceResultService.officializeRace (idempotente e canônico)
      const official = canonicalRaceResultService.officializeRace(stateToOfficialize)
      setOfficialRaceResult(official)

      // 3. Persistência de carreira (journal atômico, pontos, stats, moral, etc.)
      try {
        setIsPersistingCareer(true)
        setCareerPersistenceStatus('APPLYING')
        const persistRes =
          await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
            official,
            { requireBackendSync: true },
          )
        setCareerPersistenceStatus(persistRes.journal.status)
        setIsPersistingCareer(false)

        if (persistRes.success) {
          // Processar campeonato canônico da rodada
          canonicalChampionshipService.processAndPersistRoundChampionship(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
            official.playerTeamId,
          )
        } else {
          setCareerPersistenceError(persistRes.error)
        }
      } catch (applyErr: any) {
        setIsPersistingCareer(false)
        setCareerPersistenceStatus('FAILED')
        setCareerPersistenceError(applyErr?.message || 'Falha ao registrar carreira.')
      }

      toast({
        title: 'Corrida Oficializada com Sucesso',
        description:
          'O resultado oficial imutável foi homologado pela FIA e registrado na temporada.',
      })
    } catch (err: any) {
      console.error('[RacePage] Erro ao oficializar corrida:', err)
      setOfficializeError(err?.message || 'Falha ao oficializar corrida.')
      toast({
        variant: 'destructive',
        title: 'Falha na Oficialização',
        description: err?.message || 'A prova não pôde ser homologada.',
      })
    } finally {
      setIsOfficializing(false)
    }
  }, [sessionResolution])

  // D) Avanço para o Próximo Fim de Semana (fluxo canônico)
  const handleAdvanceToNextWeekend = useCallback(async () => {
    if (!sessionResolution || sessionResolution.status !== 'ready' || !season?.id) return
    if (careerPersistenceStatus !== 'COMPLETE') {
      toast({
        variant: 'destructive',
        title: 'Avanço Bloqueado',
        description:
          'O registro obrigatório do resultado na carreira deve ser concluído com sucesso antes de avançar.',
      })
      return
    }
    const ctx = sessionResolution.context

    setIsAdvancingRound(true)
    try {
      const res = await advanceWeekendRound({
        officialResult: officialRaceResult,
        season,
        team,
        currentRound: ctx.round,
        totalRounds: 24,
        onSuccess: (nextRound) => {
          toast({
            title: `Rodada ${ctx.round} Concluída!`,
            description: `Avançando para a Rodada ${nextRound} da temporada 2026.`,
          })
          navigate(`/corrida?round=${nextRound}`)
        },
        onError: (err) => {
          toast({
            variant: 'destructive',
            title: 'Erro ao avançar rodada',
            description: err?.message || 'Falha ao atualizar rodada.',
          })
        },
      })

      if (!res.success && res.error) {
        toast({
          variant: 'destructive',
          title: 'Avanço de Rodada Bloqueado',
          description: res.error,
        })
      }
    } catch (err: any) {
      console.error('[RacePage] Erro ao avançar rodada:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no Avanço',
        description: err?.message || 'Não foi possível avançar para a próxima rodada.',
      })
    } finally {
      setIsAdvancingRound(false)
    }
  }, [sessionResolution, officialRaceResult, season, team, navigate, careerPersistenceStatus])

  // ESTADO DE CARREGAMENTO
  if (isAuthLoading || isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] space-y-4 font-mono text-white">
        <div className="w-10 h-10 border-4 border-[#E10600] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Sincronizando Box da Equipe & Grid Oficial FIA...
        </p>
      </div>
    )
  }

  // ESTADO: SEM CORRIDA PREPARADA (EMPTY STATE AMIGÁVEL)
  if (!sessionResolution || sessionResolution.status === 'no_race') {
    const msg =
      sessionResolution && sessionResolution.status === 'no_race'
        ? sessionResolution.message
        : 'Nenhuma corrida preparada para esta rodada. O grid oficial ainda não foi formado.'

    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5 font-mono">
        <Card className="bg-[#090F1C] border border-[#1E293B] p-6 rounded-2xl shadow-xl text-white space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-black uppercase text-amber-300">
              Nenhuma corrida preparada para esta rodada
            </h2>
            <p className="text-xs text-slate-400 font-sans">{msg}</p>
          </div>
          <div className="pt-2">
            <Button
              asChild
              className="bg-[#E10600] hover:bg-[#C00400] text-white font-black text-xs gap-2 uppercase tracking-wide"
            >
              <Link to="/corrida">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Fim de Semana
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ESTADO: ERRO NA RESOLUÇÃO
  if (sessionResolution.status === 'error') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5 font-mono">
        <Card className="bg-[#090F1C] border border-rose-900/60 p-6 rounded-2xl shadow-xl text-white space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-black uppercase text-rose-400">
              Erro ao carregar dados da corrida
            </h2>
            <p className="text-xs text-slate-300 font-sans">{sessionResolution.message}</p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              asChild
              variant="outline"
              className="border-slate-700 text-slate-300 text-xs font-bold"
            >
              <Link to="/corrida">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Voltar ao Fim de Semana
              </Link>
            </Button>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Recarregar Página
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const { context } = sessionResolution
  const { circuit, weather, playerTeam, playerDrivers, finalGrid } = context
  const [driver1, driver2] = playerDrivers

  const isConfirmed = Boolean(canonicalRaceState)
  const isFinished =
    canonicalRaceState?.status === 'completed' ||
    Boolean(canonicalRaceState && canonicalRaceState.currentLap > canonicalRaceState.totalLaps)

  // Status exibido
  const sessionStatusLabel = isFinished
    ? 'CORRIDA ENCERRADA'
    : canonicalRaceState
      ? isPlaying
        ? 'EM ANDAMENTO (1x)'
        : 'PAUSADA'
      : 'PRÉ-CORRIDA'

  const currentLapDisplay = canonicalRaceState?.currentLap ?? 0
  const totalLapsDisplay = canonicalRaceState?.totalLaps ?? context.totalLaps

  // Dados dos pilotos do jogador do estado canônico se existirem
  const canonicalDriver1State = canonicalRaceState?.drivers?.find(
    (d) => d.driverId === driver1.driverId,
  )
  const canonicalDriver2State = canonicalRaceState?.drivers?.find(
    (d) => d.driverId === driver2.driverId,
  )

  // Clima inicial (CanonicalRaceInitialWeather) da sessão
  const initialWeather = weather

  // SE HOUVER RESULTADO OFICIAL HOMOLOGADO, EXIBIR PAINEL OFICIAL FIA
  if (officialRaceResult) {
    return (
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-4 space-y-4 font-sans text-white">
        <header className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#0E1626] via-[#1B1124] to-[#450A1A] border border-[#1E293B] shadow-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase tracking-wider">
                  BOX DA EQUIPE
                </Badge>
                <Badge
                  variant="outline"
                  className="text-emerald-300 border-emerald-800/60 bg-emerald-950/40 text-[10px] font-mono"
                >
                  RESULTADO OFICIAL HOMOLOGADO
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                {circuit.name}
              </h1>
              <p className="text-xs text-slate-300 font-mono">
                {circuit.circuit} • {circuit.country} • Rodada {context.round} • Equipe:{' '}
                <span className="text-white font-bold">{playerTeam.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs h-9 px-3 gap-1.5"
              >
                <Link to="/corrida">
                  <ArrowLeft className="w-4 h-4" />
                  Fim de Semana
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Componente canônico de Resultado Oficial FIA */}
        <OfficialRaceResultPanel
          result={officialRaceResult}
          careerPersistenceStatus={careerPersistenceStatus}
          isPersisting={isPersistingCareer}
          persistenceError={careerPersistenceError}
          isContinuing={isAdvancingRound}
          onExportDiagnostics={() => {
            try {
              const diagData = collectRaceDiagnosticData(context.careerId, {
                appContext: {
                  careerId: context.careerId,
                  careerIdOrigin: 'RacePage context.careerId',
                  pocketBaseSeasonId: season?.id,
                  pocketBaseSeasonIdOrigin: 'auth season.id',
                  internalNumericSeasonId: context.seasonYear,
                  internalNumericSeasonIdOrigin: 'RacePage context.seasonYear',
                  displayedYear: season?.year || 2026,
                  displayedYearOrigin: 'season.year',
                  currentRound: context.round,
                  currentRoundOrigin: 'RacePage context.round',
                  sessionType: 'race',
                  sessionTypeOrigin: 'RacePage OfficialPanel',
                },
              })
              const ok = downloadDiagnosticJson(diagData, `apex-diagnostico-r${context.round}.json`)
              if (ok) {
                toast({
                  title: 'Diagnóstico Exportado',
                  description: 'Arquivo JSON com resultado e inventário baixado com sucesso.',
                })
              }
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Erro ao exportar diagnóstico',
                description: e?.message || 'Falha ao gerar arquivo de diagnóstico.',
              })
            }
          }}
          onRegisterInCareer={async () => {
            try {
              setIsPersistingCareer(true)
              setCareerPersistenceStatus('APPLYING')
              setCareerPersistenceError(undefined)
              const res =
                await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
                  officialRaceResult,
                  { requireBackendSync: true },
                )
              setCareerPersistenceStatus(res.journal.status)
              setIsPersistingCareer(false)
              if (res.success) {
                canonicalChampionshipService.processAndPersistRoundChampionship(
                  context.careerId,
                  context.seasonYear,
                  context.round,
                  officialRaceResult.playerTeamId,
                )
              } else {
                setCareerPersistenceError(res.error)
              }
            } catch (err: any) {
              setIsPersistingCareer(false)
              setCareerPersistenceStatus('FAILED')
              setCareerPersistenceError(err?.message || 'Falha na persistência da carreira.')
            }
          }}
          onContinue={handleAdvanceToNextWeekend}
          onViewChampionship={() => navigate('/classificacao')}
        />
      </div>
    )
  }

  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-2 space-y-2.5 font-sans text-white">
      {/* 4.A HEADER: BOX DA EQUIPE — CONTROLE DE CORRIDA */}
      <header className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#0E1626] via-[#1B1124] to-[#450A1A] border border-[#1E293B] shadow-xl p-4 sm:p-5 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase tracking-wider">
                BOX DA EQUIPE
              </Badge>
              <Badge
                variant="outline"
                className="text-cyan-300 border-cyan-800/60 bg-cyan-950/40 text-[10px] font-mono"
              >
                CONTROLE DE CORRIDA
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  isFinished
                    ? 'text-emerald-300 border-emerald-800/60 bg-emerald-950/40'
                    : isConfirmed
                      ? 'text-blue-300 border-blue-800/60 bg-blue-950/40'
                      : 'text-amber-300 border-amber-800/60 bg-amber-950/40'
                }`}
              >
                STATUS: {sessionStatusLabel}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              {circuit.name}
            </h1>
            <p className="text-xs text-slate-300 font-mono">
              {circuit.circuit} • {circuit.country} • {context.totalLaps} Voltas • Equipe:{' '}
              <span className="text-white font-bold">{playerTeam.name}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                setStrategyModalCarId('car1')
                setShowStrategyModal(true)
              }}
              className="bg-[#1A253A] hover:bg-[#253550] text-cyan-300 border border-cyan-700/60 font-black text-xs h-9 px-4 gap-2"
            >
              <Layers className="w-4 h-4" />
              Box de Estratégia
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs h-9 px-3 gap-1.5"
            >
              <Link to="/corrida">
                <ArrowLeft className="w-4 h-4" />
                Fim de Semana
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ALERTA DE ERRO DE PERSISTÊNCIA SE HOUVER */}
      {persistenceError && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs font-mono flex items-center justify-between">
          <span>Erro no motor de corrida: {persistenceError}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPersistenceError(null)}
            className="text-rose-300 hover:text-white h-7 px-2 text-[10px]"
          >
            Fechar
          </Button>
        </div>
      )}

      {/* ALERTA DE ERRO DE OFICIALIZAÇÃO SE HOUVER */}
      {officializeError && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs font-mono flex items-center justify-between">
          <span>Erro ao oficializar resultado: {officializeError}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOfficializeError(null)}
            className="text-rose-300 hover:text-white h-7 px-2 text-[10px]"
          >
            Fechar
          </Button>
        </div>
      )}

      {/* BANNER SE CORRIDA ENCERRADA E NÃO OFICIALIZADA */}
      {isFinished && !officialRaceResult && (
        <div
          className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs font-mono flex flex-wrap items-center justify-between gap-3 shadow-md"
          data-testid="banner-race-finished-pending-official"
        >
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold block text-white">
                Corrida encerrada ({currentLapDisplay}/{totalLapsDisplay} voltas completadas).
              </span>
              <span className="text-[11px] text-emerald-300">
                O resultado canônico está congelado e pronto para homologação da FIA.
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isOfficializing}
            onClick={handleOfficializeRace}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-9 px-4 shadow-lg gap-2 cursor-pointer border border-emerald-400"
            data-testid="btn-officialize-race"
          >
            {isOfficializing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Oficializando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Oficializar Resultado</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* 4.B CONTROLES SUPERIORES: PLAY / PAUSE (1x apenas) */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-[#090F1C] border border-[#1E293B] shadow-md flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          {isPlaying ? (
            <Button
              type="button"
              size="sm"
              onClick={handleTogglePlayPause}
              disabled={isFinished}
              className="h-8 px-3 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white border border-amber-500 shadow gap-1.5 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              PAUSE
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleTogglePlayPause}
              disabled={!isConfirmed || isFinished}
              className={`h-8 px-3 text-xs font-black gap-1.5 ${
                !isConfirmed || isFinished
                  ? 'bg-[#1E293B] text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow cursor-pointer'
              }`}
              title={
                !isConfirmed
                  ? 'Confirme a estratégia antes de iniciar.'
                  : isFinished
                    ? 'Corrida encerrada.'
                    : 'Iniciar simulação da corrida'
              }
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              PLAY
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-2.5 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800"
            title="Velocidade 1x ativa por padrão"
          >
            1x
          </Button>
          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-2.5 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800"
          >
            2x
          </Button>
          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-2.5 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800"
          >
            4x
          </Button>

          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-3 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800 gap-1"
          >
            <FastForward className="w-3 h-3" />
            10 VOLTAS
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!isPlaying}
            onClick={() => setIsPlaying(false)}
            className={`h-8 px-3 text-xs font-bold gap-1 ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                : 'bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            <Pause className="w-3 h-3" />
            PAUSE
          </Button>

          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-3 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800 gap-1"
          >
            <Flag className="w-3 h-3" />
            FIM
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span
            className={`w-2 h-2 rounded-full ${
              isFinished
                ? 'bg-emerald-400'
                : isPlaying
                  ? 'bg-emerald-400 animate-pulse'
                  : isConfirmed
                    ? 'bg-blue-400'
                    : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="font-bold text-slate-300 uppercase">{sessionStatusLabel}:</span>
          <span>
            {isFinished
              ? 'Todas as voltas completadas.'
              : isPlaying
                ? 'Avanço a cada ~1.5s por volta.'
                : isConfirmed
                  ? 'Pronta para largada. Clique em PLAY.'
                  : 'Confirme a estratégia para liberar o PLAY.'}
          </span>
        </div>
      </div>

      {/* 4.C VISÃO GERAL: VOLTA ATUAL 0/TOTAL, STATUS, CLIMA, PISTA, ADERÊNCIA */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
            Volta Atual
          </span>
          <span className="text-base font-black text-white font-mono mt-0.5 block">
            {currentLapDisplay} / {totalLapsDisplay}
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
            Status da Sessão
          </span>
          <span
            className={`text-xs font-black font-mono mt-1 block ${
              isFinished
                ? 'text-emerald-400'
                : isPlaying
                  ? 'text-emerald-400 animate-pulse'
                  : isConfirmed
                    ? 'text-blue-400'
                    : 'text-amber-400'
            }`}
          >
            {sessionStatusLabel}
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block flex items-center justify-center gap-1">
            {initialWeather.isWet ? (
              <CloudRain className="w-3 h-3 text-cyan-400" />
            ) : (
              <CloudSun className="w-3 h-3 text-amber-400" />
            )}
            Clima
          </span>
          <span className="text-xs font-black text-white font-mono mt-1 block truncate">
            {initialWeather.airTempC}°C ar • {initialWeather.trackTempC}°C pista
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
            Condição da Pista
          </span>
          <span
            className={`text-xs font-black font-mono mt-1 block ${
              initialWeather.isWet ? 'text-cyan-300' : 'text-emerald-400'
            }`}
          >
            {initialWeather.trackStatus}
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block flex items-center justify-center gap-1">
            <Gauge className="w-3 h-3 text-slate-400" />
            Aderência
          </span>
          <span className="text-xs font-black text-white font-mono mt-1 block">
            {initialWeather.trackGripPct}% ({initialWeather.trackGripLabel})
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block flex items-center justify-center gap-1">
            <Wind className="w-3 h-3 text-slate-400" />
            Vento & Chuva
          </span>
          <span className="text-xs font-black text-slate-200 font-mono mt-1 block truncate">
            {initialWeather.windSpeedKmh} km/h • {initialWeather.rainProbabilityPct}% chuva
          </span>
        </Card>
      </div>

      {/* ÁREA PRINCIPAL: DOIS CARDS DE PILOTO + TOP 10 + ESTRATÉGIA + MENSAGENS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* COLUNA ESQUERDA: DOIS CARDS DOS PILOTOS DO JOGADOR (8 colunas no lg) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <RacePlayerDriverCard
              driver={driver1}
              preparedCar={prepSnapshot?.cars[0]}
              canonicalDriverState={canonicalDriver1State}
              teamColor={playerTeam.color || '#E10600'}
              onOpenStrategyModal={(carId) => {
                setStrategyModalCarId(carId)
                setShowStrategyModal(true)
              }}
            />
            <RacePlayerDriverCard
              driver={driver2}
              preparedCar={prepSnapshot?.cars[1]}
              canonicalDriverState={canonicalDriver2State}
              teamColor={playerTeam.color || '#E10600'}
              onOpenStrategyModal={(carId) => {
                setStrategyModalCarId(carId)
                setShowStrategyModal(true)
              }}
            />
          </div>

          {/* 4.G MENSAGENS DA EQUIPE */}
          <RaceTeamMessagesFeed events={canonicalRaceState?.events} />
        </div>

        {/* COLUNA DIREITA: TOP 10 DO GRID OFICIAL + ESTRATÉGIA (4 colunas no lg) */}
        <div className="lg:col-span-4 space-y-3">
          {/* 4.D TOP 10 DO GRID OFICIAL / CORRIDA EM TEMPO REAL */}
          <RaceTopTenBoard
            finalGrid={finalGrid}
            canonicalDrivers={canonicalRaceState?.drivers}
            playerDriverIds={[driver1.driverId, driver2.driverId]}
          />

          {/* 4.F ESTRATÉGIA DA CORRIDA */}
          <RaceStrategyPanel
            preparedCars={prepSnapshot?.cars || [undefined, undefined]}
            totalLaps={context.totalLaps}
          />
        </div>
      </div>

      {/* 5. BOX DE ESTRATÉGIA INICIAL (OVERLAY MODAL) */}
      {showStrategyModal && prepSnapshot && (
        <PreRaceStrategyModalOverlay
          key={strategyModalCarId}
          snapshot={prepSnapshot}
          inventories={context.tyreInventories}
          totalLaps={context.totalLaps}
          initialCarId={strategyModalCarId}
          isConfirmed={isConfirmed}
          isConfirming={isConfirmingStrategy}
          onConfirmAndPrepare={handleConfirmAndPrepare}
          onClose={() => setShowStrategyModal(false)}
          onUpdateSnapshot={(next) => {
            setPrepSnapshot(next)
            canonicalRacePreparationService.saveSnapshot(next)
          }}
        />
      )}
    </div>
  )
}
