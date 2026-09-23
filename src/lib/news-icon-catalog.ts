/**
 * CAMADA CANÔNICA DE ÍCONES DE NOTÍCIAS (NEWS-ICONS-01A)
 *
 * Taxonomia oficial, catálogo canônico, resolver único, normalizador de aliases legacy,
 * desacoplamento categoria vs severidade e auditoria de integridade.
 *
 * REGRAS DE OURO:
 * 1. "A NOTÍCIA INFORMA O SEU TIPO. O RESOLVER ESCOLHE O ÍCONE."
 *    Proibido heurística textual na UI (headline.includes, title.includes) para escolher ícone.
 * 2. "ENTIDADE É UMA COISA. TIPO DE NOTÍCIA É OUTRA. PILOTO TEM RETRATO. EQUIPE TEM LOGO. NOTÍCIA TEM ÍCONE TEMÁTICO."
 * 3. Separação categórica: TIPO da notícia (category) vs IMPORTÂNCIA/URGÊNCIA (severity).
 * 4. Zero URLs externas em runtime. Lucide local ou assets vetoriais internos.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Flag,
  Timer,
  Compass,
  User,
  Shield,
  Wrench,
  Cog,
  Gauge,
  FileText,
  Repeat,
  DollarSign,
  Handshake,
  Scale,
  AlertTriangle,
  AlertCircle,
  HeartPulse,
  CloudRain,
  Building2,
  GraduationCap,
  Trophy,
  Mic,
  Newspaper,
  Radio,
} from 'lucide-react'

// ============================================================================
// 1. TAXONOMIA CANÔNICA (18-23 categorias estáveis do domínio F1 2026)
// ============================================================================

export const CANONICAL_NEWS_CATEGORIES = [
  'RACE',
  'QUALIFYING',
  'PRACTICE',
  'DRIVER',
  'TEAM',
  'CAR',
  'DEVELOPMENT',
  'ENGINE',
  'CONTRACT',
  'TRANSFER',
  'FINANCE',
  'SPONSOR',
  'REGULATION',
  'PENALTY',
  'INCIDENT',
  'INJURY',
  'WEATHER',
  'FACILITY',
  'ACADEMY',
  'CHAMPIONSHIP',
  'MEDIA',
  'RADIO',
  'GENERAL',
] as const

export type CanonicalNewsCategory = (typeof CANONICAL_NEWS_CATEGORIES)[number]

// Fallback canônico padrão
export const CANONICAL_FALLBACK_CATEGORY: CanonicalNewsCategory = 'GENERAL'

// ============================================================================
// 2. SEVERIDADE DESACOPLADA (Categoria = tipo, Severidade = peso/urgência)
// ============================================================================

export type NewsSeverity = 'low' | 'medium' | 'high' | 'critical'

// ============================================================================
// 3. SUBTIPOS CANÔNICOS (Eventos específicos agrupados sob categoria ampla)
// ============================================================================

export type CanonicalNewsSubtype =
  // RACE
  | 'VICTORY'
  | 'PODIUM'
  | 'FASTEST_LAP'
  | 'RESULT'
  | 'RESTART'
  // QUALIFYING
  | 'POLE'
  | 'Q3_ELIMINATION'
  | 'Q2_ELIMINATION'
  | 'Q1_ELIMINATION'
  // PRACTICE
  | 'FP1'
  | 'FP2'
  | 'FP3'
  | 'ROOKIE_SESSION'
  // DRIVER
  | 'MILESTONE'
  | 'SUPERLICENSE'
  | 'HOMOLOGATION'
  | 'MORALE'
  // DEVELOPMENT
  | 'AERO_UPGRADE'
  | 'CHASSIS_UPGRADE'
  | 'WIND_TUNNEL'
  | 'CFD'
  // ENGINE
  | 'NEW_PU'
  | 'WEAR_ALERT'
  | 'ICE_CHANGE'
  | 'ERS_UPDATE'
  // CONTRACT
  | 'SIGNING'
  | 'EXTENSION'
  | 'PRECONTRACT'
  | 'EXPIRY'
  // TRANSFER
  | 'SILLY_SEASON'
  | 'TRADE'
  | 'DEMOTION'
  | 'PROMOTION'
  // INCIDENT
  | 'CRASH'
  | 'DNF'
  | 'COLLISION'
  | 'SPIN'
  | 'MECHANICAL_FAILURE'
  // PENALTY
  | 'GRID_PENALTY'
  | 'TIME_PENALTY'
  | 'DISQUALIFICATION'
  | 'COST_CAP_BREACH'
  // REGULATION
  | 'FIA_DIRECTIVE'
  | 'TECHNICAL_RULE'
  | 'SPORTING_RULE'
  // FINANCE / SPONSOR
  | 'PRIZE_MONEY'
  | 'NEW_PARTNER'
  | 'COMMERCIAL_PAYOUT'
  // FACILITY / ACADEMY
  | 'FACTORY_UPGRADE'
  | 'GRADUATE'
  // GENERAL
  | 'DEFAULT'

// ============================================================================
// 4. ESTRUTURA DA DEFINIÇÃO CANÔNICA DE ÍCONE
// ============================================================================

export interface NewsIconDefinition {
  category: CanonicalNewsCategory
  iconId: string
  label: string
  lucideIcon: LucideIcon
  localPath?: string
  fallback?: boolean
}

// ============================================================================
// 5. CATÁLOGO CANÔNICO DE ÍCONES DE NOTÍCIAS (Zero URL externa, 100% canônico)
// ============================================================================

export const NEWS_ICON_CATALOG: Record<CanonicalNewsCategory, NewsIconDefinition> = {
  RACE: {
    category: 'RACE',
    iconId: 'news_icon_race',
    label: 'Corrida & Resultados',
    lucideIcon: Flag,
    localPath: '/news-icons/race.svg',
  },
  QUALIFYING: {
    category: 'QUALIFYING',
    iconId: 'news_icon_qualifying',
    label: 'Classificação & Pole',
    lucideIcon: Timer,
    localPath: '/news-icons/qualifying.svg',
  },
  PRACTICE: {
    category: 'PRACTICE',
    iconId: 'news_icon_practice',
    label: 'Treinos Livres & Preparação',
    lucideIcon: Compass,
    localPath: '/news-icons/practice.svg',
  },
  DRIVER: {
    category: 'DRIVER',
    iconId: 'news_icon_driver',
    label: 'Piloto & Notícias Pessoais',
    lucideIcon: User,
    localPath: '/news-icons/driver.svg',
  },
  TEAM: {
    category: 'TEAM',
    iconId: 'news_icon_team',
    label: 'Equipe & Paddock',
    lucideIcon: Shield,
    localPath: '/news-icons/team.svg',
  },
  CAR: {
    category: 'CAR',
    iconId: 'news_icon_car',
    label: 'Carro & Ajustes Técnicos',
    lucideIcon: Wrench,
    localPath: '/news-icons/car.svg',
  },
  DEVELOPMENT: {
    category: 'DEVELOPMENT',
    iconId: 'news_icon_development',
    label: 'Desenvolvimento & P&D',
    lucideIcon: Cog,
    localPath: '/news-icons/development.svg',
  },
  ENGINE: {
    category: 'ENGINE',
    iconId: 'news_icon_engine',
    label: 'Motor & Unidade de Potência',
    lucideIcon: Gauge,
    localPath: '/news-icons/engine.svg',
  },
  CONTRACT: {
    category: 'CONTRACT',
    iconId: 'news_icon_contract',
    label: 'Contratos & Negociações',
    lucideIcon: FileText,
    localPath: '/news-icons/contract.svg',
  },
  TRANSFER: {
    category: 'TRANSFER',
    iconId: 'news_icon_transfer',
    label: 'Mercado de Pilotos & Transferências',
    lucideIcon: Repeat,
    localPath: '/news-icons/transfer.svg',
  },
  FINANCE: {
    category: 'FINANCE',
    iconId: 'news_icon_finance',
    label: 'Finanças & Orçamento',
    lucideIcon: DollarSign,
    localPath: '/news-icons/finance.svg',
  },
  SPONSOR: {
    category: 'SPONSOR',
    iconId: 'news_icon_sponsor',
    label: 'Patrocínio & Comercial',
    lucideIcon: Handshake,
    localPath: '/news-icons/sponsor.svg',
  },
  REGULATION: {
    category: 'REGULATION',
    iconId: 'news_icon_regulation',
    label: 'Regulamento Técnico & Diretivas FIA',
    lucideIcon: Scale,
    localPath: '/news-icons/regulation.svg',
  },
  PENALTY: {
    category: 'PENALTY',
    iconId: 'news_icon_penalty',
    label: 'Punições & Sanções Administrativas',
    lucideIcon: AlertTriangle,
    localPath: '/news-icons/penalty.svg',
  },
  INCIDENT: {
    category: 'INCIDENT',
    iconId: 'news_icon_incident',
    label: 'Incidentes, Colisões & Abandonos',
    lucideIcon: AlertCircle,
    localPath: '/news-icons/incident.svg',
  },
  INJURY: {
    category: 'INJURY',
    iconId: 'news_icon_injury',
    label: 'Condição Física & Departamento Médico',
    lucideIcon: HeartPulse,
    localPath: '/news-icons/injury.svg',
  },
  WEATHER: {
    category: 'WEATHER',
    iconId: 'news_icon_weather',
    label: 'Clima & Condições de Pista',
    lucideIcon: CloudRain,
    localPath: '/news-icons/weather.svg',
  },
  FACILITY: {
    category: 'FACILITY',
    iconId: 'news_icon_facility',
    label: 'Instalações & Infraestrutura da Fábrica',
    lucideIcon: Building2,
    localPath: '/news-icons/facility.svg',
  },
  ACADEMY: {
    category: 'ACADEMY',
    iconId: 'news_icon_academy',
    label: 'Academia de Jovens Pilotos',
    lucideIcon: GraduationCap,
    localPath: '/news-icons/academy.svg',
  },
  CHAMPIONSHIP: {
    category: 'CHAMPIONSHIP',
    iconId: 'news_icon_championship',
    label: 'Classificação & Disputa do Mundial',
    lucideIcon: Trophy,
    localPath: '/news-icons/championship.svg',
  },
  MEDIA: {
    category: 'MEDIA',
    iconId: 'news_icon_media',
    label: 'Imprensa & Entrevistas de Paddock',
    lucideIcon: Mic,
    localPath: '/news-icons/media.svg',
  },
  RADIO: {
    category: 'RADIO',
    iconId: 'news_icon_radio',
    label: 'Comunicação de Rádio & Mensagens',
    lucideIcon: Radio,
    localPath: '/news-icons/radio.svg',
  },
  GENERAL: {
    category: 'GENERAL',
    iconId: 'news_icon_general',
    label: 'Notícia Geral & Comunicados',
    lucideIcon: Newspaper,
    localPath: '/news-icons/general.svg',
    fallback: true,
  },
}

// ============================================================================
// 6. MAPA DE ALIASES LEGACY (Normalização de formatos antigos do jogo)
// ============================================================================

export const LEGACY_NEWS_CATEGORY_ALIASES: Record<string, CanonicalNewsCategory> = {
  // Corrida / Resultados
  race: 'RACE',
  corrida: 'RACE',
  race_result: 'RACE',
  'race-result': 'RACE',
  race_results: 'RACE',
  raceresult: 'RACE',
  raceResult: 'RACE',
  RACE_RESULT: 'RACE',
  gp_result: 'RACE',
  gp_results: 'RACE',
  gpResult: 'RACE',
  resultado: 'RACE',
  resultados: 'RACE',
  pos_corrida: 'RACE',
  podium: 'RACE',
  victory: 'RACE',

  // Treinos / Qualy
  quali: 'QUALIFYING',
  qualifying: 'QUALIFYING',
  qualificacao: 'QUALIFYING',
  pole: 'QUALIFYING',
  pole_position: 'QUALIFYING',
  practice: 'PRACTICE',
  treino: 'PRACTICE',
  treinos: 'PRACTICE',
  treino_livre: 'PRACTICE',
  fp1: 'PRACTICE',
  fp2: 'PRACTICE',
  fp3: 'PRACTICE',
  shakedown: 'PRACTICE',

  // Pilotos
  pilot: 'DRIVER',
  driver: 'DRIVER',
  piloto: 'DRIVER',
  pilotos: 'DRIVER',
  drivers: 'DRIVER',

  // Equipes
  team: 'TEAM',
  equipe: 'TEAM',
  equipes: 'TEAM',
  teams: 'TEAM',
  paddock: 'TEAM',

  // Carro / Setup
  car: 'CAR',
  carro: 'CAR',
  setup: 'CAR',
  chassis: 'CAR',
  pecas: 'CAR',
  part: 'CAR',
  parts: 'CAR',

  // Desenvolvimento / P&D
  development: 'DEVELOPMENT',
  desenvolvimento: 'DEVELOPMENT',
  rd: 'DEVELOPMENT',
  p_d: 'DEVELOPMENT',
  technical_upgrade: 'DEVELOPMENT',
  technicalupgrade: 'DEVELOPMENT',
  car_upgrade: 'DEVELOPMENT',
  carupgrade: 'DEVELOPMENT',
  upgrade: 'DEVELOPMENT',
  upgrade_concluido: 'DEVELOPMENT',

  // Motor / Unidade de Potência
  engine: 'ENGINE',
  motor: 'ENGINE',
  pu: 'ENGINE',
  power_unit: 'ENGINE',
  unidade_potencia: 'ENGINE',

  // Contratos
  contract: 'CONTRACT',
  contrato: 'CONTRACT',
  contratos: 'CONTRACT',
  contracts: 'CONTRACT',
  renovacao: 'CONTRACT',
  renewal: 'CONTRACT',
  extension: 'CONTRACT',
  precontract: 'CONTRACT',
  pre_contrato: 'CONTRACT',

  // Transferências / Mercado
  transfer: 'TRANSFER',
  transf: 'TRANSFER',
  transferencia: 'TRANSFER',
  transferencias: 'TRANSFER',
  driver_transfer: 'TRANSFER',
  drivertransfer: 'TRANSFER',
  driver_market: 'TRANSFER',
  drivermarket: 'TRANSFER',
  mercado: 'TRANSFER',
  silly_season: 'TRANSFER',
  sillyseason: 'TRANSFER',
  promocao: 'TRANSFER',
  promotion: 'TRANSFER',
  demissao: 'TRANSFER',
  dismissal: 'TRANSFER',

  // Finanças
  finance: 'FINANCE',
  finances: 'FINANCE',
  financas: 'FINANCE',
  orcamento: 'FINANCE',
  budget: 'FINANCE',
  cost_cap: 'FINANCE',
  costcap: 'FINANCE',
  teto_gastos: 'FINANCE',

  // Patrocínio
  sponsor: 'SPONSOR',
  sponsorship: 'SPONSOR',
  sponsors: 'SPONSOR',
  patrocinio: 'SPONSOR',
  patrocinios: 'SPONSOR',
  comercial: 'SPONSOR',
  commercial: 'SPONSOR',
  parceria: 'SPONSOR',

  // Regulamento
  regulation: 'REGULATION',
  regulations: 'REGULATION',
  regulamento: 'REGULATION',
  regulamentos: 'REGULATION',
  fia_rule: 'REGULATION',
  fia_directive: 'REGULATION',
  regras: 'REGULATION',

  // Punição
  penalty: 'PENALTY',
  penalties: 'PENALTY',
  punicao: 'PENALTY',
  punicoes: 'PENALTY',
  sancao: 'PENALTY',
  multa: 'PENALTY',
  fia_penalty: 'PENALTY',
  desclassificacao: 'PENALTY',

  // Incidente
  incident: 'INCIDENT',
  incidents: 'INCIDENT',
  incidente: 'INCIDENT',
  incidentes: 'INCIDENT',
  acidente: 'INCIDENT',
  crash: 'INCIDENT',
  colisao: 'INCIDENT',
  collision: 'INCIDENT',
  dnf: 'INCIDENT',
  quebra: 'INCIDENT',

  // Lesão / Físico
  injury: 'INJURY',
  injuries: 'INJURY',
  lesao: 'INJURY',
  lesoes: 'INJURY',
  medico: 'INJURY',
  physical: 'INJURY',
  saude: 'INJURY',

  // Clima
  weather: 'WEATHER',
  clima: 'WEATHER',
  chuva: 'WEATHER',
  rain: 'WEATHER',
  meteo: 'WEATHER',

  // Instalações
  facility: 'FACILITY',
  facilities: 'FACILITY',
  instalacao: 'FACILITY',
  instalacoes: 'FACILITY',
  fabrica: 'FACILITY',
  factory: 'FACILITY',
  infraestrutura: 'FACILITY',
  infrastructure: 'FACILITY',

  // Academia
  academy: 'ACADEMY',
  academia: 'ACADEMY',
  jovem_piloto: 'ACADEMY',
  rookie: 'ACADEMY',
  novato: 'ACADEMY',

  // Campeonato
  championship: 'CHAMPIONSHIP',
  campeonato: 'CHAMPIONSHIP',
  standings: 'CHAMPIONSHIP',
  classificacao: 'CHAMPIONSHIP',
  tabela: 'CHAMPIONSHIP',
  titulo: 'CHAMPIONSHIP',

  // Mídia
  media: 'MEDIA',
  imprensa: 'MEDIA',
  entrevista: 'MEDIA',
  rumor: 'MEDIA',
  rumores: 'MEDIA',

  // Rádio
  radio: 'RADIO',
  pitwall_radio: 'RADIO',
  mensagens: 'RADIO',

  // Geral / Notícias
  general: 'GENERAL',
  geral: 'GENERAL',
  news: 'GENERAL',
  noticia: 'GENERAL',
  noticias: 'GENERAL',
  sistema: 'GENERAL',
  system: 'GENERAL',
  default: 'GENERAL',
}

// ============================================================================
// 7. FUNÇÕES DE RESOLUÇÃO E NORMALIZAÇÃO
// ============================================================================

/**
 * Normaliza qualquer string de categoria bruta (ou legacy alias) para uma categoria canônica.
 * Retorna CANONICAL_FALLBACK_CATEGORY se não for reconhecida.
 */
export function normalizeNewsCategory(
  rawCategory: string | null | undefined,
): CanonicalNewsCategory {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return CANONICAL_FALLBACK_CATEGORY
  }

  const trimmed = rawCategory.trim()
  if (!trimmed) {
    return CANONICAL_FALLBACK_CATEGORY
  }

  // 1. Verificação exata em caixa alta
  const upper = trimmed.toUpperCase()
  if (CANONICAL_NEWS_CATEGORIES.includes(upper as CanonicalNewsCategory)) {
    return upper as CanonicalNewsCategory
  }

  // 2. Normalização case-insensitive / underscore / kebab-case
  const lower = trimmed.toLowerCase()
  if (lower in LEGACY_NEWS_CATEGORY_ALIASES) {
    return LEGACY_NEWS_CATEGORY_ALIASES[lower]
  }

  const sanitized = lower.replace(/[-_\s]+/g, '_')
  if (sanitized in LEGACY_NEWS_CATEGORY_ALIASES) {
    return LEGACY_NEWS_CATEGORY_ALIASES[sanitized]
  }

  const plain = lower.replace(/[-_\s]+/g, '')
  if (plain in LEGACY_NEWS_CATEGORY_ALIASES) {
    return LEGACY_NEWS_CATEGORY_ALIASES[plain]
  }

  return CANONICAL_FALLBACK_CATEGORY
}

/**
 * Resolve o ícone canônico para uma dada categoria de notícia.
 * Apenas a categoria informa o ícone (nenhuma heurística textual na UI).
 * Categoria desconhecida utiliza o fallback canônico GENERAL.
 */
export function resolveNewsIcon(rawCategory: string | null | undefined): NewsIconDefinition {
  const canonicalCategory = normalizeNewsCategory(rawCategory)
  const definition = NEWS_ICON_CATALOG[canonicalCategory]

  if (!definition) {
    return NEWS_ICON_CATALOG[CANONICAL_FALLBACK_CATEGORY]
  }

  return definition
}

/**
 * Helper para obter diretamente o componente de ícone Lucide correspondente.
 */
export function resolveNewsLucideIcon(rawCategory: string | null | undefined): LucideIcon {
  return resolveNewsIcon(rawCategory).lucideIcon
}

// ============================================================================
// 8. AUDITORIA CANÔNICA (auditCanonicalNewsIconCatalog)
// ============================================================================

export interface CanonicalNewsIconCatalogAuditReport {
  canonicalCategories: number
  mappedCategories: number
  duplicateCategories: number
  duplicateIconIds: number
  unresolvedCategories: number
  legacyAliases: number
  externalRuntimeUrls: number
  missingFallback: number
  fallbackCategory: CanonicalNewsCategory
  categoriesList: CanonicalNewsCategory[]
}

/**
 * Realiza uma auditoria formal de integridade sobre o catálogo de ícones de notícias.
 * Verifica:
 * - Unicidade das categorias
 * - Unicidade dos iconIds
 * - Resolução de todas as categorias canônicas
 * - Presença do fallback canônico
 * - Zero URLs externas em runtime
 * - Contagem e integridade dos aliases legados
 */
export function auditCanonicalNewsIconCatalog(): CanonicalNewsIconCatalogAuditReport {
  const canonicalCategories = CANONICAL_NEWS_CATEGORIES.length
  let mappedCategories = 0
  let duplicateCategories = 0
  let duplicateIconIds = 0
  let unresolvedCategories = 0
  let externalRuntimeUrls = 0

  const seenCategories = new Set<string>()
  const seenIconIds = new Set<string>()

  for (const cat of CANONICAL_NEWS_CATEGORIES) {
    if (seenCategories.has(cat)) {
      duplicateCategories++
    } else {
      seenCategories.add(cat)
    }

    const item = NEWS_ICON_CATALOG[cat]
    if (!item) {
      unresolvedCategories++
      continue
    }

    mappedCategories++

    if (seenIconIds.has(item.iconId)) {
      duplicateIconIds++
    } else {
      seenIconIds.add(item.iconId)
    }

    if (item.localPath) {
      if (item.localPath.startsWith('http://') || item.localPath.startsWith('https://')) {
        externalRuntimeUrls++
      }
    }
  }

  const legacyAliases = Object.keys(LEGACY_NEWS_CATEGORY_ALIASES).length

  // Validar se o fallback está devidamente registrado e resolúvel
  const fallbackItem = NEWS_ICON_CATALOG[CANONICAL_FALLBACK_CATEGORY]
  const missingFallback = fallbackItem ? 0 : 1

  return {
    canonicalCategories,
    mappedCategories,
    duplicateCategories,
    duplicateIconIds,
    unresolvedCategories,
    legacyAliases,
    externalRuntimeUrls,
    missingFallback,
    fallbackCategory: CANONICAL_FALLBACK_CATEGORY,
    categoriesList: [...CANONICAL_NEWS_CATEGORIES],
  }
}
