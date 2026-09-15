/**
 * Mapeamento Canônico de Atributos do Manager para Domínios Funcionais
 * F1 Manager 2026 — Implementação Nº 3
 *
 * Princípios Arquiteturais:
 * 1. O Manager NÃO gera velocidade direta nem altera atributos de downforce, chassi ou carPerformanceRating.
 * 2. Os 28 atributos existentes em manager-profiles.ts são mapeados estritamente para 6 domínios canônicos.
 * 3. Cada atributo possui exatamente 1 domínio primário (peso alto: ex. 0.7 - 1.0) e no máximo 1 domínio secundário (peso menor: ex. 0.2 - 0.3).
 * 4. Regra Anti-Duplicação: Sistemas leem os domínios derivados consolidados através do ManagerEffectService,
 *    nunca lendo atributos brutos diretamente para evitar stacking e dupla aplicação.
 */

export type ManagerDomainId =
  | 'raceManagement'
  | 'technicalManagement'
  | 'peopleManagement'
  | 'commercialManagement'
  | 'politicalManagement'
  | 'talentDevelopment'

export interface ManagerDomainMeta {
  id: ManagerDomainId
  name: string
  description: string
  color: string
  iconName: string
}

export const MANAGER_DOMAINS: Record<ManagerDomainId, ManagerDomainMeta> = {
  raceManagement: {
    id: 'raceManagement',
    name: 'Gestão de Corrida',
    description:
      'Estratégia de pista, janelas de pit stop, leitura de Safety Car e gestão de risco tático.',
    color: '#F59E0B', // Amber
    iconName: 'Timer',
  },
  technicalManagement: {
    id: 'technicalManagement',
    name: 'Gestão Técnica',
    description:
      'Eficiência de desenvolvimento, confiabilidade em oficina, precisão e diagnóstico de peças.',
    color: '#06B6D4', // Cyan
    iconName: 'Wrench',
  },
  peopleManagement: {
    id: 'peopleManagement',
    name: 'Gestão de Pessoas',
    description:
      'Moral do time e pilotos, resiliência emocional, mitigação de crise e satisfação interna.',
    color: '#10B981', // Emerald
    iconName: 'Users',
  },
  commercialManagement: {
    id: 'commercialManagement',
    name: 'Gestão Comercial',
    description:
      'Captação de patrocinadores, valor comercial da equipe e eficiência em negociação de receitas.',
    color: '#8B5CF6', // Purple
    iconName: 'DollarSign',
  },
  politicalManagement: {
    id: 'politicalManagement',
    name: 'Gestão Política',
    description:
      'Confiança institucional com diretoria, influência no paddock FIA e negociações institucionais.',
    color: '#3B82F6', // Blue
    iconName: 'ShieldAlert',
  },
  talentDevelopment: {
    id: 'talentDevelopment',
    name: 'Desenvolvimento de Talentos',
    description:
      'Evolução na Academia, velocidade de adaptação, aproveitamento de testes e lapidação de jovens.',
    color: '#EC4899', // Pink
    iconName: 'Sparkles',
  },
}

export interface AttributeDomainMapping {
  attributeKey: string
  label: string
  primaryDomain: ManagerDomainId
  primaryWeight: number // Peso de 0.0 a 1.0 (soma normalizada)
  secondaryDomain?: ManagerDomainId
  secondaryWeight?: number // Peso secundário (máx 0.35)
  rationale: string
  isAmbiguousOrInverted?: boolean
  notes?: string
}

/**
 * Mapeamento dos 28 Atributos Canônicos existentes:
 * - lideranca
 * - gestao_pessoas
 * - gestao_pilotos
 * - visao_estrategica
 * - tomada_decisao
 * - gestao_corrida
 * - conhecimento_tecnico
 * - desenvolvimento_carro
 * - gestao_projeto
 * - gestao_financeira
 * - negociacao
 * - captacao_comercial
 * - influencia_politica
 * - reputacao
 * - desenvolvimento_talentos
 * - gestao_crise
 * - comunicacao
 * - pressao
 * - adaptabilidade
 * - organizacao
 * - disciplina
 * - inovacao
 * - agressividade_gerencial
 * - lealdade
 * - ambicao
 * - ego
 * - temperamento
 * - espirito_equipe
 * - resiliencia
 * (Obs: Há 29 chaves na tabela de manager-profiles.ts, todas tratadas sem omissão)
 */
export const MANAGER_ATTRIBUTE_DOMAIN_MAP: Record<string, AttributeDomainMapping> = {
  // 1. Liderança
  lideranca: {
    attributeKey: 'lideranca',
    label: 'Liderança',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.3,
    rationale: 'Inspirar a equipe e manter coesão frente à diretoria e conselho.',
  },
  // 2. Gestão de Pessoas
  gestao_pessoas: {
    attributeKey: 'gestao_pessoas',
    label: 'Gestão de Pessoas',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.8,
    secondaryDomain: 'talentDevelopment',
    secondaryWeight: 0.2,
    rationale: 'Clima organizacional e retenção de engenheiros e mecânicos.',
  },
  // 3. Gestão de Pilotos
  gestao_pilotos: {
    attributeKey: 'gestao_pilotos',
    label: 'Gestão de Pilotos',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.65,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.35,
    rationale: 'Mediação de atritos de cockpit e alinhamento tático de domingo.',
  },
  // 4. Visão Estratégica
  visao_estrategica: {
    attributeKey: 'visao_estrategica',
    label: 'Visão Estratégica',
    primaryDomain: 'raceManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'technicalManagement',
    secondaryWeight: 0.3,
    rationale: 'Planejamento antecipado de corrida e direcionamento do carro ao longo do ano.',
  },
  // 5. Tomada de Decisão
  tomada_decisao: {
    attributeKey: 'tomada_decisao',
    label: 'Tomada de Decisão',
    primaryDomain: 'raceManagement',
    primaryWeight: 0.75,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.25,
    rationale: 'Decisão rápida no pit wall sob chuva e bandeira amarela.',
  },
  // 6. Gestão de Corrida
  gestao_corrida: {
    attributeKey: 'gestao_corrida',
    label: 'Gestão de Corrida',
    primaryDomain: 'raceManagement',
    primaryWeight: 0.85,
    secondaryDomain: 'peopleManagement',
    secondaryWeight: 0.15,
    rationale: 'Execução do plano de prova e comandos de pit stop no domingo.',
  },
  // 7. Conhecimento Técnico
  conhecimento_tecnico: {
    attributeKey: 'conhecimento_tecnico',
    label: 'Conhecimento Técnico',
    primaryDomain: 'technicalManagement',
    primaryWeight: 0.8,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.2,
    rationale: 'Compreensão de telemetria, setup e feedback de engenharia de pista.',
  },
  // 8. Desenvolvimento do Carro
  desenvolvimento_carro: {
    attributeKey: 'desenvolvimento_carro',
    label: 'Desenvolvimento do Carro',
    primaryDomain: 'technicalManagement',
    primaryWeight: 0.85,
    secondaryDomain: 'commercialManagement',
    secondaryWeight: 0.15,
    rationale: 'Eficiência no cronograma de upgrades e otimização do teto em P&D.',
  },
  // 9. Gestão de Projeto
  gestao_projeto: {
    attributeKey: 'gestao_projeto',
    label: 'Gestão de Projeto',
    primaryDomain: 'technicalManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'peopleManagement',
    secondaryWeight: 0.3,
    rationale: 'Entrega de revisões estruturais no prazo sem retrabalho na fábrica.',
  },
  // 10. Gestão Financeira
  gestao_financeira: {
    attributeKey: 'gestao_financeira',
    label: 'Gestão Financeira',
    primaryDomain: 'commercialManagement',
    primaryWeight: 0.75,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.25,
    rationale: 'Planejamento de fluxo de caixa e respeito ao teto de gastos.',
  },
  // 11. Negociação
  negociacao: {
    attributeKey: 'negociacao',
    label: 'Negociação',
    primaryDomain: 'commercialManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.3,
    rationale: 'Flexibilidade de margem em cotas de patrocínio e contratos.',
  },
  // 12. Captação Comercial
  captacao_comercial: {
    attributeKey: 'captacao_comercial',
    label: 'Captação Comercial',
    primaryDomain: 'commercialManagement',
    primaryWeight: 0.85,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.15,
    rationale: 'Atratividade das marcas multinacionais para o monoposto.',
  },
  // 13. Influência Política
  influencia_politica: {
    attributeKey: 'influencia_politica',
    label: 'Influência Política',
    primaryDomain: 'politicalManagement',
    primaryWeight: 0.85,
    secondaryDomain: 'commercialManagement',
    secondaryWeight: 0.15,
    rationale: 'Peso institucional junto à FIA, paddock e reuniões do conselho.',
  },
  // 14. Reputação
  reputacao: {
    attributeKey: 'reputacao',
    label: 'Reputação',
    primaryDomain: 'politicalManagement',
    primaryWeight: 0.6,
    secondaryDomain: 'commercialManagement',
    secondaryWeight: 0.4,
    rationale: 'Credibilidade pública no paddock e facilitação de parcerias de peso.',
  },
  // 15. Desenvolvimento de Talentos
  desenvolvimento_talentos: {
    attributeKey: 'desenvolvimento_talentos',
    label: 'Desenvolvimento de Talentos',
    primaryDomain: 'talentDevelopment',
    primaryWeight: 0.85,
    secondaryDomain: 'peopleManagement',
    secondaryWeight: 0.15,
    rationale: 'Olhar clínico para novos pilotos da Academia e sua aceleração de testes.',
  },
  // 16. Gestão de Crise
  gestao_crise: {
    attributeKey: 'gestao_crise',
    label: 'Gestão de Crise',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.65,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.35,
    rationale: 'Recuperação emocional após abandono, erro de box ou fim de semana desastroso.',
  },
  // 17. Comunicação
  comunicacao: {
    attributeKey: 'comunicacao',
    label: 'Comunicação',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.6,
    secondaryDomain: 'commercialManagement',
    secondaryWeight: 0.4,
    rationale: 'Clareza no rádio interno e projeção da marca nos pronunciamentos da escuderia.',
  },
  // 18. Pressão (Resistência sob Pressão)
  pressao: {
    attributeKey: 'pressao',
    label: 'Pressão (Resistência)',
    primaryDomain: 'raceManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'peopleManagement',
    secondaryWeight: 0.3,
    rationale: 'Estabilidade emocional em finais de prova apertados e momentos tensos.',
  },
  // 19. Adaptabilidade
  adaptabilidade: {
    attributeKey: 'adaptabilidade',
    label: 'Adaptabilidade',
    primaryDomain: 'raceManagement',
    primaryWeight: 0.6,
    secondaryDomain: 'technicalManagement',
    secondaryWeight: 0.4,
    rationale: 'Capacidade de reagir a clima mutável e revisões técnicas inesperadas.',
  },
  // 20. Organização
  organizacao: {
    attributeKey: 'organizacao',
    label: 'Organização',
    primaryDomain: 'technicalManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'peopleManagement',
    secondaryWeight: 0.3,
    rationale: 'Ordem de processos na garagem e planejamento operacional dos mecânicos.',
  },
  // 21. Disciplina
  disciplina: {
    attributeKey: 'disciplina',
    label: 'Disciplina',
    primaryDomain: 'technicalManagement',
    primaryWeight: 0.6,
    secondaryDomain: 'talentDevelopment',
    secondaryWeight: 0.4,
    rationale: 'Rigor metódico em testes de pista e execução cirúrgica de protocolos.',
  },
  // 22. Inovação
  inovacao: {
    attributeKey: 'inovacao',
    label: 'Inovação',
    primaryDomain: 'technicalManagement',
    primaryWeight: 0.75,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.25,
    rationale: 'Busca por soluções audaciosas de engenharia e caminhos táticos alternativos.',
  },
  // 23. Agressividade Gerencial
  agressividade_gerencial: {
    attributeKey: 'agressividade_gerencial',
    label: 'Agressividade Gerencial',
    primaryDomain: 'politicalManagement',
    primaryWeight: 0.6,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.4,
    rationale: 'Postura combativa nas disputas desportivas e tolerância a risco tático.',
    notes:
      'Agressividade alta melhora respostas ousadas em corrida, mas pode aumentar fricção interna se mal dosada.',
  },
  // 24. Lealdade
  lealdade: {
    attributeKey: 'lealdade',
    label: 'Lealdade',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.75,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.25,
    rationale: 'Compromisso com o projeto da equipe e valorização dos profissionais internos.',
  },
  // 25. Ambição
  ambicao: {
    attributeKey: 'ambicao',
    label: 'Ambição',
    primaryDomain: 'commercialManagement',
    primaryWeight: 0.6,
    secondaryDomain: 'politicalManagement',
    secondaryWeight: 0.4,
    rationale: 'Desejo ardente de vitórias e atração de investimento ambicioso.',
  },
  // 26. Ego
  // NOTA CRÍTICA DO REGULAMENTO: Ego alto tradicionalmente é gerador de atrito.
  // No cálculo, quanto maior o ego, MENOR a contribuição harmoniosa em peopleManagement,
  // ou funciona como fator de pressão competitiva individual.
  ego: {
    attributeKey: 'ego',
    label: 'Ego (Autonomia / Centralização)',
    primaryDomain: 'politicalManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'peopleManagement',
    secondaryWeight: 0.3,
    rationale:
      'Autoafirmação de autoridade. No domínio de pessoas, ego excessivo exige temperamento para não desgastar o ambiente.',
    isAmbiguousOrInverted: true,
    notes:
      'Tratado de forma equilibrada: valores equilibrados (40-60) representam liderança segura; valores extremos exigem trade-off.',
  },
  // 27. Temperamento
  temperamento: {
    attributeKey: 'temperamento',
    label: 'Temperamento (Equilíbrio Emocional)',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.7,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.3,
    rationale:
      'Frieza e serenidade para amortecer conflitos internos e não tomar decisões precipitadas.',
  },
  // 28. Espírito de Equipe
  espirito_equipe: {
    attributeKey: 'espirito_equipe',
    label: 'Espírito de Equipe',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.75,
    secondaryDomain: 'talentDevelopment',
    secondaryWeight: 0.25,
    rationale: 'Integração entre fábrica, departamento de pista e jovens da Academia.',
  },
  // 29. Resiliência
  resiliencia: {
    attributeKey: 'resiliencia',
    label: 'Resiliência',
    primaryDomain: 'peopleManagement',
    primaryWeight: 0.65,
    secondaryDomain: 'raceManagement',
    secondaryWeight: 0.35,
    rationale: 'Capacidade de suportar sequências de derrotas ou contratempos sem esmorecer.',
  },
}

/**
 * Análise de Duplicidades e Ambiguidade Conceitual (Conforme Requisito 2 e Regra Final do Prompt):
 *
 * 1. `gestao_pessoas` vs `lideranca` vs `espirito_equipe`:
 *    - Problema: Três atributos cobrem o aspecto humano da escuderia.
 *    - Resolução Canônica: `gestao_pessoas` foca no bem-estar e retenção cotidiana (peopleManagement 0.8);
 *      `lideranca` projeta visão inspiradora e autoridade (peopleManagement 0.7 / politicalManagement 0.3);
 *      `espirito_equipe` atua na integração interdepartamental e recepção de jovens pilotos (talentDevelopment 0.25).
 *
 * 2. `gestao_corrida` vs `tomada_decisao` vs `visao_estrategica`:
 *    - Problema: Sobreposição evidente no domingo de prova.
 *    - Resolução Canônica: `gestao_corrida` é o comando operacional de pit e ritmo (raceManagement 0.85);
 *      `tomada_decisao` é a agilidade em cenários ambíguos de chuva/SC (raceManagement 0.75 / political 0.25);
 *      `visao_estrategica` é o planejamento antecipado de longo prazo e P&D (raceManagement 0.7 / technical 0.3).
 *
 * 3. `ego` e `agressividade_gerencial`:
 *    - Problema: Atributos que em psicologia corporativa podem ser negativos se excessivos.
 *    - Resolução Canônica: No ManagerEffectService, pontuações moderadas a equilibradas conferem bônus estáveis;
 *      pontuações extremas alimentam arquétipos específicos (como o Competidor que tem agressividade 92 e ego 80),
 *      trazendo forte impulso de pressão positiva sobre resultados, mas ligeiro trade-off na paciência de longo prazo.
 */
