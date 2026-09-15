import {
  CanonicalFacilityId,
  FacilityDefinition,
  FacilityUpgradeCostSpec,
} from './canonical-facilities'

/**
 * Tabela Canônica de Upgrades e Custos (Fase 4A)
 * Escala Nível 1 a 5:
 * Nível 1: Básica (Oficina inicial, capacidade restrita)
 * Nível 2: Adequada (Sistemas padrão para o grid intermediário)
 * Nível 3: Competitiva (Instalações de alto rendimento)
 * Nível 4: Avançada (Tecnologia de ponta e clusters dedicados)
 * Nível 5: Estado da Arte (Referência mundial absoluta)
 *
 * Prazos em rodadas (1 temporada = 24 rodadas):
 * 1->2: 2 rodadas
 * 2->3: 3 rodadas
 * 3->4: 4 rodadas
 * 4->5: 5 rodadas
 */

export const STANDARD_UPGRADE_SPECS: Record<number, FacilityUpgradeCostSpec> = {
  2: {
    targetLevel: 2,
    capexCost: 8000000, // R$ 8.0M
    durationRounds: 2,
    opexAnnualIncrease: 1200000, // R$ 1.2M/ano
    subjectToCostCap: true,
  },
  3: {
    targetLevel: 3,
    capexCost: 16000000, // R$ 16.0M
    durationRounds: 3,
    opexAnnualIncrease: 2500000, // R$ 2.5M/ano
    subjectToCostCap: true,
  },
  4: {
    targetLevel: 4,
    capexCost: 28000000, // R$ 28.0M
    durationRounds: 4,
    opexAnnualIncrease: 4200000, // R$ 4.2M/ano
    subjectToCostCap: true,
  },
  5: {
    targetLevel: 5,
    capexCost: 45000000, // R$ 45.0M
    durationRounds: 5,
    opexAnnualIncrease: 7000000, // R$ 7.0M/ano
    subjectToCostCap: true,
  },
}

/**
 * Tabela com as 9 Instalações Canônicas
 */
export const CANONICAL_FACILITIES_DEFINITIONS: FacilityDefinition[] = [
  // 1. Factory
  {
    id: 'factory',
    teamField: 'factory_level',
    name: 'Fábrica & Sede Operacional',
    shortName: 'Fábrica HQ',
    subtitle: 'Estrutura Física, Coordenação Departamental & Throughput',
    description:
      'Instalação central de engenharia e operações. Determina a coordenação entre departamentos, velocidade de fluxo de trabalho (throughput), suporte a múltiplos projetos simultâneos e eficiência logística interna.',
    iconName: 'Building2',
    accentColor: '#E10600',
    levelLabels: [
      'Nível 1 — Galpão Básico de Montagem',
      'Nível 2 — Fábrica Integrada com Baías Dedicadas',
      'Nível 3 — Centro de Engenharia Multidepartamental',
      'Nível 4 — Complexo Tecnológico Automatizado',
      'Nível 5 — Supercampus Tecnológico Integrado',
    ],
    benefitsSummary: 'Aumenta throughput geral e eficiência operacional em até +35%.',
    primaryCapabilitiesText: 'Throughput de Desenvolvimento & Eficiência Operacional',
    effects: [
      {
        title: 'Coordenação Departamental',
        description: 'Sincronia entre aerodinâmica, dinâmica veicular e manufatura.',
        gameplayBonusDescription: 'Throughput de projetos acelerado sem sobrecarregar engenheiros.',
        formulaDetail: 'developmentThroughput base escala de 40 a 95',
      },
      {
        title: 'Logística & Suporte Simultâneo',
        description: 'Capacidade de tocar múltiplos programas sem atrito logístico.',
        gameplayBonusDescription: 'Reduz custo logístico e atrito interno entre equipes.',
        formulaDetail: 'operationalEfficiency escala de 38 a 92',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 4000000,
  },

  // 2. Design Centre
  {
    id: 'design_centre',
    teamField: 'design_centre_level',
    name: 'Centro de Design & Engenharia',
    shortName: 'Design Centre',
    subtitle: 'Gabinete de Projetos, CAD Avançado & Complexidade Conceitual',
    description:
      'Núcleo criativo e conceitual da escuderia. Determina a capacidade dos engenheiros de explorar novos conceitos, a velocidade do desenho de projetos (CAD) e a precisão das estimativas de ganho.',
    iconName: 'PencilRuler',
    accentColor: '#8B5CF6',
    levelLabels: [
      'Nível 1 — Pranchetas & Estações CAD Básicas',
      'Nível 2 — Escritório CAD 3D Paramétrico',
      'Nível 3 — Estúdio de Modelagem e Superfícies Classe A',
      'Nível 4 — Centro Integrado de Simulação e Design Generativo',
      'Nível 5 — Divisão de Design com IA & Gêmeo Digital',
    ],
    benefitsSummary: 'Eleva a capacidade e velocidade conceitual de projetos em até +40%.',
    primaryCapabilitiesText: 'Capacidade de Design & Qualidade de Estimativa',
    effects: [
      {
        title: 'Exploração Conceitual',
        description: 'Maior liberdade para criar geometrias ousadas e soluções inovadoras.',
        gameplayBonusDescription: 'Aumenta a margem de conceitos viáveis no desenvolvimento.',
        formulaDetail: 'designCapacity escala de 35 a 96',
      },
      {
        title: 'Rigor de Estimativa de Projeto',
        description: 'Reduz a discrepância entre o ganho previsto e o projeto concebido.',
        gameplayBonusDescription: 'Projetos mais previsíveis antes de irem para validação.',
        formulaDetail: 'Precisão projetual de 65% a 95%',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 3500000,
  },

  // 3. CFD (Computational Fluid Dynamics)
  {
    id: 'cfd',
    teamField: 'cfd_level',
    name: 'Cluster de CFD (Supercomputação)',
    shortName: 'Cluster CFD',
    subtitle: 'Simulação Virtual de Escoamento Aerodinâmico em Alta Fidelidade',
    description:
      'Supercomputador de alta densidade para simulações aerodinâmicas numéricas Navier-Stokes. Avalia centenas de variações de peças virtualmente com alta velocidade antes de construir maquetes físicas.',
    iconName: 'Cpu',
    accentColor: '#06B6D4',
    levelLabels: [
      'Nível 1 — Servidores Básicos de Baixa Resolução',
      'Nível 2 — Cluster Multi-Nó para Malhas Médias',
      'Nível 3 — Supercomputador Dedicado com Malhas Densas',
      'Nível 4 — Cluster com Aceleração por GPU e Alta Precisão',
      'Nível 5 — Supercluster Petaflop de Alta Fidelidade',
    ],
    benefitsSummary: 'Precisão e volume de simulações virtuais ampliados em até +38%.',
    primaryCapabilitiesText: 'Precisão de Simulação CFD & Exploração Virtual',
    effects: [
      {
        title: 'Resolução da Malha Aerodinâmica',
        description: 'Capacidade de identificar vórtices complexos e esteiras turbulentas.',
        gameplayBonusDescription: 'Maior confiança nos dados gerados em ambiente computacional.',
        formulaDetail: 'simulationAccuracy escala de 35 a 94',
      },
      {
        title: 'Throughput Virtual de Conceitos',
        description: 'Avaliação rápida de múltiplos perfis de asa e assoalho em paralelo.',
        gameplayBonusDescription: 'Filtra conceitos fracos antes de gastar recursos de túnel.',
        formulaDetail: 'Suporte a simulações simultâneas',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 5000000,
  },

  // 4. Wind Tunnel
  {
    id: 'wind_tunnel',
    teamField: 'wind_tunnel_level',
    name: 'Túnel de Vento (Escala 60%)',
    shortName: 'Túnel de Vento',
    subtitle: 'Validação Aerodinâmica Física, Correlação & Redução de Incerteza',
    description:
      'Túnel de vento com esteira rolante (rolling road) homologado pela FIA. Valida fisicamente se o fluxo aerodinâmico previsto no CFD realmente se confirma na prática, eliminando desvios e correlações ilusórias.',
    iconName: 'Wind',
    accentColor: '#3B82F6',
    levelLabels: [
      'Nível 1 — Túnel Convencional Antigo (Correlação Fraca)',
      'Nível 2 — Esteira Rolante Básica com Balança Mecânica',
      'Nível 3 — Túnel 60% Moderno com Sistema de PIV Laser',
      'Nível 4 — Esteira de Alta Precisão & Sensores de Pressão Contínua',
      'Nível 5 — Túnel de Estado da Arte com Calibração Dinâmica Máxima',
    ],
    benefitsSummary: 'Correlação aerodinâmica túnel-pista elevada em até +45%.',
    primaryCapabilitiesText: 'Correlação Aerodinâmica & Confiança de Projeto',
    effects: [
      {
        title: 'Correlação Real vs Virtual',
        description: 'Garante que downforce e arrasto vistos no projeto existam na pista.',
        gameplayBonusDescription: 'Minimiza o risco de introduzir peças que gerem instabilidade.',
        formulaDetail: 'aeroCorrelation escala de 30 a 95',
      },
      {
        title: 'Detecção de Conceitos Fracos',
        description: 'Diagnostica stalls aerodinâmicos e separação de fluxo indesejada.',
        gameplayBonusDescription: 'Evita a fabricação de componentes fisicamente ineficientes.',
        formulaDetail: 'Redução de incerteza técnica',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 7000000,
  },

  // 5. Manufacturing
  {
    id: 'manufacturing',
    teamField: 'manufacturing_level',
    name: 'Centro de Manufatura & Compósitos',
    shortName: 'Manufatura',
    subtitle: 'Elo Design -> Physical Part: Autoclaves, Usinagem & Qualidade Física',
    description:
      'Estrutura industrial que converte desenhos e specs em peças físicas reais. Determina o tempo de fabricação, o custo de produção, a qualidade dos materiais e o índice de defeitos estruturais.',
    iconName: 'Factory',
    accentColor: '#F97316',
    levelLabels: [
      'Nível 1 — Oficina Terceirizada (Prazos Longos, Tolerância Ampla)',
      'Nível 2 — Maquinário CNC Interno & Autoclave Convencional',
      'Nível 3 — Usinagem de 5 Eixos & Laminação de Carbono de Precisão',
      'Nível 4 — Manufatura Aditiva de Titânio & Controle Ultrassônico',
      'Nível 5 — Fábrica 4.0 Automatizada com Tolerâncias Aeroespaciais',
    ],
    benefitsSummary: 'Acelera fabricação física em até +40% e reduz risco de defeitos.',
    primaryCapabilitiesText: 'Capacidade & Qualidade de Fabricação Física',
    effects: [
      {
        title: 'Velocidade de Fabricação (Throughput Físico)',
        description: 'Rapidez para produzir lotes de peças e enviar atualizações à pista.',
        gameplayBonusDescription: 'Peças novas saem da prancheta e chegam à pista em menos tempo.',
        formulaDetail: 'manufacturingCapacity escala de 30 a 96',
      },
      {
        title: 'Qualidade Estrutural & Tolerâncias',
        description: 'Peças mais leves, rígidas e resistentes à fadiga mecânica.',
        gameplayBonusDescription: 'Reduz risco de falha estrutural e retrabalho na oficina.',
        formulaDetail: 'manufacturingQuality escala de 40 a 98',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 4500000,
  },

  // 6. Simulator
  {
    id: 'simulator',
    teamField: 'simulator_level',
    name: 'Simulador Dinâmico de Pilotos (6-DOF)',
    shortName: 'Simulador',
    subtitle: 'Gêmeo Digital, Preparação de Setup, Pilotos & Treinamento de Jovens',
    description:
      'Plataforma cinemática hexápode com cockpit real e telemetria sincronizada. Prepara setup para cada GP, adapta pilotos a pistas desafiadoras, atenua fadiga e serve como laboratório para jovens da Academia.',
    iconName: 'Monitor',
    accentColor: '#38BDF8',
    levelLabels: [
      'Nível 1 — Simulador Estático com Monitores Convencionais',
      'Nível 2 — Plataforma com Force Feedback e Modelos Básicos',
      'Nível 3 — Movimento 6 Graus de Liberdade e Dados LiDAR',
      'Nível 4 — Sala Imersiva 360° com Modelo de Pneu Térmico Avançado',
      'Nível 5 — Gêmeo Digital F1 Completo com Correlação Dinâmica Perfeita',
    ],
    benefitsSummary: 'Melhora preparação de setup, adaptação e atenua desgaste físico.',
    primaryCapabilitiesText: 'Preparação de Pista, Setup & Adaptação de Pilotos',
    effects: [
      {
        title: 'Adaptação de Pilotos & Jovens',
        description: 'Permite que titulares e novatos da Academia dominem os 24 circuitos.',
        gameplayBonusDescription: 'Acelera aclimatação e confiança em circuitos desconhecidos.',
        formulaDetail: 'academySupportQuality + amortecimento de fadiga',
      },
      {
        title: 'Otimização Prévia de Setup',
        description: 'Carro chega à sexta-feira de treinos com acerto mais refinado.',
        gameplayBonusDescription:
          'Aumenta precisão do pacote nas primeiras voltas do fim de semana.',
        formulaDetail: 'Validação de dados de telemetria',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 3000000,
  },

  // 7. Operations Centre
  {
    id: 'operations_centre',
    teamField: 'operations_centre_level',
    name: 'Centro de Operações de Corrida (Remote Pit Wall)',
    shortName: 'Centro de Operações',
    subtitle: 'Sala de Estratégia Remota, Análise de Dados em Tempo Real & Suporte ao Box',
    description:
      'Sala de controle na sede ligada diretamente ao pit wall no autódromo por link de fibra dedicado. Analisa telemetria de rivais, degradação climática, modelos preditivos e cenários de Safety Car.',
    iconName: 'Radio',
    accentColor: '#EC4899',
    levelLabels: [
      'Nível 1 — Suporte Remoto Básico via Rádio e Dados Convencionais',
      'Nível 2 — Sala Dedicada de Análise de Telemetria com Telas Múltiplas',
      'Nível 3 — Centro de Modelagem Preditiva com Links de Baixa Latência',
      'Nível 4 — Sala Tática Integrada com Modelos de Ritmo dos Rivais',
      'Nível 5 — Centro de Comando Neural com Machine Learning de Estratégia',
    ],
    benefitsSummary: 'Refina precisão estratégica e capacidade de resposta tática no domingo.',
    primaryCapabilitiesText: 'Qualidade de Dados de Pit Wall & Resposta Operacional',
    effects: [
      {
        title: 'Inteligência Estratégica em Tempo Real',
        description: 'Leitura rápida de janelas de tráfego, overcut/undercut e janelas de chuva.',
        gameplayBonusDescription: 'Melhora reação a bandeiras amarelas e momentos imprevisíveis.',
        formulaDetail: 'raceOperationsCapability escala de 35 a 95',
      },
      {
        title: 'Coordenação de Pista e Fábrica',
        description: 'Comunicação limpa sem atrasos entre engenharia e mecânicos.',
        gameplayBonusDescription: 'Reduz decisões confusas e estresse de rádio durante a prova.',
        formulaDetail: 'Sinergia direta com raceManagement do Manager',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 3200000,
  },

  // 8. Pit Crew Centre
  {
    id: 'pitstop_center',
    teamField: 'pitstop_center_level',
    name: 'Centro de Treinamento de Pit Stop',
    shortName: 'Centro de Pit Stop',
    subtitle: 'Bancada de Ensaios, Pistolas Pneumáticas, Biomecânica & Repetição',
    description:
      'Gantry de treinamento físico com semáforos eletrônicos de liberação rápida, câmeras de alta velocidade e pistolas de troca rápida de porca única. Lapida a consistência mecânica e diminui o risco de falhas nos boxes.',
    iconName: 'Gauge',
    accentColor: '#F59E0B',
    levelLabels: [
      'Nível 1 — Treino Amador em Estacionamento',
      'Nível 2 — Pistolas Pneumáticas Homologadas & Marcações de Box',
      'Nível 3 — Gantry Completo com Sistema de Luzes Automatizado',
      'Nível 4 — Biomecânica dos Mecânicos & Análise em 1000fps',
      'Nível 5 — Esquadrão Relâmpago Sub-2.0s com Automação de Liberação',
    ],
    benefitsSummary: 'Reduz tempo médio de parada e diminui drasticamente chance de erro humano.',
    primaryCapabilitiesText: 'Velocidade & Consistência de Parada nos Boxes',
    effects: [
      {
        title: 'Velocidade Média de Parada',
        description: 'Mecânicos treinados operam no limite físico do regulamento.',
        gameplayBonusDescription: 'Paradas mais curtas em até -0.40s com relação ao Nível 1.',
        formulaDetail: 'pitCrewPerformance escala de 40 a 95',
      },
      {
        title: 'Segurança & Redução de Falhas',
        description: 'Minimiza risco de porca encavalar ou problema de macaco dianteiro.',
        gameplayBonusDescription: 'Queda na frequência de pit stops desastrosos na corrida.',
        formulaDetail: 'Taxa de erro cai para patamares mínimos',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 2000000,
  },

  // 9. Youth Academy
  {
    id: 'youth_academy',
    teamField: 'youth_academy_level',
    name: 'Academia de Pilotos & Scouting',
    shortName: 'Academia de Pilotos',
    subtitle: 'Rede Global de Olheiros, Rastreamento júnior & Programa de Desenvolvimento',
    description:
      'Estrutura institucional de identificação, avaliação e formação de talentos de base. Sustenta o scouting global (F2, F3, FRECA, Kart), melhora a precisão na leitura do verdadeiro potencial dos jovens e garante suporte ao desenvolvimento.',
    iconName: 'GraduationCap',
    accentColor: '#10B981',
    levelLabels: [
      'Nível 1 — Olheiro Local & Observação Ocasional',
      'Nível 2 — Parceria com Equipe de Base & Rede Regional',
      'Nível 3 — Programa Júnior Estruturado com Scouting Internacional',
      'Nível 4 — Centro de Alto Rendimento com Rede Continental de Olheiros',
      'Nível 5 — Academia de Elite Global de Campeões',
    ],
    benefitsSummary: 'Amplia alcance de scouting, precisão de avaliação e retenção de jovens.',
    primaryCapabilitiesText: 'Scouting Global, Avaliação de Potencial & Lapidação',
    effects: [
      {
        title: 'Alcance & Profundidade de Scouting',
        description: 'Detecta mais jovens promissores em categorias inferiores ao redor do mundo.',
        gameplayBonusDescription: 'Mais candidatos identificados por temporada na base de dados.',
        formulaDetail: 'scoutingReach escala de 30 a 96',
      },
      {
        title: 'Precisão na Avaliação de Potencial',
        description:
          'Enxerga com maior clareza o teto real do piloto (diminui ruído de avaliação).',
        gameplayBonusDescription: 'Menor risco de superestimar ou subestimar futuros craques.',
        formulaDetail: 'evaluationAccuracy escala de 40 a 95',
      },
      {
        title: 'Capacidade de Lapidação e Suporte',
        description: 'Treinamento atlético, psicológico e técnico para jovens do programa.',
        gameplayBonusDescription:
          'Acelera evolução de atributos após o piloto ingressar na equipe.',
        formulaDetail: 'talentDevelopmentCapacity escala de 35 a 94',
      },
    ],
    upgrades: STANDARD_UPGRADE_SPECS,
    baseAnnualOpex: 2800000,
  },
]
