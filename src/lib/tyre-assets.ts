import type { TireCompound } from '@/types/f1'

/**
 * Mapeamento canônico estrito dos compostos de pneus para os arquivos locais reais em public/pneus/
 * Arquivos existentes verificados no repositório:
 * - Chuva.jpg
 * - compostos.jpg
 * - Duros.jpg
 * - Intermediário.jpg
 * - Macios.jpg
 * - Médios.jpg
 */
export const LOCAL_TYRE_ASSETS: Record<TireCompound, string> = {
  macio: '/pneus/Macios.jpg',
  medio: '/pneus/Médios.jpg',
  duro: '/pneus/Duros.jpg',
  intermediario: '/pneus/Intermediário.jpg',
  chuva_extrema: '/pneus/Chuva.jpg',
}

export const LOCAL_ALL_COMPOUNDS_ASSET = '/pneus/compostos.jpg'

export interface TyreCompoundDisplayMeta {
  compound: TireCompound
  localAsset: string
  name: string
  code: string
  shortLabel: string
  colorHex: string
  badgeBg: string
  badgeText: string
  borderAccent: string
}

export const TYRE_COMPOUND_META: Record<TireCompound, TyreCompoundDisplayMeta> = {
  macio: {
    compound: 'macio',
    localAsset: LOCAL_TYRE_ASSETS.macio,
    name: 'MACIO',
    code: 'Soft',
    shortLabel: 'S',
    colorHex: '#EF4444',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-600',
    borderAccent: '#EF4444',
  },
  medio: {
    compound: 'medio',
    localAsset: LOCAL_TYRE_ASSETS.medio,
    name: 'MÉDIO',
    code: 'Medium',
    shortLabel: 'M',
    colorHex: '#F59E0B',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-600',
    borderAccent: '#F59E0B',
  },
  duro: {
    compound: 'duro',
    localAsset: LOCAL_TYRE_ASSETS.duro,
    name: 'DURO',
    code: 'Hard',
    shortLabel: 'H',
    colorHex: '#64748B',
    badgeBg: 'bg-slate-500/10',
    badgeText: 'text-slate-700',
    borderAccent: '#64748B',
  },
  intermediario: {
    compound: 'intermediario',
    localAsset: LOCAL_TYRE_ASSETS.intermediario,
    name: 'INTERMEDIÁRIO',
    code: 'Intermediate',
    shortLabel: 'I',
    colorHex: '#10B981',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-600',
    borderAccent: '#10B981',
  },
  chuva_extrema: {
    compound: 'chuva_extrema',
    localAsset: LOCAL_TYRE_ASSETS.chuva_extrema,
    name: 'CHUVA EXTREMA',
    code: 'Wet',
    shortLabel: 'W',
    colorHex: '#3B82F6',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-600',
    borderAccent: '#3B82F6',
  },
}

/**
 * Resolver canônico único para imagens locais de pneus.
 * Retorna o path absoluto servido a partir de public/pneus/
 * Zero chamadas externas, zero Google Drive, zero Dropbox, zero placeholders de CDN.
 */
export function getTyreImage(compound?: string | null): string {
  if (!compound) return LOCAL_TYRE_ASSETS.medio

  const normalized = compound.toLowerCase().trim()

  if (
    normalized === 'macio' ||
    normalized === 'soft' ||
    normalized === 'c4' ||
    normalized === 'c5'
  ) {
    return LOCAL_TYRE_ASSETS.macio
  }
  if (
    normalized === 'medio' ||
    normalized === 'médio' ||
    normalized === 'medium' ||
    normalized === 'c3'
  ) {
    return LOCAL_TYRE_ASSETS.medio
  }
  if (
    normalized === 'duro' ||
    normalized === 'hard' ||
    normalized === 'c1' ||
    normalized === 'c2'
  ) {
    return LOCAL_TYRE_ASSETS.duro
  }
  if (
    normalized === 'intermediario' ||
    normalized === 'intermediário' ||
    normalized === 'intermediate' ||
    normalized === 'inters'
  ) {
    return LOCAL_TYRE_ASSETS.intermediario
  }
  if (
    normalized === 'chuva_extrema' ||
    normalized === 'chuva' ||
    normalized === 'wet' ||
    normalized === 'wets'
  ) {
    return LOCAL_TYRE_ASSETS.chuva_extrema
  }

  // Fallback padrão se não mapeado
  return LOCAL_TYRE_ASSETS.medio
}

export function getTyreMeta(compound?: string | null): TyreCompoundDisplayMeta {
  if (!compound) return TYRE_COMPOUND_META.medio
  const normalized = compound.toLowerCase().trim()

  if (
    normalized === 'macio' ||
    normalized === 'soft' ||
    normalized === 'c4' ||
    normalized === 'c5'
  ) {
    return TYRE_COMPOUND_META.macio
  }
  if (
    normalized === 'medio' ||
    normalized === 'médio' ||
    normalized === 'medium' ||
    normalized === 'c3'
  ) {
    return TYRE_COMPOUND_META.medio
  }
  if (
    normalized === 'duro' ||
    normalized === 'hard' ||
    normalized === 'c1' ||
    normalized === 'c2'
  ) {
    return TYRE_COMPOUND_META.duro
  }
  if (
    normalized === 'intermediario' ||
    normalized === 'intermediário' ||
    normalized === 'intermediate' ||
    normalized === 'inters'
  ) {
    return TYRE_COMPOUND_META.intermediario
  }
  if (
    normalized === 'chuva_extrema' ||
    normalized === 'chuva' ||
    normalized === 'wet' ||
    normalized === 'wets'
  ) {
    return TYRE_COMPOUND_META.chuva_extrema
  }

  return TYRE_COMPOUND_META.medio
}
