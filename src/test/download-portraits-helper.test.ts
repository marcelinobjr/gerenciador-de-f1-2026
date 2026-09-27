import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Download Portraits Helper', () => {
  it('downloads DRV_0135 and DRV_0136 and copies DRV_0137', async () => {
    const publicPilotos = path.resolve(process.cwd(), 'public/pilotos')
    if (!fs.existsSync(publicPilotos)) {
      fs.mkdirSync(publicPilotos, { recursive: true })
    }

    // 1. Download Mazepin DRV_0135.jpg
    const mazepinUrl =
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/27918979-068c-4c35-80ed-e16c255f350b/drv0135-96f8c.jpg'
    const res135 = await fetch(mazepinUrl)
    expect(res135.ok).toBe(true)
    const buf135 = Buffer.from(await res135.arrayBuffer())
    fs.writeFileSync(path.join(publicPilotos, 'DRV_0135.jpg'), buf135)

    // 2. Download Kvyat DRV_0136.jpg
    const kvyatUrl =
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/27918979-068c-4c35-80ed-e16c255f350b/drv0136-ad5d3.jpg'
    const res136 = await fetch(kvyatUrl)
    expect(res136.ok).toBe(true)
    const buf136 = Buffer.from(await res136.arrayBuffer())
    fs.writeFileSync(path.join(publicPilotos, 'DRV_0136.jpg'), buf136)

    // 3. Bourdais DRV_0137.jpg from src/assets/drv0137-6cd34.jpg
    const bourdaisSource = path.resolve(process.cwd(), 'src/assets/drv0137-6cd34.jpg')
    expect(fs.existsSync(bourdaisSource)).toBe(true)
    fs.copyFileSync(bourdaisSource, path.join(publicPilotos, 'DRV_0137.jpg'))

    // Verify files exist and have non-zero size
    expect(fs.statSync(path.join(publicPilotos, 'DRV_0135.jpg')).size).toBeGreaterThan(1000)
    expect(fs.statSync(path.join(publicPilotos, 'DRV_0136.jpg')).size).toBeGreaterThan(1000)
    expect(fs.statSync(path.join(publicPilotos, 'DRV_0137.jpg')).size).toBeGreaterThan(1000)
  })
})
