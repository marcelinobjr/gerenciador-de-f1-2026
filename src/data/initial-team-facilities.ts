import { FacilityLevels } from '@/types/canonical-facilities'

/**
 * Perfis de Infraestrutura Inicial Canônica para todas as 28 Escuderias
 * F1 Manager 2026 — Implementação Nº 4A
 *
 * Princípio 31: Identidades heterogêneas baseadas em dados, sem uniformidade.
 * As equipes possuem pontos fortes e gargalos distintos:
 * Ex: Audi forte em Manufacturing e Factory, intermediária em Túnel de Vento;
 * McLaren forte em Design e Túnel, mas dependente de sinergias;
 * Haas enxuta com dependência de fornecedores (Manufacturing 2).
 */

export const INITIAL_GRID_FACILITIES: Record<string, FacilityLevels> = {
  // Top 4 Atual
  mclaren: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 4,
    simulator: 5,
    operations_centre: 5,
    pitstop_center: 5,
    youth_academy: 4,
  },
  ferrari: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 5,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 5,
    youth_academy: 5,
  },
  redbull: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 5,
    simulator: 5,
    operations_centre: 5,
    pitstop_center: 5,
    youth_academy: 5,
  },
  mercedes: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 5,
    simulator: 5,
    operations_centre: 5,
    pitstop_center: 4,
    youth_academy: 5,
  },

  // Intermediárias Altas / Novas Construtoras
  astonmartin: {
    factory: 5,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 5, // Novo campus tecnológico Silverstone
    manufacturing: 4,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 3,
  },
  audi: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 3, // Em transição Hinwil/Neuburg
    manufacturing: 4,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 3,
    youth_academy: 4,
  },
  alpine: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 4,
    manufacturing: 3,
    simulator: 4,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 4,
  },
  racingbulls: {
    factory: 3,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 4,
    manufacturing: 3,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },

  // Tradicionais & Independentes
  williams: {
    factory: 3,
    design_centre: 3,
    cfd: 3,
    wind_tunnel: 3,
    manufacturing: 3,
    simulator: 4,
    operations_centre: 3,
    pitstop_center: 4,
    youth_academy: 3,
  },
  haas: {
    factory: 2,
    design_centre: 3,
    cfd: 3,
    wind_tunnel: 3,
    manufacturing: 2, // Operação terceirizada / Dallara
    simulator: 3,
    operations_centre: 3,
    pitstop_center: 4,
    youth_academy: 2,
  },
  cadillac: {
    factory: 3,
    design_centre: 3,
    cfd: 3,
    wind_tunnel: 3,
    manufacturing: 3,
    simulator: 3,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 3,
  },

  // Grandes Construtoras Históricas
  porsche: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 5,
    simulator: 4,
    operations_centre: 5,
    pitstop_center: 4,
    youth_academy: 4,
  },
  honda: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 5,
    simulator: 5,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },
  toyota: {
    factory: 5,
    design_centre: 5,
    cfd: 5,
    wind_tunnel: 5,
    manufacturing: 5,
    simulator: 5,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },
  lamborghini: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 4,
    manufacturing: 4,
    simulator: 4,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 3,
  },
  andretti: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 3,
    manufacturing: 4,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },
  byd: {
    factory: 4,
    design_centre: 4,
    cfd: 5, // Forte investimento tecnológico e computacional
    wind_tunnel: 3,
    manufacturing: 5, // Gigante industrial
    simulator: 4,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 3,
  },
  penske: {
    factory: 4,
    design_centre: 4,
    cfd: 3,
    wind_tunnel: 3,
    manufacturing: 4,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 5,
    youth_academy: 3,
  },

  // Clássicas & Retorno
  lotus: {
    factory: 3,
    design_centre: 4,
    cfd: 3,
    wind_tunnel: 3,
    manufacturing: 3,
    simulator: 3,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 3,
  },
  benetton: {
    factory: 4,
    design_centre: 4,
    cfd: 3,
    wind_tunnel: 4,
    manufacturing: 3,
    simulator: 3,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },
  copersucar: {
    factory: 3,
    design_centre: 3,
    cfd: 2,
    wind_tunnel: 2,
    manufacturing: 3,
    simulator: 3,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 3,
  },
  fittipaldi: {
    factory: 3,
    design_centre: 3,
    cfd: 2,
    wind_tunnel: 2,
    manufacturing: 3,
    simulator: 3,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 3,
  },
  jordan: {
    factory: 3,
    design_centre: 3,
    cfd: 3,
    wind_tunnel: 3,
    manufacturing: 3,
    simulator: 3,
    operations_centre: 3,
    pitstop_center: 4,
    youth_academy: 3,
  },
  renault: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 4,
    manufacturing: 4,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },
  sauber: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 4,
    manufacturing: 3,
    simulator: 4,
    operations_centre: 3,
    pitstop_center: 3,
    youth_academy: 4,
  },
  alfaromeo: {
    factory: 4,
    design_centre: 4,
    cfd: 4,
    wind_tunnel: 3,
    manufacturing: 3,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 3,
  },
  alphatauri: {
    factory: 3,
    design_centre: 3,
    cfd: 4,
    wind_tunnel: 3,
    manufacturing: 3,
    simulator: 4,
    operations_centre: 4,
    pitstop_center: 4,
    youth_academy: 4,
  },
  toleman: {
    factory: 3,
    design_centre: 3,
    cfd: 2,
    wind_tunnel: 2,
    manufacturing: 3,
    simulator: 2,
    operations_centre: 2,
    pitstop_center: 3,
    youth_academy: 3,
  },
}

/** Perfil Padrão para Custom Team (12ª Equipe Nova) */
export const DEFAULT_CUSTOM_TEAM_FACILITIES: FacilityLevels = {
  factory: 2,
  design_centre: 2,
  cfd: 2,
  wind_tunnel: 2,
  manufacturing: 2,
  simulator: 2,
  operations_centre: 2,
  pitstop_center: 2,
  youth_academy: 2,
}

/**
 * Retorna as instalações iniciais para uma dada chave de equipe.
 */
export function getInitialTeamFacilities(teamKey?: string | null): FacilityLevels {
  if (!teamKey) return { ...DEFAULT_CUSTOM_TEAM_FACILITIES }
  const normalized = teamKey.toLowerCase().replace(/[^a-z0-9]/g, '')
  return INITIAL_GRID_FACILITIES[normalized] || { ...DEFAULT_CUSTOM_TEAM_FACILITIES }
}
