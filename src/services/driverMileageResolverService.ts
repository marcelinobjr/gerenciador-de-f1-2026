/**
 * Canonical Driver Mileage & Test Resolver
 * ACADEMY-DRIVER-INTEGRATION-01
 *
 * Centraliza e calcula a quilometragem total real acumulada em testes de pista
 * para qualquer piloto (Mariana Fagundes ou qualquer outro piloto da base/academia).
 * Fonte canônica: coleção driver_tests ou registros persistidos de testes.
 */

export interface DriverTestKmRecord {
  id?: string
  driver_id?: string
  km?: number
  test_type?: string
  circuit?: string
  date?: string
}

/**
 * Calcula a quilometragem total acumulada de testes válidos do piloto.
 * Não duplica nem inventa dados; soma exclusivamente atividades registradas.
 */
export function calculateDriverTotalTestMileage(
  driverId: string,
  testsList?: DriverTestKmRecord[] | null,
  fallbackRecords?: Array<{ km?: number; driver_id?: string }> | null,
): number {
  if (!driverId) return 0
  let totalKm = 0

  if (Array.isArray(testsList) && testsList.length > 0) {
    for (const test of testsList) {
      if (test.driver_id === driverId) {
        const kmNum = Number(test.km) || 0
        if (kmNum > 0) {
          totalKm += kmNum
        }
      }
    }
  }

  if (totalKm === 0 && Array.isArray(fallbackRecords) && fallbackRecords.length > 0) {
    for (const test of fallbackRecords) {
      if (test.driver_id === driverId) {
        const kmNum = Number(test.km) || 0
        if (kmNum > 0) {
          totalKm += kmNum
        }
      }
    }
  }

  return totalKm
}
