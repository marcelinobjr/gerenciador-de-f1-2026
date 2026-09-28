import { describe, it, expect } from 'vitest'
import {
  hashDriverId,
  getGeneratedDriverImageUrl,
  GENERATED_DRIVER_IMAGES_COUNT,
  GENERATED_DRIVER_IMAGE_FILES,
} from '@/lib/resolve-driver-image'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import {
  CANONICAL_DRIVERS_MASTER,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
} from '@/lib/canonical-driver-database'

describe('test environment and canonical database', () => {
  it('has pilots and assets loaded', () => {
    expect(MBJ_2026_PILOTS.length).toBeGreaterThan(0)
    expect(CANONICAL_DRIVERS_MASTER.length).toBeGreaterThan(0)
    expect(GENERATED_DRIVER_IMAGES_COUNT).toBe(39)
    expect(GENERATED_DRIVER_IMAGE_FILES.length).toBe(39)
  })
})
