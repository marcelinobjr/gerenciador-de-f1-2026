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
  driverId?: string
  km?: number
  test_type?: string
  circuit?: string
  date?: string
  status?: string // ex: 'completed' | 'cancelled' | 'pending'
}

/**
 * Calcula a quilometragem total acumulada de testes válidos e concluídos do piloto.
 * Não duplica nem inventa dados; soma exclusivamente atividades registradas e concluídas.
 */
export function calculateDriverTotalTestMileage(
  driverId: string,
  testsList?: DriverTestKmRecord[] | null,
  fallbackRecords?: Array<{
    km?: number
    driver_id?: string
    driverId?: string
    status?: string
  }> | null,
): number {
  if (!driverId) return 0
  let totalKm = 0

  // Deduplicação por id se o teste possuir chave identificadora única
  const seenTestIds = new Set<string>()

  if (Array.isArray(testsList) && testsList.length > 0) {
    for (const test of testsList) {
      const tDriverId = test.driver_id || test.driverId
      if (tDriverId === driverId) {
        // Se o teste possui status e não está concluído/válido (ex: cancelled, pending, failed), ignora
        if (
          test.status &&
          test.status.toLowerCase() !== 'completed' &&
          test.status.toLowerCase() !== 'concluido' &&
          test.status.toLowerCase() !== 'concluído'
        ) {
          continue
        }

        if (test.id) {
          if (seenTestIds.has(test.id)) continue
          seenTestIds.add(test.id)
        }

        const kmNum = Number(test.km) || 0
        if (kmNum > 0) {
          totalKm += kmNum
        }
      }
    }
  }

  if (totalKm === 0 && Array.isArray(fallbackRecords) && fallbackRecords.length > 0) {
    for (const test of fallbackRecords) {
      const tDriverId = test.driver_id || test.driverId
      if (tDriverId === driverId) {
        if (
          test.status &&
          test.status.toLowerCase() !== 'completed' &&
          test.status.toLowerCase() !== 'concluido' &&
          test.status.toLowerCase() !== 'concluído'
        ) {
          continue
        }

        const kmNum = Number(test.km) || 0
        if (kmNum > 0) {
          totalKm += kmNum
        }
      }
    }
  }

  return totalKm
}
