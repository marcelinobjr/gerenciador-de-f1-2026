import pb from '@/lib/pocketbase/client'
import type {
  PracticePreparation,
  PracticeCarPreparation,
  PracticeSessionType,
  PracticeCarSetup,
  PracticeTyreSelection,
  PracticeFuelLoad,
  PracticeCarValidation,
  PracticeOverallValidation,
} from '@/types/practice-preparation'
import {
  PRACTICE_PROGRAMS,
  DEFAULT_PRACTICE_SETUP,
  FUEL_CONSUMPTION_KG_PER_LAP,
} from '@/types/practice-preparation'
import type { DriverModel, TireSetItem, TireCompound } from '@/types/f1'

export interface SessionSetupDriverData {
  carId: 'car1' | 'car2'
  driverId: string
  program: PracticeCarPreparation['program']
  tyreSelection: PracticeTyreSelection | null
  fuelLoad: PracticeFuelLoad
  setup: PracticeCarSetup
  objective: string
  status: PracticeCarPreparation['status']
}

export interface SessionSetupPayload {
  preparation?: {
    careerId: string
    seasonId: string
    round: number
    sessionType: PracticeSessionType
    status: PracticePreparation['status']
    updatedAt: string
  }
  cars?: {
    car1?: SessionSetupDriverData
    car2?: SessionSetupDriverData
  }
}

/**
 * Converte kg de combustível em voltas estimadas pela regra canônica (~1.65 kg/volta)
 */
export function calculateEstimatedLaps(kg: number): number {
  if (!kg || kg <= 0) return 0
  return Math.max(1, Math.round(kg / FUEL_CONSUMPTION_KG_PER_LAP))
}

/**
 * Converte voltas estimadas em kg de combustível
 */
export function calculateKgFromLaps(laps: number): number {
  if (!laps || laps <= 0) return 0
  return Number((laps * FUEL_CONSUMPTION_KG_PER_LAP).toFixed(1))
}

/**
 * Cria a estrutura inicial padrão para um carro na preparação
 */
export function createDefaultCarPreparation(
  carId: 'car1' | 'car2',
  driverId: string = '',
  initialSetup?: Partial<PracticeCarSetup>,
): PracticeCarPreparation {
  const setup: PracticeCarSetup = {
    frontWing: initialSetup?.frontWing ?? DEFAULT_PRACTICE_SETUP.frontWing,
    rearWing: initialSetup?.rearWing ?? DEFAULT_PRACTICE_SETUP.rearWing,
    suspension: initialSetup?.suspension ?? DEFAULT_PRACTICE_SETUP.suspension,
    differential: initialSetup?.differential ?? DEFAULT_PRACTICE_SETUP.differential,
  }

  const defaultProgram = 'car_setup'
  const defaultKg = 25
  const estimatedLaps = calculateEstimatedLaps(defaultKg)

  return {
    carId,
    driverId,
    program: defaultProgram,
    tyreSelection: null,
    fuelLoad: {
      kg: defaultKg,
      estimatedLaps,
    },
    setup,
    objective: PRACTICE_PROGRAMS[defaultProgram].objective,
    status: driverId ? 'preparing' : 'empty',
  }
}

/**
 * Cria a preparação canônica para os dois carros da equipe
 */
export function createInitialPracticePreparation(params: {
  careerId: string
  seasonId: string
  round: number
  sessionType?: PracticeSessionType
  driver1Id?: string
  driver2Id?: string
  car1Setup?: Partial<PracticeCarSetup>
  car2Setup?: Partial<PracticeCarSetup>
}): PracticePreparation {
  const sessionType = params.sessionType || 'tp1'

  const car1 = createDefaultCarPreparation('car1', params.driver1Id || '', params.car1Setup)
  const car2 = createDefaultCarPreparation('car2', params.driver2Id || '', params.car2Setup)

  return {
    careerId: params.careerId,
    seasonId: params.seasonId,
    round: params.round,
    sessionType,
    cars: [car1, car2],
    status: 'not_started',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Valida o estado de configuração de um carro para a sessão de treino
 */
export function validateCarPreparation(
  car: PracticeCarPreparation,
  availableTires: TireSetItem[] = [],
): PracticeCarValidation {
  const errors: PracticeCarValidation['errors'] = {}

  if (!car.driverId) {
    errors.driver = 'Piloto não escalado para o carro.'
  }

  if (!car.program || !PRACTICE_PROGRAMS[car.program]) {
    errors.program = 'Programa de treino não selecionado.'
  }

  if (!car.tyreSelection || !car.tyreSelection.setId) {
    errors.tyres = 'Nenhum jogo de pneus reservado para o treino.'
  } else if (availableTires.length > 0) {
    const found = availableTires.find((t) => t.id === car.tyreSelection?.setId)
    if (!found) {
      errors.tyres = `O jogo de pneus [${car.tyreSelection.compound}] não está disponível no inventário.`
    }
  }

  if (!car.fuelLoad || car.fuelLoad.kg < 5 || car.fuelLoad.kg > 110) {
    errors.fuel = 'Carga de combustível inválida (permitido entre 5 kg e 110 kg).'
  }

  const { frontWing, rearWing, suspension, differential } = car.setup || {}
  if (
    typeof frontWing !== 'number' ||
    frontWing < 1 ||
    frontWing > 10 ||
    typeof rearWing !== 'number' ||
    rearWing < 1 ||
    rearWing > 10 ||
    typeof suspension !== 'number' ||
    suspension < 1 ||
    suspension > 10 ||
    typeof differential !== 'number' ||
    differential < 20 ||
    differential > 80
  ) {
    errors.setup = 'Parâmetros de setup fora da faixa regulamentar permitida pela FIA.'
  }

  const valid = Object.keys(errors).length === 0
  return { valid, errors }
}

/**
 * Validação geral dos dois carros para habilitar o "INICIAR TL"
 */
export function validateOverallPractice(
  prep: PracticePreparation,
  car1AvailableTires: TireSetItem[] = [],
  car2AvailableTires: TireSetItem[] = [],
): PracticeOverallValidation {
  const car1Val = validateCarPreparation(prep.cars[0], car1AvailableTires)
  const car2Val = validateCarPreparation(prep.cars[1], car2AvailableTires)

  return {
    canStart: car1Val.valid && car2Val.valid,
    car1: car1Val,
    car2: car2Val,
  }
}

/**
 * Copia apenas os 4 parâmetros de setup mecânico/aerodinâmico entre os carros.
 * NUNCA copia piloto, programa, pneus ou combustível.
 */
export function copyCarSetup(
  fromCar: PracticeCarPreparation,
  toCar: PracticeCarPreparation,
): PracticeCarPreparation {
  return {
    ...toCar,
    setup: {
      frontWing: fromCar.setup.frontWing,
      rearWing: fromCar.setup.rearWing,
      suspension: fromCar.setup.suspension,
      differential: fromCar.setup.differential,
    },
  }
}

class PracticePreparationService {
  /**
   * Salva a preparação na collection `session_setups` do PocketBase.
   * Utiliza o campo `driver_strategies` (JSON) ou fallback em `notes` para armazenar
   * o contrato estruturado completo sem quebrar a interoperabilidade.
   */
  async savePreparation(prep: PracticePreparation): Promise<PracticePreparation> {
    const sessionName = prep.sessionType // 'tp1' | 'tp2' | 'tp3'
    const teamId = prep.careerId
    const seasonId = prep.seasonId
    const round = prep.round

    const payload: SessionSetupPayload = {
      preparation: {
        careerId: prep.careerId,
        seasonId: prep.seasonId,
        round: prep.round,
        sessionType: prep.sessionType,
        status: prep.status,
        updatedAt: new Date().toISOString(),
      },
      cars: {
        car1: {
          carId: prep.cars[0].carId,
          driverId: prep.cars[0].driverId,
          program: prep.cars[0].program,
          tyreSelection: prep.cars[0].tyreSelection,
          fuelLoad: prep.cars[0].fuelLoad,
          setup: prep.cars[0].setup,
          objective: prep.cars[0].objective,
          status: prep.cars[0].status,
        },
        car2: {
          carId: prep.cars[1].carId,
          driverId: prep.cars[1].driverId,
          program: prep.cars[1].program,
          tyreSelection: prep.cars[1].tyreSelection,
          fuelLoad: prep.cars[1].fuelLoad,
          setup: prep.cars[1].setup,
          objective: prep.cars[1].objective,
          status: prep.cars[1].status,
        },
      },
    }

    const payloadJson = JSON.stringify(payload)

    // Valores canônicos das colunas de topo herdadas do Carro 1 (para compatibilidade retroativa)
    const car1 = prep.cars[0]
    const wingLevel = car1?.setup?.frontWing || 6
    const suspensionStiffness = car1?.setup?.suspension || 6
    const puElectricRatio = car1?.setup?.differential || 50
    const tireCompound: TireCompound = (car1?.tyreSelection?.compound as TireCompound) || 'medio'

    try {
      // Localiza registro existente para o quadrante (team_id, season_id, round, session)
      const existing = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${teamId}" && season_id = "${seasonId}" && round = ${round} && session = "${sessionName}"`,
      })

      const recordBody: Record<string, any> = {
        team_id: teamId,
        season_id: seasonId,
        round: round,
        session: sessionName,
        wing_level: wingLevel,
        suspension_stiffness: suspensionStiffness,
        pu_electric_ratio: puElectricRatio,
        tire_compound: tireCompound,
        notes: payloadJson, // Armazena cópia íntegra em string serializada
        driver_strategies: payload, // Campo json nativo suportado na migration 0011
      }

      if (existing.items.length > 0) {
        await pb.collection('session_setups').update(existing.items[0].id, recordBody)
      } else {
        await pb.collection('session_setups').create(recordBody)
      }

      // Também espelha em localStorage para resiliência instantânea contra perda de rede/reload
      this.cacheLocally(prep)
      return prep
    } catch (err) {
      console.warn('Erro ao salvar preparação no PocketBase, usando cache local resiliente:', err)
      this.cacheLocally(prep)
      return prep
    }
  }

  /**
   * Carrega a preparação de `session_setups` no PocketBase com fallback no cache local.
   */
  async loadPreparation(params: {
    careerId: string
    seasonId: string
    round: number
    sessionType?: PracticeSessionType
    driver1Id?: string
    driver2Id?: string
    defaultSetup?: Partial<PracticeCarSetup>
  }): Promise<PracticePreparation> {
    const sessionType = params.sessionType || 'tp1'
    const teamId = params.careerId
    const seasonId = params.seasonId
    const round = params.round

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${teamId}" && season_id = "${seasonId}" && round = ${round} && session = "${sessionType}"`,
      })

      if (records.items.length > 0) {
        const item = records.items[0]
        let parsedPayload: SessionSetupPayload | null = null

        // Tenta ler do campo json nativo
        if (item.driver_strategies && (item.driver_strategies as any).preparation) {
          parsedPayload = item.driver_strategies as SessionSetupPayload
        } else if (item.notes) {
          try {
            parsedPayload = JSON.parse(item.notes) as SessionSetupPayload
          } catch (_) {
            parsedPayload = null
          }
        }

        if (parsedPayload?.cars?.car1 && parsedPayload?.cars?.car2) {
          const prep: PracticePreparation = {
            careerId: params.careerId,
            seasonId: params.seasonId,
            round: params.round,
            sessionType,
            cars: [
              this.rehydrateCar(
                'car1',
                parsedPayload.cars.car1,
                params.driver1Id,
                params.defaultSetup,
              ),
              this.rehydrateCar(
                'car2',
                parsedPayload.cars.car2,
                params.driver2Id,
                params.defaultSetup,
              ),
            ],
            status: parsedPayload.preparation?.status || 'preparing',
            updatedAt: parsedPayload.preparation?.updatedAt || item.updated,
          }
          this.cacheLocally(prep)
          return prep
        }
      }
    } catch (err) {
      console.warn('Falha na consulta ao PocketBase, verificando cache local:', err)
    }

    // Tenta fallback no cache local
    const cached = this.readFromLocalCache(teamId, seasonId, round, sessionType)
    if (cached) {
      // Atualiza os pilotos se fornecidos
      if (params.driver1Id && !cached.cars[0].driverId) cached.cars[0].driverId = params.driver1Id
      if (params.driver2Id && !cached.cars[1].driverId) cached.cars[1].driverId = params.driver2Id
      return cached
    }

    // Se não existir, inicializa nova preparação
    const fresh = createInitialPracticePreparation({
      careerId: params.careerId,
      seasonId: params.seasonId,
      round: params.round,
      sessionType,
      driver1Id: params.driver1Id,
      driver2Id: params.driver2Id,
      car1Setup: params.defaultSetup,
      car2Setup: params.defaultSetup,
    })
    this.cacheLocally(fresh)
    return fresh
  }

  private rehydrateCar(
    carId: 'car1' | 'car2',
    raw: SessionSetupDriverData,
    fallbackDriverId?: string,
    defaultSetup?: Partial<PracticeCarSetup>,
  ): PracticeCarPreparation {
    const program = raw.program || 'car_setup'
    const driverId = raw.driverId || fallbackDriverId || ''
    const kg = raw.fuelLoad?.kg ?? 25
    const estimatedLaps = raw.fuelLoad?.estimatedLaps ?? calculateEstimatedLaps(kg)

    return {
      carId,
      driverId,
      program,
      tyreSelection: raw.tyreSelection || null,
      fuelLoad: {
        kg,
        estimatedLaps,
      },
      setup: {
        frontWing: raw.setup?.frontWing ?? defaultSetup?.frontWing ?? 6,
        rearWing: raw.setup?.rearWing ?? defaultSetup?.rearWing ?? 6,
        suspension: raw.setup?.suspension ?? defaultSetup?.suspension ?? 6,
        differential: raw.setup?.differential ?? defaultSetup?.differential ?? 50,
      },
      objective: raw.objective || PRACTICE_PROGRAMS[program].objective,
      status: raw.status || (driverId ? 'preparing' : 'empty'),
    }
  }

  private getCacheKey(
    careerId: string,
    seasonId: string,
    round: number,
    sessionType: string,
  ): string {
    return `apex_practice_prep_${careerId}_${seasonId}_${round}_${sessionType}`
  }

  private cacheLocally(prep: PracticePreparation): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getCacheKey(prep.careerId, prep.seasonId, prep.round, prep.sessionType)
      localStorage.setItem(key, JSON.stringify(prep))
    } catch {
      /* intentionally ignored */
    }
  }

  private readFromLocalCache(
    careerId: string,
    seasonId: string,
    round: number,
    sessionType: string,
  ): PracticePreparation | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = this.getCacheKey(careerId, seasonId, round, sessionType)
      const data = localStorage.getItem(key)
      if (!data) return null
      return JSON.parse(data) as PracticePreparation
    } catch (_) {
      return null
    }
  }
}

export const practicePreparationService = new PracticePreparationService()
