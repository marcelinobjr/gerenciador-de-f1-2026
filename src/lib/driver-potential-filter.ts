/**
 * DRIVERS-POTENTIAL-FILTER-01: Funções puras canônicas para resolução e filtragem de potencial de pilotos
 */

export function getDriverCanonicalPotential(pilot: any): number | undefined {
  if (!pilot) return undefined
  const rawRec = pilot.rawDbRecord as any

  const candidate =
    rawRec?.perceived_potential ??
    rawRec?.true_potential ??
    rawRec?.procedural_data?.perceivedPotential ??
    (pilot.potentialMin !== undefined && pilot.potentialMax !== undefined
      ? Math.round((pilot.potentialMin + pilot.potentialMax) / 2)
      : undefined)

  if (candidate === undefined || candidate === null || isNaN(candidate)) {
    return undefined
  }

  return Number(candidate)
}

export type PotentialFilterOption = 'all' | '90_100' | '80_89' | '70_79' | '60_69' | 'below_60'

export function filterByPotential(pilot: any, filter: PotentialFilterOption | string): boolean {
  if (filter === 'all') return true

  const potential = getDriverCanonicalPotential(pilot)
  if (potential === undefined) {
    return false
  }

  if (filter === '90_100') {
    return potential >= 90 && potential <= 100
  }
  if (filter === '80_89') {
    return potential >= 80 && potential < 90
  }
  if (filter === '70_79') {
    return potential >= 70 && potential < 80
  }
  if (filter === '60_69') {
    return potential >= 60 && potential < 70
  }
  if (filter === 'below_60') {
    return potential < 60
  }

  return true
}
