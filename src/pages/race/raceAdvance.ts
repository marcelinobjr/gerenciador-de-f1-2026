import { f1Service } from '@/services/f1Service'
import { notificationService } from '@/services/notificationService'
import { formatCurrency } from '@/lib/formatters'
import type { DriverModel, PartModel, SponsorModel, SeasonModel, TeamModel } from '@/types/f1'
import type { WeekendSession } from '@/types/race-events'
import type { SimDriverEntry } from '@/pages/race/types'

export interface AdvanceRoundParams {
  raceResults: SimDriverEntry[] | null
  team: TeamModel | null
  season: SeasonModel | null
  currentRound: number
  totalRounds: number
  gpInfo: {
    name: string
    laps: number
  }
  sponsors: SponsorModel[]
  drivers: DriverModel[]
  parts: PartModel[]
  setups: Record<
    WeekendSession,
    { wing_level?: number; suspension_stiffness?: number; pu_electric_ratio?: number }
  >
  currentEngine: {
    costAnnual: number
  }
  user: { id: string } | null
  hasUsedPreserveMode: boolean
  toast: (options: {
    title: string
    description?: string
    variant?: 'default' | 'destructive'
  }) => void
  navigate: (to: string) => void
  refreshTeamAndSeason: () => Promise<void>
  setSeasonCompleted: (completed: boolean) => void
  setIsProcessingSillySeason: (processing: boolean) => void
  setMarketMoves: (moves: any[]) => void
  setSillySeasonModalOpen: (open: boolean) => void
  setIsFinishing: (finishing: boolean) => void
}

export async function advanceRound(params: AdvanceRoundParams): Promise<void> {
  const {
    raceResults,
    team,
    season,
    currentRound,
    totalRounds,
    gpInfo,
    sponsors,
    drivers,
    parts,
    setups,
    currentEngine,
    user,
    hasUsedPreserveMode,
    toast,
    navigate,
    refreshTeamAndSeason,
    setSeasonCompleted,
    setIsProcessingSillySeason,
    setMarketMoves,
    setSillySeasonModalOpen,
    setIsFinishing,
  } = params

  if (!raceResults || !team || !season) return
  setIsFinishing(true)

  try {
    await f1Service.deleteRaceResultsForRound(season.id, currentRound)

    const resultsToSave = raceResults
    let savedCount = 0
    for (const res of resultsToSave) {
      try {
        const driverCandidate = res.isPlayer ? res.driverId : undefined
        const teamCandidate = res.isPlayer ? res.teamId : undefined

        const { canonicalDriverId, canonicalTeamId } = await f1Service.ensureDriverAndTeam(
          res.driverName,
          driverCandidate,
          teamCandidate,
          { name: res.teamName, color: res.teamColor },
          { role: 'titular', nationality: res.flag ? undefined : undefined },
        )

        if (canonicalDriverId && canonicalTeamId) {
          const calculatedPoints =
            typeof res.points === 'number'
              ? res.points
              : res.position <= 10 && !res.dnf
                ? [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][res.position - 1]
                : 0

          await f1Service.createRaceResult({
            season_id: season.id,
            round: currentRound,
            driver_id: canonicalDriverId,
            team_id: canonicalTeamId,
            position: res.position,
            points: calculatedPoints,
            fastest_lap: !!res.fastestLap,
            laps_completed: res.lapsCompleted ?? gpInfo.laps,
            accumulated_time_sec: res.accumulatedTimeSec,
          })
          savedCount++
        } else {
          console.warn(
            'Não foi possível resolver ID canônico para:',
            res.driverName,
            res.teamName,
            { canonicalDriverId, canonicalTeamId },
          )
        }
      } catch (resErr) {
        console.warn('Erro tolerado ao gravar resultado de um piloto:', res.driverName, resErr)
      }
    }

    // Process Finances
    let totalSponsorIncome = 0
    for (const sp of sponsors) {
      if (sp.status === 'ativo') {
        totalSponsorIncome += sp.value_per_round
        if (sp.rounds_remaining && sp.rounds_remaining > 1) {
          await f1Service.updateSponsor(sp.id, { rounds_remaining: sp.rounds_remaining - 1 })
        } else if (sp.rounds_remaining === 1) {
          await f1Service.updateSponsor(sp.id, { rounds_remaining: 0, status: 'encerrado' })
        }
      }
    }

    const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / totalRounds), 0)
    const engineCost = Math.round(currentEngine.costAnnual / totalRounds)
    const netCashflow = totalSponsorIncome - driversCost - engineCost
    const updatedBudget = Math.max(0, team.budget + netCashflow)

    // -------------------------------------------------------------
    // Atualização de Moral, Condição Física, Lesões e Recuperação ao Avançar Rodada
    // Garantir idempotência: verificar se a rodada já foi processada
    // -------------------------------------------------------------
    const alreadyProcessed = season.last_processed_round === currentRound
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team.id && d.team_id !== team.id),
    )

    if (!alreadyProcessed) {
      for (const t of titulars) {
        const resEntry = raceResults.find((r) => r.isPlayer && r.driverId === t.id)
        const baseMorale = resEntry?.newMorale ?? t.morale ?? 80
        const basePhysical = resEntry?.newPhysical ?? t.physical_condition ?? 90

        if (t.is_incapacitated) {
          const roundsLeft = (t.incapacitated_rounds_left || 1) - 1
          // Lesionados: recuperam física +8 por rodada afastado
          const recoveredPhysical = Math.max(5, Math.min(100, basePhysical + 8))

          if (roundsLeft <= 0) {
            await f1Service.updateDriver(t.id, {
              is_incapacitated: false,
              incapacitated_rounds_left: 0,
              incapacitated_reason: '',
              morale: baseMorale,
              physical_condition: recoveredPhysical,
            })
            await f1Service.addEvent(
              team.id,
              `Piloto ${t.name} foi liberado pelo departamento médico e retorna ao cockpit! (Física: ${recoveredPhysical}%)`,
              'resultado',
            )
          } else {
            await f1Service.updateDriver(t.id, {
              incapacitated_rounds_left: roundsLeft,
              morale: baseMorale,
              physical_condition: recoveredPhysical,
            })
          }
        } else {
          // Titulares que correram: recuperação de +2 entre rodadas
          const recoveredPhysical = Math.max(5, Math.min(100, basePhysical + 2))

          const injuryRoll = Math.random() < 0.04
          if (injuryRoll && reserve) {
            const reasons = [
              'Lesão cervical por fadiga em alta velocidade',
              'Contratura muscular nas costas',
              'Intoxicação alimentar',
            ]
            const reason = reasons[Math.floor(Math.random() * reasons.length)]
            await f1Service.updateDriver(t.id, {
              is_incapacitated: true,
              incapacitated_rounds_left: 1,
              incapacitated_reason: reason,
              morale: baseMorale,
              physical_condition: recoveredPhysical,
            })
            await f1Service.addEvent(
              team.id,
              `ALERTA MÉDICO: ${t.name} sofreu "${reason}" e ficará fora da próxima etapa. O reserva ${reserve.name} assumirá o carro!`,
              'resultado',
            )
          } else {
            await f1Service.updateDriver(t.id, {
              morale: baseMorale,
              physical_condition: recoveredPhysical,
            })
          }
        }
      }

      // Recuperação de pilotos sem corrida no fim de semana (reservas sem corrida recuperam +6)
      if (reserve) {
        const currentResPhysical = reserve.physical_condition ?? 95
        const recoveredResPhysical = Math.max(5, Math.min(100, currentResPhysical + 6))
        await f1Service.updateDriver(reserve.id, {
          physical_condition: recoveredResPhysical,
        })
      }
    }

    // Apply wear to parts
    const aggressiveAero = (setups.race.wing_level || 5) > 7
    const aggressiveSuspension = (setups.race.suspension_stiffness || 5) > 7
    const aggressiveMGU = (setups.race.pu_electric_ratio || 50) > 65

    for (const p of parts) {
      let wearPercent = Math.floor(8 + Math.random() * 11)
      if (p.name.toLowerCase().includes('asa') && aggressiveAero) wearPercent += 3
      if (p.name.toLowerCase().includes('suspens') && aggressiveSuspension) wearPercent += 4
      if (p.name.toLowerCase().includes('aerodin') && aggressiveAero) wearPercent += 3
      if (p.name.toLowerCase().includes('chassi') && aggressiveMGU) wearPercent += 2

      const currentPartCond = p.condition ?? 100
      const newCondition = Math.max(0, currentPartCond - wearPercent)
      try {
        await f1Service.updatePart(p.id, { condition: newCondition })
      } catch (pErr) {
        console.warn('Erro ao atualizar desgaste de peça:', p.name, pErr)
      }
    }

    // Desgaste da Unidade de Potência (com redutor de 0.85 se usou modo preserve_car)
    const currentEngWear = team.active_engine_wear ?? 15
    let engineWearIncrement = Math.floor(18 + Math.random() * 8)
    if (aggressiveMGU) engineWearIncrement += 6
    if (hasUsedPreserveMode) {
      engineWearIncrement = Math.round(engineWearIncrement * 0.85)
    }
    const newEngWear = Math.min(100, currentEngWear + engineWearIncrement)

    await f1Service.updateTeam(team.id, {
      active_engine_wear: newEngWear,
    })

    // Register Event
    const playerWinner = raceResults.find((p) => p.isPlayer && p.position === 1)
    const bestPos = Math.min(...raceResults.filter((p) => p.isPlayer).map((p) => p.position))
    const eventMsg = playerWinner
      ? `VITÓRIA ESPETACULAR! ${playerWinner.driverName} venceu o ${gpInfo.name}!`
      : `Rodada ${currentRound} (${gpInfo.name}) concluída. Melhor posição da equipe: P${bestPos}. Fluxo financeiro: ${formatCurrency(netCashflow)}.`

    await f1Service.addEvent(team.id, eventMsg, 'resultado')

    if (user?.id) {
      if (playerWinner) {
        await notificationService.createNotification(user.id, {
          type: 'corrida',
          title: `🏆 VITÓRIA NO GP! ${playerWinner.driverName} P1`,
          message: `A ${team.name} venceu o ${gpInfo.name}! Desempenho brilhante de ${playerWinner.driverName}.`,
          round: currentRound,
          link: '/race',
        })
      }
    }

    // Advance season round & mark last_processed_round to prevent duplicate processing
    const nextRound = currentRound + 1
    await f1Service.updateSeason(season.id, {
      current_round: nextRound,
      last_processed_round: currentRound,
    })

    // Silly Season Trigger (Rodadas 12 a 24): IA realiza movimentações e pré-contratos de mercado
    if (currentRound >= 12 && currentRound <= 24) {
      try {
        await f1Service.processMidSeasonSillyMoves(season.id, team.id, currentRound)
      } catch (sillyErr) {
        console.warn('Erro Silly Season:', sillyErr)
      }
    }

    toast({
      title: `Rodada ${currentRound} Concluída com Sucesso!`,
      description: `${savedCount} classificações registradas no campeonato oficial.`,
    })

    await refreshTeamAndSeason()

    if (nextRound > totalRounds) {
      setSeasonCompleted(true)
      try {
        setIsProcessingSillySeason(true)
        const moves = await f1Service.processEndOfSeasonMarket(season.id, team.id)
        setMarketMoves(moves)
        setSillySeasonModalOpen(true)
      } catch (sillyErr) {
        console.warn('Erro ao disparar silly season automática:', sillyErr)
      } finally {
        setIsProcessingSillySeason(false)
      }
    } else {
      navigate('/')
    }
  } catch (err: any) {
    toast({
      variant: 'destructive',
      title: 'Falha ao avançar rodada',
      description: err?.message || 'Tente novamente.',
    })
  } finally {
    setIsFinishing(false)
  }
}
