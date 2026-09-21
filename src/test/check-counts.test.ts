import { describe, it, expect } from 'vitest'

describe('FW-FOTOS-01: Verificação de arquivos em disco', () => {
  it('confirma contagem de fotos', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const pilotosDir = path.resolve('public/pilotos')
    const geradosDir = path.resolve('public/pilotos-gerados')

    const pilotosFiles = fs.readdirSync(pilotosDir).filter((f: string) => f.endsWith('.jpg'))
    const geradosFiles = fs.readdirSync(geradosDir).filter((f: string) => f.endsWith('.jpg'))

    expect(pilotosFiles).toHaveLength(134)
    expect(geradosFiles).toHaveLength(13)

    for (let i = 1; i <= 13; i++) {
      const num = i < 10 ? '0' + i : String(i)
      expect(geradosFiles).toContain(`Piloto_${num}.jpg`)
      expect(pilotosFiles).not.toContain(`Piloto_${num}.jpg`)
    }
  })
})
