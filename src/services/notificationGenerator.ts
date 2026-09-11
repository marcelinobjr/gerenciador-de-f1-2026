import { TeamModel, SeasonModel, DriverModel, SponsorModel, PartModel } from '@/types/f1'
import { notificationService, CreateNotificationInput } from '@/services/notificationService'

interface RoundCheckContext {
  userId: string
  team: TeamModel
  season: SeasonModel
  drivers: DriverModel[]
  sponsors: SponsorModel[]
  parts: PartModel[]
  podiumOrWin?: { position: number; driverName: string }
  dnfDrivers?: { driverName: string; reason: string }[]
  componentFailure?: string
}

export const notificationGenerator = {
  /**
   * Avalia a equipe, pilotos, motor, patrocinadores e rivais e dispara notificações adequadas (máx ~10 por rodada).
   * Sem duplicatas na mesma rodada.
   */
  async evaluateRoundEvents(context: RoundCheckContext): Promise<void> {
    const { userId, team, season, drivers, sponsors, parts, podiumOrWin, dnfDrivers } = context
    const currentRound = season.current_round || 1
    const notificationsToCreate: CreateNotificationInput[] = []

    // 1. Corrida / Rádio Importante: Pódio ou Vitória
    if (podiumOrWin) {
      if (podiumOrWin.position === 1) {
        notificationsToCreate.push({
          type: 'corrida',
          title: `🏆 Vitória Espetacular em P1!`,
          message: `${podiumOrWin.driverName} conquistou o lugar mais alto do pódio na rodada ${currentRound}! Parabéns à equipe técnica.`,
          round: currentRound,
          link: '/standings',
        })
      } else if (podiumOrWin.position <= 3) {
        notificationsToCreate.push({
          type: 'corrida',
          title: `🥉 Pódio Garantido (P${podiumOrWin.position})`,
          message: `${podiumOrWin.driverName} finalizou em P${podiumOrWin.position} e levou a equipe ao pódio oficial!`,
          round: currentRound,
          link: '/standings',
        })
      }
    }

    // 2. Rádio / DNF / Pane Seca / Falha de Componente
    if (dnfDrivers && dnfDrivers.length > 0) {
      for (const dnf of dnfDrivers) {
        const isFuel =
          dnf.reason.toLowerCase().includes('combustível') ||
          dnf.reason.toLowerCase().includes('pane seca')
        notificationsToCreate.push({
          type: 'radio',
          title: isFuel
            ? `⚠️ Pane Seca no Carro de ${dnf.driverName}`
            : `📻 Rádio: Abandono de ${dnf.driverName}`,
          message: `O piloto foi forçado a abandonar a prova devido a "${dnf.reason}". Analise os danos mecânicos na oficina.`,
          round: currentRound,
          link: '/car',
        })
      }
    }

    // 3. Motor comprometido (pool > 65% de desgaste ou unidade crítica)
    const activeWear = team.active_engine_wear ?? 15
    if (activeWear >= 65) {
      notificationsToCreate.push({
        type: 'motor',
        title: `🔧 Alerta de Motor Comprometido (${activeWear}%)`,
        message: `A unidade de potência ativa atingiu ${activeWear}% de desgaste (>65%), gerando perda de ritmo por volta e alto risco de quebra.`,
        round: currentRound,
        link: '/car',
      })
    }

    // 4. Investigação FIA / Estouro de Teto de Gastos
    const spent = team.cost_cap_spent ?? 0
    const limit = 135000000 // Teto F1 2026 oficial R$ 135M
    if (spent > limit) {
      const overspend = spent - limit
      notificationsToCreate.push({
        type: 'fia',
        title: `⚖️ Investigação FIA: Teto Financeiro Estourado`,
        message: `Sua equipe excedeu o limite orçamentário de R$ 135M em R$ ${(overspend / 1000000).toFixed(1)}M. Sanções e deduções de pontos aplicáveis pelo regulamento 2026.`,
        round: currentRound,
        link: '/car',
      })
    } else if (team.rd_penalty_rounds_left && team.rd_penalty_rounds_left > 0) {
      notificationsToCreate.push({
        type: 'fia',
        title: `⚖️ Sanção Regulatória FIA Ativa`,
        message: `Restam ${team.rd_penalty_rounds_left} etapa(s) de restrição de túnel de vento e P&D devido a penalidades anteriores.`,
        round: currentRound,
        link: '/car',
      })
    }
    // 5. Patrocínios: Contratos expirando (1 rodada restante) ou vencidos/encerrados
    for (const sp of sponsors) {
      if (sp.status === 'ativo' && sp.rounds_remaining === 1) {
        notificationsToCreate.push({
          type: 'patrocinio',
          title: `💰 Patrocínio de ${sp.name} Expirando!`,
          message: `Resta apenas 1 rodada no contrato da cota [${sp.slot || 'oficial'}]. Acesse a central de marketing para renovar ou buscar novos parceiros.`,
          round: currentRound,
          link: '/sponsors',
        })
      } else if (sp.status === 'encerrado' || sp.rounds_remaining === 0) {
        notificationsToCreate.push({
          type: 'patrocinio',
          title: `💰 Contrato Expirado: ${sp.name}`,
          message: `O contrato de patrocínio com a cota [${sp.slot || 'oficial'}] chegou ao fim. Novas marcas estão disponíveis no mercado!`,
          round: currentRound,
          link: '/sponsors',
        })
      } else if (sp.status === 'suspenso') {
        notificationsToCreate.push({
          type: 'patrocinio',
          title: `💰 Repasse de ${sp.name} Suspenso`,
          message: `O patrocinador reteve o pagamento da rodada devido a não atingimento da meta: "${sp.requirement}".`,
          round: currentRound,
          link: '/sponsors',
        })
      }
    }
    // 6. Pilotos: Lesão crítica, fadiga/física crítica (<50%), moral muito baixa (<40%)
    for (const d of drivers) {
      if (d.team_id === team.id || d.reserve_team_id === team.id) {
        if (d.is_incapacitated) {
          notificationsToCreate.push({
            type: 'lesao',
            title: `🩹 Piloto Afastado por Lesão: ${d.name}`,
            message: `${d.name} está sob cuidados médicos (${d.incapacitated_reason || 'Lesão muscular'}). Restam ${d.incapacitated_rounds_left || 1} GP(s) de afastamento.`,
            round: currentRound,
            link: '/team',
          })
        } else if (d.physical_condition !== undefined && d.physical_condition < 50) {
          notificationsToCreate.push({
            type: 'lesao',
            title: `🩹 Condição Física Crítica: ${d.name} (${d.physical_condition}%)`,
            message: `O piloto relata fadiga aguda e dor muscular intensa. O ritmo e consistência serão afetados se não houver descanso.`,
            round: currentRound,
            link: '/team',
          })
        }

        if (d.morale !== undefined && d.morale < 40) {
          notificationsToCreate.push({
            type: 'lesao',
            title: `🩹 Moral Muito Baixa: ${d.name} (${d.morale}%)`,
            message: `O moral do piloto despencou após os últimos resultados. Há insatisfação interna na garagem.`,
            round: currentRound,
            link: '/team',
          })
        }
      }
    }

    // 7. Peças em estado crítico de integridade (<30%)
    for (const p of parts) {
      const cond = p.condition ?? 100
      if (cond < 30) {
        notificationsToCreate.push({
          type: 'motor',
          title: `🔧 Integridade Crítica: ${p.name} (${cond}%)`,
          message: `Fissuras estruturais detectadas em ${p.name}. Alto risco de quebra mecânica nas voltas de corrida. Faça a revisão na oficina!`,
          round: currentRound,
          link: '/car',
        })
        break // Apenas 1 alerta de peça para não poluir
      }
    }

    // 8. Rivais / Silly Season / Mudança de força
    if (currentRound === 7 || currentRound === 12 || currentRound === 14 || currentRound === 20) {
      notificationsToCreate.push({
        type: 'rival',
        title: `🏎️ Boatos do Paddock: Silly Season 2026`,
        message: `Especulações no paddock indicam movimentações intensas entre escuderias rivais buscando reforços técnicos e pilotos para 2027.`,
        round: currentRound,
        link: '/teams',
      })
    }

    // Limitar a no máximo 8-10 notificações novas por rodada
    const toDispatch = notificationsToCreate.slice(0, 8)
    for (const n of toDispatch) {
      await notificationService.createNotification(userId, n)
    }
  },

  /**
   * Disparo imediato para eventos pontuais (ex: rádio da corrida, novo patrocínio fechado, upgrade de motor)
   */
  async notifyImmediate(userId: string, input: CreateNotificationInput): Promise<void> {
    await notificationService.createNotification(userId, input)
  },
}

export const generateGameStateNotifications = notificationGenerator.evaluateRoundEvents
