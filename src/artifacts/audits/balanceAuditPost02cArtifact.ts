import { calibration01aBaselineService } from '@/services/calibration01aBaselineService'
import type { Calibration01aArtifact } from '@/services/calibration01aBaselineService'

// Geração inicial síncrona
export const POST_02C_AUDIT_DATA: Calibration01aArtifact =
  calibration01aBaselineService.runFullMeasurement({
    qualiIterations: 200,
    raceIterations: 100,
    deterministicSeed: 20260315,
  })

export default POST_02C_AUDIT_DATA
