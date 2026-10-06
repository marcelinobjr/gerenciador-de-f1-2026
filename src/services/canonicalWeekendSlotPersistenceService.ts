/**
 * src/services/canonicalWeekendSlotPersistenceService.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01A
 * Persistência, restauração e migração canônica da arquitetura de 7 slots do fim de semana.
 *
 * INVARIANTES:
 * - Sobrevive a reload (localStorage + espelho em memória resiliente).
 * - Reload não avança slot.
 * - Abrir tela não avança slot.
 * - Duas rodadas com formatos diferentes não compartilham slot nem configuração.
 * - Weekend normal: TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> CORRIDA.
 * - Weekend Sprint: TL1 -> QUALI_SPRINT -> SPRINT -> Q1 -> Q2 -> Q3 -> CORRIDA.
 * - TL2 e TL3 são marcadas como NOT_RUN no fim de semana Sprint: não calculam, não geram RNG nem setup.
 * - Migração de saves antigos:
 *   * NORMAL: TL1 -> slot 1, TL2 -> slot 2, TL3 -> slot 3, Q1 -> slot 4, Q2 -> slot 5, Q3 -> slot 6, corrida/grid-ready -> slot 7.
 *   * SPRINT: TL1 -> slot 1; SQ1/SQ2/SQ3 -> slot 2 com subfase; Sprint -> slot 3; Q1 -> slot 4, Q2 -> slot 5, Q3 -> slot 6, Corrida -> slot 7.
 */

import pb from '@/lib/pocketbase/client'
import type {
  WeekendFormat,
  WeekendSlotNumber,
  WeekendSlotType,
  WeekendSlotStatus,
  CanonicalWeekendSlotState,
  SprintQualifyingSubPhase,
  MainQualifyingSubPhase,
} from '@/types/weekend-slot-types'
import { resolveWeekendFormat, getSlotTypeForNumber } from '@/services/weekendSlotSequenceService'
import { getActiveWeekendGeneration } from '@/services/weekendProgressionService'

const STORAGE_KEY_PREFIX = 'apex_weekend_slot_state_v1'

export function buildWeekendSlotStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
): string {
  return `${STORAGE_KEY_PREFIX}_${careerId}_${seasonId}_r${round}`
}

export class CanonicalWeekendSlotPersistenceService {
  private inMemoryCache: Map<string, CanonicalWeekendSlotState> = new Map()

  /**
   * Inicializa um estado novo e limpo para uma rodada no formato canônico.
   */
  public createInitialState(params: {
    careerId: string
    seasonId: string
    round: number
    weekendFormat?: WeekendFormat
    configVersion?: string
  }): CanonicalWeekendSlotState {
    const {
      careerId,
      seasonId,
      round,
      weekendFormat = resolveWeekendFormat(round),
      configVersion = 'v1',
    } = params

    const slots: CanonicalWeekendSlotState['slots'] = {
      1: {
        slotNumber: 1,
        slotType: getSlotTypeForNumber(weekendFormat, 1),
        status: 'AVAILABLE',
      },
      2: {
        slotNumber: 2,
        slotType: getSlotTypeForNumber(weekendFormat, 2),
        status: 'LOCKED',
      },
      3: {
        slotNumber: 3,
        slotType: getSlotTypeForNumber(weekendFormat, 3),
        status: 'LOCKED',
      },
      4: {
        slotNumber: 4,
        slotType: getSlotTypeForNumber(weekendFormat, 4),
        status: 'LOCKED',
      },
      5: {
        slotNumber: 5,
        slotType: getSlotTypeForNumber(weekendFormat, 5),
        status: 'LOCKED',
      },
      6: {
        slotNumber: 6,
        slotType: getSlotTypeForNumber(weekendFormat, 6),
        status: 'LOCKED',
      },
      7: {
        slotNumber: 7,
        slotType: getSlotTypeForNumber(weekendFormat, 7),
        status: 'LOCKED',
      },
    }

    return {
      careerId,
      seasonId,
      round,
      weekendFormat,
      configVersion,
      currentSlot: 1,
      slotType: slots[1].slotType,
      slotStatus: 'AVAILABLE',
      subPhase: null,
      completedSlots: [],
      slots,
      updatedAt: new Date().toISOString(),
      generation: getActiveWeekendGeneration(seasonId, round, careerId),
      weekendGeneration: getActiveWeekendGeneration(seasonId, round, careerId),
    }
  }

  /**
   * Salva o estado do fim de semana em memória e no localStorage.
   * Se explicitTeamId for fornecido, usa diretamente como team_id na relation com a collection teams.
   */
  public async saveSlotState(
    state: CanonicalWeekendSlotState,
    explicitTeamId?: string,
  ): Promise<void> {
    if (!state.careerId || !state.seasonId || state.round === undefined) {
      return
    }

    const currentGen = getActiveWeekendGeneration(state.seasonId, state.round, state.careerId)
    const effectiveGen = state.weekendGeneration ?? state.generation

    // RESET-FIX-2: Gatekeeper central contra state stale / geração incompatível
    if (effectiveGen !== undefined) {
      if (effectiveGen < currentGen) {
        console.warn(
          `[WeekendSlotPersistence] STALE_STATE: escrita rejeitada por geração obsoleta (state=${effectiveGen} < current=${currentGen}) para ${state.seasonId} r${state.round}`,
        )
        return
      }
      if (effectiveGen > currentGen) {
        console.warn(
          `[WeekendSlotPersistence] INCONSISTENT_GENERATION: escrita rejeitada por geração futura não sincronizada (state=${effectiveGen} > current=${currentGen}) para ${state.seasonId} r${state.round}`,
        )
        return
      }
      state.weekendGeneration = currentGen
      state.generation = currentGen
    } else {
      // State legado sem weekendGeneration / generation:
      // Só é aceito e associado à geração atual se a rodada ainda estiver na geração baseline (1).
      // Se a rodada já avançou geração por reset (currentGen > 1), state sem geração é stale e não pode ser persistido.
      if (currentGen > 1) {
        console.warn(
          `[WeekendSlotPersistence] STALE_STATE: escrita rejeitada para state legado sem generation após avanço de rodada (current=${currentGen}) para ${state.seasonId} r${state.round}`,
        )
        return
      }
      state.weekendGeneration = currentGen
      state.generation = currentGen
    }

    const key = buildWeekendSlotStorageKey(state.careerId, state.seasonId, state.round)
    state.updatedAt = new Date().toISOString()
    this.inMemoryCache.set(key, state)

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(state))
      } catch (err) {
        console.warn('[WeekendSlotPersistence] Erro ao gravar localStorage:', err)
      }
    }

    // Opcional: espelhar no PocketBase de forma assíncrona tolerante a falhas
    try {
      let resolvedTeamId = explicitTeamId || state.careerId
      if (!explicitTeamId || resolvedTeamId === state.seasonId) {
        try {
          const seasonRecord = await pb.collection('seasons').getOne(state.seasonId)
          if (seasonRecord?.team_id) {
            resolvedTeamId = seasonRecord.team_id
          }
        } catch (seasonErr) {
          console.warn(
            '[WeekendSlotPersistence] Não foi possível resolver team_id a partir de season:',
            seasonErr,
          )
        }
      }

      const { canonicalSessionSetupPersistenceService } =
        await import('@/services/canonicalSessionSetupPersistenceService')
      const result = await canonicalSessionSetupPersistenceService.upsertSessionSetup({
        teamId: resolvedTeamId,
        seasonId: state.seasonId,
        round: state.round,
        session: 'weekend_slot_state',
        payload: {
          driver_strategies: { weekendSlotState: state },
        },
        mergeWithExisting: (existing) => {
          const currentStrategies = (existing?.driver_strategies as any) || {}
          return {
            driver_strategies: {
              ...currentStrategies,
              weekendSlotState: state,
            },
          }
        },
      })
      if (!result.success) {
        console.warn(
          '[WeekendSlotPersistence] Falha ao sincronizar weekendSlotState no PocketBase, mantendo persistência local.',
        )
      }
    } catch (persistErr) {
      console.warn(
        '[WeekendSlotPersistence] Erro não-bloqueante ao sincronizar weekendSlotState no PocketBase:',
        persistErr,
      )
    }
  }

  /**
   * Carrega o estado existente ou realiza a migração de saves legados.
   * Não avança slot em reload nem altera sessões concluídas.
   */
  public async loadOrMigrateSlotState(params: {
    careerId: string
    seasonId: string
    round: number
    configVersion?: string
    weekendFormat?: 'NORMAL' | 'SPRINT'
  }): Promise<CanonicalWeekendSlotState> {
    const { careerId, seasonId, round, configVersion = 'v1', weekendFormat } = params
    const key = buildWeekendSlotStorageKey(careerId, seasonId, round)

    // 1. Tenta carregar do cache em memória
    if (this.inMemoryCache.has(key)) {
      return this.inMemoryCache.get(key)!
    }

    // 2. Tenta carregar do localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as CanonicalWeekendSlotState
          if (parsed && parsed.currentSlot && parsed.weekendFormat) {
            const currentGen = getActiveWeekendGeneration(seasonId, round, careerId)
            const parsedGen = parsed.weekendGeneration ?? parsed.generation
            let isValidGen = false
            if (parsedGen !== undefined) {
              if (parsedGen === currentGen) {
                isValidGen = true
              }
            } else {
              if (currentGen === 1) {
                isValidGen = true
              }
            }

            if (isValidGen) {
              parsed.weekendGeneration = currentGen
              parsed.generation = currentGen
              this.inMemoryCache.set(key, parsed)
              return parsed
            }
          }
        }
      } catch {
        /* fallback para migração */
      }
    }

    // 3. Tenta carregar do PocketBase
    try {
      let resolvedTeamId = careerId
      if (resolvedTeamId === seasonId) {
        try {
          const seasonRecord = await pb.collection('seasons').getOne(seasonId)
          if (seasonRecord?.team_id) {
            resolvedTeamId = seasonRecord.team_id
          }
        } catch {
          // ignore
        }
      }

      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `(team_id = "${resolvedTeamId}" || team_id = "${careerId}") && season_id = "${seasonId}" && round = ${round} && session = "weekend_slot_state"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const state =
          ((item.driver_strategies as any)?.weekendSlotState as CanonicalWeekendSlotState) ||
          (item.notes ? JSON.parse(item.notes) : null)
        if (state && state.currentSlot && state.weekendFormat) {
          const currentGen = getActiveWeekendGeneration(seasonId, round, careerId)
          const parsedGen = state.weekendGeneration ?? state.generation

          let isValidGen = false
          if (parsedGen !== undefined) {
            if (parsedGen === currentGen) {
              isValidGen = true
            } else {
              console.warn(
                `[WeekendSlotPersistence] Estado do PocketBase ignorado por geração incompatível/obsoleta: ${parsedGen} !== currentGen ${currentGen}`,
              )
            }
          } else {
            // Registro legado sem generation
            if (currentGen === 1) {
              isValidGen = true
            } else {
              console.warn(
                `[WeekendSlotPersistence] Estado legado do PocketBase ignorado por avanço prévio de geração: currentGen ${currentGen}`,
              )
            }
          }

          if (isValidGen) {
            state.weekendGeneration = currentGen
            state.generation = currentGen
            this.inMemoryCache.set(key, state)
            return state
          }
          // Se generation for obsoleta, prossegue para criar estado inicial de weekend novo/resetado
          const freshState = this.createInitialState({
            careerId,
            seasonId,
            round,
            configVersion,
            weekendFormat: state.weekendFormat || weekendFormat,
          })
          await this.saveSlotState(freshState)
          return freshState
        }
      }
    } catch {
      /* fallback para migração */
    }

    // 4. Migração determinística a partir de dados existentes (saves legados)
    const migratedState = this.migrateFromLegacyState({
      careerId,
      seasonId,
      round,
      configVersion,
    })

    await this.saveSlotState(migratedState)
    return migratedState
  }

  /**
   * Migra um save antigo para a arquitetura de 7 slots preservando todo o progresso esportivo.
   */
  public migrateFromLegacyState(params: {
    careerId: string
    seasonId: string
    round: number
    configVersion?: string
  }): CanonicalWeekendSlotState {
    const { careerId, seasonId, round, configVersion = 'v1' } = params
    const format = resolveWeekendFormat(round)
    const state = this.createInitialState({
      careerId,
      seasonId,
      round,
      weekendFormat: format,
      configVersion,
    })

    // Lê histórico legado de sessões concluídas no localStorage
    let legacyCompleted: string[] = []
    try {
      // Import inline ou leitura direta do storage para evitar ciclo de módulo estático
      const raw =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(`apex_f1_weekend_completed_v1_${seasonId}_r${round}`)
          : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) legacyCompleted = parsed
      }
    } catch {
      legacyCompleted = []
    }

    if (format === 'NORMAL') {
      // Migração NORMAL:
      // TL1 -> slot 1, TL2 -> slot 2, TL3 -> slot 3, Q1 -> slot 4, Q2 -> slot 5, Q3 -> slot 6, corrida -> slot 7
      const hasTL1 = legacyCompleted.includes('tp1')
      const hasTL2 = legacyCompleted.includes('tp2')
      const hasTL3 = legacyCompleted.includes('tp3')
      const hasQ1 = legacyCompleted.includes('q1')
      const hasQ2 = legacyCompleted.includes('q2')
      const hasQ3 = legacyCompleted.includes('q3') || legacyCompleted.includes('qualifying')
      const hasRace = legacyCompleted.includes('race')

      if (hasTL1) {
        state.slots[1].status = 'COMPLETED'
        state.completedSlots.push(1)
        state.slots[2].status = 'AVAILABLE'
        state.currentSlot = 2
      }
      if (hasTL2) {
        state.slots[2].status = 'COMPLETED'
        state.completedSlots.push(2)
        state.slots[3].status = 'AVAILABLE'
        state.currentSlot = 3
      }
      if (hasTL3) {
        state.slots[3].status = 'COMPLETED'
        state.completedSlots.push(3)
        state.slots[4].status = 'AVAILABLE'
        state.currentSlot = 4
      }
      if (hasQ1) {
        state.slots[4].status = 'COMPLETED'
        if (!state.completedSlots.includes(4)) state.completedSlots.push(4)
        state.slots[5].status = 'AVAILABLE'
        state.currentSlot = 5
      }
      if (hasQ2) {
        state.slots[5].status = 'COMPLETED'
        if (!state.completedSlots.includes(5)) state.completedSlots.push(5)
        state.slots[6].status = 'AVAILABLE'
        state.currentSlot = 6
      }
      if (hasQ3) {
        state.slots[6].status = 'COMPLETED'
        if (!state.completedSlots.includes(6)) state.completedSlots.push(6)
        state.slots[7].status = 'AVAILABLE'
        state.currentSlot = 7
      }
      if (hasRace) {
        state.slots[7].status = 'COMPLETED'
        if (!state.completedSlots.includes(7)) state.completedSlots.push(7)
      }

      state.slotType = state.slots[state.currentSlot].slotType
      state.slotStatus = state.slots[state.currentSlot].status
      return state
    }

    // Migração SPRINT:
    // slot 1 = TL1
    // slot 2 = TL2
    // slot 3 = QUALI_SPRINT (SQ1 / SQ2 / SQ3)
    // slot 4 = SPRINT
    // slot 5 = Q1
    // slot 6 = Q2
    // slot 7 = Q3
    // slot 8 = CORRIDA
    const hasTL1 =
      legacyCompleted.includes('tp1') ||
      legacyCompleted.includes('tl1') ||
      legacyCompleted.includes('fp1')
    const hasTL2 =
      legacyCompleted.includes('tp2') ||
      legacyCompleted.includes('tl2') ||
      legacyCompleted.includes('fp2')
    const hasSQ =
      legacyCompleted.includes('sprint_qualifying') ||
      legacyCompleted.includes('sq') ||
      legacyCompleted.includes('sq3') ||
      legacyCompleted.includes('sprint_q3')
    const hasSQ1 =
      legacyCompleted.includes('sq1') ||
      legacyCompleted.includes('sprint_q1') ||
      legacyCompleted.includes('sq_1')
    const hasSQ2 =
      legacyCompleted.includes('sq2') ||
      legacyCompleted.includes('sprint_q2') ||
      legacyCompleted.includes('sq_2')
    const hasSprint = legacyCompleted.includes('sprint') || legacyCompleted.includes('sprint_race')
    const hasQ1 = legacyCompleted.includes('q1')
    const hasQ2 = legacyCompleted.includes('q2')
    const hasQ3 = legacyCompleted.includes('q3') || legacyCompleted.includes('qualifying')
    const hasRace = legacyCompleted.includes('race')

    if (hasTL1) {
      state.slots[1].status = 'COMPLETED'
      state.completedSlots.push(1)
      state.slots[2].status = 'AVAILABLE'
      state.currentSlot = 2
    }
    if (hasTL2 && state.slots[2]) {
      state.slots[2].status = 'COMPLETED'
      if (!state.completedSlots.includes(2)) state.completedSlots.push(2)
      if (state.slots[3]) {
        state.slots[3].status = 'AVAILABLE'
        state.currentSlot = 3
      }
    }
    if (hasSQ) {
      if (state.slots[3]) {
        state.slots[3].status = 'COMPLETED'
        state.slots[3].subPhase = 'SQ3'
        if (!state.completedSlots.includes(3)) state.completedSlots.push(3)
        if (state.slots[4]) {
          state.slots[4].status = 'AVAILABLE'
          state.currentSlot = 4
        }
      }
    } else if (hasSQ2) {
      if (state.slots[3]) {
        state.slots[3].status = 'IN_PROGRESS'
        state.slots[3].subPhase = 'SQ3'
        state.currentSlot = 3
      }
    } else if (hasSQ1) {
      if (state.slots[3]) {
        state.slots[3].status = 'IN_PROGRESS'
        state.slots[3].subPhase = 'SQ2'
        state.currentSlot = 3
      }
    }

    if (hasSprint) {
      if (state.slots[4]) {
        state.slots[4].status = 'COMPLETED'
        if (!state.completedSlots.includes(4)) state.completedSlots.push(4)
        if (state.slots[5]) {
          state.slots[5].status = 'AVAILABLE'
          state.currentSlot = 5
        }
      } else {
        state.slots[3].status = 'COMPLETED'
        if (!state.completedSlots.includes(3)) state.completedSlots.push(3)
        state.slots[4].status = 'AVAILABLE'
        state.currentSlot = 4
      }
    }
    if (hasQ1) {
      state.slots[4].status = 'COMPLETED'
      if (!state.completedSlots.includes(4)) state.completedSlots.push(4)
      state.slots[5].status = 'AVAILABLE'
      state.currentSlot = 5
    }
    if (hasQ2) {
      state.slots[5].status = 'COMPLETED'
      if (!state.completedSlots.includes(5)) state.completedSlots.push(5)
      state.slots[6].status = 'AVAILABLE'
      state.currentSlot = 6
    }
    if (hasQ3) {
      state.slots[6].status = 'COMPLETED'
      if (!state.completedSlots.includes(6)) state.completedSlots.push(6)
      state.slots[7].status = 'AVAILABLE'
      state.currentSlot = 7
    }
    if (hasRace) {
      state.slots[7].status = 'COMPLETED'
      if (!state.completedSlots.includes(7)) state.completedSlots.push(7)
    }

    state.slotType = state.slots[state.currentSlot].slotType
    state.slotStatus = state.slots[state.currentSlot].status
    state.subPhase = state.slots[state.currentSlot].subPhase as any
    return state
  }

  /**
   * Conclui o slot atual e transiciona determinística e estritamente para o próximo slot lógico.
   * No formato Sprint:
   * Concluir slot 1 (TL1) -> próximo é slot 2 (QUALI_SPRINT), NUNCA TL2.
   * Concluir slot 2 (QUALI_SPRINT) -> próximo é slot 3 (SPRINT).
   * Concluir slot 3 (SPRINT) -> próximo é slot 4 (Q1 principal).
   * No formato Normal:
   * Concluir slot 1 (TL1) -> slot 2 (TL2) -> slot 3 (TL3) -> slot 4 (Q1) -> slot 5 (Q2) -> slot 6 (Q3) -> slot 7 (CORRIDA).
   */
  public async completeSlot(
    state: CanonicalWeekendSlotState,
    slotNumber: WeekendSlotNumber,
    subPhase?: SprintQualifyingSubPhase | MainQualifyingSubPhase | string | null,
  ): Promise<CanonicalWeekendSlotState> {
    if (state.currentSlot !== slotNumber) {
      throw new Error(
        `Não é possível concluir o slot ${slotNumber}: o slot atual é ${state.currentSlot} (${state.slotType}).`,
      )
    }

    const currentSlotDef = state.slots[slotNumber]
    currentSlotDef.status = 'COMPLETED'
    currentSlotDef.completedAt = new Date().toISOString()
    if (subPhase) {
      currentSlotDef.subPhase = subPhase
    }
    if (!state.completedSlots.includes(slotNumber)) {
      state.completedSlots.push(slotNumber)
    }

    // Determina o próximo slot
    if (slotNumber < 7) {
      const nextSlot = (slotNumber + 1) as WeekendSlotNumber
      state.currentSlot = nextSlot
      if (state.slots[nextSlot]) {
        state.slots[nextSlot].status = 'AVAILABLE'
        state.slotType = state.slots[nextSlot].slotType
      }
      state.slotStatus = 'AVAILABLE'
      state.subPhase = null
    } else {
      // Slot 7 concluído (Fim de semana finalizado)
      state.slotStatus = 'COMPLETED'
    }

    await this.saveSlotState(state)
    return state
  }

  /**
   * Limpa cache em memória (útil para testes de reload e isolamento).
   */
  public async getWeekendSlotState(params: {
    careerId: string
    seasonId: string
    round: number
    configVersion?: string
    weekendFormat?: 'NORMAL' | 'SPRINT'
  }): Promise<CanonicalWeekendSlotState> {
    return this.loadOrMigrateSlotState(params)
  }

  public async updateSubPhase(params: {
    careerId: string
    seasonId: string
    round: number
    slotNumber: WeekendSlotNumber
    subPhase: SprintQualifyingSubPhase | MainQualifyingSubPhase | string | null
  }): Promise<CanonicalWeekendSlotState> {
    const { careerId, seasonId, round, slotNumber, subPhase } = params
    const state = await this.loadOrMigrateSlotState({ careerId, seasonId, round })
    if (state.slots[slotNumber]) {
      state.slots[slotNumber].subPhase = subPhase
      if (state.currentSlot === slotNumber) {
        state.subPhase = subPhase as any
      }
      await this.saveSlotState(state)
    }
    return state
  }

  /**
   * BUG-Q1-RESULT-01B: Sincroniza um slot específico como concluído mesmo se currentSlot estiver divergente.
   * Não altera outros slots não relacionados e garante que o slotNumber alvo tenha status COMPLETED.
   * Se currentSlot === slotNumber, avança para o próximo slot (como completeSlot).
   * Se currentSlot < slotNumber (slot atual residual/atrasado), promove currentSlot para o próximo slot (slotNumber + 1).
   * Se currentSlot > slotNumber (já à frente), apenas garante que o slot alvo e completedSlots estejam consistentes.
   */
  /**
   * BUG-Q1-RESULT-01B: Sincroniza um slot específico como concluído mesmo se currentSlot estiver divergente.
   * Não avança outros slots não relacionados e garante que o slotNumber alvo tenha status COMPLETED.
   * Se currentSlot === slotNumber, avança para o próximo slot (slotNumber + 1) tornando-o AVAILABLE.
   * Se currentSlot != slotNumber, NÃO avança cegamente outros slots e NÃO marca Q2 como concluído:
   * apenas garante que o slot alvo (ex: slot 4) fique COMPLETED e registrado em completedSlots,
   * preservando a integridade dos demais slots.
   */
  public async syncSlotCompleted(
    state: CanonicalWeekendSlotState,
    slotNumber: WeekendSlotNumber,
    subPhase?: SprintQualifyingSubPhase | MainQualifyingSubPhase | string | null,
  ): Promise<CanonicalWeekendSlotState> {
    const targetSlotDef = state.slots[slotNumber]
    if (targetSlotDef) {
      targetSlotDef.status = 'COMPLETED'
      if (!targetSlotDef.completedAt) {
        targetSlotDef.completedAt = new Date().toISOString()
      }
      if (subPhase) {
        targetSlotDef.subPhase = subPhase
      }
    }

    if (!state.completedSlots.includes(slotNumber)) {
      state.completedSlots.push(slotNumber)
    }

    // Se currentSlot for exatamente o slotNumber concluído, avança para o próximo slot
    if (state.currentSlot === slotNumber) {
      if (slotNumber < 7) {
        const nextSlot = (slotNumber + 1) as WeekendSlotNumber
        state.currentSlot = nextSlot
        if (state.slots[nextSlot]) {
          state.slots[nextSlot].status = 'AVAILABLE'
          state.slotType = state.slots[nextSlot].slotType
        }
        state.slotStatus = 'AVAILABLE'
        state.subPhase = null
      } else {
        state.slotStatus = 'COMPLETED'
      }
    } else {
      // Quando currentSlot != slotNumber (divergente), garante que o próximo slot imediato
      // fique disponível se o slot divergente anterior estava antes dele ou se o próximo era bloqueado
      if (slotNumber < 7) {
        const nextSlot = (slotNumber + 1) as WeekendSlotNumber
        if (state.slots[nextSlot] && state.slots[nextSlot].status === 'LOCKED') {
          state.slots[nextSlot].status = 'AVAILABLE'
        }
      }
    }

    await this.saveSlotState(state)
    return state
  }

  /**
   * Invalida a entrada do inMemoryCache referente a (careerId, seasonId, round).
   * Reutiliza buildWeekendSlotStorageKey para manter estrita paridade de chave.
   */
  public invalidateMemoryCache(careerId: string, seasonId: string, round: number): void {
    const key = buildWeekendSlotStorageKey(careerId, seasonId, round)
    this.inMemoryCache.delete(key)
  }

  public clearMemoryCache(): void {
    this.inMemoryCache.clear()
  }
}

export const canonicalWeekendSlotPersistenceService = new CanonicalWeekendSlotPersistenceService()
export default canonicalWeekendSlotPersistenceService
