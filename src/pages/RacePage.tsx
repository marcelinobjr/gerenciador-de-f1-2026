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
import { Card } from '@/components/ui/card'
import { ArrowLeft, AlertTriangle, RotateCcw, Layers, Radio } from 'lucide-react'
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

  const requestedVariant = useMemo<'MAIN_RACE' | 'SPRINT_RACE'>(() => {
    const raw = (searchParams.get('variant') || '').trim().toLowerCase()
    if (raw === 'sprint' || raw === 'sprint_race') return 'SPRINT_RACE'
    return 'MAIN_RACE'
  }, [searchParams])

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
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const [careerPersistenceStatus, setCareerPersistenceStatus] = useState<
    'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED'
  >('PENDING')
  const [remoteQueryState, setRemoteQueryState] = useState<
    'idle' | 'checking' | 'found' | 'missing' | 'error'
  >('idle')
  const [remoteQueryError, setRemoteQueryError] = useState<string | undefined>(undefined)
  const [isReconciliationPending, setIsReconciliationPending] = useState(false)
  const [isPersistingCareer, setIsPersistingCareer] = useState(false)
  const [careerPersistenceError, setCareerPersistenceError] = useState<string | undefined>(
    undefined,
  )
  const [isOfficializing, setIsOfficializing] = useState(false)
  const [officializeError, setOfficializeError] = useState<string | null>(null)
  const [isAdvancingRound, setIsAdvancingRound] = useState(false)

  // Refs de controle de avanço e timer
  const activeRequestIdRef = useRef<number>(0)
  const canonicalRaceStateRef = useRef<CanonicalRaceState | null>(null)
  canonicalRaceStateRef.current = canonicalRaceState

  // Função centralizada para consultar e validar o journal remoto
  const verifyRemoteJournalStatus = useCallback(
    async (
      targetResult: OfficialRaceResult,
      targetContext: CanonicalRaceSessionContext,
    ): Promise<boolean> => {
      const currentRequestId = ++activeRequestIdRef.current
      setRemoteQueryState('checking')
      setRemoteQueryError(undefined)
      setIsReconciliationPending(false)

      try {
        const remoteJournal =
          await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
            targetContext.careerId,
            targetContext.seasonYear,
            targetContext.round,
            targetContext.variant,
          )

        // Se uma requisição mais recente foi disparada ou mudou de contexto, descartar
        if (currentRequestId !== activeRequestIdRef.current) {
          return false
        }

        if (!remoteJournal) {
          setRemoteQueryState('missing')
          setCareerPersistenceStatus('PENDING')
          return false
        }

        // Validar correspondência estrita da prova exibida
        const matchesCareer = remoteJournal.careerId === targetContext.careerId
        const matchesSeason = Number(remoteJournal.season) === Number(targetContext.seasonYear)
        const matchesRound = Number(remoteJournal.round) === Number(targetContext.round)
        const matchesHash =
          !targetResult.resultHash ||
          !remoteJournal.checksum ||
          remoteJournal.checksum === targetResult.resultHash

        if (!matchesCareer || !matchesSeason || !matchesRound || !matchesHash) {
          setRemoteQueryState('error')
          setRemoteQueryError('Divergência de identidade ou hash no journal remoto.')
          setCareerPersistenceStatus('FAILED')
          return false
        }

        // Journal correspondente encontrado
        setRemoteQueryState('found')
        setCareerPersistenceStatus(remoteJournal.status)

        // Se o journal estiver em APPLYING ou FAILED, ou se ainda não tiver completado todos os pilotos,
        // marcar reconciliação pendente para permitir retomar com segurança
        if (
          remoteJournal.status === 'FAILED' ||
          (remoteJournal.status === 'APPLYING' &&
            remoteJournal.totalEntries > 0 &&
            remoteJournal.appliedDriverIds.length < remoteJournal.totalEntries)
        ) {
          setIsReconciliationPending(true)
        }

        return remoteJournal.status === 'COMPLETE'
      } catch (err: any) {
        if (currentRequestId !== activeRequestIdRef.current) {
          return false
        }
        console.warn('[RacePage] Erro ao consultar journal remoto:', err)
        setRemoteQueryState('error')
        setRemoteQueryError(err?.message || 'Falha de comunicação ao consultar o backend.')
        setCareerPersistenceStatus('FAILED')
        return false
      }
    },
    [],
  )

  // Carrega a sessão canônica
  useEffect(() => {
    if (isAuthLoading) return

    let isMounted = true
    setIsLoadingSession(true)

    loadCanonicalRaceSessionContext({
      season,
      team,
      round: requestedRound,
      variant: requestedVariant,
      allPlayerDrivers: catalogDrivers,
    })
      .then(async (res) => {
        if (!isMounted) return
        setSessionResolution(res)

        if (res.status === 'ready') {
          const ctx = res.context

          // (1) Prioridade 1: Resultado oficial gravado
          // Tentar cache local síncrono primeiro; se ausente, buscar do backend PocketBase
          let official = canonicalRaceResultService.getOfficialRaceResult(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
            ctx.variant,
          )

          const processOfficialFound = (offResult: OfficialRaceResult) => {
            setOfficialRaceResult(offResult)
            verifyRemoteJournalStatus(offResult, ctx)
          }

          if (official) {
            processOfficialFound(official)
            // Consultar o backend para verificar se o journal precisa ser retomado
            // Executado em background resiliente: não amarrado à desmontagem do componente
            canonicalCareerPersistenceService
              .getApplicationJournalFromBackend(
                ctx.careerId,
                ctx.seasonYear,
                ctx.round,
                ctx.variant,
              )
              .then((remoteJ) => {
                if (
                  !remoteJ ||
                  remoteJ.status !== 'COMPLETE' ||
                  (remoteJ.totalEntries > 0 &&
                    remoteJ.appliedDriverIds.length < remoteJ.totalEntries)
                ) {
                  if (isMounted) setIsPersistingCareer(true)
                  canonicalCareerPersistenceService
                    .registerOfficialRaceResultInCareerAsync(official, { requireBackendSync: true })
                    .then((res) => {
                      if (isMounted) {
                        setCareerPersistenceStatus(res.journal.status)
                        setIsReconciliationPending(res.journal.status !== 'COMPLETE')
                        setIsPersistingCareer(false)
                        if (res.success) {
                          setRemoteQueryState('found')
                        }
                      }
                    })
                    .catch((resumeErr) => {
                      if (isMounted) {
                        setIsPersistingCareer(false)
                        setCareerPersistenceStatus('FAILED')
                        setCareerPersistenceError(resumeErr?.message || 'Falha ao retomar journal.')
                        console.warn(
                          '[RacePage] Erro ao retomar aplicação do journal da corrida:',
                          resumeErr,
                        )
                      }
                    })
                }
              })
              .catch((err) => {
                console.warn('[RacePage] Erro ao consultar journal para retomada:', err)
              })
            return
          }
          // (2) Prioridade 2: Corrida em andamento ou concluída (backend-first via readCanonicalRaceStatePreferred)
          let inProgressRace: CanonicalRaceState | null = null
          try {
            inProgressRace =
              await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
                ctx.careerId,
                ctx.seasonYear,
                ctx.round,
                ctx.variant,
              )
          } catch (p2Err) {
            console.warn(
              '[RacePage] Falha na leitura preferencial backend-first do race state:',
              p2Err,
            )
            inProgressRace = canonicalRaceInitializationService.readCanonicalRaceState(
              ctx.careerId,
              ctx.seasonYear,
              ctx.round,
              ctx.variant,
            )
          }

          if (inProgressRace) {
            setCanonicalRaceState(inProgressRace)
            return
          }

          // RACE-RESUME-01B: Checagem de segurança absoluta — um estado `completed` NUNCA deve reiniciar a corrida.
          // Se houver qualquer indício de race state concluído sem resultado oficializado, não reiniciar.

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
  }, [isAuthLoading, season?.id, team?.id, requestedRound, requestedVariant, catalogDrivers])

  // Recuperação do resultado oficial persistido no backend caso localStorage não o tenha (ex: cota excedida)
  useEffect(() => {
    if (!sessionResolution || sessionResolution.status !== 'ready') return

    const ctx = sessionResolution.context
    let isMounted = true

    // Se já temos resultado carregado, verificar se o journal precisa de retomada automática
    if (officialRaceResult) {
      canonicalCareerPersistenceService
        .getApplicationJournalFromBackend(ctx.careerId, ctx.seasonYear, ctx.round, ctx.variant)
        .then((j) => {
          if (
            isMounted &&
            j &&
            (j.status === 'APPLYING' ||
              j.status === 'FAILED' ||
              (j.totalEntries > 0 && j.appliedDriverIds.length < j.totalEntries))
          ) {
            console.info(
              '[RacePage] Retomando journal de aplicação pendente/stall da rodada:',
              j.key,
            )
            setIsPersistingCareer(true)
            canonicalCareerPersistenceService
              .registerOfficialRaceResultInCareerAsync(officialRaceResult, {
                requireBackendSync: true,
              })
              .then((res) => {
                if (isMounted) {
                  setCareerPersistenceStatus(res.journal.status)
                  setIsReconciliationPending(res.journal.status !== 'COMPLETE')
                  setIsPersistingCareer(false)
                  if (res.success) {
                    setRemoteQueryState('found')
                  }
                }
              })
              .catch((err) => {
                if (isMounted) {
                  setIsPersistingCareer(false)
                  setCareerPersistenceStatus('FAILED')
                  setCareerPersistenceError(err?.message || 'Falha ao retomar journal da rodada.')
                  console.warn('[RacePage] Erro ao retomar journal da rodada:', err)
                }
              })
          }
        })
        .catch(() => {})
      return
    }

    canonicalRaceResultService
      .getOfficialRaceResultFromBackend(ctx.careerId, ctx.seasonYear, ctx.round, ctx.variant)
      .then((remoteOfficial) => {
        if (!isMounted || !remoteOfficial) return
        setOfficialRaceResult(remoteOfficial)
        // Salvar em cache local se possível (não-bloqueante)
        try {
          canonicalRaceResultService.saveOfficialRaceResult(remoteOfficial)
        } catch {
          /* cache local opcional */
        }
        verifyRemoteJournalStatus(remoteOfficial, ctx)

        // Se o journal estiver incompleto, retomar reconciliação e aplicação automática
        canonicalCareerPersistenceService
          .getApplicationJournalFromBackend(ctx.careerId, ctx.seasonYear, ctx.round, ctx.variant)
          .then((j) => {
            if (isMounted && (!j || j.status !== 'COMPLETE')) {
              setIsPersistingCareer(true)
              canonicalCareerPersistenceService
                .registerOfficialRaceResultInCareerAsync(remoteOfficial, {
                  requireBackendSync: true,
                })
                .then((res) => {
                  if (isMounted) {
                    setCareerPersistenceStatus(res.journal.status)
                    setIsReconciliationPending(res.journal.status !== 'COMPLETE')
                    setIsPersistingCareer(false)
                    if (res.success) {
                      setRemoteQueryState('found')
                    }
                  }
                })
                .catch((err) => {
                  if (isMounted) {
                    setIsPersistingCareer(false)
                    setCareerPersistenceStatus('FAILED')
                    setCareerPersistenceError(
                      err?.message || 'Falha ao retomar journal do backend.',
                    )
                    console.warn('[RacePage] Erro ao retomar journal a partir do backend:', err)
                  }
                })
            }
          })
          .catch(() => {})
      })
      .catch((remoteErr) => {
        // Diferenciar consulta com falha de registro ausente: falha de rede preserva o estado carregado e apenas loga aviso
        console.warn(
          '[RacePage] Consulta de resultado no backend falhou (preservando estado atual):',
          remoteErr,
        )
      })

    return () => {
      isMounted = false
    }
  }, [sessionResolution, officialRaceResult])

  // A) Conexão confirmação → motor em RacePage.tsx
  const handleConfirmAndPrepare = useCallback(async () => {
    if (!sessionResolution || sessionResolution.status !== 'ready') return
    const ctx = sessionResolution.context

    // Guard contra corrida já existente (backend-first preferred com fallback local)
    let existingRace: CanonicalRaceState | null = null
    try {
      existingRace = await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
        ctx.careerId,
        ctx.seasonYear,
        ctx.round,
        ctx.variant,
      )
    } catch {
      existingRace = canonicalRaceInitializationService.readCanonicalRaceState(
        ctx.careerId,
        ctx.seasonYear,
        ctx.round,
        ctx.variant,
      )
    }

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
        raceVariant: ctx.variant,
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
      toast({
        title: 'Corrida Iniciada',
        description: 'Estratégia aplicada com sucesso. Boa sorte!',
      })
    } catch (err: any) {
      console.error('[RacePage] Erro ao confirmar preparação e inicializar corrida:', err)
      setPersistenceError(err?.message || 'Falha ao inicializar o motor de corrida.')
    } finally {
      setIsConfirmingStrategy(false)
    }
  }, [sessionResolution, prepSnapshot, toast])

  // Handlers do Race Control canônico (mesma fonte de verdade da /corrida e /corrida/live)
  const handleAdvanceOneLap = useCallback(
    (opts?: Parameters<typeof canonicalRaceEngineService.advanceOneLap>[1]) => {
      const currentState = canonicalRaceStateRef.current
      if (!currentState) return
      try {
        const nextState = canonicalRaceEngineService.advanceOneLap(currentState, opts)
        setCanonicalRaceState(nextState)
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Erro ao avançar volta',
          description: e?.message || 'Falha na execução do Race Engine.',
        })
      }
    },
    [toast],
  )

  const handleAdvanceMultipleLaps = useCallback(
    (count: number) => {
      const currentState = canonicalRaceStateRef.current
      if (!currentState) return
      try {
        const nextState = canonicalRaceEngineService.advanceMultipleLaps(currentState, count)
        setCanonicalRaceState(nextState)
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Erro ao simular voltas',
          description: e?.message || 'Falha na execução do Race Engine.',
        })
      }
    },
    [toast],
  )

  const handleRequestPit = useCallback(
    (driverId: string, compound?: TireCompound) => {
      const currentState = canonicalRaceStateRef.current
      if (!currentState) return
      try {
        const nextState = raceStrategyService.requestPitStop(currentState, driverId, compound)
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
    },
    [toast],
  )

  const handleCancelPit = useCallback(
    (driverId: string) => {
      const currentState = canonicalRaceStateRef.current
      if (!currentState) return
      try {
        const nextState = raceStrategyService.cancelPitRequest(currentState, driverId)
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
    },
    [toast],
  )

  const handleSetPaceMode = useCallback((driverId: string, mode: DriverPaceMode) => {
    const currentState = canonicalRaceStateRef.current
    if (!currentState) return
    try {
      const nextState = raceStrategyService.setDriverPaceMode(currentState, driverId, mode)
      canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
      setCanonicalRaceState(nextState)
    } catch (e: any) {
      console.warn('[RacePage] Erro ao alterar ritmo:', e)
    }
  }, [])

  const handleSetTargetCompound = useCallback((driverId: string, comp: TireCompound) => {
    const currentState = canonicalRaceStateRef.current
    if (!currentState) return
    try {
      const nextState = raceStrategyService.setDriverTargetCompound(currentState, driverId, comp)
      canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
      setCanonicalRaceState(nextState)
    } catch (e: any) {
      console.warn('[RacePage] Erro ao alterar composto alvo:', e)
    }
  }, [])

  const handleTriggerRedFlag = useCallback(() => {
    const currentState = canonicalRaceStateRef.current
    if (!currentState) return
    try {
      const nextState = canonicalRaceEngineService.triggerRedFlag(currentState, {
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
  }, [toast])

  const handlePrepareRestart = useCallback(() => {
    const currentState = canonicalRaceStateRef.current
    if (!currentState) return
    try {
      const nextState = canonicalRaceEngineService.prepareRedFlagRestart(currentState)
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
  }, [toast])

  const handleResumeRace = useCallback(() => {
    const currentState = canonicalRaceStateRef.current
    if (!currentState) return
    try {
      const nextState = canonicalRaceEngineService.resumeRaceAfterRedFlag(currentState)
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
  }, [toast])

  const handleChangeSuspensionTyre = useCallback(
    (driverId: string, compound: TireCompound) => {
      const currentState = canonicalRaceStateRef.current
      if (!currentState) return
      try {
        const res = canonicalRaceEngineService.changeTyresDuringSuspension({
          raceState: currentState,
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
    },
    [toast],
  )

  const handleSubmitWeatherDecision = useCallback(
    (driverId: string, action: WeatherDecisionAction, selectedCompound?: TireCompound) => {
      const currentState = canonicalRaceStateRef.current
      if (!currentState) return { success: false, error: 'Corrida não encontrada' }
      try {
        const res = raceStrategyService.submitWeatherDecision({
          raceState: currentState,
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
    },
    [],
  )

  const handleResetRace = useCallback(() => {
    if (!sessionResolution || sessionResolution.status !== 'ready' || !team?.id || !season?.id) {
      return
    }
    const ctx = sessionResolution.context
    const currentState = canonicalRaceStateRef.current

    if (officialRaceResult || currentState?.status === 'completed') {
      toast({
        variant: 'destructive',
        title: 'Ação Bloqueada',
        description:
          'Esta corrida já foi oficializada e homologada. O histórico da temporada é imutável.',
      })
      return
    }

    try {
      const clearRes = canonicalRaceInitializationService.clearCanonicalRaceState(
        ctx.careerId,
        ctx.seasonYear,
        ctx.round,
        { raceVariant: ctx.variant },
      )
      if (!clearRes.success) {
        toast({
          variant: 'destructive',
          title: 'Não é possível reiniciar',
          description: clearRes.blockedReason,
        })
        return
      }

      const freshRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        raceVariant: ctx.variant,
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
      })
      setCanonicalRaceState(freshRace)
      toast({
        title: 'Corrida Reiniciada',
        description: 'Estado redefinido a partir do grid oficial.',
      })
    } catch (e: any) {
      console.warn('[RacePage] Erro ao resetar corrida:', e)
    }
  }, [sessionResolution, officialRaceResult, team, season, toast])

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
      ctx.variant,
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
          await verifyRemoteJournalStatus(alreadyOfficial, ctx)
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
      // 1. Snapshot da corrida com o careerId canônico e raceVariant consistente
      const stateToOfficialize: CanonicalRaceState = {
        ...currentState,
        careerId: ctx.careerId,
        raceVariant: ctx.variant,
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
          await verifyRemoteJournalStatus(official, ctx)
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
  }, [sessionResolution, verifyRemoteJournalStatus])

  // D) Avanço para o Próximo Fim de Semana (fluxo canônico)
  const handleAdvanceToNextWeekend = useCallback(async () => {
    if (!sessionResolution || sessionResolution.status !== 'ready' || !season?.id) return
    const ctx = sessionResolution.context

    // Revalidação estrita da condição no backend antes de prosseguir
    if (!officialRaceResult) {
      toast({
        variant: 'destructive',
        title: 'Avanço Bloqueado',
        description: 'Resultado da prova ausente.',
      })
      return
    }

    setIsAdvancingRound(true)
    try {
      const isRemoteValid = await verifyRemoteJournalStatus(officialRaceResult, ctx)
      if (!isRemoteValid) {
        toast({
          variant: 'destructive',
          title: 'Avanço Bloqueado',
          description:
            'A confirmação remota no backend é obrigatória e deve estar íntegra antes de avançar.',
        })
        return
      }

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
  }, [sessionResolution, officialRaceResult, season, team, navigate, verifyRemoteJournalStatus])

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
    Boolean(
      canonicalRaceState &&
      canonicalRaceState.totalLaps > 0 &&
      canonicalRaceState.currentLap > canonicalRaceState.totalLaps,
    )

  // Status exibido
  const sessionStatusLabel = isFinished
    ? 'CORRIDA ENCERRADA'
    : canonicalRaceState
      ? 'EM ANDAMENTO'
      : 'PRÉ-CORRIDA'

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
                {context.variant === 'SPRINT_RACE' && (
                  <Badge className="bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider">
                    SPRINT
                  </Badge>
                )}
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
          remoteQueryState={remoteQueryState}
          remoteQueryError={remoteQueryError}
          isReconciliationPending={isReconciliationPending}
          canAdvance={
            remoteQueryState === 'found' &&
            careerPersistenceStatus === 'COMPLETE' &&
            !isReconciliationPending
          }
          isContinuing={isAdvancingRound}
          onVerifyRemoteJournal={async () => {
            const isComplete = await verifyRemoteJournalStatus(officialRaceResult, context)
            if (!isComplete) {
              // Disparar retomada explícita ao verificar se não estiver COMPLETE
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
                setIsReconciliationPending(res.journal.status !== 'COMPLETE')
                setIsPersistingCareer(false)
                if (res.success) {
                  setRemoteQueryState('found')
                } else {
                  setCareerPersistenceError(res.error)
                }
              } catch (retryErr: any) {
                setIsPersistingCareer(false)
                setCareerPersistenceStatus('FAILED')
                setCareerPersistenceError(retryErr?.message || 'Falha ao retomar aplicação.')
              }
            }
          }}
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
          onDownloadMemoryResult={() => {
            try {
              const ok = downloadDiagnosticJson(
                officialRaceResult,
                `apex-resultado-memoria-r${context.round}.json`,
              )
              if (ok) {
                toast({
                  title: 'Resultado em Memória Baixado',
                  description: 'Arquivo JSON do resultado oficial carregado baixado com sucesso.',
                })
              }
            } catch (e: any) {
              toast({
                variant: 'destructive',
                title: 'Erro ao baixar resultado',
                description: e?.message || 'Falha ao baixar resultado da memória.',
              })
            }
          }}
          onRegisterInCareer={async () => {
            // Guard: se a aplicação está incerta (reconciliação pendente), impedir replay
            if (isReconciliationPending) {
              toast({
                variant: 'destructive',
                title: 'Replay Bloqueado',
                description:
                  'Aplicação incerta: reconciliação da carreira pendente (01D). Replay bloqueado.',
              })
              return
            }
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
                setRemoteQueryState('found')
                canonicalChampionshipService.processAndPersistRoundChampionship(
                  context.careerId,
                  context.seasonYear,
                  context.round,
                  officialRaceResult.playerTeamId,
                )
              } else {
                setCareerPersistenceError(res.error)
                // Se a persistência falhou em etapas, marcar reconciliação pendente
                setIsReconciliationPending(true)
              }
            } catch (err: any) {
              setIsPersistingCareer(false)
              setCareerPersistenceStatus('FAILED')
              setIsReconciliationPending(true)
              setCareerPersistenceError(err?.message || 'Falha na persistência da carreira.')
            }
          }}
          onContinue={handleAdvanceToNextWeekend}
          onViewChampionship={() => navigate('/classificacao')}
        />
      </div>
    )
  }

  // SE HOUVER CORRIDA ATIVA OU CONCLUÍDA: RENDERIZAR VISÃO COMPACTA DE RACE CONTROL (RACE-DUAL-VIEW-01A)
  if (canonicalRaceState) {
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
                RACE CONTROL AO VIVO — VISÃO COMPACTA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="font-bold text-cyan-300">
              {context.variant === 'SPRINT_RACE' ? 'CORRIDA SPRINT' : 'CORRIDA PRINCIPAL'}
            </span>
            <span className="text-slate-700">•</span>
            <span>{circuit.name}</span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-200 font-bold">Rodada {context.round}/24</span>
          </div>
        </div>

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

        {/* PAINEL CANÔNICO DE RACE CONTROL COM compactMode={true} */}
        <CanonicalRaceInitializationPanel
          raceState={canonicalRaceState}
          compactMode={true}
          hasOfficialResult={!!officialRaceResult}
          onResetGrid={() => {
            navigate('/corrida')
          }}
          onOfficializeRace={handleOfficializeRace}
          onRequestPit={handleRequestPit}
          onCancelPit={handleCancelPit}
          onSetPaceMode={handleSetPaceMode}
          onSetTargetCompound={handleSetTargetCompound}
          onTriggerRedFlag={handleTriggerRedFlag}
          onPrepareRestart={handlePrepareRestart}
          onResumeRace={handleResumeRace}
          onChangeSuspensionTyre={handleChangeSuspensionTyre}
          onAdvanceOneLap={handleAdvanceOneLap}
          onSubmitWeatherDecision={handleSubmitWeatherDecision}
          onAdvanceMultipleLaps={handleAdvanceMultipleLaps}
          onResetRace={handleResetRace}
        />
      </div>
    )
  }

  // SE NÃO HÁ CORRIDA EM ANDAMENTO: PREPARAÇÃO PRÉ-CORRIDA (CARDS, SELEÇÃO DE COMPOSTO, CONFIRMAÇÃO)
  return (
    <div className="max-w-[1920px] mx-auto px-2 sm:px-4 py-2 space-y-2.5 font-sans text-white">
      {/* HEADER: BOX DA EQUIPE — PREPARAÇÃO PRÉ-CORRIDA */}
      <header className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#0E1626] via-[#1B1124] to-[#450A1A] border border-[#1E293B] shadow-xl p-4 sm:p-5 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase tracking-wider">
                BOX DA EQUIPE
              </Badge>
              {context.variant === 'SPRINT_RACE' && (
                <Badge className="bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider">
                  SPRINT
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-cyan-300 border-cyan-800/60 bg-cyan-950/40 text-[10px] font-mono"
              >
                CONTROLE DE CORRIDA
              </Badge>
              <Badge
                variant="outline"
                className="text-amber-300 border-amber-800/60 bg-amber-950/40 text-[10px] font-mono"
              >
                STATUS: PRÉ-CORRIDA
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

      {/* ÁREA PRINCIPAL: DOIS CARDS DE PILOTO + TOP 10 + ESTRATÉGIA + MENSAGENS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* COLUNA ESQUERDA: DOIS CARDS DOS PILOTOS DO JOGADOR (8 colunas no lg) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <RacePlayerDriverCard
              driver={driver1}
              preparedCar={prepSnapshot?.cars[0]}
              canonicalDriverState={undefined}
              teamColor={playerTeam.color || '#E10600'}
              onOpenStrategyModal={(carId) => {
                setStrategyModalCarId(carId)
                setShowStrategyModal(true)
              }}
            />
            <RacePlayerDriverCard
              driver={driver2}
              preparedCar={prepSnapshot?.cars[1]}
              canonicalDriverState={undefined}
              teamColor={playerTeam.color || '#E10600'}
              onOpenStrategyModal={(carId) => {
                setStrategyModalCarId(carId)
                setShowStrategyModal(true)
              }}
            />
          </div>

          {/* MENSAGENS DA EQUIPE */}
          <RaceTeamMessagesFeed events={undefined} />
        </div>

        {/* COLUNA DIREITA: TOP 10 DO GRID OFICIAL + ESTRATÉGIA (4 colunas no lg) */}
        <div className="lg:col-span-4 space-y-3">
          {/* TOP 10 DO GRID OFICIAL */}
          <RaceTopTenBoard
            finalGrid={finalGrid}
            canonicalDrivers={undefined}
            playerDriverIds={[driver1.driverId, driver2.driverId]}
          />

          {/* ESTRATÉGIA DA CORRIDA */}
          <RaceStrategyPanel
            preparedCars={prepSnapshot?.cars || [undefined, undefined]}
            totalLaps={context.totalLaps}
          />
        </div>
      </div>

      {/* BOX DE ESTRATÉGIA INICIAL (OVERLAY MODAL) */}
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
