import { describe, it, expect } from 'vitest'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { resolveCanonicalDriverImagePath } from '@/lib/driver-canonical-service'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import { getDriveStoragePhotoUrl } from '@/lib/drive-storage-photos'

describe('Rafaela Ferreira Canonical Photo Resolution', () => {
  it('maps drv_rafaela_ferreira and direct tokens to DRV_0071', () => {
    expect((DRIVER_PORTRAIT_ASSET_MAP as any).drv_rafaela_ferreira).toBe('DRV_0071')
    expect(resolveCanonicalDriverImagePath(undefined, 'Rafaela Ferreira')).toBe(
      '/pilotos/DRV_0071.jpg',
    )
    expect(resolveCanonicalDriverImagePath('mhi73bs998erxn5', 'Rafaela Ferreira')).toBe(
      '/pilotos/DRV_0071.jpg',
    )
  })

  it('resolves canonical DRV_0071 even when visualIdentity carries a legacy customImageUrl or procedural portrait profile', () => {
    const legacyDriveUrl =
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPUnxA_mr7eqrAQTgsNpkf_d58C0HF1Qno81X8TWB5FH95UhRTMXMiMW84y6VwqTJzWOsiycugA9T3SvCCNG8Ci50mOfz9yIMBjTxk=s0'

    const resolved = resolveDriverPhoto({
      name: 'Rafaela Ferreira',
      driverId: 'mhi73bs998erxn5',
      visualIdentity: {
        gender: 'female',
        generatedPortraitProfileId: 'Piloto_50',
        customImageUrl: legacyDriveUrl,
      } as any,
    })

    // Canonical photo must be first and preferred
    expect(resolved.url).toBe('/pilotos/DRV_0071.jpg')
    expect(resolved.candidateUrls[0]).toBe('/pilotos/DRV_0071.jpg')
    expect(resolved.sourceType).toBe('canonical_real')
    expect(resolved.assetId).toBe('DRV_0071')

    // Legacy URL can exist only as a secondary fallback candidate
    if (resolved.candidateUrls.length > 1) {
      expect(resolved.candidateUrls[1]).toBe(legacyDriveUrl)
    }
  })

  it('resolves canonical photo for Rafaela Ferreira when only name is provided', () => {
    const resolved = resolveDriverPhoto({
      name: 'Rafaela Ferreira',
    })

    expect(resolved.url).toBe('/pilotos/DRV_0071.jpg')
    expect(resolved.candidateUrls[0]).toBe('/pilotos/DRV_0071.jpg')
    expect(resolved.sourceType).toBe('canonical_real')
  })

  it('keeps genuine custom images for player-created newgen/procedural drivers (isCustom=true)', () => {
    const playerCustomUrl = 'https://custom-avatar.com/my-pilot.png'
    const resolved = resolveDriverPhoto({
      name: 'Piloto Criado Jogador 99',
      driverId: 'drv_proc_player_99',
      visualIdentity: {
        isCustom: true,
        customImageUrl: playerCustomUrl,
      } as any,
    })

    expect(resolved.url).toBe(playerCustomUrl)
    expect(resolved.candidateUrls[0]).toBe(playerCustomUrl)
    expect(resolved.sourceType).toBe('custom')
  })

  it('manifest and drive storage map have sanitized direct paths for 18-Rafaela_Ferreira.jpg', () => {
    const url = getDriveStoragePhotoUrl('18-Rafaela_Ferreira.jpg')
    expect(url).toBe('/pilotos/DRV_0071.jpg')
  })
})
