import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  getDriverCanonicalKey,
  getCanonicalDisplayName,
  resolveCanonicalDriverImagePath,
  DRIVER_CANONICAL_PHOTO_MAP,
} from '@/lib/driver-canonical-service'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('PIL-GH-B: Validação e Aceitação Bloco 1 Fotos de Pilotos', () => {
  const publicPilotosDir = path.resolve(process.cwd(), 'public/pilotos')

  // Pilotos do Bloco 1 (31 pilotos + Freddie Slater = 32 pilotos)
  const bloco1Pilots: { name: string; expectedAsset: string; aliases?: string[] }[] = [
    { name: 'Alba Hurup Larsen', expectedAsset: 'DRV_0001.jpg', aliases: ['Alba Larsen'] },
    { name: 'Alessandro Pier Guidi', expectedAsset: 'DRV_0081.jpg' },
    { name: 'Alex Dunne', expectedAsset: 'DRV_0042.jpg', aliases: ['Alexander Dunne'] },
    { name: 'Alex Lynn', expectedAsset: 'DRV_0138.jpg' },
    { name: 'Alisha Palmowski', expectedAsset: 'DRV_0082.jpg' },
    { name: 'Amauri Cordell', expectedAsset: 'DRV_0083.jpg', aliases: ['Amaury Cordeel'] },
    { name: 'Antonio Fuoco', expectedAsset: 'DRV_0084.jpg', aliases: ['António Fuoco'] },
    { name: 'Ava Dobson', expectedAsset: 'DRV_0086.jpg' },
    { name: 'Brad Keselowiski', expectedAsset: 'DRV_0004.jpg', aliases: ['Brad Keselowski'] },
    { name: 'Callum Hedge', expectedAsset: 'DRV_0088.jpg' },
    { name: 'Callum Llott', expectedAsset: 'DRV_0139.jpg', aliases: ['Callum Ilott'] },
    { name: 'Callum Voisin', expectedAsset: 'DRV_0140.jpg' },
    { name: 'Chase Elliott', expectedAsset: 'DRV_0006.jpg' },
    { name: 'Christian Mansell', expectedAsset: 'DRV_0141.jpg' },
    { name: 'Christopher Bell', expectedAsset: 'DRV_0048.jpg' },
    { name: 'Connor de Phillippi', expectedAsset: 'DRV_0142.jpg' },
    { name: 'Dane Cameron', expectedAsset: 'DRV_0143.jpg' },
    { name: 'Daniil Kvyat', expectedAsset: 'DRV_0136.jpg' },
    { name: 'Dennis Hauger', expectedAsset: 'DRV_0144.jpg' },
    { name: 'Denny Hamlin', expectedAsset: 'DRV_0051.jpg' },
    { name: 'Dries Vanthoor', expectedAsset: 'DRV_0145.jpg' },
    { name: 'Earl Bamber', expectedAsset: 'DRV_0146.jpg' },
    { name: 'Edoardo Mortara', expectedAsset: 'DRV_0090.jpg' },
    { name: 'Ella Lloyd', expectedAsset: 'DRV_0091.jpg' },
    { name: 'Ella Stevens', expectedAsset: 'DRV_0147.jpg' },
    {
      name: 'Emerson Fittipaldi Jr.',
      expectedAsset: 'DRV_0148.jpg',
      aliases: ['Emerson Fittipaldi Junior'],
    },
    { name: 'Emma Felbermayr', expectedAsset: 'DRV_0010.jpg' },
    { name: 'Enzo Fittipaldi', expectedAsset: 'DRV_0149.jpg' },
    { name: 'Esmee Kosterman', expectedAsset: 'DRV_0092.jpg' },
    { name: 'Gabriele Mini', expectedAsset: 'DRV_0013.jpg', aliases: ['Gabriele Minì'] },
    { name: 'Helio Castroneves', expectedAsset: 'DRV_0151.jpg', aliases: ['Hélio Castroneves'] },
  ]

  // PIL-GH-B-01: todos os pilotos do bloco 1 resolvem para path não vazio
  it('PIL-GH-B-01: todos os pilotos do bloco 1 resolvem para path não vazio', () => {
    for (const pilot of bloco1Pilots) {
      const resolved = resolveCanonicalDriverImagePath(null, pilot.name)
      expect(resolved, `Path para ${pilot.name} não pode ser nulo ou vazio`).toBeTruthy()
      expect(typeof resolved).toBe('string')
      expect(resolved!.length).toBeGreaterThan(0)
    }

    // Freddie Slater também deve resolver para path não vazio
    const slaterPath = resolveCanonicalDriverImagePath(null, 'Freddie Slater')
    expect(slaterPath, 'Path para Freddie Slater não pode ser nulo ou vazio').toBeTruthy()
  })

  // PIL-GH-B-02: todos os paths resolvidos existem
  it('PIL-GH-B-02: todos os paths resolvidos existem no disco local em public', () => {
    for (const pilot of bloco1Pilots) {
      const resolved = resolveCanonicalDriverImagePath(null, pilot.name)
      expect(resolved).toBeTruthy()
      const diskPath = path.resolve(process.cwd(), 'public', resolved!.replace(/^\//, ''))
      const fileExists = fs.existsSync(diskPath)
      expect(fileExists, `Arquivo no disco para ${pilot.name} (${diskPath}) deve existir`).toBe(
        true,
      )
    }
  })

  // PIL-GH-B-03: Alex Dunne/Alexander Dunne retornam a mesma foto
  it('PIL-GH-B-03: Alex Dunne e Alexander Dunne retornam a mesma foto', () => {
    const photo1 = resolveDriverPhoto({ name: 'Alex Dunne' })
    const photo2 = resolveDriverPhoto({ name: 'Alexander Dunne' })
    expect(photo1.url).toBeTruthy()
    expect(photo1.url).toBe(photo2.url)
    expect(photo1.url).toBe('/pilotos/DRV_0042.jpg')
  })

  // PIL-GH-B-04: Gabriele Mini/Minì retornam a mesma foto
  it('PIL-GH-B-04: Gabriele Mini e Gabriele Minì retornam a mesma foto', () => {
    const photo1 = resolveDriverPhoto({ name: 'Gabriele Mini' })
    const photo2 = resolveDriverPhoto({ name: 'Gabriele Minì' })
    expect(photo1.url).toBeTruthy()
    expect(photo1.url).toBe(photo2.url)
    expect(photo1.url).toBe('/pilotos/DRV_0013.jpg')
  })

  // PIL-GH-B-05: nenhum piloto do bloco 1 cai em placeholder se o arquivo existe
  it('PIL-GH-B-05: nenhum piloto do bloco 1 cai em placeholder se o arquivo existe', () => {
    for (const pilot of bloco1Pilots) {
      const photo = resolveDriverPhoto({ name: pilot.name })
      expect(photo.sourceType, `${pilot.name} não deve cair em fallback_initials`).not.toBe(
        'fallback_initials',
      )
      expect(photo.url, `${pilot.name} deve ter URL válida de asset real`).toBe(
        `/pilotos/${pilot.expectedAsset}`,
      )
    }
  })

  // PIL-GH-B-06: Freddie Slater resolve para o filename REAL encontrado no repositório
  it('PIL-GH-B-06: Freddie Slater resolve para o filename REAL encontrado (DRV_0150.jpg)', () => {
    const hasDrv0150 = fs.existsSync(path.join(publicPilotosDir, 'DRV_0150.jpg'))
    const hasDrvDrv0150 = fs.existsSync(path.join(publicPilotosDir, 'DRV_DRV_0150.jpg'))

    // O arquivo real verificado no repositório é DRV_0150.jpg
    expect(hasDrv0150).toBe(true)
    expect(hasDrvDrv0150).toBe(false)

    const photo = resolveDriverPhoto({ name: 'Freddie Slater' })
    expect(photo.url).toBe('/pilotos/DRV_0150.jpg')
    expect(photo.sourceType).toBe('canonical_real')

    const diskPath = path.resolve(process.cwd(), 'public', photo.url!.replace(/^\//, ''))
    expect(
      fs.existsSync(diskPath),
      `Arquivo físico para Freddie Slater em ${diskPath} deve existir`,
    ).toBe(true)
  })

  // PIL-GH-B-07: Felipe Albuquerque registrado como pendente para Bloco E
  it('PIL-GH-B-07: Felipe Albuquerque preservado sem inventar número no Bloco B', () => {
    const res = resolveCanonicalDriverImagePath(null, 'Felipe Albuquerque')
    expect(res).toBeTruthy()
  })
})
