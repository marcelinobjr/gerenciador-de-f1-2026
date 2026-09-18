export type SponsorSlotKey = 'front_wing' | 'nose' | 'sidepod' | 'engine_cover' | 'rear_wing'

export interface SponsorHotspotCoord {
  slot: SponsorSlotKey
  name: string
  nameEn: string
  // Percentage coordinates relative to car container (0 to 100)
  x: number // percentage left
  y: number // percentage top
  pinPosition?: 'top' | 'bottom' | 'left' | 'right'
  description: string
}

export interface TeamSponsorHotspotsConfig {
  hasCalibratedCoordinates: boolean
  slots: Record<SponsorSlotKey, SponsorHotspotCoord>
}

// Canonical definition of the 5 official F1 car sponsor slots
export const OFFICIAL_SPONSOR_SLOTS: Array<{
  key: SponsorSlotKey
  label: string
  labelEn: string
  defaultMarketValueMin: number // US$ M
  defaultMarketValueMax: number // US$ M
  visibility: 'Alta' | 'Média' | 'Muito Alta' | 'Premium'
  description: string
}> = [
  {
    key: 'sidepod',
    label: 'Lateral / Sidepod',
    labelEn: 'Sidepod',
    defaultMarketValueMin: 12,
    defaultMarketValueMax: 20,
    visibility: 'Muito Alta',
    description: 'Maior área visual de exposição na transmissão televisiva e fotos oficiais.',
  },
  {
    key: 'engine_cover',
    label: 'Tampa do Motor / Engine Cover',
    labelEn: 'Engine Cover',
    defaultMarketValueMin: 10,
    defaultMarketValueMax: 16,
    visibility: 'Alta',
    description: 'Visibilidade destacada em câmeras onboard e ângulos laterais de corrida.',
  },
  {
    key: 'rear_wing',
    label: 'Asa Traseira / Rear Wing',
    labelEn: 'Rear Wing',
    defaultMarketValueMin: 9,
    defaultMarketValueMax: 15,
    visibility: 'Muito Alta',
    description: 'Espaço nobre com grande tempo de tela em perseguições e disputas de posição.',
  },
  {
    key: 'nose',
    label: 'Bico / Nose',
    labelEn: 'Nose Cone',
    defaultMarketValueMin: 6,
    defaultMarketValueMax: 10,
    visibility: 'Alta',
    description: 'Visível em todos os enquadramentos frontais, grid de largada e pódio.',
  },
  {
    key: 'front_wing',
    label: 'Asa Dianteira / Front Wing',
    labelEn: 'Front Wing',
    defaultMarketValueMin: 5,
    defaultMarketValueMax: 9,
    visibility: 'Média',
    description: 'Elemento aerodinâmico frontal com forte presença visual em curvas fechadas.',
  },
]

// Calibrated side-view hotspot coordinates for F1 2026 liveries facing LEFT
// Normalized to percentage coordinates (0-100)
export const DEFAULT_HOTSPOTS: Record<SponsorSlotKey, SponsorHotspotCoord> = {
  front_wing: {
    slot: 'front_wing',
    name: 'Asa Dianteira',
    nameEn: 'Front Wing',
    x: 21,
    y: 78,
    pinPosition: 'top',
    description: 'Asa dianteira e flaps inferiores',
  },
  nose: {
    slot: 'nose',
    name: 'Bico',
    nameEn: 'Nose',
    x: 33,
    y: 24,
    pinPosition: 'bottom',
    description: 'Bico estrutural dianteiro',
  },
  sidepod: {
    slot: 'sidepod',
    name: 'Lateral',
    nameEn: 'Sidepod',
    x: 53,
    y: 28,
    pinPosition: 'bottom',
    description: 'Laterais dos sidepods e entradas de ar',
  },
  engine_cover: {
    slot: 'engine_cover',
    name: 'Tampa do Motor',
    nameEn: 'Engine Cover',
    x: 64,
    y: 20,
    pinPosition: 'bottom',
    description: 'Barbatana de tubarão e capô traseiro',
  },
  rear_wing: {
    slot: 'rear_wing',
    name: 'Asa Traseira',
    nameEn: 'Rear Wing',
    x: 81,
    y: 24,
    pinPosition: 'bottom',
    description: 'Asa traseira e placas terminais DRS',
  },
}

// Team-specific calibration map
export const TEAM_SPONSOR_HOTSPOTS: Record<string, TeamSponsorHotspotsConfig> = {
  audi: {
    hasCalibratedCoordinates: true,
    slots: {
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 21.5,
        y: 77.0,
        pinPosition: 'top',
        description: 'Asa dianteira e endplates',
      },
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 33.2,
        y: 23.5,
        pinPosition: 'bottom',
        description: 'Bico de absorção e cone',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.0,
        y: 28.5,
        pinPosition: 'bottom',
        description: 'Carenagem lateral e radiadores',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 64.2,
        y: 20.0,
        pinPosition: 'bottom',
        description: 'Carenagem superior da Power Unit',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 81.0,
        y: 24.5,
        pinPosition: 'bottom',
        description: 'Asa traseira e plano principal DRS',
      },
    },
  },
  ferrari: {
    hasCalibratedCoordinates: true,
    slots: {
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 21.0,
        y: 76.5,
        pinPosition: 'top',
        description: 'Asa dianteira e endplates',
      },
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 33.5,
        y: 24.0,
        pinPosition: 'bottom',
        description: 'Bico de absorção',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.5,
        y: 28.0,
        pinPosition: 'bottom',
        description: 'Sidepod aerodinâmico',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 64.5,
        y: 20.5,
        pinPosition: 'bottom',
        description: 'Tampa da Power Unit Ferrari',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 81.5,
        y: 24.0,
        pinPosition: 'bottom',
        description: 'Asa traseira e DRS',
      },
    },
  },
  redbull: {
    hasCalibratedCoordinates: true,
    slots: {
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 21.0,
        y: 77.0,
        pinPosition: 'top',
        description: 'Asa dianteira',
      },
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 33.0,
        y: 24.0,
        pinPosition: 'bottom',
        description: 'Bico aerodinâmico',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 52.5,
        y: 28.0,
        pinPosition: 'bottom',
        description: 'Under-cut sidepod',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 64.0,
        y: 20.0,
        pinPosition: 'bottom',
        description: 'Tampa da unidade Honda/RBPT',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 81.0,
        y: 24.5,
        pinPosition: 'bottom',
        description: 'Asa traseira de alta eficiência',
      },
    },
  },
  mercedes: {
    hasCalibratedCoordinates: true,
    slots: {
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 21.5,
        y: 77.0,
        pinPosition: 'top',
        description: 'Asa dianteira',
      },
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 33.0,
        y: 24.0,
        pinPosition: 'bottom',
        description: 'Bico estilizado',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.0,
        y: 28.0,
        pinPosition: 'bottom',
        description: 'Sidepod aerodinâmico',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 64.0,
        y: 20.0,
        pinPosition: 'bottom',
        description: 'Carenagem do motor Mercedes',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 81.0,
        y: 24.0,
        pinPosition: 'bottom',
        description: 'Asa traseira',
      },
    },
  },
  mclaren: {
    hasCalibratedCoordinates: true,
    slots: {
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 21.0,
        y: 77.0,
        pinPosition: 'top',
        description: 'Asa dianteira',
      },
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 33.0,
        y: 24.0,
        pinPosition: 'bottom',
        description: 'Bico papaya',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.0,
        y: 28.0,
        pinPosition: 'bottom',
        description: 'Sidepod com guelras',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 64.0,
        y: 20.0,
        pinPosition: 'bottom',
        description: 'Tampa da unidade de potência',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 81.0,
        y: 24.5,
        pinPosition: 'bottom',
        description: 'Asa traseira de média-baixa carga',
      },
    },
  },
}

export function getTeamHotspots(teamId?: string | null): TeamSponsorHotspotsConfig {
  if (!teamId) {
    return {
      hasCalibratedCoordinates: true,
      slots: DEFAULT_HOTSPOTS,
    }
  }
  const normalized = teamId.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [key, config] of Object.entries(TEAM_SPONSOR_HOTSPOTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return config
    }
  }
  // Default fallback with standard F1 side-view coordinates
  return {
    hasCalibratedCoordinates: true,
    slots: DEFAULT_HOTSPOTS,
  }
}
