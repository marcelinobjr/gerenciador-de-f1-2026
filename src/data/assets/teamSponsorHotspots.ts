export type SponsorSlotKey = 'front_wing' | 'nose' | 'sidepod' | 'engine_cover' | 'rear_wing'

export interface SponsorHotspotCoord {
  slot: SponsorSlotKey
  name: string
  nameEn: string
  // Percentage coordinates relative to car container (0 to 100)
  x: number // percentage left
  y: number // percentage top
  boxBand: 'top' | 'bottom' // Band where the box resides in the reference layout
  boxIndex: number // 0-based ordering within band
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
// Calibrated against official 2026 sideview (Audi_VL.jpg / F1 2026 reference)
export const DEFAULT_HOTSPOTS: Record<SponsorSlotKey, SponsorHotspotCoord> = {
  nose: {
    slot: 'nose',
    name: 'Bico',
    nameEn: 'Nose',
    x: 6.2,
    y: 65.0,
    boxBand: 'top',
    boxIndex: 0,
    pinPosition: 'top',
    description: 'Parte frontal superior do nariz, próximo à ponta dianteira',
  },
  front_wing: {
    slot: 'front_wing',
    name: 'Asa Dianteira',
    nameEn: 'Front Wing',
    x: 11.8,
    y: 71.5,
    boxBand: 'bottom',
    boxIndex: 0,
    pinPosition: 'bottom',
    description: 'Conjunto aerodinâmico frontal e endplates da asa dianteira',
  },
  sidepod: {
    slot: 'sidepod',
    name: 'Lateral',
    nameEn: 'Sidepod',
    x: 53.5,
    y: 57.5,
    boxBand: 'top',
    boxIndex: 1,
    pinPosition: 'top',
    description: 'Área lateral principal da carenagem comercial (sidepod)',
  },
  engine_cover: {
    slot: 'engine_cover',
    name: 'Tampa do Motor',
    nameEn: 'Engine Cover',
    x: 66.8,
    y: 44.5,
    boxBand: 'top',
    boxIndex: 2,
    pinPosition: 'top',
    description: 'Região superior da engine cover / barbatana dorsal',
  },
  rear_wing: {
    slot: 'rear_wing',
    name: 'Asa Traseira',
    nameEn: 'Rear Wing',
    x: 89.6,
    y: 46.5,
    boxBand: 'top',
    boxIndex: 3,
    pinPosition: 'top',
    description: 'Estrutura principal e endplate da asa traseira',
  },
}

// Team-specific calibration map
export const TEAM_SPONSOR_HOTSPOTS: Record<string, TeamSponsorHotspotsConfig> = {
  audi: {
    hasCalibratedCoordinates: true,
    slots: {
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 6.2,
        y: 65.0,
        boxBand: 'top',
        boxIndex: 0,
        pinPosition: 'top',
        description: 'Parte frontal superior do nariz, próximo à ponta dianteira',
      },
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 11.8,
        y: 71.5,
        boxBand: 'bottom',
        boxIndex: 0,
        pinPosition: 'bottom',
        description: 'Conjunto aerodinâmico frontal e endplates da asa dianteira',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.5,
        y: 57.5,
        boxBand: 'top',
        boxIndex: 1,
        pinPosition: 'top',
        description: 'Área lateral principal da carenagem comercial (sidepod)',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 66.8,
        y: 44.5,
        boxBand: 'top',
        boxIndex: 2,
        pinPosition: 'top',
        description: 'Região superior da engine cover / barbatana dorsal',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 89.6,
        y: 46.5,
        boxBand: 'top',
        boxIndex: 3,
        pinPosition: 'top',
        description: 'Estrutura principal e endplate da asa traseira',
      },
    },
  },
  ferrari: {
    hasCalibratedCoordinates: true,
    slots: {
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 6.5,
        y: 65.0,
        boxBand: 'top',
        boxIndex: 0,
        pinPosition: 'top',
        description: 'Bico dianteiro',
      },
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 12.0,
        y: 71.5,
        boxBand: 'bottom',
        boxIndex: 0,
        pinPosition: 'bottom',
        description: 'Asa dianteira e endplates',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.5,
        y: 57.5,
        boxBand: 'top',
        boxIndex: 1,
        pinPosition: 'top',
        description: 'Sidepod aerodinâmico',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 66.5,
        y: 44.5,
        boxBand: 'top',
        boxIndex: 2,
        pinPosition: 'top',
        description: 'Tampa da Power Unit Ferrari',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 89.5,
        y: 46.5,
        boxBand: 'top',
        boxIndex: 3,
        pinPosition: 'top',
        description: 'Asa traseira e DRS',
      },
    },
  },
  redbull: {
    hasCalibratedCoordinates: true,
    slots: {
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 6.2,
        y: 65.0,
        boxBand: 'top',
        boxIndex: 0,
        pinPosition: 'top',
        description: 'Bico aerodinâmico',
      },
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 12.0,
        y: 71.5,
        boxBand: 'bottom',
        boxIndex: 0,
        pinPosition: 'bottom',
        description: 'Asa dianteira',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.0,
        y: 57.5,
        boxBand: 'top',
        boxIndex: 1,
        pinPosition: 'top',
        description: 'Under-cut sidepod',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 66.5,
        y: 44.5,
        boxBand: 'top',
        boxIndex: 2,
        pinPosition: 'top',
        description: 'Tampa da unidade Honda/RBPT',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 89.5,
        y: 46.5,
        boxBand: 'top',
        boxIndex: 3,
        pinPosition: 'top',
        description: 'Asa traseira de alta eficiência',
      },
    },
  },
  mercedes: {
    hasCalibratedCoordinates: true,
    slots: {
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 6.2,
        y: 65.0,
        boxBand: 'top',
        boxIndex: 0,
        pinPosition: 'top',
        description: 'Bico estilizado',
      },
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 12.0,
        y: 71.5,
        boxBand: 'bottom',
        boxIndex: 0,
        pinPosition: 'bottom',
        description: 'Asa dianteira',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.5,
        y: 57.5,
        boxBand: 'top',
        boxIndex: 1,
        pinPosition: 'top',
        description: 'Sidepod aerodinâmico',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 66.5,
        y: 44.5,
        boxBand: 'top',
        boxIndex: 2,
        pinPosition: 'top',
        description: 'Carenagem do motor Mercedes',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 89.5,
        y: 46.5,
        boxBand: 'top',
        boxIndex: 3,
        pinPosition: 'top',
        description: 'Asa traseira',
      },
    },
  },
  mclaren: {
    hasCalibratedCoordinates: true,
    slots: {
      nose: {
        slot: 'nose',
        name: 'Bico',
        nameEn: 'Nose',
        x: 6.2,
        y: 65.0,
        boxBand: 'top',
        boxIndex: 0,
        pinPosition: 'top',
        description: 'Bico papaya',
      },
      front_wing: {
        slot: 'front_wing',
        name: 'Asa Dianteira',
        nameEn: 'Front Wing',
        x: 12.0,
        y: 71.5,
        boxBand: 'bottom',
        boxIndex: 0,
        pinPosition: 'bottom',
        description: 'Asa dianteira',
      },
      sidepod: {
        slot: 'sidepod',
        name: 'Lateral',
        nameEn: 'Sidepod',
        x: 53.5,
        y: 57.5,
        boxBand: 'top',
        boxIndex: 1,
        pinPosition: 'top',
        description: 'Sidepod com guelras',
      },
      engine_cover: {
        slot: 'engine_cover',
        name: 'Tampa do Motor',
        nameEn: 'Engine Cover',
        x: 66.5,
        y: 44.5,
        boxBand: 'top',
        boxIndex: 2,
        pinPosition: 'top',
        description: 'Tampa da unidade de potência',
      },
      rear_wing: {
        slot: 'rear_wing',
        name: 'Asa Traseira',
        nameEn: 'Rear Wing',
        x: 89.5,
        y: 46.5,
        boxBand: 'top',
        boxIndex: 3,
        pinPosition: 'top',
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
