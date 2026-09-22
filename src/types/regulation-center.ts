/**
 * regulation-center.ts
 *
 * Modelos e Tipos Canônicos da Central de Regulamento FIA (REG-01).
 * F1 Manager 2026 — APEX GP Manager.
 *
 * Princípios Fundamentais:
 * 1. A Central de Regulamento NÃO É UMA SEGUNDA ENGINE DE REGRAS. Ela CONSULTA e EXPLICA.
 * 2. Transparência regulamentar: distinção visual e conceitual clara entre:
 *    - OFFICIAL_FIA (regra oficial da Federação Internacional de Automobilismo)
 *    - APEX_ADAPTATION (adaptação ou mecânica de jogo calibrada do APEX GP Manager)
 *    - GAME_MECHANIC (funcionalidade estrutural interna do jogo)
 * 3. Status de implementação honesto: IMPLEMENTADO | SUPORTE PARCIAL | INFORMATIVO.
 * 4. Arquitetura season-aware: metadados e regras atrelados à temporada atual.
 */

export type RegulationSourceType = 'OFFICIAL_FIA' | 'APEX_ADAPTATION' | 'GAME_MECHANIC'

export type RegulationImplementationStatus = 'IMPLEMENTADO' | 'SUPORTE PARCIAL' | 'INFORMATIVO'

export type RegulationCategoryId =
  | 'fim_de_semana'
  | 'treinos_livres'
  | 'novatos_tl1'
  | 'qualificacao'
  | 'sprint'
  | 'corrida'
  | 'pneus'
  | 'power_unit'
  | 'parc_ferme'
  | 'safety_car_vsc'
  | 'bandeira_vermelha'
  | 'pontuacao'
  | 'grid_penalidades'
  | 'licencas'
  | 'campeonato'
  | 'regulamento_tecnico'

export interface RegulationCategoryMeta {
  id: RegulationCategoryId
  label: string
  shortLabel: string
  order: number
  description: string
  iconName: string
}

export interface OfficialFiaSectionMetadata {
  sectionCode: 'Section A' | 'Section B' | 'Section C' | 'Section D' | 'Section E' | 'Section F'
  title: string
  scope: string
}

export interface SeasonRegulationFrameworkMetadata {
  season: number
  authority: 'FIA'
  championship: string
  versionName: string
  officialSections: OfficialFiaSectionMetadata[]
}

export interface OfficialRegulationSourceMetadata {
  authority: 'FIA' | 'APEX' | 'FIA + APEX'
  championship: string // ex: "FIA Formula One World Championship"
  season: number
  section?: string // ex: "Section B — Sporting Regulations (Art. 32)"
  documentTitle: string // ex: "FIA Formula One Sporting Regulations 2026"
  issue?: string
  articleRef?: string // ex: "Art. 32.4", "Art. 28.1"
}

export interface RegulationDefinition {
  id: string
  category: RegulationCategoryId
  title: string
  season: number
  sourceType: RegulationSourceType
  status: RegulationImplementationStatus
  sourceMetadata: OfficialRegulationSourceMetadata
  tags: string[]
  whatItDetermines: string // "O QUE DETERMINA" (Princípio regulamentar oficial / base da regra)
  apexExplanation: string // "COMO FUNCIONA NO APEX" (Como o motor do jogo executa ou traduz)
  teamSituationNote?: string // "SITUAÇÃO DA SUA EQUIPE" (Texto explicativo padrão quando aplicável)
  relatedService: string // Nome do serviço/configuração canônica de onde derivam os dados
  relatedRoute?: string // Rota de navegação contextual (ex: "/calendario", "/car", etc.)
  relatedRouteLabel?: string // Texto do CTA (ex: "VER PLANEJAMENTO NO CALENDÁRIO")
  hasTeamContext: boolean // Se renderiza o painel lateral contextual dinâmico
}

export interface RegulationAuditIssue {
  ruleId: string
  issue: string
  severity: 'ERROR' | 'WARNING'
}

export interface RegulationAuditReport {
  isValid: boolean
  totalRules: number
  rulesPerCategory: Record<RegulationCategoryId, number>
  issues: RegulationAuditIssue[]
  auditedAt: string
}
