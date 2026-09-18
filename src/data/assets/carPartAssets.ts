/**
 * Centralizador de Assets de Peças e Componentes do Carro (APEX GP Manager)
 *
 * Permite resolução componentType + spec/version -> asset local limpo
 * com fotos reais de estúdio em cinza para Asa Dianteira, Asa Traseira e Assoalho,
 * e fallback visual limpo para as demais peças ou specs sem foto.
 */

export type CarPartType = 'frontWing' | 'rearWing' | 'floor' | 'sidepods' | 'engine' | 'suspension'

export interface CarPartAssetDefinition {
  partType: CarPartType
  label: string
  photoUrl?: string
  fallbackSvg: string
  aspectRatio?: string
}

import frontWingImg from '@/assets/asadianteira-59e28.png'
import rearWingImg from '@/assets/asatraseira-33f08.png'
import floorImg from '@/assets/assoalho-e8e97.png'
import sidepodsImg from '@/assets/laterais-37ced.jpg'
import engineImg from '@/assets/motor-67601.jpg'
import suspensionImg from '@/assets/suspensao-8b1b8.jpg'

export const CAR_PART_ASSETS: Record<CarPartType, CarPartAssetDefinition> = {
  frontWing: {
    partType: 'frontWing',
    label: 'Asa Dianteira',
    photoUrl: frontWingImg,
    fallbackSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 40 C30 25, 70 25, 90 40 L85 50 C65 35, 35 35, 15 50 Z" fill="#94A3B8" fill-opacity="0.2"/><path d="M45 20 L55 20 L52 40 L48 40 Z" fill="#64748B"/></svg>`,
  },
  rearWing: {
    partType: 'rearWing',
    label: 'Asa Traseira',
    photoUrl: rearWingImg,
    fallbackSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="15" y="15" width="70" height="15" rx="3" fill="#94A3B8" fill-opacity="0.2"/><path d="M25 30 L25 50 M75 30 L75 50 M50 30 L50 50" stroke="#64748B" stroke-width="3"/></svg>`,
  },
  floor: {
    partType: 'floor',
    label: 'Assoalho e Efeito Solo',
    photoUrl: floorImg,
    fallbackSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 20 L80 20 L75 45 L25 45 Z" fill="#94A3B8" fill-opacity="0.2"/><line x1="35" y1="20" x2="35" y2="45" stroke="#64748B"/><line x1="50" y1="20" x2="50" y2="45" stroke="#64748B"/><line x1="65" y1="20" x2="65" y2="45" stroke="#64748B"/></svg>`,
  },
  sidepods: {
    partType: 'sidepods',
    label: 'Laterais & Refrigeração',
    photoUrl: sidepodsImg,
    fallbackSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M25 15 C40 15, 60 25, 75 30 L70 45 C55 40, 35 30, 20 30 Z" fill="#94A3B8" fill-opacity="0.2"/></svg>`,
  },
  engine: {
    partType: 'engine',
    label: 'Unidade de Potência (PU)',
    photoUrl: engineImg,
    fallbackSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="25" y="15" width="50" height="32" rx="4" fill="#94A3B8" fill-opacity="0.2"/><circle cx="50" cy="31" r="8" stroke="#64748B"/></svg>`,
  },
  suspension: {
    partType: 'suspension',
    label: 'Suspensão Push/Pull-rod',
    photoUrl: suspensionImg,
    fallbackSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="15" y1="20" x2="50" y2="35" stroke="#64748B" stroke-width="3"/><line x1="15" y1="45" x2="50" y2="35" stroke="#64748B" stroke-width="3"/><line x1="85" y1="20" x2="50" y2="35" stroke="#64748B" stroke-width="3"/><line x1="85" y1="45" x2="50" y2="35" stroke="#64748B" stroke-width="3"/></svg>`,
  },
}

/**
 * Normaliza a chave de componente
 */
export function normalizeCarPartType(rawKey: string | null | undefined): CarPartType {
  if (!rawKey) return 'frontWing'
  const clean = rawKey.toLowerCase().trim()
  if (clean.includes('front') || clean.includes('asa dianteira')) return 'frontWing'
  if (clean.includes('rear') || clean.includes('asa traseira')) return 'rearWing'
  if (clean.includes('floor') || clean.includes('assoalho')) return 'floor'
  if (clean.includes('sidepod') || clean.includes('lateral') || clean.includes('laterais'))
    return 'sidepods'
  if (
    clean.includes('engine') ||
    clean.includes('pu') ||
    clean.includes('motor') ||
    clean.includes('potencia') ||
    clean.includes('potência')
  )
    return 'engine'
  if (clean.includes('suspension') || clean.includes('suspensao') || clean.includes('suspensão'))
    return 'suspension'
  return 'frontWing'
}

/**
 * Retorna a URL da imagem da peça se existir, ou null para fallback limpo
 */
export function getCarPartPhoto(partKey: string | null | undefined, _spec?: string): string | null {
  const norm = normalizeCarPartType(partKey)
  const asset = CAR_PART_ASSETS[norm]
  return asset?.photoUrl || null
}

/**
 * Retorna o SVG de fallback limpo como Data URL
 */
export function getCarPartFallbackSvg(partKey: string | null | undefined): string {
  const norm = normalizeCarPartType(partKey)
  const asset = CAR_PART_ASSETS[norm] || CAR_PART_ASSETS.frontWing
  return `data:image/svg+xml;utf8,${encodeURIComponent(asset.fallbackSvg)}`
}
