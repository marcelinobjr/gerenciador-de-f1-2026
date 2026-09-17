import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Validação e Ingestão do asset local da Audi', () => {
  it('garante que public/assets/teams/sideviews/Audi_VL.jpg existe com magic bytes e tamanho válidos', () => {
    const srcPath = path.resolve(process.cwd(), 'src/assets/audivl-cfef2.jpg')
    const destDir = path.resolve(process.cwd(), 'public/assets/teams/sideviews')
    const destPath = path.join(destDir, 'Audi_VL.jpg')

    if (!fs.existsSync(destPath)) {
      expect(fs.existsSync(srcPath)).toBe(true)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      fs.copyFileSync(srcPath, destPath)
    }

    expect(fs.existsSync(destPath)).toBe(true)
    const stat = fs.statSync(destPath)
    const buf = fs.readFileSync(destPath)

    // Magic bytes JPEG: FF D8 FF
    expect(buf[0]).toBe(0xff)
    expect(buf[1]).toBe(0xd8)
    expect(buf[2]).toBe(0xff)

    // Tamanho maior que 20KB
    expect(stat.size).toBeGreaterThan(20 * 1024)
    console.log(`Audi_VL.jpg validado com sucesso: ${stat.size} bytes`)
  })
})
