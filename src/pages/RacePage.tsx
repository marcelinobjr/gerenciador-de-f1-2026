import React, { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import {
  loadCanonicalRaceSessionContext,
  CanonicalRaceSessionContext,
  RaceSessionResolutionResult,
} from '@/services/canonicalRaceSessionLoader'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { RaceTopTenBoard } from '@/components/race/RaceTopTenBoard'
import { RacePlayerDriverCard } from '@/components/race/RacePlayerDriverCard'
import { RaceStrategyPanel } from '@/components/race/RaceStrategyPanel'
import { RaceTeamMessagesFeed } from '@/components/race/RaceTeamMessagesFeed'
import { PreRaceStrategyModalOverlay } from '@/components/race/PreRaceStrategyModalOverlay'
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
  Layers,
} from 'lucide-react'
import type { RacePreparationSnapshot } from '@/types/canonical-race-preparation'

export default function RacePage() {
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
          // Carregar ou inicializar snapshot da preparação pré-corrida
          let snap = canonicalRacePreparationService.loadSnapshot(
            ctx.careerId,
            ctx.seasonYear,
            ctx.round,
          )

          if (!snap || !snap.cars || snap.cars.length !== 2) {
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
              onClick={() => setShowStrategyModal(true)}
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

      {/* 4.B CONTROLES SUPERIORES: DESABILITADOS EM PRE_RACE */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-[#090F1C] border border-[#1E293B] shadow-md flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-3 text-xs font-black bg-[#1E293B] text-slate-500 cursor-not-allowed border border-slate-700/50 gap-1.5"
            title="Motor de corrida será conectado na próxima etapa."
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            PLAY
          </Button>

          <Button
            type="button"
            size="sm"
            disabled
            className="h-8 px-2.5 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800"
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
            disabled
            className="h-8 px-3 text-xs font-bold bg-[#131D2E] text-slate-500 cursor-not-allowed border border-slate-800 gap-1"
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
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-bold text-amber-300 uppercase">PRÉ-CORRIDA:</span>
          <span>Controles de simulação bloqueados até a largada.</span>
        </div>
      </div>

      {/* 4.C VISÃO GERAL: VOLTA ATUAL 0/TOTAL, STATUS, CLIMA, PISTA, ADERÊNCIA */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
            Volta Atual
          </span>
          <span className="text-base font-black text-white font-mono mt-0.5 block">
            0 / {context.totalLaps}
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
            Status da Sessão
          </span>
          <span className="text-xs font-black text-amber-400 font-mono mt-1 block">
            PRÉ-CORRIDA
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block flex items-center justify-center gap-1">
            {weather.isWet ? (
              <CloudRain className="w-3 h-3 text-cyan-400" />
            ) : (
              <CloudSun className="w-3 h-3 text-amber-400" />
            )}
            Clima Inicial
          </span>
          <span className="text-xs font-black text-white font-mono mt-1 block truncate">
            {weather.airTempC}°C ar • {weather.trackTempC}°C pista
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
            Condição da Pista
          </span>
          <span
            className={`text-xs font-black font-mono mt-1 block ${
              weather.isWet ? 'text-cyan-300' : 'text-emerald-400'
            }`}
          >
            {weather.trackStatus}
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block flex items-center justify-center gap-1">
            <Gauge className="w-3 h-3 text-slate-400" />
            Aderência
          </span>
          <span className="text-xs font-black text-white font-mono mt-1 block">
            {weather.trackGripPct}% ({weather.trackGripLabel})
          </span>
        </Card>

        <Card className="bg-[#0D1524] border border-[#1E293B] p-2.5 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block flex items-center justify-center gap-1">
            <Wind className="w-3 h-3 text-slate-400" />
            Vento & Chuva
          </span>
          <span className="text-xs font-black text-slate-200 font-mono mt-1 block truncate">
            {weather.windSpeedKmh} km/h • {weather.rainProbabilityPct}% chuva
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
              teamColor={playerTeam.color || '#E10600'}
              onOpenStrategyModal={() => setShowStrategyModal(true)}
            />
            <RacePlayerDriverCard
              driver={driver2}
              preparedCar={prepSnapshot?.cars[1]}
              teamColor={playerTeam.color || '#E10600'}
              onOpenStrategyModal={() => setShowStrategyModal(true)}
            />
          </div>

          {/* 4.G MENSAGENS DA EQUIPE */}
          <RaceTeamMessagesFeed />
        </div>

        {/* COLUNA DIREITA: TOP 10 DO GRID OFICIAL + ESTRATÉGIA (4 colunas no lg) */}
        <div className="lg:col-span-4 space-y-3">
          {/* 4.D TOP 10 DO GRID OFICIAL */}
          <RaceTopTenBoard
            finalGrid={finalGrid}
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
          snapshot={prepSnapshot}
          inventories={context.tyreInventories}
          totalLaps={context.totalLaps}
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
