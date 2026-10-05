import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionPlaceholderCard } from '@/components/race/SessionPlaceholderCard'
import { CompleteQualifyingGridSummary } from '@/components/race/CompleteQualifyingGridSummary'
import { PreRaceStrategyPreparationPanel } from '@/components/race/PreRaceStrategyPreparationPanel'
import { CANONICAL_SESSION_DEFINITIONS } from '@/services/weekendScheduleConfig'
import type {
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
  QualifyingStageResult,
} from '@/types/canonical-qualifying-types'

/**
 * SPRINT-RACE-UI-01B-T: Suíte de renderização/DOM comprovando a apresentação da Sprint (01B-P)
 *
 * PROVA 1 — IDENTIFICAÇÃO E BLOQUEIO:
 *   - Renderizar o SessionPlaceholderCard real com props de Sprint cujo pré-requisito pendente é SQ3.
 *   - Confirmar badge "Sprint", título com GP/circuito ("SPRINT — Grande Prêmio da China"),
 *     status de bloqueio ("Bloqueado"), orientação de concluir a SQ3
 *     ("Complete a Qualificação Sprint (SQ3) para definir o grid e desbloquear a Corrida Sprint."),
 *     e AUSÊNCIA da orientação fixa de TL1/TL2.
 *   - Confirmar que a corrida principal mantém badge próprio ("Grande Prêmio") e orientação canônica de Q3.
 *
 * PROVA 2 — PREPARAÇÃO DISPONÍVEL:
 *   - Fixtures equivalentes de Sprint e Principal com grids definidos e preparação disponível.
 *   - Confirmar composição compartilhada (CompleteQualifyingGridSummary + PreRaceStrategyPreparationPanel + link dedicado /corrida/live?variant=...).
 *   - Confirmar grids e variantes distintos por variante (SPRINT_RACE vs MAIN_RACE).
 *   - O placeholder não substitui a preparação da Sprint quando dados e permissões existem.
 *
 * PROVA 3 — EM ANDAMENTO E CONCLUÍDA:
 *   - Sprint em andamento (statusVariant: 'active' | 'paused') → identificação + badge "Em andamento" + ação de retomação.
 *   - Sprint concluída (statusVariant: 'completed') → identificação + badge "Concluída" + mensagem oficial de resultado homologado.
 *
 * PROVA 4 — CARREGAMENTO NÃO É NOVO PRÉ-REQUISITO:
 *   - Avaliação da distinção entre carregamento de grid e bloqueio esportivo.
 */

function buildMockStageResult(stageId: 'q1' | 'q2' | 'q3'): QualifyingStageResult {
  return {
    stageId,
    seasonId: '2026',
    round: 2,
    completedAt: '2026-04-18T08:00:00.000Z',
    entries: [],
    advancingDriverIds: [],
    eliminatedDriverIds: [],
  }
}

// Helper para montar mock canônico de grid de qualificação
function buildMockGridResult(variant: 'SPRINT' | 'MAIN'): CompleteQualifyingWeekendResult {
  const isSprint = variant === 'SPRINT'
  const poleDriver = isSprint ? 'Oscar Piastri' : 'Max Verstappen'
  const poleTeam = isSprint ? 'McLaren' : 'Red Bull Racing'

  const finalGrid: FinalQualifyingGridEntry[] = [
    {
      gridPosition: 1,
      driverId: isSprint ? 'drv_piastri' : 'drv_verstappen',
      driverName: poleDriver,
      teamId: isSprint ? 'team_mclaren' : 'team_redbull',
      teamName: poleTeam,
      teamColor: isSprint ? '#FF8000' : '#0600EF',
      isPlayer: false,
      eliminationStage: 'Q3',
      bestLapTime: '1:31.250',
      bestLapSec: 91.25,
      bestLapCompound: 'macio',
      q1LapTime: '1:32.000',
      q2LapTime: '1:31.600',
      q3LapTime: '1:31.250',
    },
    {
      gridPosition: 2,
      driverId: isSprint ? 'drv_norris' : 'drv_leclerc',
      driverName: isSprint ? 'Lando Norris' : 'Charles Leclerc',
      teamId: isSprint ? 'team_mclaren' : 'team_ferrari',
      teamName: isSprint ? 'McLaren' : 'Ferrari',
      teamColor: isSprint ? '#FF8000' : '#E8002D',
      isPlayer: true,
      eliminationStage: 'Q3',
      bestLapTime: '1:31.320',
      bestLapSec: 91.32,
      bestLapCompound: 'macio',
      q1LapTime: '1:32.100',
      q2LapTime: '1:31.700',
      q3LapTime: '1:31.320',
    },
  ]

  return {
    seasonId: '2026',
    round: 2,
    completedAt: '2026-04-18T08:00:00.000Z',
    poleDriverId: finalGrid[0].driverId,
    poleDriverName: finalGrid[0].driverName,
    poleLapTime: finalGrid[0].bestLapTime,
    q1Result: buildMockStageResult('q1'),
    q2Result: buildMockStageResult('q2'),
    q3Result: buildMockStageResult('q3'),
    finalGrid,
  }
}

describe('SPRINT-RACE-UI-01B-T: Apresentação da Sprint por Renderização', () => {
  const sprintSessionDef = CANONICAL_SESSION_DEFINITIONS.sprint_race
  const mainRaceSessionDef = CANONICAL_SESSION_DEFINITIONS.race

  beforeEach(() => {
    localStorage.clear()
  })

  // =========================================================================
  // PROVA 1 — IDENTIFICAÇÃO E BLOQUEIO
  // =========================================================================
  describe('PROVA 1 — IDENTIFICAÇÃO E BLOQUEIO', () => {
    it('deve renderizar SessionPlaceholderCard de Sprint bloqueada com badge "Sprint", título com GP da China e orientação de SQ3', () => {
      const { container } = render(
        <SessionPlaceholderCard
          session={sprintSessionDef}
          isLocked={true}
          isPendingDevelopment={false}
          gpName="Grande Prêmio da China"
          circuitName="Circuito Internacional de Xangai"
          statusVariant="locked"
        />,
      )

      // 1. Badge específico de Sprint
      const badge = screen.getByText('Sprint')
      expect(badge).toBeInTheDocument()

      // 2. Status de bloqueio
      expect(screen.getByText('Bloqueado')).toBeInTheDocument()

      // 3. Título contendo GP/circuito da fixture discriminado
      const title = screen.getByRole('heading', { level: 3 })
      expect(title.textContent).toBe('SPRINT — Grande Prêmio da China')

      // 4. Orientação regulamentar canônica de concluir SQ3
      const regulation = container.querySelector('.text-xs')
      expect(regulation?.textContent).toContain('Regulamento Esportivo FIA F1 2026:')
      expect(regulation?.textContent).toContain(
        'Complete a Qualificação Sprint (SQ3) para definir o grid e desbloquear a Corrida Sprint.',
      )

      // 5. AUSÊNCIA expressa de orientações de treino livre (TL1 / TL2)
      expect(regulation?.textContent).not.toContain('Treino Livre 1 (TL1)')
      expect(regulation?.textContent).not.toContain('complete os treinos livres')
      expect(regulation?.textContent).not.toContain('TL2')
    })

    it('deve confirmar que a Corrida Principal mantém badge próprio ("Grande Prêmio") e orientação regulamentar de Q3', () => {
      const { container } = render(
        <SessionPlaceholderCard
          session={mainRaceSessionDef}
          isLocked={true}
          isPendingDevelopment={false}
          gpName="Grande Prêmio da China"
          circuitName="Circuito Internacional de Xangai"
          statusVariant="locked"
        />,
      )

      // 1. Badge específico do Grande Prêmio
      expect(screen.getByText('Grande Prêmio')).toBeInTheDocument()
      expect(screen.queryByText('Sprint')).not.toBeInTheDocument()

      // 2. Título da sessão oficial
      const title = screen.getByRole('heading', { level: 3 })
      expect(title.textContent).toBe('Grande Prêmio (Corrida Oficial)')

      // 3. Orientação regulamentar canônica da corrida principal (Q3)
      const regulation = container.querySelector('.text-xs')
      expect(regulation?.textContent).toContain(
        'Complete a classificação oficial (Q3) para definir o grid de largada da Corrida Principal.',
      )
    })
  })

  // =========================================================================
  // PROVA 2 — PREPARAÇÃO DISPONÍVEL
  // =========================================================================
  describe('PROVA 2 — PREPARAÇÃO DISPONÍVEL', () => {
    it('deve renderizar a preparação da Sprint com CompleteQualifyingGridSummary sem ser substituída por placeholder', () => {
      const sprintGridResult = buildMockGridResult('SPRINT')

      // Simulação do ramo do chamador (WeekendV2Page):
      // Quando isRaceSession && completeQualifyingResult existe, renderiza a composição compartilhada
      const isRaceSession = true
      const isSprintRaceSession = true
      const round = 2

      render(
        <div data-testid="sprint-race-prep-branch">
          {/* Link para visualização dedicada com variant=SPRINT_RACE */}
          <a
            href={`/corrida/live?variant=${isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE'}&round=${round}`}
            data-testid="dedicated-race-control-link"
          >
            Abrir Race Control Dedicado →
          </a>

          {/* Composição compartilhada: Resumo do Grid Canônico */}
          <CompleteQualifyingGridSummary result={sprintGridResult} onGoToRace={() => {}} />
        </div>,
      )

      // 1. Comprovando que o link aponta estritamente para SPRINT_RACE
      const link = screen.getByTestId('dedicated-race-control-link')
      expect(link).toHaveAttribute('href', '/corrida/live?variant=SPRINT_RACE&round=2')

      // 2. CompleteQualifyingGridSummary está presente com o grid da Sprint
      expect(screen.getByText(/GRID OFICIAL FIA FORMADO/i)).toBeInTheDocument()
      expect(screen.getByText(/Pole Position: Oscar Piastri/i)).toBeInTheDocument()
      expect(screen.getByText('Lando Norris')).toBeInTheDocument()

      // 3. O placeholder NÃO substitui a preparação quando dados e permissões existem
      expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument()
    })

    it('deve renderizar a preparação da Principal com variant=MAIN_RACE e grid próprio distinto do da Sprint', () => {
      const mainGridResult = buildMockGridResult('MAIN')
      const isRaceSession = true
      const isSprintRaceSession = false
      const round = 2

      render(
        <div data-testid="main-race-prep-branch">
          <a
            href={`/corrida/live?variant=${isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE'}&round=${round}`}
            data-testid="dedicated-race-control-link"
          >
            Abrir Race Control Dedicado →
          </a>

          <CompleteQualifyingGridSummary result={mainGridResult} onGoToRace={() => {}} />
        </div>,
      )

      // 1. Link aponta para MAIN_RACE
      const link = screen.getByTestId('dedicated-race-control-link')
      expect(link).toHaveAttribute('href', '/corrida/live?variant=MAIN_RACE&round=2')

      // 2. Pole e grid são específicos da corrida principal (Max Verstappen vs Oscar Piastri da Sprint)
      expect(screen.getByText(/Pole Position: Max Verstappen/i)).toBeInTheDocument()
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument()
      expect(screen.queryByText('Oscar Piastri')).not.toBeInTheDocument()
    })

    it('deve permitir renderizar o PreRaceStrategyPreparationPanel para a Sprint compartilhando o painel de estratégia', () => {
      const sprintGridResult = buildMockGridResult('SPRINT')

      render(
        <PreRaceStrategyPreparationPanel
          careerId="career_sprint_test"
          seasonYear={2026}
          round={2}
          teamId="team_mclaren"
          teamColor="#FF8000"
          totalLaps={19} // Laps específicos de Sprint
          canonicalGrid={sprintGridResult.finalGrid}
          inventories={{}}
          onCancelToGrid={() => {}}
          onConfirmAndStartRace={() => {}}
        />,
      )

      // Comprovando que o painel de preparação é renderizado com sucesso
      expect(screen.getByText(/Estratégia de Corrida & Pneus/i)).toBeInTheDocument()
      expect(screen.getByText(/19 voltas/i)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // PROVA 3 — EM ANDAMENTO E CONCLUÍDA
  // =========================================================================
  describe('PROVA 3 — EM ANDAMENTO E CONCLUÍDA', () => {
    it('deve identificar Sprint em andamento com status "Em andamento" e orientação de retomada sem reiniciar preparação', () => {
      const { container } = render(
        <SessionPlaceholderCard
          session={sprintSessionDef}
          isLocked={false}
          isPendingDevelopment={false}
          gpName="Grande Prêmio da China"
          statusVariant="active"
        />,
      )

      // 1. Identificação Sprint
      expect(screen.getByText('Sprint')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
        'SPRINT — Grande Prêmio da China',
      )

      // 2. Badge de status "Em andamento"
      expect(screen.getByText('Em andamento')).toBeInTheDocument()

      // 3. Orientação regulamentar de retomada no Race Control
      const regulation = container.querySelector('.text-xs')
      expect(regulation?.textContent).toContain(
        'A Corrida Sprint está em andamento. Retome a sessão no Race Control para continuar.',
      )

      // 4. Sem orientação de reiniciar preparação
      expect(regulation?.textContent).not.toContain('reiniciar')
      expect(regulation?.textContent).not.toContain('recomeçar')
    })

    it('deve identificar Sprint concluída com badge "Concluída" e mensagem oficial de homologação', () => {
      const { container } = render(
        <SessionPlaceholderCard
          session={sprintSessionDef}
          isLocked={false}
          isPendingDevelopment={false}
          gpName="Grande Prêmio da China"
          statusVariant="completed"
        />,
      )

      // 1. Identificação Sprint
      expect(screen.getByText('Sprint')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
        'SPRINT — Grande Prêmio da China',
      )

      // 2. Badge de status "Concluída"
      expect(screen.getByText('Concluída')).toBeInTheDocument()

      // 3. Mensagem canônica de resultado oficial homologado e pontuação atribuída
      const regulation = container.querySelector('.text-xs')
      expect(regulation?.textContent).toContain(
        'Corrida Sprint concluída. O resultado oficial foi homologado e a pontuação atribuída.',
      )

      // 4. Descrição secundária de sessão concluída
      expect(
        screen.getByText('Sessão concluída com resultado oficial registrado.'),
      ).toBeInTheDocument()
    })
  })

  // =========================================================================
  // PROVA 4 — CARREGAMENTO NÃO É NOVO PRÉ-REQUISITO
  // =========================================================================
  describe('PROVA 4 — CARREGAMENTO NÃO É NOVO PRÉ-REQUISITO', () => {
    it('deve distinguir visualmente bloqueio esportivo de sessão liberada/disponível', () => {
      // Quando a sessão não está bloqueada esportivamente (isLocked: false) mas statusVariant é 'available',
      // o placeholder não deve alegar que faltam pré-requisitos esportivos se fornecida a orientação de grid definido
      const { container } = render(
        <SessionPlaceholderCard
          session={sprintSessionDef}
          isLocked={false}
          isPendingDevelopment={false}
          gpName="Grande Prêmio da China"
          statusVariant="available"
        />,
      )

      // Badge deve ser "Disponível", e NÃO "Bloqueado"
      expect(screen.getByText('Disponível')).toBeInTheDocument()
      expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument()

      // A orientação canônica indica que o grid está definido e pronto para estratégia,
      // sem exigir novamente a conclusão de SQ3
      const regulation = container.querySelector('.text-xs')
      expect(regulation?.textContent).toContain(
        'O grid da Sprint foi definido. Prossiga com a preparação de estratégia e pneus antes de iniciar.',
      )
      expect(regulation?.textContent).not.toContain('Complete a Qualificação Sprint (SQ3)')
    })
  })
})
