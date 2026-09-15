/**
 * Serviço de Homologação FIA, Academia e Test Drivers
 * F1 Manager 2026 — FASE HOMOLOGAÇÃO & DESENVOLVIMENTO
 *
 * Implementa integralmente as regras do Documento Funcional (13 páginas):
 * - Status de função e licença independentes
 * - Limite de até 2 Test Drivers (3º BLOQUEADO)
 * - 6 tipos de teste com custos, km, notas e consequências
 * - Homologação FIA (R$ 2.5M abertura, mín. 4 testes válidos de 300+ km)
 * - Avaliação ponderada: Ritmo (30%), Consistência (25%), Controle (20%), Feedback Técnico (15%), Segurança (10%)
 * - Notas: 85-100 Super Licença, 75-84 Provisória, 65-74 Teste adicional, <65 Reprovado
 * - Seat Security e impacto contextual sobre titulares
 * - Teste comparativo contextual (pneus/combustível/objetivo)
 * - Technical Feedback e progressão não-linear de academia
 */

import pb from '@/lib/pocketbase/client'
import { DriverModel, TeamModel } from '@/types/f1'
import {
  DriverRole,
  DriverLicenseStatus,
  DriverTestType,
  DriverTestResult,
  DriverHomologationProgram,
  HOMOLOGATION_CONFIG,
  DRIVER_TEST_TYPES_CONFIG,
  HomologationPhase,
} from '@/types/driver-development'

export interface TestExecutionParams {
  teamId: string
  driverId: string
  testType: DriverTestType
  circuit: string
  km?: number
  cost?: number
  secondDriverId?: string // Para teste comparativo
}

export interface TestExecutionOutcome {
  testResult: DriverTestResult
  updatedProgram?: DriverHomologationProgram
  updatedDriver: Partial<DriverModel>
  updatedTitularContext?: {
    titularId: string
    newSeatSecurity: number
    newMorale: number
    reactionMessage: string
  }
  newsEvent?: {
    title: string
    message: string
    type: 'resultado' | 'desenvolvimento' | 'contrato'
  }
}

class DriverDevelopmentService {
  /**
   * Helper para carregar dados de desenvolvimento da equipe com fallback seguro
   */
  getAcademyData(team: TeamModel | null | undefined) {
    const raw = team?.academy_development_data
    return {
      testDrivers: Array.isArray(raw?.testDrivers) ? raw.testDrivers : [],
      academyDrivers: Array.isArray(raw?.academyDrivers) ? raw.academyDrivers : [],
      homologationPrograms: raw?.homologationPrograms || {},
      testResults: Array.isArray(raw?.testResults) ? raw.testResults : [],
      seatSecurities: raw?.seatSecurities || {},
      technicalFeedbacks: raw?.technicalFeedbacks || {},
      developmentProgresses: raw?.developmentProgresses || {},
    }
  }

  /**
   * 1. ADICIONAR PILOTO À ACADEMIA (Vínculo criado sem duplicação de entidade)
   */
  async addDriverToAcademy(
    team: TeamModel,
    driver: DriverModel,
  ): Promise<{ success: boolean; message: string }> {
    const data = this.getAcademyData(team)
    if (data.academyDrivers.includes(driver.id)) {
      return { success: false, message: `${driver.name} já pertence à Academia de Jovens Pilotos.` }
    }

    const updatedAcademy = [...data.academyDrivers, driver.id]
    const updatedDevData = {
      ...data,
      academyDrivers: updatedAcademy,
    }

    // Atualiza team
    await pb.collection('teams').update(team.id, {
      academy_development_data: updatedDevData,
    })

    // Atualiza driver: marca is_academy=true, preserva role se for reserva ou titular
    const updates: Partial<DriverModel> = {
      is_academy: true,
      team_id: team.id,
    }
    if (!driver.license_status) {
      updates.license_status = 'nivel_c'
    }
    if (!driver.technical_feedback) {
      updates.technical_feedback = driver.consistency ? Math.round(driver.consistency * 0.9) : 65
    }

    // Se for piloto procedural, atualiza metadados e marco
    const rawProc = (driver as any).procedural_data
    if (rawProc) {
      const updatedMeta = {
        ...rawProc,
        currentAcademyTeamId: team.id,
        careerStatus: 'academy',
        academyOriginTeamId: rawProc.academyOriginTeamId || team.id,
        milestones: [
          ...(rawProc.milestones || []),
          {
            date: new Date().toISOString().split('T')[0],
            type: 'entrada_academia',
            teamId: team.id,
            teamName: team.name,
            description: `Ingressou oficialmente na Academia de Pilotos da ${team.name}.`,
          },
        ],
      }
      ;(updates as any).procedural_data = updatedMeta
      ;(updates as any).career_status = 'academy'
      if (!(updates as any).academy_origin_team_id) {
        ;(updates as any).academy_origin_team_id = rawProc.academyOriginTeamId || team.id
      }
    }

    await pb.collection('drivers').update(driver.id, updates)

    // Log de evento
    try {
      await pb.collection('events').create({
        team_id: team.id,
        message: `${driver.name} ingressou no programa oficial da Academia de Pilotos da ${team.name}.`,
        type: 'desenvolvimento',
      })
    } catch {
      /* intentionally ignored */
    }

    return { success: true, message: `${driver.name} agora integra a Academia da equipe!` }
  }

  /**
   * 2. DESIGNAR COMO TEST DRIVER (Máximo de 2 por equipe; 3º deve ser BLOQUEADO)
   * Regra do PDF: Um acadêmico pode virar Test Driver SEM duplicar a entidade (mesmo driverId).
   */
  async assignTestDriver(
    team: TeamModel,
    driver: DriverModel,
    salaryAnnual: number = 650000,
  ): Promise<{ success: boolean; message: string }> {
    const data = this.getAcademyData(team)

    // Se já é test driver desta equipe, não adiciona novamente
    if (data.testDrivers.includes(driver.id)) {
      return { success: true, message: `${driver.name} já atua como Piloto de Testes da equipe.` }
    }

    // Regra do PDF: limite de até 2 Test Drivers simultâneos. 3º BLOQUEADO!
    if (data.testDrivers.length >= HOMOLOGATION_CONFIG.maxTestDriversPerTeam) {
      return {
        success: false,
        message: `Limite atingido! A equipe já possui o máximo permitido de ${HOMOLOGATION_CONFIG.maxTestDriversPerTeam} Pilotos de Teste/Desenvolvimento. Dispense um antes de promover outro.`,
      }
    }

    // Adiciona à lista de test drivers mantendo vínculo acadêmico se houver
    const updatedTestDrivers = [...data.testDrivers, driver.id]
    const updatedDevData = {
      ...data,
      testDrivers: updatedTestDrivers,
    }

    await pb.collection('teams').update(team.id, {
      academy_development_data: updatedDevData,
    })

    // Atualiza motorista
    await pb.collection('drivers').update(driver.id, {
      is_test_driver: true,
      // Se não tiver licença definida, recebe Autorização de Teste Nível C
      license_status: driver.license_status || 'nivel_c',
      salary: driver.salary || salaryAnnual,
    })

    try {
      await pb.collection('events').create({
        team_id: team.id,
        message: `${driver.name} foi designado como Piloto de Teste e Desenvolvimento oficial da ${team.name}.`,
        type: 'contrato',
      })
    } catch {
      /* intentionally ignored */
    }

    return { success: true, message: `${driver.name} designado com sucesso como Piloto de Testes!` }
  }

  /**
   * 3. REMOVER PILOTO DE TESTES (Libera vaga para novo)
   */
  async removeTestDriver(
    team: TeamModel,
    driverId: string,
  ): Promise<{ success: boolean; message: string }> {
    const data = this.getAcademyData(team)
    const updatedTestDrivers = data.testDrivers.filter((id) => id !== driverId)

    await pb.collection('teams').update(team.id, {
      academy_development_data: {
        ...data,
        testDrivers: updatedTestDrivers,
      },
    })

    await pb.collection('drivers').update(driverId, {
      is_test_driver: false,
    })

    return { success: true, message: 'Piloto dispensado da função de Test Driver.' }
  }

  /**
   * 3.1 LIBERAR PILOTO DA ACADEMIA (REGRA CENTRAL: LIBERAR ≠ DELETAR)
   * O piloto desvincula da equipe, mas PERMANECE PERMANENTEMENTE NO SAVE,
   * ficando livre no mercado para ser contratado por outras equipes ou rivais.
   */
  async releaseDriverFromAcademy(
    team: TeamModel,
    driver: DriverModel,
  ): Promise<{ success: boolean; message: string }> {
    const data = this.getAcademyData(team)
    const updatedAcademy = data.academyDrivers.filter((id) => id !== driver.id)
    const updatedTestDrivers = data.testDrivers.filter((id) => id !== driver.id)

    await pb.collection('teams').update(team.id, {
      academy_development_data: {
        ...data,
        academyDrivers: updatedAcademy,
        testDrivers: updatedTestDrivers,
      },
    })

    const updates: Partial<DriverModel> = {
      is_academy: false,
      is_test_driver: false,
      team_id: null,
      role: null,
    }

    const rawProc = (driver as any).procedural_data
    if (rawProc) {
      const updatedMeta = {
        ...rawProc,
        currentAcademyTeamId: undefined,
        careerStatus: 'free_agent',
        milestones: [
          ...(rawProc.milestones || []),
          {
            date: new Date().toISOString().split('T')[0],
            type: 'dispensado',
            teamId: team.id,
            teamName: team.name,
            description: `Liberado do programa da ${team.name}. Disponível no mercado como agente livre.`,
          },
        ],
      }
      ;(updates as any).procedural_data = updatedMeta
      ;(updates as any).career_status = 'free_agent'
    }

    await pb.collection('drivers').update(driver.id, updates)

    try {
      await pb.collection('events').create({
        team_id: team.id,
        message: `${driver.name} foi liberado da Academia da ${team.name} e está disponível no mercado.`,
        type: 'contrato',
      })
    } catch {
      /* intentionally ignored */
    }

    return {
      success: true,
      message: `${driver.name} foi liberado da Academia. A entidade do piloto permanece ativa no mercado.`,
    }
  }

  /**
   * 4. INICIAR PROGRAMA DE HOMOLOGAÇÃO FIA
   * Custo inicial de balanceamento: R$ 2.500.000 (abertura do processo formal na FIA).
   */
  async startHomologationProgram(
    team: TeamModel,
    driver: DriverModel,
    targetLicense: 'nivel_b' | 'nivel_a' = 'nivel_b',
  ): Promise<{ success: boolean; message: string }> {
    const fee = HOMOLOGATION_CONFIG.openingFee

    if ((team.budget || 0) < fee) {
      return {
        success: false,
        message: `Orçamento insuficiente. A taxa oficial de abertura do Programa de Homologação FIA é de R$ ${fee.toLocaleString('pt-BR')}.`,
      }
    }

    const data = this.getAcademyData(team)
    const existingProg = data.homologationPrograms[driver.id]
    if (
      existingProg &&
      (existingProg.phase === 'em_andamento' || existingProg.phase === 'teste_adicional')
    ) {
      return {
        success: false,
        message: `${driver.name} já possui um Programa de Homologação FIA ativo.`,
      }
    }

    const newProgram: DriverHomologationProgram = {
      driver_id: driver.id,
      team_id: team.id,
      startDate: new Date().toISOString(),
      phase: 'em_andamento',
      completedValidTests: 0,
      accumulatedHomologatedKm: 0,
      testScores: [],
      averageScore: 0,
      openingFeePaid: true,
      totalSpent: fee,
      targetLicense,
      isEligibleForFinalEvaluation: false,
    }

    const updatedPrograms = {
      ...data.homologationPrograms,
      [driver.id]: newProgram,
    }

    // Deduz do orçamento
    const newBudget = Math.max(0, (team.budget || 0) - fee)

    await pb.collection('teams').update(team.id, {
      budget: newBudget,
      academy_development_data: {
        ...data,
        homologationPrograms: updatedPrograms,
      },
    })

    // Atualiza status do driver
    await pb.collection('drivers').update(driver.id, {
      homologation_status: 'homologacao',
    })

    try {
      await pb.collection('events').create({
        team_id: team.id,
        message: `Programa de Homologação FIA iniciado para ${driver.name}. Taxa regulamentar de R$ ${fee.toLocaleString('pt-BR')} quitada.`,
        type: 'desenvolvimento',
      })
    } catch {
      /* intentionally ignored */
    }

    return {
      success: true,
      message: `Programa de Homologação FIA iniciado para ${driver.name}! Mínimo de 4 testes válidos (>=300 km) exigidos.`,
    }
  }

  /**
   * 5. EXECUTAR TESTE PRIVADO (1 dos 6 Tipos)
   * Sem teste grátis: debita orçamento, calcula km, notas ponderadas, feedback técnico,
   * avanço de homologação e impacto humano em Seat Security e moral de titulares.
   */
  async executeTest(
    team: TeamModel,
    driver: DriverModel,
    params: TestExecutionParams,
    allTitularDrivers: DriverModel[] = [],
  ): Promise<TestExecutionOutcome> {
    const config = DRIVER_TEST_TYPES_CONFIG[params.testType]
    const cost = params.cost || config.baseCost
    const km = params.km || config.standardKm

    if ((team.budget || 0) < cost) {
      throw new Error(
        `Orçamento insuficiente para realizar teste de ${config.name}. Custo: R$ ${cost.toLocaleString('pt-BR')}.`,
      )
    }

    const speed = driver.speed || 75
    const consistency = driver.consistency || 75
    const techFeedback = driver.technical_feedback || 70
    const defense = driver.defense || 70

    // Integração com ManagerEffectService (talentDevelopment do Manager — 2% a 8%)
    // O Manager não ultrapassa o potencial nem quebra física: apenas acelera adaptação e qualidade da coleta
    const { managerEffectService } = await import('@/services/managerEffectService')
    const managerTalentMod = managerEffectService.getAcademyDevelopmentModifier(team)
    const talentBonusPoints = Math.round(managerTalentMod * 25) // ~1 a 2 pontos na execução

    // Variação orgânica controlada (evitar RNG excessivo conforme regra 7)
    // Pequena variação entre -3 e +3
    const jitter = Math.random() * 6 - 3

    // 1. Ritmo 30% (velocidade e proximidade do potencial)
    const scorePace = Math.min(
      100,
      Math.max(45, Math.round(speed * 0.95 + jitter + (driver.age <= 21 ? 2 : 0))),
    )

    // 2. Consistência 25% (repetir performance)
    const scoreConsistency = Math.min(
      100,
      Math.max(45, Math.round(consistency * 0.96 + (Math.random() * 4 - 2))),
    )

    // 3. Controle do carro 20% (erros, estabilidade)
    const scoreCarControl = Math.min(
      100,
      Math.max(45, Math.round(defense * 0.6 + consistency * 0.4 + (Math.random() * 4 - 2))),
    )

    // 4. Feedback técnico 15% (utilidade para setup/desenvolvimento)
    const scoreTechnicalFeedback = Math.min(
      100,
      Math.max(40, Math.round(techFeedback + talentBonusPoints + (Math.random() * 4 - 1))),
    )

    // 5. Disciplina / Segurança 10% (incidentes)
    let scoreDisciplineSafety = Math.min(
      100,
      Math.max(50, Math.round(85 + (consistency > 80 ? 5 : -3) + (Math.random() * 8 - 4))),
    )

    // Incidentes simulados
    const incidents: string[] = []
    const hasSmallIncident = Math.random() < 0.18 // 18% chance de escapada de pista
    const hasMechanicalGlitch = Math.random() < 0.12 // 12% falha de sensor/freios

    if (hasSmallIncident) {
      incidents.push('Escapada na caixa de brita na curva de alta sem danos estruturais.')
      scoreDisciplineSafety = Math.max(40, scoreDisciplineSafety - 12)
    }
    if (hasMechanicalGlitch) {
      incidents.push('Superaquecimento pontual de freios resolvido nos boxes.')
    }

    // Nota final calculada pela fórmula oficial do PDF:
    // Final = (Pace * 0.3) + (Consistency * 0.25) + (CarControl * 0.2) + (TechFeedback * 0.15) + (Discipline * 0.1)
    const weights = HOMOLOGATION_CONFIG.weights
    const rawFinalScore =
      scorePace * weights.pace +
      scoreConsistency * weights.consistency +
      scoreCarControl * weights.carControl +
      scoreTechnicalFeedback * weights.technicalFeedback +
      scoreDisciplineSafety * weights.disciplineSafety

    const finalScore = Math.min(100, Math.max(40, Math.round(rawFinalScore)))

    // Geração de tempo de volta realista no circuito
    const lapSeconds = 88.5 + (100 - speed) * 0.08 + (Math.random() * 0.4 - 0.2)
    const lapMins = Math.floor(lapSeconds / 60)
    const lapSecsRem = (lapSeconds % 60).toFixed(3)
    const bestLapTime = `${lapMins}:${lapSecsRem.padStart(6, '0')}`

    // É teste válido para homologação se km >= 300 e tipo apropriado
    const isValidForHomologation =
      km >= HOMOLOGATION_CONFIG.minKmPerTest &&
      (params.testType === 'homologacao' ||
        params.testType === 'avaliacao' ||
        params.testType === 'desenvolvimento')

    // Feedback técnico ganho pelo piloto
    const technicalFeedbackGain = Math.min(
      2,
      Math.round(1 + (scoreTechnicalFeedback >= 80 ? 1 : 0)),
    )
    const experienceGained = Math.round(km * 0.05)

    // Comparativo (se houver segundo piloto)
    let secondDriverName: string | undefined
    let secondDriverBestLapTime: string | undefined
    let comparisonDeltaSec: number | undefined
    let comparisonSummary: string | undefined

    if (params.testType === 'comparativo' && params.secondDriverId) {
      const secondDriver = allTitularDrivers.find((d) => d.id === params.secondDriverId)
      if (secondDriver) {
        secondDriverName = secondDriver.name
        // Titular faz volta base
        const titularSpeed = secondDriver.speed || 84
        const secondLapSec = 88.5 + (100 - titularSpeed) * 0.08 + (Math.random() * 0.3 - 0.15)
        const secMin = Math.floor(secondLapSec / 60)
        const secRem = (secondLapSec % 60).toFixed(3)
        secondDriverBestLapTime = `${secMin}:${secRem.padStart(6, '0')}`

        // Delta positivo: jovem mais rápido; delta negativo: titular mais rápido
        comparisonDeltaSec = Number((secondLapSec - lapSeconds).toFixed(3))

        if (comparisonDeltaSec > 0.2) {
          comparisonSummary = `${driver.name} surpreendeu e superou ${secondDriver.name} por ${comparisonDeltaSec}s com excelente ritmo de pneus médios.`
        } else if (comparisonDeltaSec < -0.2) {
          comparisonSummary = `${secondDriver.name} impôs sua experiência como titular, ficando ${Math.abs(comparisonDeltaSec)}s à frente de ${driver.name}.`
        } else {
          comparisonSummary = `Tempos praticamente idênticos entre ${driver.name} e ${secondDriver.name} (diferença de apenas ${Math.abs(comparisonDeltaSec)}s).`
        }
      }
    }

    const testResult: DriverTestResult = {
      id: 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      team_id: team.id,
      driver_id: driver.id,
      driver_name: driver.name,
      test_type: params.testType,
      circuit: params.circuit,
      date: new Date().toLocaleDateString('pt-BR'),
      km,
      cost,
      isValidForHomologation,
      scorePace,
      scoreConsistency,
      scoreCarControl,
      scoreTechnicalFeedback,
      scoreDisciplineSafety,
      finalScore,
      bestLapTime,
      incidents,
      experienceGained,
      technicalFeedbackGain,
      feedbackSummary: `Sessão de ${config.name} concluída em ${params.circuit}. Nota geral: ${finalScore}/100.`,
      secondDriverId: params.secondDriverId,
      secondDriverName,
      secondDriverBestLapTime,
      comparisonDeltaSec,
      comparisonSummary,
      created: new Date().toISOString(),
    }

    // Persiste o teste no banco (coleção driver_tests criada na migração)
    try {
      await pb.collection('driver_tests').create({
        team_id: team.id,
        driver_id: driver.id,
        test_type: params.testType,
        circuit: params.circuit,
        date: testResult.date,
        km,
        cost,
        is_valid_homologation: isValidForHomologation,
        score_pace: scorePace,
        score_consistency: scoreConsistency,
        score_car_control: scoreCarControl,
        score_technical_feedback: scoreTechnicalFeedback,
        score_discipline_safety: scoreDisciplineSafety,
        final_score: finalScore,
        best_lap_time: bestLapTime,
        second_driver_id: params.secondDriverId || null,
        details: {
          incidents,
          feedbackSummary: testResult.feedbackSummary,
          comparisonSummary,
          comparisonDeltaSec,
        },
      })
    } catch (saveErr) {
      console.warn(
        'Registro em driver_tests falhou ou collection ainda não sincronizada, mantendo em memória da equipe:',
        saveErr,
      )
    }

    // Atualiza Homologation Program se houver
    const data = this.getAcademyData(team)
    let updatedProgram: DriverHomologationProgram | undefined
    const prog = data.homologationPrograms[driver.id]

    if (prog && prog.phase !== 'superlicenca_concedida' && prog.phase !== 'aprovado_provisoria') {
      const isCountable = isValidForHomologation
      const newValidTests = isCountable ? prog.completedValidTests + 1 : prog.completedValidTests
      const newKm = isCountable ? prog.accumulatedHomologatedKm + km : prog.accumulatedHomologatedKm
      const newScores = isCountable ? [...prog.testScores, finalScore] : prog.testScores
      const avgScore =
        newScores.length > 0
          ? Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length)
          : 0

      // Elegível a avaliação final quando completar 4 testes válidos e mínimo de 1.200 km
      const isEligible =
        newValidTests >= HOMOLOGATION_CONFIG.minValidTests &&
        newKm >= HOMOLOGATION_CONFIG.minValidTests * HOMOLOGATION_CONFIG.minKmPerTest

      let newPhase: HomologationPhase = prog.phase
      let targetLicense = prog.targetLicense

      // Se elegível a avaliação, define o resultado conforme nota média consolidada (Regra 7 do PDF)
      if (isEligible) {
        if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.superLicenseMin) {
          // 85-100: Super Licença Nível A
          newPhase = 'superlicenca_concedida'
          targetLicense = 'nivel_a'
        } else if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.provisionalLicenseMin) {
          // 75-84: Licença Provisória Nível B
          newPhase = 'aprovado_provisoria'
          targetLicense = 'nivel_b'
        } else if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.additionalTestMin) {
          // 65-74: Teste adicional obrigatório
          newPhase = 'teste_adicional'
        } else {
          // < 65: Não aprovado naquele momento
          newPhase = 'reprovado'
        }
      }

      updatedProgram = {
        ...prog,
        completedValidTests: newValidTests,
        accumulatedHomologatedKm: newKm,
        testScores: newScores,
        averageScore: avgScore,
        totalSpent: prog.totalSpent + cost,
        isEligibleForFinalEvaluation: isEligible,
        phase: newPhase,
        targetLicense,
        finalEvaluationDate: isEligible ? new Date().toISOString() : undefined,
      }
    }

    // Impacto no Piloto: feedback técnico evolui, f1_adaptation sobe (com bônus do Manager se houver)
    const extraAdaptationFromManager = managerTalentMod > 0 ? 1 : 0
    const updatedDriver: Partial<DriverModel> = {
      technical_feedback: Math.min(
        99,
        (driver.technical_feedback || 70) +
          technicalFeedbackGain +
          (managerTalentMod >= 0.05 ? 1 : 0),
      ),
      f1_adaptation: Math.min(
        99,
        (driver.f1_adaptation || 60) + Math.round(km * 0.02) + extraAdaptationFromManager,
      ),
    }

    // Se conquistou licença no teste:
    if (updatedProgram?.phase === 'superlicenca_concedida') {
      updatedDriver.license_status = 'nivel_a'
      updatedDriver.homologation_status = 'elegivel'
    } else if (updatedProgram?.phase === 'aprovado_provisoria') {
      updatedDriver.license_status = 'nivel_b'
      updatedDriver.homologation_status = 'elegivel'
    }

    await pb.collection('drivers').update(driver.id, updatedDriver)

    // REGRAS DE SEAT SECURITY E IMPACTO CONTEXTUAL (Regras 6, 10 e 11 do PDF)
    // Se o jovem/test driver impressiona em teste (nota >= 82 ou vence comparativo),
    // afeta Seat Security do titular que estiver sob maior pressão.
    let updatedTitularContext: TestExecutionOutcome['updatedTitularContext']
    let newsEvent: TestExecutionOutcome['newsEvent']

    if (finalScore >= 82 || (comparisonDeltaSec && comparisonDeltaSec > 0.15)) {
      // Localiza titular sob maior ameaça
      const targetTitular = allTitularDrivers[0]
      if (targetTitular) {
        const currentSeatSecurity = targetTitular.seat_security ?? 80
        const titularMorale = targetTitular.morale ?? 75

        // O impacto depende da personalidade e contexto: redução equilibrada de 4 a 8 pontos
        const seatDrop = Math.min(8, Math.max(3, Math.round((finalScore - 78) * 0.6)))
        const newSeatSecurity = Math.max(30, currentSeatSecurity - seatDrop)

        // Se titular tem alta moral, reage com foco (motivação+); se moral baixa, sente a pressão (moral-)
        let newMorale = titularMorale
        let reactionMsg = ''

        if (titularMorale >= 80) {
          reactionMsg = `${targetTitular.name} respondeu ao bom teste de ${driver.name} com foco redobrado no simulador.`
          newMorale = Math.min(99, titularMorale + 2)
        } else {
          reactionMsg = `${targetTitular.name} demonstrou incômodo com o ritmo forte do jovem ${driver.name} nos bastidores.`
          newMorale = Math.max(40, titularMorale - 4)
        }

        updatedTitularContext = {
          titularId: targetTitular.id,
          newSeatSecurity,
          newMorale,
          reactionMessage: reactionMsg,
        }

        // Salva titular
        await pb.collection('drivers').update(targetTitular.id, {
          seat_security: newSeatSecurity,
          morale: newMorale,
        })

        // Evento de notícia relevante
        newsEvent = {
          title: `Destaque em Teste: ${driver.name} impressiona a engenharia da ${team.name}`,
          message: `${driver.name} registrou voltas rápidas e nota ${finalScore}/100. ${reactionMsg}`,
          type: 'desenvolvimento',
        }

        try {
          await pb.collection('events').create({
            team_id: team.id,
            message: newsEvent.message,
            type: newsEvent.type,
          })
        } catch {
          /* intentionally ignored */
        }
      }
    }

    // Se superlicença concedida: Notícia de primeira linha
    if (updatedProgram?.phase === 'superlicenca_concedida') {
      newsEvent = {
        title: `Super Licença FIA Concedida a ${driver.name}!`,
        message: `Com média de ${updatedProgram.averageScore}/100 e ${updatedProgram.accumulatedHomologatedKm} km completados, a FIA concedeu Super Licença Plena (Nível A) a ${driver.name}. Elegível para titularidade de F1!`,
        type: 'contrato',
      }
      try {
        await pb.collection('events').create({
          team_id: team.id,
          message: newsEvent.message,
          type: 'contrato',
        })
      } catch {
        /* intentionally ignored */
      }

      // Adiciona milestone procedural se for piloto procedural
      const rawProc = (driver as any).procedural_data
      if (rawProc) {
        const updatedMeta = {
          ...rawProc,
          milestones: [
            ...(rawProc.milestones || []),
            {
              date: new Date().toISOString().split('T')[0],
              type: 'homologacao_conquistada',
              teamId: team.id,
              teamName: team.name,
              description: `Conquistou a Super Licença FIA Nível A após ${updatedProgram.completedValidTests} testes válidos.`,
            },
          ],
        }
        await pb.collection('drivers').update(driver.id, {
          procedural_data: updatedMeta,
        })
      }
    }

    // Salva estado agregado no time (debita orçamento, salva programa e histórico)
    const newTeamBudget = Math.max(0, (team.budget || 0) - cost)
    const updatedPrograms = {
      ...data.homologationPrograms,
      ...(updatedProgram ? { [driver.id]: updatedProgram } : {}),
    }
    const updatedResults = [testResult, ...(data.testResults || [])].slice(0, 50)

    await pb.collection('teams').update(team.id, {
      budget: newTeamBudget,
      academy_development_data: {
        ...data,
        homologationPrograms: updatedPrograms,
        testResults: updatedResults,
      },
    })

    return {
      testResult,
      updatedProgram,
      updatedDriver,
      updatedTitularContext,
      newsEvent,
    }
  }

  /**
   * 6. RATIFICAÇÃO / RECONFIRMAÇÃO PÚBLICA DO TITULAR
   * Se a equipe confirma publicamente o titular: Seat Security +, jovem pode ficar frustrado (Regra 10).
   */
  async confirmTitularPublicly(
    team: TeamModel,
    titular: DriverModel,
    challengerDriver?: DriverModel,
  ): Promise<{ message: string }> {
    const newSeat = Math.min(99, (titular.seat_security || 80) + 12)
    const newMorale = Math.min(99, (titular.morale || 75) + 6)

    await pb.collection('drivers').update(titular.id, {
      seat_security: newSeat,
      morale: newMorale,
    })

    if (challengerDriver) {
      const challengerMorale = Math.max(45, (challengerDriver.morale || 75) - 5)
      await pb.collection('drivers').update(challengerDriver.id, {
        morale: challengerMorale,
      })
    }

    const msg = `A diretoria da ${team.name} confirmou publicamente ${titular.name} como titular absoluto. Segurança de assento restaurada para ${newSeat}%.`

    try {
      await pb.collection('events').create({
        team_id: team.id,
        message: msg,
        type: 'contrato',
      })
    } catch {
      /* intentionally ignored */
    }

    return { message: msg }
  }
}

export const driverDevelopmentService = new DriverDevelopmentService()
export default driverDevelopmentService
