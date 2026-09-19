import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RaceSlim from './RaceSlim'
import { Link } from 'react-router-dom'
import { raceSessionService } from '@/services/raceSessionService'
import { WeekendHeader, WeekendDisplaySession } from './race/WeekendHeader'
import { SimulateWeekendModal } from '@/components/race/SimulateWeekendModal'
import { Button } from '@/components/ui/button'
import { ExternalLink, Radio } from 'lucide-react'
import { SimulationStepTracker } from '@/components/race/SimulationStepTracker'
import { WeekendSummaryModal } from '@/components/race/WeekendSummaryModal'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { toast } from '@/hooks/use-toast'
import type {
  WeekendSimulationStepProgress,
  WeekendSummaryReport,
} from '@/types/canonical-season-transition'
import type { WeekendSession } from '@/types/race-events'
import { f1Service } from '@/services/f1Service'

export default function RaceSlimWrapper() {
  const navigate = useNavigate()
  const { team, season } = useUnifiedSeason()

  const [simulateModalOpen, setSimulateModalOpen] = useState(false)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryReport, setSummaryReport] = useState<WeekendSummaryReport | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationSteps, setSimulationSteps] = useState<WeekendSimulationStepProgress[]>([])
  const [simulationStepMessage, setSimulationStepMessage] = useState('')
  const [completedSessions, setCompletedSessions] = useState<string[]>([])
  const [raceRefreshKey, setRaceRefreshKey] = useState(0)
  const [activeSharedSession, setActiveSharedSession] = useState<any>(null)

  const currentRound = season?.current_round || 1

  // Detecta se existe uma sessão compartilhada ativa para esta rodada
  React.useEffect(() => {
    if (!season?.id || !team?.id) return
    let active = true
    raceSessionService
      .getSession({
        seasonId: season.id,
        teamId: team.id,
        round: currentRound,
        sessionType: 'race',
      })
      .then((sess) => {
        if (!active) return
        if (sess && sess.status !== 'not_started') {
          setActiveSharedSession(sess)
        } else {
          setActiveSharedSession(null)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [season?.id, team?.id, currentRound])
  const gpInfo =
    F1_2026_CALENDAR[Math.min(currentRound - 1, F1_2026_CALENDAR.length - 1)] || F1_2026_CALENDAR[0]

  const hasRaceFinished = completedSessions.includes('race')
  const hasQualyFinished = completedSessions.includes('q3')
  const practiceDone = completedSessions.includes('tp1') || completedSessions.includes('tp2')

  const weekendSession: WeekendDisplaySession = hasRaceFinished
    ? 'pos_corrida'
    : hasQualyFinished
      ? 'corrida'
      : practiceDone
        ? 'classificacao'
        : 'treino_livre'

  const remainingSessionsLabel = (['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[])
    .filter((s) => !completedSessions.includes(s))
    .map((s) => {
      const names: Record<WeekendSession, string> = {
        tp1: 'Treino 1',
        tp2: 'Treino 2',
        q1: 'Q1',
        q2: 'Q2',
        q3: 'Q3',
        race: 'Corrida',
      }
      return names[s] || s
    })
    .join(' · ')

  const handleStartSimulateWeekend = async () => {
    if (!team || !season) return
    setSimulateModalOpen(false)
    setIsSimulating(true)
    setSimulationSteps([])
    setSimulationStepMessage('Iniciando simulação de fim de semana...')

    try {
      const [drivers, parts, sponsors] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
      ])

      const res = await weekendSimulationService.simulateRemainingWeekend({
        team,
        season,
        drivers,
        parts,
        sponsors,
        currentRound,
        alreadyCompletedSessions: completedSessions as WeekendSession[],
        onStepProgress: (progress) => {
          setSimulationSteps((prev) => {
            const next = [...prev.filter((p) => p.session !== progress.session), progress]
            return next
          })
          setSimulationStepMessage(
            (progress as any).stepName || (progress as any).message || progress.label || '',
          )
        },
      })

      const allSessions = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
      setCompletedSessions(allSessions)
      setSummaryReport(res.report)
      setSummaryModalOpen(true)
      setRaceRefreshKey((prev) => prev + 1)

      toast({
        title: 'Fim de Semana Simulado com Sucesso!',
        description: `GP ${gpInfo.name} concluído com decisões autônomas do Pit Wall.`,
      })
    } catch (err: any) {
      console.error('Erro na simulação do fim de semana:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na Simulação',
        description: err?.message || 'Erro ao simular o fim de semana.',
      })
    } finally {
      setIsSimulating(false)
    }
  }

  const handleAdvanceRound = async () => {
    if (!season || !team) return
    if (currentRound >= 24) {
      navigate('/season-end')
      return
    }
    try {
      if (season.id) {
        await f1Service.updateSeason(season.id, {
          current_round: currentRound + 1,
        })
      }
      setCompletedSessions([])
      setSummaryReport(null)
      setRaceRefreshKey((prev) => prev + 1)
      toast({
        title: 'Nova Etapa Carregada',
        description: `Avançando para a Rodada ${currentRound + 1}/24.`,
      })
    } catch (err: any) {
      console.error('Erro ao avançar rodada:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao avançar rodada',
        description: err?.message || 'Falha ao avançar campeonato.',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner de interop e sessão compartilhada ativa */}
      {activeSharedSession && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-red-600 text-white rounded-lg">
              <Radio className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <p className="font-extrabold text-sm text-red-950">
                Sessão Compartilhada Ativa Detectada
              </p>
              <p className="text-xs text-red-800">
                Esta corrida já possui uma sessão persistente em andamento (Volta{' '}
                {activeSharedSession.current_lap}/{activeSharedSession.total_laps}, status:{' '}
                {activeSharedSession.status}). Para evitar conflitos de save, continue na nova
                interface.
              </p>
            </div>
          </div>
          <Button
            asChild
            className="bg-[#E10600] hover:bg-red-700 text-white font-bold text-xs h-8 px-4 shrink-0 shadow-sm"
          >
            <Link to="/corrida-ao-vivo">
              Continuar na Nova Interface
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Acesso rápido temporário para a nova página funcional */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold">NOVA CORRIDA AO VIVO DISPONÍVEL:</span>
          <span className="text-slate-300">
            Layout claro com timing real, controles 1x/2x/4x e checkpoints persistentes.
          </span>
        </div>
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="h-7 text-xs font-bold bg-white text-slate-900 hover:bg-slate-100"
        >
          <Link to="/corrida-ao-vivo">Abrir Nova Versão</Link>
        </Button>
      </div>

      {/* 1. Header Canônico com Botão Visível "SIMULAR FIM DE SEMANA" */}
      <WeekendHeader
        currentRound={currentRound}
        gpInfo={{
          name: gpInfo.name,
          circuit: gpInfo.circuit,
        }}
        weekendSession={weekendSession}
        isSimulating={isSimulating}
        hasRaceFinished={hasRaceFinished}
        hasQualyFinished={hasQualyFinished}
        practiceDone={practiceDone}
        completedSessions={completedSessions}
        remainingSessionsLabel={remainingSessionsLabel}
        onRunSession={() => {
          // O usuário pode interagir diretamente na interface do RaceSlim abaixo
          const el = document.getElementById('race-slim-container')
          el?.scrollIntoView({ behavior: 'smooth' })
        }}
        onAdvanceRound={handleAdvanceRound}
        onOpenSimulateModal={() => setSimulateModalOpen(true)}
        onOpenSummaryModal={() => setSummaryModalOpen(true)}
      />

      {/* 2. Tracker de Progresso durante a Simulação */}
      {isSimulating && simulationSteps.length > 0 && (
        <SimulationStepTracker steps={simulationSteps} currentStepMessage={simulationStepMessage} />
      )}

      {/* 3. Modal de Confirmação para Simulação de Fim de Semana */}
      <SimulateWeekendModal
        open={simulateModalOpen}
        onClose={() => setSimulateModalOpen(false)}
        onConfirm={handleStartSimulateWeekend}
        hasCompletedSessions={completedSessions.length > 0}
        isSimulating={isSimulating}
      />

      {/* 4. Modal de Resumo Oficial FIA de Fim de Semana */}
      <WeekendSummaryModal
        open={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        report={summaryReport}
        isRound24={currentRound >= 24}
        onAdvanceToNextRound={() => {
          setSummaryModalOpen(false)
          handleAdvanceRound()
        }}
        onNavigateToSeasonEnd={() => {
          setSummaryModalOpen(false)
          navigate('/season-end')
        }}
      />

      {/* 5. Conteúdo Original de Operações e Corridas */}
      <div id="race-slim-container" key={raceRefreshKey}>
        <RaceSlim />
      </div>
    </div>
  )
}
