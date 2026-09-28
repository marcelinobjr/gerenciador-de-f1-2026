import { describe, it, expect } from 'vitest'
import * as DPA from '@/components/DriverPhotoAvatar'
import * as DPR from '@/lib/driver-photo-resolver'
import * as CDD from '@/lib/canonical-driver-database'
import * as GDP from '@/lib/generated-driver-profiles'

describe('inspect probe', () => {
  it('logs exports', () => {
    // Probing types & signatures
    expect(DPA).toBeDefined()
    expect(DPR).toBeDefined()
    expect(CDD).toBeDefined()
    expect(GDP).toBeDefined()

    // Test specific functions from DPR
    const resolvedReal = DPR.resolveDriverPhoto({ driverId: 'mbj-001', name: 'Max Verstappen' })
    expect(resolvedReal).toBeDefined()

    const resolvedFictional = DPR.resolveDriverPhoto({ driverId: 'mbj-custom-99', name: 'Carlos Teste' })
    expect(resolvedFictional).toBeDefined()
    
    // Check what getCanonicalDriverMaster gives
    expect(CDD.getCanonicalDriverMaster('mbj-001')).not.toBeNull()
    expect(CDD.getCanonicalDriverMaster('mbj-custom-99')).toBeNull()
  })
})
