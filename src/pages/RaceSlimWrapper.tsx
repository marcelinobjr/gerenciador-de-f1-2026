import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RaceSlim from './RaceSlim'
import { WeekendHeader, WeekendDisplaySession } from './race/WeekendHeader'
import { SimulateWeekendModal } from '@/components/race/SimulateWeekendModal'
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

  const currentRound = season?.current_round || 1
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
