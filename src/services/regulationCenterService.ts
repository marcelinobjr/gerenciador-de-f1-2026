/**
 * regulationCenterService.ts
 *
 * Catálogo canônico e serviço de consulta do Regulamento FIA (REG-01).
 * Não reinventa nem duplica regras — expõe e explica o que os serviços canônicos já executam.
 */

import type {
  RegulationDefinition,
  RegulationCategoryId,
  RegulationCategoryMeta,
  RegulationAuditReport,
  RegulationAuditIssue,
  SeasonRegulationFrameworkMetadata,
} from '@/types/regulation-center'
import {
  ROOKIE_REQUIRED_TOTAL_TEAM,
  ROOKIE_REQUIRED_PER_CAR,
  ROOKIE_MAX_CAREER_STARTS,
} from '@/types/rookie-practice'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import { FIA_POINTS_TABLE } from '@/lib/f1-standings-calculator'
import {
  STANDARD_GP_TYRE_ALLOCATION,
  SPRINT_GP_TYRE_ALLOCATION,
} from '@/services/canonicalTyreAllocationService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'

export const REGULATION_CATEGORIES: RegulationCategoryMeta[] = [
  {
    id: 'fim_de_semana',
    label: 'Fim de Semana',
    shortLabel: 'Fim de Semana',
    order: 1,
    description: 'Formato da esteira oficial de sessões, cronogramas e restrições de tempo.',
    iconName: 'Calendar',
  },
  {
    id: 'treinos_livres',
    label: 'Treinos Livres',
    shortLabel: 'Treinos Livres',
    order: 2,
    description: 'Programas de pista, acerto do carro, feedback e simulação de ritmo.',
    iconName: 'Timer',
  },
  {
    id: 'novatos_tl1',
    label: 'Novatos no TL1',
    shortLabel: 'Novatos no TL1',
    order: 3,
    description: 'Obrigação regulamentar de cessão de 4 sessões de TL1 para pilotos jovens.',
    iconName: 'GraduationCap',
  },
  {
    id: 'qualificacao',
    label: 'Qualificação',
    shortLabel: 'Qualificação',
    order: 4,
    description: 'Eliminações progressivas em Q1, Q2 e disputa da Pole Position no Q3.',
    iconName: 'Trophy',
  },
  {
    id: 'sprint',
    label: 'Sprint',
    shortLabel: 'Sprint',
    order: 5,
    description: 'Formato alternativo curto com pontuação e cronograma comprimido.',
    iconName: 'Zap',
  },
  {
    id: 'corrida',
    label: 'Corrida',
    shortLabel: 'Corrida',
    order: 6,
    description: 'Largada, estratégia de pit stop, neutralizações e bandeiras na prova principal.',
    iconName: 'Flag',
  },
  {
    id: 'pneus',
    label: 'Pneus',
    shortLabel: 'Pneus',
    order: 7,
    description: 'Alocação Pirelli, compostos secos e molhados, inventário e degradação.',
    iconName: 'Disc',
  },
  {
    id: 'power_unit',
    label: 'Power Unit',
    shortLabel: 'Power Unit',
    order: 8,
    description: 'Alocação de motores térmicos e elétricos, desgaste térmico e confiabilidade.',
    iconName: 'Cpu',
  },
  {
    id: 'parc_ferme',
    label: 'Parc Fermé',
    shortLabel: 'Parc Fermé',
    order: 9,
    description: 'Congelamento de setup mecânico e aerodinâmico entre qualificação e GP.',
    iconName: 'Lock',
  },
  {
    id: 'safety_car_vsc',
    label: 'Safety Car & VSC',
    shortLabel: 'Safety Car / VSC',
    order: 10,
    description:
      'Procedimentos de neutralização de pista, fila atrás do SC e delta obrigatório de velocidade do VSC.',
    iconName: 'ShieldAlert',
  },
  {
    id: 'bandeira_vermelha',
    label: 'Bandeira Vermelha',
    shortLabel: 'Bandeira Vermelha',
    order: 11,
    description:
      'Suspensão temporária de sessão, recolhimento obrigatório ao pit lane e reinício controlado.',
    iconName: 'OctagonAlert',
  },
  {
    id: 'pontuacao',
    label: 'Pontuação',
    shortLabel: 'Pontuação',
    order: 12,
    description: 'Sistema FIA oficial de pontos para Pilotos e Construtores (Top 10).',
    iconName: 'Award',
  },
  {
    id: 'grid_penalidades',
    label: 'Grid & Penalidades',
    shortLabel: 'Grid & Penalidades',
    order: 13,
    description: 'Formação do grid de largada, posições pós-qualificação e punições desportivas.',
    iconName: 'ListOrdered',
  },
  {
    id: 'licencas',
    label: 'Licenças & Superlicença',
    shortLabel: 'Licenças',
    order: 14,
    description: 'Critérios de elegibilidade para assento titular, reserva e sessões oficiais.',
    iconName: 'FileCheck',
  },
  {
    id: 'campeonato',
    label: 'Campeonato Mundial',
    shortLabel: 'Campeonato',
    order: 15,
    description: 'Classificações de Pilotos e Construtores, desempates e critérios de countback.',
    iconName: 'Medal',
  },
  {
    id: 'regulamento_tecnico',
    label: 'Regulamento Técnico',
    shortLabel: 'Técnico',
    order: 16,
    description:
      'Diretrizes de P&D, transição de eras, transferibilidade de conhecimento e túnel de vento.',
    iconName: 'Wrench',
  },
]

/**
 * Estrutura canônica de metadados das seções regulamentares da temporada.
 * Section A a Section F conforme diretrizes oficiais FIA 2026.
 */
export const SEASON_REGULATION_FRAMEWORKS: Record<number, SeasonRegulationFrameworkMetadata> = {
  2026: {
    season: 2026,
    authority: 'FIA',
    championship: 'FIA Formula One World Championship',
    versionName: 'FIA F1 2026 Sporting & Technical Framework (Issue Homologated)',
    officialSections: [
      {
        sectionCode: 'Section A',
        title: 'General Provisions',
        scope: 'Governança geral, competência dos comissários, inscrições e jurisdição esportiva.',
      },
      {
        sectionCode: 'Section B',
        title: 'Sporting Regulations',
        scope:
          'Cronograma, treinos, novatos no TL1, qualificação, Sprint, corrida, pneus, parc fermé e pontuação.',
      },
      {
        sectionCode: 'Section C',
        title: 'Technical Regulations',
        scope:
          'Chassi, aerodinâmica ativa/passiva, Power Unit turbo-híbrida V6 350kW MGU-K e segurança.',
      },
      {
        sectionCode: 'Section D',
        title: 'Financial Regulations (Teams)',
        scope: 'Teto orçamentário de equipes (Cost Cap), limites de gastos e auditoria financeira.',
      },
      {
        sectionCode: 'Section E',
        title: 'Financial Regulations (PU Manufacturers)',
        scope: 'Teto de despesas para fornecedoras homologadas de Unidade de Potência.',
      },
      {
        sectionCode: 'Section F',
        title: 'Operational Regulations',
        scope:
          'Horários de toque de recolher (curfew), logística, esteira de transporte e homologações.',
      },
    ],
  },
}

export function getSeasonRegulationFramework(
  seasonYear: number,
): SeasonRegulationFrameworkMetadata | null {
  return SEASON_REGULATION_FRAMEWORKS[seasonYear] || null
}

/**
 * Cria o conjunto canônico de regras da temporada 2026.
 * Todos os valores numéricos são derivados diretamente das fontes canônicas.
 */
export function buildSeasonRegulations2026(): RegulationDefinition[] {
  const qRules = CANONICAL_QUALIFYING_RULES
  const top10Pts = FIA_POINTS_TABLE.join(', ')

  return [
    // 1. FIM DE SEMANA
    {
      id: 'reg_weekend_pipeline',
      category: 'fim_de_semana',
      title: 'Estrutura Canônica do Fim de Semana de Grande Prêmio',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 31 & 32)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 31.1',
      },
      tags: ['fim de semana', 'sessões', 'cronograma', 'esteira', 'pipeline', 'gp'],
      whatItDetermines:
        'A FIA determina que um Grande Prêmio tradicional compreenda 3 sessões de Treino Livre (TL1, TL2 de 60 minutos na sexta-feira e TL3 no sábado), uma sessão qualificatória eliminatória e a Corrida Principal no domingo.',
      apexExplanation:
        'No APEX GP Manager, a esteira principal da aba CORRIDA executa o pipeline sequencial canônico: TL1 → TL2 → Q1 → Q2 → Q3 → Corrida. A sessão TL3 permanece 100% implementada no motor de simulação e nos runners de backend, ficando isolada nesta versão por opção de ritmo de jogo sem quebrar a consistência das sessões.',
      teamSituationNote:
        'O acesso a cada sessão subsequente exige a conclusão ou simulação da etapa anterior na barra de progressão.',
      relatedService: 'weekendProgressionService & weekendScheduleConfig',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'IR PARA ABA CORRIDA',
      hasTeamContext: false,
    },

    // 2. TREINOS LIVRES
    {
      id: 'reg_practice_sessions',
      category: 'treinos_livres',
      title: 'Treinos Livres: Preparação e Conhecimento de Pista',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 32)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 32.2',
      },
      tags: ['treino livre', 'tl1', 'tl2', 'tl3', 'setup', 'preparação', 'telemetria'],
      whatItDetermines:
        'Os treinos livres têm o propósito estrito de permitir que as equipes e pilotos avaliem o comportamento dos compostos de pneus, refinem a configuração aerodinâmica e mecânica do chassi e acumulem telemetria antes do início das sessões competitivas.',
      apexExplanation:
        'O motor de treinos do APEX simula programas dedicados (Aclimação de Pista, Ritmo de Qualificação, Gestão de Pneus e Ritmo de Corrida). A quilometragem percorrida pelos dois carros gera feedback técnico do piloto, calibrando a janela ideal de asa dianteira, asa traseira, suspensão e pressão de freios antes do Parc Fermé.',
      teamSituationNote:
        'Carros que completam seus programas de treino entram na qualificação com índices de acerto mais próximos de 100%, reduzindo o tempo de volta estimado.',
      relatedService: 'canonicalPracticeRunner & practicePreparationService',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'PREPARAR TREINOS',
      hasTeamContext: false,
    },

    // 3. NOVATOS NO TL1 (Regra mais completa)
    {
      id: 'reg_rookie_fp1_obligation',
      category: 'novatos_tl1',
      title: 'Obrigação Regulamentar de Novatos no TL1 (FP1 Rookie Rule)',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 32.4)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 32.4 (c)',
      },
      tags: [
        'rookie',
        'novato',
        'tl1',
        'fp1',
        'jovem piloto',
        'reserva',
        'carro 1',
        'carro 2',
        'obrigação',
      ],
      whatItDetermines: `Cada construtor inscrito no Campeonato Mundial é obrigado a ceder o cockpit em exatamente ${ROOKIE_REQUIRED_TOTAL_TEAM} sessões de Treino Livre 1 ao longo da temporada a pilotos novatos, sendo rigorosamente ${ROOKIE_REQUIRED_PER_CAR} sessões no Carro 1 e ${ROOKIE_REQUIRED_PER_CAR} sessões no Carro 2. Define-se formalmente como novato o piloto que disputou no máximo ${ROOKIE_MAX_CAREER_STARTS} Grandes Prêmios de Fórmula 1 em toda a sua carreira. A função contratual de 'Reserva' ou a idade não qualificam o piloto caso ele possua 3 ou mais GPs disputados.`,
      apexExplanation:
        'O APEX GP Manager implementa o sistema canônico em dois níveis independentes: (1) O RookiePracticeRequirementService mantém o ledger oficial de cumprimento por assento, concedendo crédito esportivo apenas após o novato completar voltas válidas de pista no TL1 real; (2) O RookieTl1PlanningService gerencia o planejamento antecipado no Calendário com status PLANNED, sem antecipar créditos regulamentares. O motor rival da IA escala seus novatos de forma balanceada ao longo do ano.',
      teamSituationNote:
        'Consulte no painel lateral o progresso em tempo real da sua equipe: créditos homologados e sessões planejadas para o Carro 1 e Carro 2.',
      relatedService: 'RookiePracticeRequirementService & RookieTl1PlanningService',
      relatedRoute: '/calendario',
      relatedRouteLabel: 'VER PLANEJAMENTO NO CALENDÁRIO',
      hasTeamContext: true,
    },

    // 4. QUALIFICAÇÃO
    {
      id: 'reg_qualifying_format',
      category: 'qualificacao',
      title: 'Sessão Classificatória Eliminatória Progressiva (Q1, Q2, Q3)',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 39)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 39.1 – 39.4',
      },
      tags: ['qualificação', 'quali', 'q1', 'q2', 'q3', 'pole', 'grid', 'eliminação', 'parc fermé'],
      whatItDetermines: `A qualificação oficial é disputada em três fases eliminatórias sucessivas. No grid oficial de ${qRules.q1.participantsCount} carros: o Q1 dura ${qRules.q1.durationSec / 60} minutos e elimina os ${qRules.q1.eliminatedCount} carros mais lentos (P${qRules.q1.minGridPos} a P${qRules.q1.maxGridPos}); os ${qRules.q2.participantsCount} restantes disputam o Q2 durante ${qRules.q2.durationSec / 60} minutos, com eliminação de mais ${qRules.q2.eliminatedCount} carros (P${qRules.q2.minGridPos} a P${qRules.q2.maxGridPos}); finalmente, os 10 melhores disputam a Pole Position e as posições P1 a P10 no Q3 durante ${qRules.q3.durationSec / 60} minutos.`,
      apexExplanation:
        'O APEX GP Manager consome a configuração canônica CANONICAL_QUALIFYING_RULES. Cada etapa opera um runner de física e telemetria por voltas individuais (saída dos boxes, volta rápida, volta de retorno), consumindo pneus reais do inventário do fim de semana. Desempates entre tempos idênticos são decididos pelo primeiro piloto que registrou a marca.',
      teamSituationNote:
        'A partir da luz verde do Q1, o regime de Parque Fechado (Parc Fermé) congela alterações profundas de afinação.',
      relatedService: 'canonicalQualifyingRunner & CANONICAL_QUALIFYING_RULES',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'IR PARA QUALIFICAÇÃO',
      hasTeamContext: false,
    },

    // 5. SPRINT
    {
      id: 'reg_sprint_format',
      category: 'sprint',
      title: 'Formato de Fim de Semana com Corrida Sprint',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'SUPORTE PARCIAL',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 40)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 40.1',
      },
      tags: ['sprint', 'formato alternativo', 'cronograma sprint', 'pontos sprint'],
      whatItDetermines:
        'Nos eventos designados pela FIA como fins de semana Sprint, o cronograma é condensado: apenas 1 sessão de treino livre (TL1), seguida pelo Sprint Shootout (qualificação da Sprint), Corrida Sprint de 100 km concedendo pontos aos 8 primeiros (8-7-6-5-4-3-2-1), com a qualificação principal e o GP no formato tradicional.',
      apexExplanation:
        'Regra regulamentar / suporte parcial no APEX: O calendário canônico identifica com precisão as 6 rodadas Sprint através do serviço hasSprintWeekend(), reduzindo a alocação de pneus para 19 jogos e aplicando restrições táticas no planejamento de novatos (já que há apenas 1 treino livre antes do parque fechado). A simulação autônoma da corrida Sprint de sábado segue em desenvolvimento na esteira principal.',
      teamSituationNote:
        'Fins de semana com Sprint recebem alertas de atenção para evitar escalação de novatos sem experiência em pistas com muros próximos.',
      relatedService: 'weekendProgressionService & SPRINT_GP_TYRE_ALLOCATION',
      relatedRoute: '/calendario',
      relatedRouteLabel: 'VER ETAPAS SPRINT NO CALENDÁRIO',
      hasTeamContext: false,
    },

    // 6. CORRIDA
    {
      id: 'reg_race_regulations',
      category: 'corrida',
      title: 'Procedimentos de Corrida, Pit Stops e Distância Oficial',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 53 & 54)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 54.1',
      },
      tags: ['corrida', 'largada', 'pit stop', 'paradas', 'distância', 'bandeiras', 'resultado'],
      whatItDetermines:
        'A corrida principal tem distância mínima regulamentar de 305 km (com exceção de Mônaco, 260 km) ou tempo máximo de 2 horas. Em provas sob condições secas, cada piloto é obrigado a utilizar ao menos dois compostos slick distintos, exigindo ao menos uma parada obrigatória nos boxes.',
      apexExplanation:
        'O motor CanonicalRaceEngineService gerencia voltas volta a volta com ritmo composto por piloto, chassi, motor, modo de motor, agressividade e desgaste de pneus. Chamadas de box podem ser feitas pelo jogador via Pit Wall ou decididas pelo engenheiro de corrida em simulações. O resultado oficial gera snapshot criptograficamente assinado com os 24 carros classificados.',
      teamSituationNote:
        'O cumprimento da troca de compostos e o cálculo de tempo de parada (tempo base + troca de pneus) influenciam a posição de saída.',
      relatedService: 'canonicalRaceEngineService & canonicalRaceResultService',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'ABRIR OPERAÇÕES DE CORRIDA',
      hasTeamContext: false,
    },

    // 7. PNEUS
    {
      id: 'reg_tyre_allocation_pirelli',
      category: 'pneus',
      title: 'Alocação Pirelli de Pneus e Persistência de Inventário',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 30)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 30.2',
      },
      tags: [
        'pneus',
        'pirelli',
        'slick',
        'duro',
        'médio',
        'macio',
        'chuva',
        'intermediário',
        'inventário',
      ],
      whatItDetermines: `Para cada evento de Grande Prêmio padrão, a Pirelli e a FIA alocam exatamente ${STANDARD_GP_TYRE_ALLOCATION.totalSetsPerDriver} jogos de pneus secos e molhados por piloto (${STANDARD_GP_TYRE_ALLOCATION.totalTyresPerDriver} pneus por piloto): ${STANDARD_GP_TYRE_ALLOCATION.slicks.duro} jogos de Duros, ${STANDARD_GP_TYRE_ALLOCATION.slicks.medio} jogos de Médios, ${STANDARD_GP_TYRE_ALLOCATION.slicks.macio} jogos de Macios, ${STANDARD_GP_TYRE_ALLOCATION.wet.intermediario} Intermediários e ${STANDARD_GP_TYRE_ALLOCATION.wet.chuva_extrema} de Chuva Extrema. Em fins de semana Sprint, o total é de ${SPRINT_GP_TYRE_ALLOCATION.totalSetsPerDriver} jogos.`,
      apexExplanation:
        'No APEX GP Manager, o inventário de pneus é estritamente persistente entre todas as sessões do fim de semana. Pneus gastos no TL1 continuam com sua quilometragem e desgaste registrados se reutilizados no TL2 ou qualificação. Cada circuito recebe a nomeação dos compostos físicos reais (C1 mais duro a C5 mais macio) através de ROUND_PHYSICAL_COMPOUND_MAP conforme a abrasividade do asfalto.',
      teamSituationNote:
        'Pneus preservados nos treinos livres ficam disponíveis com 100% de borracha para as fases decisivas do Q3 e da Corrida.',
      relatedService: 'canonicalTyreAllocationService & canonicalWeekendTyrePersistence',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'VER ESTOQUE DE PNEUS NO GP',
      hasTeamContext: true,
    },

    // 8. POWER UNIT
    {
      id: 'reg_power_unit_management',
      category: 'power_unit',
      title: 'Unidade de Potência 2026: Alocação, Desgaste e Confiabilidade',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One Technical Regulations 2026',
        season: 2026,
        section: 'Section C — Technical Regulations (Power Unit)',
        documentTitle: 'FIA Formula One Technical Regulations 2026',
        articleRef: 'Art. 5.1 – 5.4',
      },
      tags: [
        'motor',
        'power unit',
        'pu',
        'unidade de potência',
        'desgaste',
        'mgu',
        'confiabilidade',
      ],
      whatItDetermines:
        'A regulamentação técnica de 2026 introduz motores turbo-híbridos V6 com aumento significativo da eletrificação (50% potência térmica e 50% potência elétrica / 350 kW do MGU-K) e eliminação do MGU-H. O número de componentes por temporada é restrito, com penalidades de posições no grid para unidades adicionais instaladas fora do limite homologado.',
      apexExplanation:
        'O APEX GP Manager simula as 5 fornecedoras oficiais (Mercedes, Ferrari, Honda, Ford e Audi) com métricas canônicas de Potência, Confiabilidade e Custo Anual. O cálculo de desgaste por corrida (pu-wear-calculator) consome uma base de 12%, modulada por temperatura de pista (>30°C aumenta até +4%), chuva (reduz até -4%), mapeamento agressivo do MGU e modo "Preservar Carro" (-15%). A gestão de pool individual de componentes é uma mecânica com badge APEX.',
      teamSituationNote:
        'Gerencie na Infraestrutura o desgaste acumulado e consulte contratos de fornecimento com a montadora.',
      relatedService: 'OFFICIAL_POWER_UNITS & calculatePUWear',
      relatedRoute: '/infraestrutura',
      relatedRouteLabel: 'VER INFRAESTRUTURA & MOTOR',
      hasTeamContext: true,
    },

    // 9. PARC FERMÉ
    {
      id: 'reg_parc_ferme',
      category: 'parc_ferme',
      title: 'Regime de Parque Fechado (Parc Fermé)',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One Sporting Regulations 2026',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 40.2 & 40.3)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 40.2',
      },
      tags: ['parc fermé', 'parque fechado', 'congelamento', 'setup', 'chassi', 'asa'],
      whatItDetermines:
        'O regime de Parque Fechado entra em vigor no momento exato em que o carro deixa os boxes pela primeira vez durante a sessão de classificação (Q1). A partir desse instante, é expressamente proibido alterar o setup de suspensão, molas, amortecedores e geometria aerodinâmica principal até a largada da corrida no domingo.',
      apexExplanation:
        'No APEX GP Manager, o status de Parc Fermé é controlado pelo canonicalQualifyingPersistenceService e persistido de forma segura por temporada e rodada. Uma vez iniciado o Q1, o setup otimizado nos treinos é congelado para Q2, Q3 e a Corrida, permitindo apenas ajustes operacionais de pressão de pneus e ângulo de flap da asa dianteira durante os pit stops.',
      teamSituationNote:
        'Certifique-se de validar todo o acerto mecânico antes de clicar em "INICIAR Q1" na esteira.',
      relatedService: 'canonicalQualifyingPersistenceService',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'IR PARA QUALIFICAÇÃO',
      hasTeamContext: false,
    },

    // 10. SAFETY CAR / VSC
    {
      id: 'reg_safety_car_vsc',
      category: 'safety_car_vsc',
      title: 'Safety Car (SC) e Virtual Safety Car (VSC)',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One Sporting Regulations 2026',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 55 & 56)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 55 (SC) & Art. 56 (VSC)',
      },
      tags: [
        'safety car',
        'sc',
        'vsc',
        'virtual safety car',
        'neutralização',
        'delta',
        'pit lane',
        'bandeira verde',
      ],
      whatItDetermines:
        'O Diretor de Prova aciona o Virtual Safety Car (VSC) quando há intervenção na pista sem necessidade de agrupamento físico, exigindo obediência a um delta de velocidade mínimo em todos os setores. O Safety Car físico (SC) é acionado quando detritos ou carros imobilizados representam perigo severo, recolhendo e agrupando o pelotão atrás do veículo líder em velocidade controlada até o retorno à bandeira verde.',
      apexExplanation:
        'O Race Engine do APEX simula o acionamento estocástico de SC e VSC calibrado pelas características de cada circuito (circuit-performance-profiles). Sob VSC, o delta é aplicado matematicamente aos tempos de volta sem reagrupamento do grid. Sob SC físico, o pelotão é comprimido e a perda de tempo em uma parada de boxes despenca de ~24s para ~11s, disparando modais de decisão tática (DecisionModals) para o jogador decidir se aproveita a janela favorável.',
      teamSituationNote:
        'Pistas de rua estreitas (Mônaco 85%, Singapura 80%, Baku 65%) concentram as maiores probabilidades de períodos de bandeira amarela e SC no calendário.',
      relatedService: 'canonicalRaceEngineService & DecisionModals',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'VER CORRIDA AO VIVO',
      hasTeamContext: false,
    },

    // 11. BANDEIRA VERMELHA
    {
      id: 'reg_red_flag_procedure',
      category: 'bandeira_vermelha',
      title: 'Bandeira Vermelha: Suspensão e Reinício de Sessão',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'SUPORTE PARCIAL',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One Sporting Regulations 2026',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 57 & 58)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 57 (Suspension) & Art. 58 (Resumption)',
      },
      tags: [
        'bandeira vermelha',
        'red flag',
        'interrupção',
        'paralisação',
        'pit lane',
        'reinício',
        'troca de pneus',
      ],
      whatItDetermines:
        'Caso a pista fique bloqueada por acidente grave ou condições meteorológicas extremas inviabilizem a visibilidade, a sessão é imediatamente suspensa com bandeira vermelha. Todos os carros devem reduzir a velocidade e dirigir-se ordenadamente ao pit lane, onde reparos limitados e troca livre de pneus são autorizados antes do reinício parado ou lançado.',
      apexExplanation:
        'Regra regulamentar / suporte parcial no APEX: O motor de corrida registra incidentes críticos de bandeira vermelha na estrutura canônica de eventos (eventsSummary.redFlagPeriods), interrompendo a contagem do cronômetro da prova e consolidando a ordem de relargada. A execução procedural detalhada do procedimento completo de reparo sob paralisação no pit lane tem escopo parcial no runner de texto.',
      teamSituationNote:
        'Se uma prova sofrer interrupção por bandeira vermelha, a classificação da volta anterior à interrupção é utilizada como referência de grid para o reinício.',
      relatedService: 'canonicalRaceEngineService & raceEventsSummary',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'VER OPERAÇÕES DE CORRIDA',
      hasTeamContext: false,
    },

    // 11. PONTUAÇÃO
    {
      id: 'reg_fia_scoring_system',
      category: 'pontuacao',
      title: 'Sistema Oficial de Pontuação do Campeonato Mundial',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 6)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 6.4',
      },
      tags: ['pontuação', 'pontos', 'tabela fia', 'p1', 'top 10', 'campeonato', 'vitória'],
      whatItDetermines: `Os pontos para o Campeonato Mundial de Pilotos e Construtores são concedidos estritamente aos 10 primeiros colocados de cada Grande Prêmio oficial na seguinte escala: 1º: 25 pts, 2º: 18 pts, 3º: 15 pts, 4º: 12 pts, 5º: 10 pts, 6º: 8 pts, 7º: 6 pts, 8º: 4 pts, 9º: 2 pts e 10º: 1 pt. Para 2026, a bonificação de 1 ponto pela volta mais rápida não é concedida se o regulamento da temporada não prever bônus.`,
      apexExplanation: `O APEX consome rigorosamente a constante canônica FIA_POINTS_TABLE ([${top10Pts}]) através da função getFiaPointsForPosition(). Nenhuma tela inventa ou calcula pontuação independente: o CanonicalChampionshipService soma com exatidão matemática apenas o campo pointsAwarded gravado no snapshot oficial imutável de cada resultado de prova.`,
      teamSituationNote:
        'A pontuação acumulada dos dois pilotos é somada integralmente para o Mundial de Construtores da sua equipe.',
      relatedService: 'FIA_POINTS_TABLE & canonicalRaceResultService',
      relatedRoute: '/standings',
      relatedRouteLabel: 'VER CLASSIFICAÇÃO NO CAMPEONATO',
      hasTeamContext: false,
    },

    // 12. GRID & PENALIDADES
    {
      id: 'reg_grid_and_penalties',
      category: 'grid_penalidades',
      title: 'Composição do Grid de Largada e Aplicação de Penalidades',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One Sporting Regulations 2026',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 42)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 42.1 – 42.3',
      },
      tags: [
        'grid',
        'largada',
        'posições',
        'penalidades',
        'punições',
        'desempate',
        'q1',
        'q2',
        'q3',
      ],
      whatItDetermines:
        'O grid de largada oficial é formado em ordem crescente dos tempos válidos do Q3 (P1 a P10), seguidos pelos pilotos eliminados no Q2 (P11 a P18) e pelos eliminados no Q1 (P19 a P24). Penalidades desportivas ou por troca de componentes da Power Unit são aplicadas cumulativamente à posição conquistada na pista.',
      apexExplanation:
        'O motor de resolução de grid (canonical-race-grid-resolver e CanonicalRaceInitializationPanel) monta a ordem de largada dos 24 carros participantes combinando a classificação final do Q3/Q2/Q1. Se dois pilotos registrarem tempos rigorosamente idênticos, a precedência é atribuída àquele que cruzou a linha de cronometragem primeiro.',
      teamSituationNote:
        'Conquistas de posições nos primeiros 10 metros dependem da velocidade de reação e tração mecânica do carro.',
      relatedService: 'canonical-race-grid-resolver & CompleteQualifyingWeekendResult',
      relatedRoute: '/corrida',
      relatedRouteLabel: 'VER GRID DA RODADA',
      hasTeamContext: false,
    },

    // 13. LICENÇAS
    {
      id: 'reg_driver_licenses',
      category: 'licencas',
      title: 'Sistema de Licenças Esportivas e Elegibilidade para Grandes Prêmios',
      season: 2026,
      sourceType: 'APEX_ADAPTATION',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA + APEX',
        championship: 'FIA Formula One World Championship',
        season: 2026,
        section: "Appendix L — International Drivers' Licences & APEX System",
        documentTitle: 'FIA Appendix L & APEX Driver Management Architecture',
        articleRef: 'Art. 5 (Super Licence)',
      },
      tags: [
        'licença',
        'superlicença',
        'licença a',
        'licença b',
        'licença c',
        'titular',
        'reserva',
        'elegibilidade',
      ],
      whatItDetermines:
        'Para conduzir um carro de Fórmula 1 em sessões oficiais de Grande Prêmio (qualificação e corrida), o piloto deve possuir obrigatoriamente a Superlicença da FIA (conquistada com 40 pontos no sistema de categorias de base ou experiência pregressa comprovada).',
      apexExplanation:
        'O APEX GP Manager adota o sistema canônico homologado de licenças de três níveis (canonicalHomologationAdapter): Licença C (categoria de base e simulador), Licença B (pilotos de testes e novatos elegíveis a TL1) e Licença A (Superlicença plena para assento titular). Estar sob contrato como "Piloto Reserva" NÃO confere automaticamente Licença A — a função contratual difere da licença desportiva.',
      teamSituationNote:
        'Consulte no painel lateral a relação de pilotos da sua equipe e verifique quais possuem Licença A ativa.',
      relatedService: 'canonicalHomologationAdapter & superlicense.ts',
      relatedRoute: '/pilotos',
      relatedRouteLabel: 'GERENCIAR PILOTOS',
      hasTeamContext: true,
    },

    // 14. CAMPEONATO
    {
      id: 'reg_championship_standings_and_countback',
      category: 'campeonato',
      title: 'Desempates no Campeonato Mundial e Critério de Countback',
      season: 2026,
      sourceType: 'OFFICIAL_FIA',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'FIA',
        championship: 'FIA Formula One Sporting Regulations 2026',
        season: 2026,
        section: 'Section B — Sporting Regulations (Art. 7)',
        documentTitle: 'FIA Formula One Sporting Regulations 2026',
        articleRef: 'Art. 7.1 – 7.2',
      },
      tags: ['campeonato', 'desempate', 'countback', 'vitórias', 'construtores', 'pilotos'],
      whatItDetermines:
        'Se dois ou mais pilotos ou construtores terminarem o campeonato com o mesmo número de pontos, o desempate é feito rigorosamente pelo critério de Countback: o título ou posição superior é concedido a quem obteve o maior número de 1ºs lugares (vitórias). Persistindo o empate, avaliam-se 2ºs lugares, depois 3ºs lugares, e assim sucessivamente até P24.',
      apexExplanation:
        'O algoritmo compareCountback implementado no CanonicalChampionshipService varre deterministamente as contagens de chegada (finishCounts) de P1 a P24 sem recorrer a sorteio, ordem alfabética ou IDs de banco de dados. Transferências de pilotos entre equipes preservam integralmente os pontos acumulados pelo piloto em seu driverId, enquanto a equipe mantém os pontos conquistados com ele.',
      teamSituationNote:
        'Acesse a tabela do campeonato para inspecionar gaps de pontos e posições conquistadas até a rodada atual.',
      relatedService: 'canonicalChampionshipService.compareCountback',
      relatedRoute: '/standings',
      relatedRouteLabel: 'IR PARA O CAMPEONATO',
      hasTeamContext: false,
    },

    // 15. REGULAMENTO TÉCNICO
    {
      id: 'reg_technical_regulations_and_eras',
      category: 'regulamento_tecnico',
      title: 'Regulamento Técnico: Ciclo Regulatório e Knowledge Transfer',
      season: 2026,
      sourceType: 'APEX_ADAPTATION',
      status: 'IMPLEMENTADO',
      sourceMetadata: {
        authority: 'APEX',
        championship: 'FIA Formula One Technical Regulations & APEX Engineering',
        season: 2026,
        section: 'Section C — Technical Regulations & APEX Module 8C',
        documentTitle: 'APEX Canonical Technical Framework 2026',
        articleRef: 'Module 8C.1 & 8C.2',
      },
      tags: [
        'regulamento técnico',
        'era técnica',
        'aerodinâmica',
        'túnel de vento',
        'cfd',
        'knowledge transfer',
        'p&d',
      ],
      whatItDetermines:
        'A regulamentação técnica da Fórmula 1 passa por revisões periódicas e novas eras para nivelar o grid, aumentar a segurança e direcionar o desenvolvimento tecnológico das montadoras.',
      apexExplanation:
        'No APEX GP Manager, o módulo regulationService implementa o modelo canônico de Knowledge Transfer (8C.1 e 8C.2). Quando uma mudança técnica é anunciada pela FIA para temporadas futuras, as equipes podem alocar horas de CFD e túnel de vento para o carro futuro sem perder a capacidade genérica de engenharia (ApplicableKnowledge = ExistingKnowledge × Transferability). Conhecimento metodológico nunca é zerado.',
      teamSituationNote:
        'Consulte na tela Carro a aba Regulamento para definir a divisão de foco entre a temporada atual e eras futuras.',
      relatedService: 'regulationService & CANONICAL_TECHNICAL_DOMAINS',
      relatedRoute: '/car',
      relatedRouteLabel: 'VER DESENVOLVIMENTO TÉCNICO',
      hasTeamContext: false,
    },
  ]
}

/**
 * Catálogo centralizado por temporada.
 * Season-aware: se a temporada solicitada for 2026, retorna as regras canônicas de 2026.
 * Se não houver rule set para o ano solicitado (ex: 2027 ainda não homologado), retorna array vazio.
 */
export const SEASON_REGULATIONS: Record<number, () => RegulationDefinition[]> = {
  2026: buildSeasonRegulations2026,
}

/**
 * Retorna todas as regras para a temporada especificada.
 */
export function getRegulationsForSeason(seasonYear: number): RegulationDefinition[] {
  const factory = SEASON_REGULATIONS[seasonYear]
  if (!factory) {
    return []
  }
  return factory()
}

/**
 * Normaliza termo de busca ignorando acentuação, maiúsculas/minúsculas e pontuação.
 */
export function normalizeSearchTerm(term: string): string {
  if (!term) return ''
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Filtra as regras por termo de busca em título, categoria, descrição, tags e texto técnico.
 */
export function searchRegulations(
  rules: RegulationDefinition[],
  query: string,
  categoryFilter?: RegulationCategoryId | 'all',
): RegulationDefinition[] {
  const normQuery = normalizeSearchTerm(query)

  return rules.filter((rule) => {
    if (categoryFilter && categoryFilter !== 'all' && rule.category !== categoryFilter) {
      return false
    }

    if (!normQuery) {
      return true
    }

    const normTitle = normalizeSearchTerm(rule.title)
    const normDesc = normalizeSearchTerm(rule.whatItDetermines)
    const normApex = normalizeSearchTerm(rule.apexExplanation)
    const normCat = normalizeSearchTerm(rule.category)
    const normDoc = normalizeSearchTerm(rule.sourceMetadata.documentTitle)

    // Tag match
    const hasTagMatch = rule.tags.some((tag) => normalizeSearchTerm(tag).includes(normQuery))

    // Match de palavras-chave especiais
    if (normQuery === 'rookie' || normQuery === 'novato') {
      return rule.category === 'novatos_tl1' || rule.category === 'licencas'
    }
    if (normQuery === 'pneu' || normQuery === 'pneus' || normQuery === 'tyre') {
      return rule.category === 'pneus'
    }
    if (normQuery === 'sc' || normQuery === 'safety car') {
      return rule.category === 'safety_car_vsc'
    }
    if (normQuery === 'bandeira vermelha' || normQuery === 'red flag') {
      return rule.category === 'bandeira_vermelha'
    }
    if (normQuery === 'pu' || normQuery === 'motor') {
      return rule.category === 'power_unit'
    }

    return (
      normTitle.includes(normQuery) ||
      normDesc.includes(normQuery) ||
      normApex.includes(normQuery) ||
      normCat.includes(normQuery) ||
      normDoc.includes(normQuery) ||
      hasTagMatch
    )
  })
}

/**
 * Função de auditoria do Centro de Regulamento.
 * Identifica:
 * - Regra sem sourceType válido
 * - Regra sem temporada
 * - Regra marcada como OFFICIAL_FIA sem metadados da FIA
 * - Regra de adaptação marcada incorretamente como oficial pura
 * - CTA apontando para rota não homologada
 * - Inconsistências de categoria
 */
export function auditRegulationCenter(seasonYear: number = 2026): RegulationAuditReport {
  const rules = getRegulationsForSeason(seasonYear)
  const issues: RegulationAuditIssue[] = []

  const rulesPerCategory: Record<RegulationCategoryId, number> = {
    fim_de_semana: 0,
    treinos_livres: 0,
    novatos_tl1: 0,
    qualificacao: 0,
    sprint: 0,
    corrida: 0,
    pneus: 0,
    power_unit: 0,
    parc_ferme: 0,
    safety_car_vsc: 0,
    bandeira_vermelha: 0,
    pontuacao: 0,
    grid_penalidades: 0,
    licencas: 0,
    campeonato: 0,
    regulamento_tecnico: 0,
  }

  const VALID_CATEGORIES = new Set<string>(REGULATION_CATEGORIES.map((c) => c.id))
  const VALID_SOURCE_TYPES = new Set(['OFFICIAL_FIA', 'APEX_ADAPTATION', 'GAME_MECHANIC'])
  const VALID_ROUTES = new Set([
    '/',
    '/calendario',
    '/corrida',
    '/race',
    '/standings',
    '/car',
    '/pilotos',
    '/infraestrutura',
    '/paddock',
    '/history',
    '/historico',
    '/sponsors',
  ])

  for (const rule of rules) {
    // 1. Contagem de categorias
    if (VALID_CATEGORIES.has(rule.category)) {
      rulesPerCategory[rule.category] = (rulesPerCategory[rule.category] || 0) + 1
    } else {
      issues.push({
        ruleId: rule.id,
        issue: `Categoria desconhecida: "${rule.category}"`,
        severity: 'ERROR',
      })
    }

    // 2. Validação de SourceType
    if (!VALID_SOURCE_TYPES.has(rule.sourceType)) {
      issues.push({
        ruleId: rule.id,
        issue: `sourceType inválido ou ausente: "${rule.sourceType}"`,
        severity: 'ERROR',
      })
    }

    // 3. Validação de Temporada
    if (!rule.season || typeof rule.season !== 'number') {
      issues.push({
        ruleId: rule.id,
        issue: `Temporada inválida ou ausente`,
        severity: 'ERROR',
      })
    }

    // 4. Validação de Metadados FIA
    if (rule.sourceType === 'OFFICIAL_FIA') {
      if (!rule.sourceMetadata || !rule.sourceMetadata.documentTitle) {
        issues.push({
          ruleId: rule.id,
          issue: `Regra marcada como OFFICIAL_FIA mas sem documentTitle válido`,
          severity: 'ERROR',
        })
      }
      if (rule.sourceMetadata && rule.sourceMetadata.authority !== 'FIA') {
        issues.push({
          ruleId: rule.id,
          issue: `Regra OFFICIAL_FIA deve conter authority='FIA' nos metadados`,
          severity: 'ERROR',
        })
      }
    }

    // 5. Validação de CTA / Related Route
    if (rule.relatedRoute && !VALID_ROUTES.has(rule.relatedRoute)) {
      issues.push({
        ruleId: rule.id,
        issue: `CTA aponta para rota desconhecida ou não registrada: "${rule.relatedRoute}"`,
        severity: 'WARNING',
      })
    }

    // 6. Textos obrigatórios dos 3 pilares
    if (!rule.whatItDetermines || rule.whatItDetermines.trim().length < 20) {
      issues.push({
        ruleId: rule.id,
        issue: `whatItDetermines ("O QUE DETERMINA") muito curto ou ausente`,
        severity: 'ERROR',
      })
    }
    if (!rule.apexExplanation || rule.apexExplanation.trim().length < 20) {
      issues.push({
        ruleId: rule.id,
        issue: `apexExplanation ("COMO FUNCIONA NO APEX") muito curto ou ausente`,
        severity: 'ERROR',
      })
    }
  }

  return {
    isValid: issues.filter((i) => i.severity === 'ERROR').length === 0,
    totalRules: rules.length,
    rulesPerCategory,
    issues,
    auditedAt: new Date().toISOString(),
  }
}

export const regulationCenterService = {
  getCategories: () => REGULATION_CATEGORIES,
  getRegulationsForSeason,
  getSeasonRegulationFramework,
  searchRegulations,
  auditRegulationCenter,
  normalizeSearchTerm,
}
