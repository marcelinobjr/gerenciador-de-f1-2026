/**
 * Centralizador de Acesso a Assets do Universo F1 2026
 *
 * Fornece helpers universais e seguros para obter imagens e logotipos
 * com resolução prioritária em assets locais (/assets/...) e fallbacks
 * limpos sem ícone de imagem quebrada.
 */

export * from './teamAssets'
export * from './driverAssets'
export * from './staffAssets'
export * from './circuitAssets'
export * from './carPartAssets'

import { getTeamLogo, getTeamSideView, getTeamReducedLogoUrl } from './teamAssets'
import { getDriverImage } from './driverAssets'
import { getStaffImage } from './staffAssets'
import { getCircuitImage } from './circuitAssets'
import { getCarPartPhoto } from './carPartAssets'

export const AssetResolver = {
  getTeamLogo,
  getTeamSideView,
  getTeamReducedLogoUrl,
  getDriverImage,
  getStaffImage,
  getCircuitImage,
  getCarPartPhoto,
}
