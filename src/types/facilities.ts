/**
 * Arquivo de Compatibilidade Legada de Instalações (Fase 3D -> Fase 4A)
 * Reexporta os modelos e definições canônicas de 9 instalações sem quebrar imports legados.
 */

export * from './canonical-facilities'
export * from './canonical-facilities-data'

import {
  CanonicalFacilityId,
  FacilityDefinition as CanonicalFacilityDefinition,
} from './canonical-facilities'
import {
  CANONICAL_FACILITIES_DEFINITIONS,
  STANDARD_UPGRADE_SPECS,
} from './canonical-facilities-data'

/** Alias de compatibilidade */
export type FacilityType = CanonicalFacilityId
export type FacilityDefinition = CanonicalFacilityDefinition

export const FACILITY_UPGRADE_COSTS: Record<number, number> = {
  2: STANDARD_UPGRADE_SPECS[2].capexCost,
  3: STANDARD_UPGRADE_SPECS[3].capexCost,
  4: STANDARD_UPGRADE_SPECS[4].capexCost,
  5: STANDARD_UPGRADE_SPECS[5].capexCost,
}

export const FACILITIES_DEFINITIONS: CanonicalFacilityDefinition[] =
  CANONICAL_FACILITIES_DEFINITIONS
