export type FacilityType = 'factory' | 'simulator' | 'pitstop_center' | 'youth_academy'

export interface FacilityDefinition {
  id: FacilityType
  teamField: 'factory_level' | 'simulator_level' | 'pitstop_center_level' | 'youth_academy_level'
  name: string
  subtitle: string
  description: string
  iconName: 'Building2' | 'Cpu' | 'Gauge' | 'GraduationCap'
  accentColor: string
  levelLabels: [string, string, string, string, string]
  benefitsSummary: string
  effects: {
    title: string
    description: string
    gameplayBonusDescription: string
    formulaDetail: string
  }[]
}

export const FACILITY_UPGRADE_COSTS: Record<number, number> = {
  // Custo para atingir cada nível (2, 3, 4, 5)
  2: 8000000, // R$ 8.0M
  3: 16000000, // R$ 16.0M
  4: 28000000, // R$ 28.0M
  5: 45000000, // R$ 45.0M
}

export const FACILITIES_DEFINITIONS: FacilityDefinition[] = [
  {
    id: 'factory',
    teamField: 'factory_level',
    name: 'Fábrica de Engenharia & P&D',
    subtitle: 'Automação, CFD & Manufatura de Peças',
    description:
      'Infraestrutura central de usinagem CNC de precisão, autoclaves de compósitos de fibra de carbono e túnel de vento. Aumenta a velocidade de desenvolvimento e barateia o custo de produção de novas peças.',
    iconName: 'Building2',
    accentColor: '#E10600',
    levelLabels: [
      'Nível 1 — Oficina Básica',
      'Nível 2 — Maquinário CNC Avançado',
      'Nível 3 — Autoclave & Túnel de Vento 60%',
      'Nível 4 — Manufatura Aditiva & CFD Dedicado',
      'Nível 5 — Supercentro de Alta Tecnologia',
    ],
    benefitsSummary: '-3% a -15% no custo de desenvolvimento e reparo de peças.',
    effects: [
      {
        title: 'Redução de Custos de P&D',
        description: 'Desconto escalonado no valor exigido para evoluir as 6 peças do monoposto.',
        gameplayBonusDescription: 'Economia de 3% por nível acima do Nível 1 (até -12% a -15%).',
        formulaDetail: 'Desconto = (Nível - 1) * 3% no custo de aprimoramento de peças',
      },
      {
        title: 'Eficiência de Oficina & Reparos',
        description:
          'Processos automatizados barateiam o custo de revisão por ultrassom das peças desgastadas.',
        gameplayBonusDescription: 'Redução de até 15% nos custos de manutenção e reparo.',
        formulaDetail: 'Desconto = (Nível - 1) * 3% no reparo de peças na oficina',
      },
    ],
  },
  {
    id: 'simulator',
    teamField: 'simulator_level',
    name: 'Simulador Dinâmico de Pilotos',
    subtitle: 'Cockpit 6-DOF, Telemetria & Preparação Psicológica',
    description:
      'Simulador cinemático hexápode com renderização em tempo real das pistas do calendário e banco de dados de telemetria. Prepara os pilotos, reduz o cansaço mental e atenua o estresse de corrida.',
    iconName: 'Cpu',
    accentColor: '#38BDF8',
    levelLabels: [
      'Nível 1 — Simulador Estático',
      'Nível 2 — Plataforma com Force Feedback',
      'Nível 3 — Movimento 6 Graus de Liberdade',
      'Nível 4 — Sala Imersiva 360° & Dados LiDAR',
      'Nível 5 — Gêmeo Digital F1 de Ponta',
    ],
    benefitsSummary:
      'Atenua fadiga física pós-GP em até +3% e melhora moral dos pilotos em até +3 pts.',
    effects: [
      {
        title: 'Atenuação de Fadiga & Condição Física',
        description:
          'Pilotos chegam mais preparados aos GPs, sofrendo menor desgaste físico sustentado.',
        gameplayBonusDescription:
          'Reduz o custo físico por corrida em até 2% e melhora recuperação entre rodadas.',
        formulaDetail: 'Amortecimento de fadiga = +(Nível - 1) * 0.5% por GP',
      },
      {
        title: 'Moral e Estabilidade Psicológica',
        description:
          'Menos erros por frustração e recuperação anímica acelerada após corridas difíceis.',
        gameplayBonusDescription: 'Bônus passivo de moral de até +3 pontos ao término dos GPs.',
        formulaDetail: 'Bônus de moral = +Math.floor((Nível - 1) * 0.75) pts pós-corrida',
      },
    ],
  },
  {
    id: 'pitstop_center',
    teamField: 'pitstop_center_level',
    name: 'Centro de Testes de Pit Stop',
    subtitle: 'Pistolas Pneumáticas, Gantry & Treinamento de Mecânicos',
    description:
      'Bancada de treino estático e mock-up de pit lane com semáforos eletrônicos de liberação rápida, câmeras de alta velocidade e pistolas de troca rápida de porca de roda única.',
    iconName: 'Gauge',
    accentColor: '#F59E0B',
    levelLabels: [
      'Nível 1 — Treino de Box Amador',
      'Nível 2 — Pistolas Pneumáticas Homologadas',
      'Nível 3 — Sistema de Luzes de Saída Automatizado',
      'Nível 4 — Biomecânica & Análise de Vídeo 1000fps',
      'Nível 5 — Esquadrão Relâmpago Sub-2.0s',
    ],
    benefitsSummary:
      'Reduz o tempo de parada nos boxes em 0,05s a 0,15s por nível e diminui risco de erro.',
    effects: [
      {
        title: 'Tempo de Parada Líquida Reduzido',
        description:
          'Garante trocas mais rápidas e consistentes nas paradas de box em bandeira verde ou Safety Car.',
        gameplayBonusDescription:
          'Ganho conservador de 0,05s a 0,15s por nível (até -0,40s no Nível 5).',
        formulaDetail: 'Delta pit stop = -((Nível - 1) * 0.10s) na duração de box',
      },
      {
        title: 'Confiabilidade e Redução de Falhas',
        description:
          'Menor probabilidade de porca encavalar ou falha no macaco dianteiro durante a prova.',
        gameplayBonusDescription:
          'Queda na taxa de pit stops lentos ou travamentos mecânicos nos boxes.',
        formulaDetail: 'Taxa de erro cai de 7% base para até 3.5% no Nível 5',
      },
    ],
  },
  {
    id: 'youth_academy',
    teamField: 'youth_academy_level',
    name: 'Academia de Jovens Pilotos',
    subtitle: 'Scouting Global, Karting & Fórmula de Acesso',
    description:
      'Programa de desenvolvimento de jovens talentos em categorias júnior (F2, F3, FRECA e Kart). Garante prospectos de alto potencial contratáveis no mercado a cada ciclo de corridas.',
    iconName: 'GraduationCap',
    accentColor: '#10B981',
    levelLabels: [
      'Nível 1 — Observador Local',
      'Nível 2 — Parceria com Equipe de F2/F3',
      'Nível 3 — Programa Júnior Estruturado',
      'Nível 4 — Centro de Alto Rendimento de Jovens',
      'Nível 5 — Academia de Elite de Campeões',
    ],
    benefitsSummary: 'Gera novos prospectos jovens no mercado de pilotos a cada 3 a 4 rodadas.',
    effects: [
      {
        title: 'Geração Contínua de Prospectos',
        description:
          'Novas promessas de 17 a 21 anos são descobertas e listadas com salários competitivos.',
        gameplayBonusDescription:
          'Gera jovens promessas com notas calibradas de acordo com o nível da academia.',
        formulaDetail: 'A cada 3 rodadas gera 1 a 2 novos prospectos no mercado livre / F2',
      },
      {
        title: 'Potencial de Habilidade Inicial',
        description:
          'Treinamento de base entrega pilotos novatos mais lapidados em velocidade e chuva.',
        gameplayBonusDescription:
          'Prospectos do Nível 5 chegam com rating entre 78 e 84 (prontos para F1).',
        formulaDetail: 'Atributos base dos jovens = 70 + (Nível * 2.5)',
      },
    ],
  },
]
