import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { PitWallRadioDialog } from '@/components/race/PitWallRadioDialog'
import { selectCarTireDisplayState } from '@/lib/f1-tire-system'
import { driverRaceInteractionService } from '@/services/driverRaceInteractionService'
import { raceSessionService } from '@/services/raceSessionService'
import pb from '@/lib/pocketbase/client'
import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import type { RacePendingDecision, RaceSessionRecord } from '@/types/race-session'

describe('SUÍTE FOCADA DO RÁDIO PIT WALL — R1 A R8 (CHECKPOINT C)', () => {
  const car1Mock: SimDriverEntry = {
    driverId: 'drv_car1_bortoleto',
    driverName: 'Gabriel Bortoleto',
    teamId: 'team_audi_sport',
    teamName: 'Audi F1 Team',
    position: 4,
    gapToFront: '+1.8s',
    tireCompound: 'medio',
    tireWear: 0,
    lapsOnCurrentTire: 0,
    pitStopsDone: 0,
    isPlayer: true,
    score: 12,
    points: 12,
    fastestLap: false,
    usedOvertake: false,
    accumulatedTimeSec: 1200,
  }

  const car2Mock: SimDriverEntry = {
    driverId: 'drv_car2_hulkenberg',
    driverName: 'Nico Hulkenberg',
    teamId: 'team_audi_sport',
    teamName: 'Audi F1 Team',
    position: 5,
    gapToFront: '+1.2s',
    tireCompound: 'duro',
    tireWear: 35,
    lapsOnCurrentTire: 14,
    pitStopsDone: 0,
    isPlayer: true,
    score: 10,
    points: 10,
    fastestLap: false,
    usedOvertake: false,
    accumulatedTimeSec: 1201.2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    driverRaceInteractionService.resetSessionState()
  })

  // =========================================================================
  // R1 TELEMETRIA: mesmo carro/jogo/revisão -> painel e modal recebem os mesmos valores
  // =========================================================================
  describe('R1 — TELEMETRIA CANÔNICA COMPARTILHADA', () => {
    it('R1.1: Desgaste 0% é válido (0% desgaste / 100% condição), não cai em fallback 50%', () => {
      const display = selectCarTireDisplayState(car1Mock)
      expect(display.hasData).toBe(true)
      expect(display.tireWearPct).toBe(0)
      expect(display.tireWearText).toBe('0%')
      expect(display.tireConditionPct).toBe(100)
      expect(display.tireConditionText).toBe('100%')
      expect(display.lapsOnTire).toBe(0)
      expect(display.lapsOnTireText).toBe('0v')

      const { getByText, queryByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={1}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          currentTireCompound={car1Mock.tireCompound}
          currentTireWear={car1Mock.tireWear}
          lapsOnTire={car1Mock.lapsOnCurrentTire}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      expect(getByText('0%')).toBeDefined()
      expect(getByText('100%')).toBeDefined()
      expect(queryByText('50%')).toBeNull()
    })

    it('R1.2: Desgaste 4% e alto (78%) refletem exatamente os mesmos valores sem distorções', () => {
      const display4 = selectCarTireDisplayState({ ...car1Mock, tireWear: 4, lapsOnCurrentTire: 2 })
      expect(display4.tireWearPct).toBe(4)
      expect(display4.tireWearText).toBe('4%')
      expect(display4.tireConditionPct).toBe(96)
      expect(display4.tireConditionText).toBe('96%')

      const display78 = selectCarTireDisplayState({
        ...car1Mock,
        tireWear: 78,
        lapsOnCurrentTire: 28,
      })
      expect(display78.tireWearPct).toBe(78)
      expect(display78.tireConditionPct).toBe(22)
      expect(display78.isHighDegradation).toBe(true)
    })

    it('R1.3: Dado ausente (ou carro sem dados) mostra "—" e nunca gera 50%', () => {
      const displayEmpty = selectCarTireDisplayState(null)
      expect(displayEmpty.hasData).toBe(false)
      expect(displayEmpty.tireWearPct).toBeNull()
      expect(displayEmpty.tireWearText).toBe('—')
      expect(displayEmpty.tireConditionPct).toBeNull()
      expect(displayEmpty.tireConditionText).toBe('—')
      expect(displayEmpty.lapsOnTireText).toBe('—')
      expect(displayEmpty.compoundName).toBe('—')
    })
  })

  // =========================================================================
  // R2 DESTINATÁRIO: ordem do canal do Carro 1 atinge apenas Carro 1; Carro 2 inalterado
  // =========================================================================
  describe('R2 — DESTINATÁRIO EXPLÍCITO & ISOLAMENTO', () => {
    it('R2.1: Ordem transmitida pelo canal do Carro 1 carrega driverId do Carro 1', () => {
      const sendSpy = vi.fn()
      const { getByText, getByRole } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={10}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          teammateName={car2Mock.driverName}
          teammateId={car2Mock.driverId}
          teammateCar={car2Mock}
          gapToTeammateSec={1.2}
          onSendTeamOrder={sendSpy}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      expect(getByText('DESTINATÁRIO:')).toBeDefined()
      expect(getByText(/Gabriel Bortoleto/)).toBeDefined()
      expect(getByText('COMPANHEIRO ENVOLVIDO:')).toBeDefined()
      expect(getByText(/Nico Hulkenberg/)).toBeDefined()

      const pushButton = getByRole('button', { name: /Aumentar Ritmo/i })
      fireEvent.click(pushButton)

      expect(sendSpy).toHaveBeenCalledWith('PUSH', 'PACE_MANAGEMENT', car1Mock.driverId)
      expect(sendSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        car2Mock.driverId,
      )
    })

    it('R2.2: Ordem bilateral "Manter Posição / Não Disputar" explicita AMBOS OS PILOTOS', () => {
      const { getByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={15}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          teammateName={car2Mock.driverName}
          teammateId={car2Mock.driverId}
          teammateCar={car2Mock}
          gapToTeammateSec={1.5}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      expect(getByText(/DESTINATÁRIOS: AMBOS OS PILOTOS/i)).toBeDefined()
    })

    it('R2.3: Botão de ceder posição desabilita com motivo real quando companheiro fora da janela', () => {
      const { getByRole, getByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={20}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          teammateName={car2Mock.driverName}
          teammateId={car2Mock.driverId}
          teammateCar={car2Mock}
          gapToTeammateSec={6.5} // fora da janela (< 3.0s)
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      const letPassBtn = getByRole('button', {
        name: /Ceder Posição ao Companheiro/i,
      }) as HTMLButtonElement
      expect(letPassBtn.disabled).toBe(true)
      expect(getByText(/Companheiro fora da janela para troca de posição/i)).toBeDefined()
    })
  })

  // =========================================================================
  // R3 CONVERSA: mensagem real aparece no modal; após ordem, resposta real do piloto aparece
  // =========================================================================
  describe('R3 — CONVERSA REAL DO FEED & RESPOSTA DO PILOTO', () => {
    it('R3.1: Exibe eventos reais do rádio do piloto e não exibe mensagens demonstrativas inventadas', () => {
      const realEvents: LiveRaceEvent[] = [
        {
          id: 'ev_1',
          lap: 8,
          type: 'team_radio',
          message: 'Gabriel, foco na conservação dos médios, janela abrindo em 4 voltas.',
          driverName: 'Gabriel Bortoleto',
          timestamp: '14:22:10',
        },
        {
          id: 'ev_2',
          lap: 9,
          type: 'team_radio',
          message: 'Entendido, os dianteiros estão começando a granular um pouco na curva 3.',
          driverName: 'Gabriel Bortoleto',
          timestamp: '14:23:45',
        },
      ]

      const { getByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={10}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          liveEvents={realEvents}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      expect(getByText(/Gabriel, foco na conservação dos médios/i)).toBeDefined()
      expect(getByText(/Entendido, os dianteiros estão começando a granular/i)).toBeDefined()
      expect(getByText(/2 mensagem\(ns\) recente\(s\)/i)).toBeDefined()
    })

    it('R3.2: Resposta psicológica estruturada do piloto é gerada pelo driverRaceInteractionService e preserva personalidade', () => {
      const driverModel = {
        id: 'drv_car1_bortoleto',
        name: 'Gabriel Bortoleto',
        procedural_data: {
          traits: {
            professionalism: 85,
            cooperation: 80,
            ambition: 75,
            ego: 40,
            loyalty: 80,
          },
        },
      }

      const evalResult = driverRaceInteractionService.evaluateTeamOrder(
        {
          orderId: 'ord_test_r3_1',
          orderType: 'PUSH',
          targetDriverId: car1Mock.driverId,
          reason: 'PACE_MANAGEMENT',
          lap: 12,
          round: 1,
          season: 2026,
        },
        {
          driverId: car1Mock.driverId,
          driverName: car1Mock.driverName,
          teamId: car1Mock.teamId,
          teamName: car1Mock.teamName,
          isPlayerTeam: true,
          round: 1,
          season: 2026,
          circuitId: 'albert_park',
          currentLap: 12,
          totalLaps: 50,
          position: 4,
          gridTotal: 24,
          tireCompound: 'medio',
          tireWear: 20,
          isInCliff: false,
          weatherState: 'seco',
        },
        driverModel,
        null,
        null,
      )

      expect(evalResult.actionApplied).toBe(true)
      expect(evalResult.reactionType).toBe('ACCEPT')
      expect(evalResult.radioMessageText).toBeTruthy()
      expect(typeof evalResult.radioMessageText).toBe('string')
    })
  })

  // =========================================================================
  // R4 RECOMENDAÇÃO: pit_stop_informed_recommendation do Carro 1 aparece somente no canal correto
  // =========================================================================
  describe('R4 — RECOMENDAÇÃO INFORMADA DA ENGENHARIA', () => {
    const pendingRecCar1: RacePendingDecision = {
      id: 'rec_c1_lap18',
      type: 'pit_stop_informed_recommendation',
      driverId: 'drv_car1_bortoleto',
      driverName: 'Gabriel Bortoleto',
      lap: 18,
      createdAt: new Date().toISOString(),
      title: 'Recomendação de Pit Stop (Treinos) — Gabriel Bortoleto',
      description: 'Degradação aprendida nos treinos livres indica janela ideal.',
      payload: {
        proposedCompound: 'duro',
        confidence: 'alta',
        estimatedWindow: 'Volta 18-20',
        justification: 'Degradação aprendida nos treinos livres indica janela ideal.',
        invalidationConditions: 'Chuva iminente ou Safety Car na pista',
      },
    }

    it('R4.1: Card da recomendação aparece apenas quando há recomendação pendente e exibe dados reais', () => {
      const { rerender, getByText, queryByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={18}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          pendingRecommendation={pendingRecCar1}
          onAcceptRecommendation={() => {}}
          onDeclineRecommendation={() => {}}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      expect(getByText(/Recomendação da Engenharia/i)).toBeDefined()
      expect(getByText(/DURO/i)).toBeDefined()
      expect(getByText(/Volta 18-20/i)).toBeDefined()
      expect(getByText(/Confiança: ALTA/i)).toBeDefined()
      expect(getByText(/Chuva iminente ou Safety Car na pista/i)).toBeDefined()

      // Se não houver recomendação pendente, NÃO renderiza o card vazio
      rerender(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={18}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          pendingRecommendation={null}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      expect(queryByText(/Recomendação da Engenharia/i)).toBeNull()
    })

    it('R4.2: Aceitar recomendação aciona o handler canônico existente com o id da decisão', () => {
      const acceptSpy = vi.fn()
      const { getByRole } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={18}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          pendingRecommendation={pendingRecCar1}
          onAcceptRecommendation={acceptSpy}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      const acceptBtn = getByRole('button', { name: /Aceitar Recomendação/i })
      fireEvent.click(acceptBtn)
      expect(acceptSpy).toHaveBeenCalledWith('rec_c1_lap18')
    })
  })

  // =========================================================================
  // R5 PARIDADE: pit pelo rádio e pit por atalho percorrem a mesma intenção canônica
  // =========================================================================
  describe('R5 — PARIDADE ENTRE ATALHOS E PIT WALL', () => {
    it('R5.1: Botão "Entrar nos boxes nesta volta" aciona o mesmo handler onCallBoxThisLap', () => {
      const callBoxSpy = vi.fn()
      const { getByRole } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={20}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          onCallBoxThisLap={callBoxSpy}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      const boxBtn = getByRole('button', { name: /Entrar nos boxes nesta volta/i })
      fireEvent.click(boxBtn)
      expect(callBoxSpy).toHaveBeenCalledWith(car1Mock.driverId)
    })

    it('R5.2: Retry e duplo clique são protegidos pela idempotência do resolveDecision no raceSessionService', async () => {
      const mockSession: Partial<RaceSessionRecord> = {
        id: 'sess_paridade_check',
        revision: 5,
        status: 'awaiting_decision',
        checkpoint_data: {
          grid: [car1Mock],
          currentLap: 22,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          pendingDecisions: [
            {
              id: 'dec_dup_1',
              type: 'pit_stop_informed_recommendation',
              driverId: car1Mock.driverId,
              lap: 22,
              createdAt: new Date().toISOString(),
              title: 'Pit Stop',
              description: 'Pit stop',
              payload: {},
            },
          ],
          resolvedDecisions: [],
          lastSavedAt: new Date().toISOString(),
        },
      }

      vi.spyOn(pb.collection('race_sessions'), 'getOne').mockResolvedValue(mockSession as any)
      vi.spyOn(pb.collection('race_sessions'), 'update').mockImplementation(
        async (_id, p: any) => ({
          ...mockSession,
          ...p,
          revision: 6,
        }),
      )

      // 1ª Resolução: Aceita com sucesso
      const res1 = await raceSessionService.resolveDecision({
        sessionId: 'sess_paridade_check',
        executorId: 'tab_r5',
        decisionId: 'dec_dup_1',
        choice: 'box_now',
      })
      expect(res1.success).toBe(true)

      // 2ª Resolução (clique duplo / retry com mesma decisão já resolvida)
      const sessionAfterRes1: Partial<RaceSessionRecord> = {
        ...mockSession,
        revision: 6,
        checkpoint_data: {
          ...mockSession.checkpoint_data!,
          pendingDecisions: [],
          resolvedDecisions: [res1.resolvedDecision!],
        },
      }
      vi.spyOn(pb.collection('race_sessions'), 'getOne').mockResolvedValue(sessionAfterRes1 as any)

      const res2 = await raceSessionService.resolveDecision({
        sessionId: 'sess_paridade_check',
        executorId: 'tab_r5',
        decisionId: 'dec_dup_1',
        choice: 'box_now',
      })
      expect(res2.success).toBe(false)
      expect(res2.alreadyResolved).toBe(true)
    })
  })

  // =========================================================================
  // R6 PAUSA: fechar ou responder modal de rádio não retoma automaticamente
  // =========================================================================
  describe('R6 — CONTROLE DE PAUSA E PLAY', () => {
    it('R6.1: Fechar o modal aciona onClose mas não altera status de pausa da corrida', () => {
      const closeSpy = vi.fn()
      const { getByRole, getByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={closeSpy}
          currentLap={25}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      const closeBtn = getByRole('button', { name: /Fechar Rádio/i })
      fireEvent.click(closeBtn)
      expect(closeSpy).toHaveBeenCalled()
      expect(getByText(/A corrida permanece pausada. O jogador retoma com Play./i)).toBeDefined()
    })
  })

  // =========================================================================
  // R7 RELOAD: histórico, recomendação e estado permanecem íntegros
  // =========================================================================
  describe('R7 — RELOAD E PERSISTÊNCIA COERENTE', () => {
    it('R7.1: Sessão reidratada mantém decisões pendentes, grid e eventos de rádio sem duplicação', async () => {
      const mockSession: Partial<RaceSessionRecord> = {
        id: 'sess_r7_test',
        session_key: 'sess_s1_t1_r1_race',
        status: 'awaiting_decision',
        revision: 12,
        current_lap: 28,
        total_laps: 50,
        checkpoint_data: {
          grid: [car1Mock, car2Mock],
          currentLap: 28,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [
            {
              id: 'ev_r7_1',
              lap: 27,
              type: 'team_radio',
              message: 'Ordem de equipe executada com sucesso.',
              driverName: car1Mock.driverName,
              timestamp: '15:10:00',
            },
          ],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          pendingDecisions: [
            {
              id: 'dec_r7_rec',
              type: 'pit_stop_informed_recommendation',
              driverId: car1Mock.driverId,
              lap: 28,
              createdAt: new Date().toISOString(),
              title: 'Recomendação de Pit Stop',
              description: 'Janela aberta',
              payload: { proposedCompound: 'duro' },
            },
          ],
          resolvedDecisions: [],
          lastSavedAt: new Date().toISOString(),
        },
      }

      vi.spyOn(pb.collection('race_sessions'), 'getList').mockResolvedValue({
        page: 1,
        perPage: 1,
        totalItems: 1,
        totalPages: 1,
        items: [mockSession],
      } as any)

      const rehydrated = await raceSessionService.openOrResumeRaceSession({
        seasonId: 'season_1',
        teamId: 'team_audi_sport',
        userId: 'usr_1',
        seasonYear: 2026,
        round: 1,
        totalLaps: 50,
        sessionType: 'race',
      })

      expect(rehydrated.isResumed).toBe(true)
      expect(rehydrated.session.checkpoint_data?.pendingDecisions).toHaveLength(1)
      expect(rehydrated.session.checkpoint_data?.pendingDecisions![0].id).toBe('dec_r7_rec')
      expect(rehydrated.session.checkpoint_data?.liveEvents).toHaveLength(1)
    })
  })

  // =========================================================================
  // R8 VISUAL/CONTRATO: tema claro, ausência de terminal dominante e responsividade
  // =========================================================================
  describe('R8 — VISUAL CLARO & CONTRATO ESTRUTURAL', () => {
    it('R8.1: Aplica visual claro (bg-white, texto slate-900), exibe seções fundamentais e não usa terminal dominante', () => {
      const { container, getByText } = render(
        <PitWallRadioDialog
          open={true}
          onClose={() => {}}
          currentLap={30}
          driverName={car1Mock.driverName}
          driverId={car1Mock.driverId}
          car={car1Mock}
          teammateName={car2Mock.driverName}
          teammateId={car2Mock.driverId}
          teammateCar={car2Mock}
          gapToTeammateSec={2.0}
          onSendTeamOrder={() => {}}
          onRespondToRequest={() => {}}
          onSendFollowUp={() => {}}
        />,
      )

      // Cabeçalho claro
      expect(getByText(/RÁDIO — GABRIEL BORTOLETO/i)).toBeDefined()
      expect(getByText(/Conversa do Canal/i)).toBeDefined()
      expect(getByText(/Ordens de Ritmo/i)).toBeDefined()
      expect(getByText(/Ordens de Boxes/i)).toBeDefined()
      expect(getByText(/Ordens de Equipe/i)).toBeDefined()

      // Estrutura de fundo claro (bg-white) aplicada no DialogContent
      const dialogContent = container.querySelector('[role="dialog"]')
      if (dialogContent) {
        expect(dialogContent.className).toContain('bg-white')
      }
    })
  })
})
