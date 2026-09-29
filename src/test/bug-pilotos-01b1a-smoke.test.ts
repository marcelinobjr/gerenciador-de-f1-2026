import { describe, it, expect } from 'vitest'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { resolveCanonicalDriverImagePath } from '@/lib/driver-canonical-service'
import { getCanonicalAssetId } from '@/lib/canonical-driver-database'

describe('BUG-PILOTOS-01B1A: Micro-Patch Smoke Tests', () => {
  // B1A-SMOKE-01: Alex Dunne (PB ID hl14dawcbv4jv79) -> /pilotos/DRV_0042.jpg
  it('B1A-SMOKE-01: Alex Dunne (PB ID hl14dawcbv4jv79) resolve para /pilotos/DRV_0042.jpg', () => {
    const pbId = 'hl14dawcbv4jv79'
    expect(getCanonicalAssetId(pbId)).toBe('DRV_0042')
    expect(resolveCanonicalDriverImagePath(pbId)).toBe('/pilotos/DRV_0042.jpg')

    const photoRes = resolveDriverPhoto({ driverId: pbId })
    expect(photoRes.url).toBe('/pilotos/DRV_0042.jpg')
    expect(photoRes.candidateUrls).toContain('/pilotos/DRV_0042.jpg')
  })

  // B1A-SMOKE-02: Chase Elliott (PB ID m2tpbn2r0mak1ut) -> /pilotos/DRV_0006.jpg
  it('B1A-SMOKE-02: Chase Elliott (PB ID m2tpbn2r0mak1ut) resolve para /pilotos/DRV_0006.jpg', () => {
    const pbId = 'm2tpbn2r0mak1ut'
    expect(getCanonicalAssetId(pbId)).toBe('DRV_0006')
    expect(resolveCanonicalDriverImagePath(pbId)).toBe('/pilotos/DRV_0006.jpg')

    const photoRes = resolveDriverPhoto({ driverId: pbId })
    expect(photoRes.url).toBe('/pilotos/DRV_0006.jpg')
    expect(photoRes.candidateUrls).toContain('/pilotos/DRV_0006.jpg')
  })

  // B1A-SMOKE-03: Brad Keselowski (PB ID zdxbpd8b2jrtq1y) -> /pilotos/DRV_0004.jpg
  it('B1A-SMOKE-03: Brad Keselowski (PB ID zdxbpd8b2jrtq1y) resolve para /pilotos/DRV_0004.jpg', () => {
    const pbId = 'zdxbpd8b2jrtq1y'
    expect(getCanonicalAssetId(pbId)).toBe('DRV_0004')
    expect(resolveCanonicalDriverImagePath(pbId)).toBe('/pilotos/DRV_0004.jpg')

    const photoRes = resolveDriverPhoto({ driverId: pbId })
    expect(photoRes.url).toBe('/pilotos/DRV_0004.jpg')
    expect(photoRes.candidateUrls).toContain('/pilotos/DRV_0004.jpg')
  })
})
