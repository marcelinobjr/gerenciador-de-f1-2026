import { describe, it, expect } from 'vitest'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  resolveCanonicalDriverImagePath,
  normalizeDriverNameToken,
  DRIVER_CANONICAL_PHOTO_MAP,
} from '@/lib/driver-canonical-service'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { GENERATED_DRIVER_MALE_INDICES } from '@/lib/generated-driver-profiles'
import fs from 'node:fs'
import path from 'node:path'

describe('PIL-GH: Acceptance Tests — Deduplicação e Identidade Canônica', () => {
  // PIL-GH-01: Alex Palou aparece uma vez
  it('PIL-GH-01: Alex Palou tem a mesma chave canônica para variantes com e sem acento', () => {
    const k1 = getDriverCanonicalKey('Alex Palou')
    const k2 = getDriverCanonicalKey('Álex Palou')
    expect(k1).toBe(k2)
    expect(getCanonicalDisplayName('Álex Palou')).toBe('Alex Palou')
  })

  // PIL-GH-02: Alex/Alexander Albon → uma identidade
  it('PIL-GH-02: Alex/Alexander Albon compartilham chave canônica e identidade', () => {
    const k1 = getDriverCanonicalKey('Alex Albon')
    const k2 = getDriverCanonicalKey('Alexander Albon')
    expect(k1).toBe(k2)
  })

  // PIL-GH-03: Alex/Alexander Dunne → uma identidade
  it('PIL-GH-03: Alex/Alexander Dunne compartilham chave canônica e identidade', () => {
    const k1 = getDriverCanonicalKey('Alex Dunne')
    const k2 = getDriverCanonicalKey('Alexander Dunne')
    expect(k1).toBe(k2)
  })

  // PIL-GH-04: Andre/André Lotterer → uma identidade
  it('PIL-GH-04: Andre/André Lotterer compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Andre Lotterer')
    const k2 = getDriverCanonicalKey('André Lotterer')
    expect(k1).toBe(k2)
  })

  // PIL-GH-05: Antonio/António Félix da Costa → uma identidade
  it('PIL-GH-05: Antonio/António Félix da Costa compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Antonio Felix da Costa')
    const k2 = getDriverCanonicalKey('António Félix da Costa')
    expect(k1).toBe(k2)
  })

  // PIL-GH-06: Gabriele Mini/Minì → uma identidade
  it('PIL-GH-06: Gabriele Mini/Minì compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Gabriele Mini')
    const k2 = getDriverCanonicalKey('Gabriele Minì')
    expect(k1).toBe(k2)
  })

  // PIL-GH-07: Robin Frijns WEC não aparece no catálogo MBJ
  it('PIL-GH-07: Robin Frijns WEC não deve existir em MBJ_2026_PILOTS', () => {
    const wecDriver = MBJ_2026_PILOTS.find(
      (p) => p.name.toLowerCase().trim() === 'robin frijns wec',
    )
    expect(wecDriver).toBeUndefined()
  })

  // PIL-GH-08: Robin Frijns aparece uma vez
  it('PIL-GH-08: Robin Frijns tem registro único no catálogo', () => {
    const frijnsEntries = MBJ_2026_PILOTS.filter(
      (p) => getDriverCanonicalKey(p.name) === getDriverCanonicalKey('Robin Frijns'),
    )
    expect(frijnsEntries.length).toBe(1)
    expect(frijnsEntries[0].name).toBe('Robin Frijns')
  })

  // TESTES DE ALIASES
  it('PIL-GH-ALIASES: aliases resolvem para as identidades corretas', () => {
    expect(getCanonicalDisplayName('Nicky de Vries')).toBe('Nyck de Vries')
    expect(getCanonicalDisplayName('Rubens Barichello')).toBe('Rubens Barrichello')
    expect(getCanonicalDisplayName('Lucas di Gassi')).toBe('Lucas di Grassi')
    expect(getCanonicalDisplayName('William Bryon')).toBe('William Byron')
    expect(getCanonicalDisplayName('Jose Maria Lopez')).toBe('José María López')
    expect(getCanonicalDisplayName("Patricio O'Ward")).toBe("Pato O'Ward")
    expect(getCanonicalDisplayName('Rene Rast')).toBe('René Rast')
    expect(getCanonicalDisplayName('Noel León')).toBe('Noel León')
    expect(getCanonicalDisplayName('Noel Leon')).toBe('Noel León')
    expect(getCanonicalDisplayName('Sebastián Montoya')).toBe('Sebastián Montoya')
    expect(getCanonicalDisplayName('Sebastian Montoya')).toBe('Sebastián Montoya')
    expect(getCanonicalDisplayName('Roman Stanêk')).toBe('Roman Staněk')
    expect(getCanonicalDisplayName('Roman Stanek')).toBe('Roman Staněk')
    expect(getCanonicalDisplayName('Kévin Estre')).toBe('Kévin Estre')
    expect(getCanonicalDisplayName('Kevin Estre')).toBe('Kévin Estre')
  })

  // TESTE DE FOTOS BLOCO 1
  it('PIL-GH-FOTO-BLOCO1: todos os pilotos do Bloco 1 resolvem para assets existentes', () => {
    const bloco1: [string, string][] = [
      ['Alba Hurup Larsen', 'DRV_0001'],
      ['Alessandro Pier Guidi', 'DRV_0081'],
      ['Alex Dunne', 'DRV_0042'],
      ['Alex Lynn', 'DRV_0138'],
      ['Alisha Palmowski', 'DRV_0082'],
      ['Amauri Cordell', 'DRV_0083'],
      ['Antonio Fuoco', 'DRV_0084'],
      ['Ava Dobson', 'DRV_0086'],
      ['Brad Keselowiski', 'DRV_0004'],
      ['Callum Hedge', 'DRV_0088'],
      ['Callum Llott', 'DRV_0139'],
      ['Callum Voisin', 'DRV_0140'],
      ['Chase Elliott', 'DRV_0006'],
      ['Christian Mansell', 'DRV_0141'],
      ['Christopher Bell', 'DRV_0048'],
      ['Connor de Phillippi', 'DRV_0142'],
      ['Dane Cameron', 'DRV_0143'],
      ['Daniil Kvyat', 'DRV_0136'],
      ['Dennis Hauger', 'DRV_0144'],
      ['Denny Hamlin', 'DRV_0051'],
      ['Dries Vanthoor', 'DRV_0145'],
      ['Earl Bamber', 'DRV_0146'],
      ['Edoardo Mortara', 'DRV_0090'],
      ['Ella Lloyd', 'DRV_0091'],
      ['Ella Stevens', 'DRV_0147'],
      ['Emerson Fittipaldi Jr.', 'DRV_0148'],
      ['Emma Felbermayr', 'DRV_0010'],
      ['Enzo Fittipaldi', 'DRV_0149'],
      ['Esmee Kosterman', 'DRV_0092'],
      ['Freddie Slater', 'DRV_0150'],
      ['Gabriele Mini', 'DRV_0013'],
      ['Helio Castroneves', 'DRV_0151'],
    ]

    for (const [name, assetId] of bloco1) {
      const res = resolveDriverPhoto({ name })
      expect(res.url).toBe(`/pilotos/${assetId}.jpg`)
      const exists = fs.existsSync(path.resolve(process.cwd(), `public/pilotos/${assetId}.jpg`))
      expect(exists).toBe(true)
    }
  })

  // TESTE DE FOTOS BLOCO 2
  it('PIL-GH-FOTO-BLOCO2: todos os pilotos do Bloco 2 resolvem para assets existentes', () => {
    const bloco2: [string, string][] = [
      ['Jade Jacquet', 'DRV_0097'],
      ['James Calado', 'DRV_0099'],
      ['Joey Logano', 'DRV_0058'],
      ['Jonathan Browne', 'DRV_0100'],
      ['Josef Nesgarden', 'DRV_0016'],
      ['Josep Maria Marti', 'DRV_0101'],
      ['Joshua Dürksen', 'DRV_0116'],
      ['Kamui Kobayashi', 'DRV_0017'],
      ['Kaylee Countryman', 'DRV_0102'],
      ['Kévin Estre', 'DRV_0103'],
      ['Kevin Magnussen', 'DRV_0059'],
      ['Lisa Billard', 'DRV_0066'],
      ['Lucas di Gassi', 'DRV_0067'],
      ['Mathilda Paatz', 'DRV_0021'],
      ['Myles Rowe', 'DRV_0122'],
      ['Natalia Granada', 'DRV_0123'],
      ['Nelson Piquet Jr', 'DRV_0026'],
      ['Nick Cassidy', 'DRV_0106'],
      ['Nikita Mazepin', 'DRV_0135'],
      ['Nikola Tsolov', 'DRV_0027'],
      ['Nina Gademan', 'DRV_0028'],
      ['Noel León', 'DRV_0124'],
      ['Nolan Allaer', 'DRV_0125'],
      ['Oliver Goethe', 'DRV_0126'],
      ['Payton Westcott', 'DRV_0030'],
      ['Rachel Robertson', 'DRV_0112'],
      ['Rafael Villagómez', 'DRV_0127'],
      ['Rafaela Ferreira', 'DRV_0071'],
      ['Richard Verschoor', 'DRV_0128'],
      ['Ritomo Miyata', 'DRV_0129'],
      ['Robert Kubica', 'DRV_0113'],
      ['Roman Bilinski', 'DRV_0130'],
      ['Roman Stanêk', 'DRV_0131'],
      ['Rubens Barichello', 'DRV_0072'],
      ['Ryan Blaney', 'DRV_0073'],
      ['Ryo Hirakawa', 'DRV_0033'],
      ['Salvador de Alba', 'DRV_0132'],
      ['Scott Dixon', 'DRV_0074'],
      ['Sebastián Montoya', 'DRV_0134'],
      ['Tyler Reddick', 'DRV_0114'],
      ['Will Power', 'DRV_0077'],
      ['William Bryon', 'DRV_0078'],
    ]

    for (const [name, assetId] of bloco2) {
      const res = resolveDriverPhoto({ name })
      expect(res.url).toBe(`/pilotos/${assetId}.jpg`)
      const exists = fs.existsSync(path.resolve(process.cwd(), `public/pilotos/${assetId}.jpg`))
      expect(exists).toBe(true)
    }
  })

  // TESTE DE FOTOS BLOCO D: NOVOS PILOTOS
  it('PIL-GH-FOTO-BLOCO-D: novos pilotos do Bloco D resolvem para assets existentes', () => {
    const blocoD: [string, string][] = [
      ['Jack Aitken', 'DRV_0152'],
      ['Jacob Abel', 'DRV_0153'],
      ['Jordan Taylor', 'DRV_0154'],
      ['Jose Maria Lopez', 'DRV_0155'],
      ['Kyffin Simpson', 'DRV_0156'],
      ['Linus Lundqvist', 'DRV_0157'],
      ['Logan Sargeant', 'DRV_0158'],
      ['Lois Delétraz', 'DRV_0159'],
      ['Marco Wittmann', 'DRV_0160'],
      ['Marcus Armstrong', 'DRV_0161'],
      ['Mathieu Jaminet', 'DRV_0162'],
      ['Matt Campbell', 'DRV_0163'],
      ['Matteo Cairoli', 'DRV_0164'],
      ['Mike Conway', 'DRV_0165'],
      ['Mirko Bortolotti', 'DRV_0166'],
      ['Nick Yelloly', 'DRV_0167'],
      ['Nolan Siegel', 'DRV_0168'],
      ['Norman Nato', 'DRV_0169'],
      ['Nicky de Vries', 'DRV_0170'],
      ["Patricio O'Ward", 'DRV_0171'],
      ['Raffaele Marciello', 'DRV_0172'],
      ['Rene Rast', 'DRV_0173'],
      ['Renger van der Zande', 'DRV_0174'],
      ['Ricky Taylor', 'DRV_0175'],
      ['Rinus VeeKay', 'DRV_0176'],
      ['Robert Shwartzman', 'DRV_0177'],
      ['Robin Frijns', 'DRV_0178'],
      ['Romain Grosjean', 'DRV_0179'],
      ['Sheldon van der Linde', 'DRV_0180'],
      ['Takuma Sato', 'DRV_0181'],
      ['Tim Tramnitz', 'DRV_0182'],
      ['Tom Blomqvist', 'DRV_0183'],
      ['Tony Kanaan', 'DRV_0184'],
      ['Tuukka Taponen', 'DRV_0185'],
      ['Ugo Ugochukwu', 'DRV_0186'],
      ['Will Stevens', 'DRV_0187'],
      ["Zak O'Sullivan", 'DRV_0188'],
    ]

    for (const [name, assetId] of blocoD) {
      const res = resolveDriverPhoto({ name })
      expect(res.url).toBe(`/pilotos/${assetId}.jpg`)
      const exists = fs.existsSync(path.resolve(process.cwd(), `public/pilotos/${assetId}.jpg`))
      expect(exists).toBe(true)
    }
  })

  // TESTE DE PILOTOS-GERADOS: Felipe Albuquerque, Mariana Costa, Noah Taylor
  it('PIL-GH-PILOTOS-GERADOS: Felipe Albuquerque, Mariana Costa e Noah Taylor usam pilotos-gerados com sexo compatível', () => {
    // 1. Felipe Albuquerque -> Piloto_14 (masculino)
    const felipeRes = resolveDriverPhoto({ name: 'Felipe Albuquerque' })
    expect(felipeRes.url).toBe('/pilotos-gerados/Piloto_14.jpg')
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/pilotos-gerados/Piloto_14.jpg'))).toBe(true)
    expect(GENERATED_DRIVER_MALE_INDICES.has(14)).toBe(true)

    // 2. Mariana Costa -> Piloto_55 (feminino)
    const marianaRes = resolveDriverPhoto({ name: 'Mariana Costa' })
    expect(marianaRes.url).toBe('/pilotos-gerados/Piloto_55.jpg')
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/pilotos-gerados/Piloto_55.jpg'))).toBe(true)
    expect(GENERATED_DRIVER_MALE_INDICES.has(55)).toBe(false) // feminino

    // 3. Noah Taylor -> Piloto_58 (masculino)
    const noahRes = resolveDriverPhoto({ name: 'Noah Taylor' })
    expect(noahRes.url).toBe('/pilotos-gerados/Piloto_58.jpg')
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/pilotos-gerados/Piloto_58.jpg'))).toBe(true)
    expect(GENERATED_DRIVER_MALE_INDICES.has(58)).toBe(true) // masculino
  })

  // TESTE DE INTEGRIDADE GLOBAL DO MAPA
  it('PIL-GH-INTEGRIDADE-MAPA: todo arquivo mapeado em DRIVER_CANONICAL_PHOTO_MAP existe no disco', () => {
    for (const [key, assetPath] of Object.entries(DRIVER_CANONICAL_PHOTO_MAP)) {
      const fullPath = path.resolve(process.cwd(), `public${assetPath}`)
      const exists = fs.existsSync(fullPath)
      expect(exists, `Arquivo ${assetPath} para chave ${key} deve existir no disco`).toBe(true)
    }
  })

  // Testes de Resolução de Fotos Bloco 1
  it('Resolve fotos do Bloco 1 para arquivos físicos válidos em public', () => {
    const bloco1Map: Record<string, string> = {
      'Alba Hurup Larsen': '/pilotos/DRV_0001.jpg',
      'Alessandro Pier Guidi': '/pilotos/DRV_0081.jpg',
      'Alex Dunne': '/pilotos/DRV_0042.jpg',
      'Alex Lynn': '/pilotos/DRV_0138.jpg',
      'Alisha Palmowski': '/pilotos/DRV_0082.jpg',
      'Amauri Cordell': '/pilotos/DRV_0083.jpg',
      'Antonio Fuoco': '/pilotos/DRV_0084.jpg',
      'Ava Dobson': '/pilotos/DRV_0086.jpg',
      'Brad Keselowiski': '/pilotos/DRV_0004.jpg',
      'Callum Hedge': '/pilotos/DRV_0088.jpg',
      'Callum Llott': '/pilotos/DRV_0139.jpg',
      'Callum Voisin': '/pilotos/DRV_0140.jpg',
      'Chase Elliott': '/pilotos/DRV_0006.jpg',
      'Christian Mansell': '/pilotos/DRV_0141.jpg',
      'Christopher Bell': '/pilotos/DRV_0048.jpg',
      'Connor de Phillippi': '/pilotos/DRV_0142.jpg',
      'Dane Cameron': '/pilotos/DRV_0143.jpg',
      'Daniil Kvyat': '/pilotos/DRV_0136.jpg',
      'Dennis Hauger': '/pilotos/DRV_0144.jpg',
      'Denny Hamlin': '/pilotos/DRV_0051.jpg',
      'Dries Vanthoor': '/pilotos/DRV_0145.jpg',
      'Earl Bamber': '/pilotos/DRV_0146.jpg',
      'Edoardo Mortara': '/pilotos/DRV_0090.jpg',
      'Ella Lloyd': '/pilotos/DRV_0091.jpg',
      'Ella Stevens': '/pilotos/DRV_0147.jpg',
      'Emerson Fittipaldi Jr.': '/pilotos/DRV_0148.jpg',
      'Emma Felbermayr': '/pilotos/DRV_0010.jpg',
      'Enzo Fittipaldi': '/pilotos/DRV_0149.jpg',
      'Esmee Kosterman': '/pilotos/DRV_0092.jpg',
      'Felipe Albuquerque': '/pilotos-gerados/Piloto_14.jpg',
      'Freddie Slater': '/pilotos/DRV_0150.jpg',
      'Gabriele Mini': '/pilotos/DRV_0013.jpg',
      'Helio Castroneves': '/pilotos/DRV_0151.jpg',
    }

    for (const [name, expectedPath] of Object.entries(bloco1Map)) {
      const resolved = resolveCanonicalDriverImagePath(null, name)
      expect(resolved, `Path para ${name} não deveria ser nulo`).toBe(expectedPath)
      const photo = resolveDriverPhoto({ name })
      expect(photo.url).toBe(expectedPath)

      // Prova de existência do arquivo local
      const physicalPath = path.resolve(process.cwd(), 'public', expectedPath.replace(/^\//, ''))
      expect(fs.existsSync(physicalPath), `Arquivo físico ${physicalPath} deve existir`).toBe(true)
    }
  })

  // Testes de Resolução de Fotos Bloco 2
  it('Resolve fotos do Bloco 2 para arquivos físicos válidos em public', () => {
    const bloco2Map: Record<string, string> = {
      'Jade Jacquet': '/pilotos/DRV_0097.jpg',
      'James Calado': '/pilotos/DRV_0099.jpg',
      'Joey Logano': '/pilotos/DRV_0058.jpg',
      'Jonathan Browne': '/pilotos/DRV_0100.jpg',
      'Josef Nesgarden': '/pilotos/DRV_0016.jpg',
      'Josep Maria Marti': '/pilotos/DRV_0101.jpg',
      'Joshua Dürksen': '/pilotos/DRV_0116.jpg',
      'Kamui Kobayashi': '/pilotos/DRV_0017.jpg',
      'Kaylee Countryman': '/pilotos/DRV_0102.jpg',
      'Kévin Estre': '/pilotos/DRV_0103.jpg',
      'Kevin Magnussen': '/pilotos/DRV_0059.jpg',
      'Lisa Billard': '/pilotos/DRV_0066.jpg',
      'Lucas di Gassi': '/pilotos/DRV_0067.jpg',
      'Mariana Costa': '/pilotos-gerados/Piloto_55.jpg',
      'Mathilda Paatz': '/pilotos/DRV_0021.jpg',
      'Myles Rowe': '/pilotos/DRV_0122.jpg',
      'Natalia Granada': '/pilotos/DRV_0123.jpg',
      'Nelson Piquet Jr': '/pilotos/DRV_0026.jpg',
      'Nick Cassidy': '/pilotos/DRV_0106.jpg',
      'Nikita Mazepin': '/pilotos/DRV_0135.jpg',
      'Nikola Tsolov': '/pilotos/DRV_0027.jpg',
      'Nina Gademan': '/pilotos/DRV_0028.jpg',
      'Noel León': '/pilotos/DRV_0124.jpg',
      'Nolan Allaer': '/pilotos/DRV_0125.jpg',
      'Oliver Goethe': '/pilotos/DRV_0126.jpg',
      'Payton Westcott': '/pilotos/DRV_0030.jpg',
      'Rachel Robertson': '/pilotos/DRV_0112.jpg',
      'Rafael Villagómez': '/pilotos/DRV_0127.jpg',
      'Rafaela Ferreira': '/pilotos/DRV_0071.jpg',
      'Richard Verschoor': '/pilotos/DRV_0128.jpg',
      'Ritomo Miyata': '/pilotos/DRV_0129.jpg',
      'Robert Kubica': '/pilotos/DRV_0113.jpg',
      'Roman Bilinski': '/pilotos/DRV_0130.jpg',
      'Roman Stanêk': '/pilotos/DRV_0131.jpg',
      'Rubens Barichello': '/pilotos/DRV_0072.jpg',
      'Ryan Blaney': '/pilotos/DRV_0073.jpg',
      'Ryo Hirakawa': '/pilotos/DRV_0033.jpg',
      'Salvador de Alba': '/pilotos/DRV_0132.jpg',
      'Scott Dixon': '/pilotos/DRV_0074.jpg',
      'Sebastián Montoya': '/pilotos/DRV_0134.jpg',
      'Tyler Reddick': '/pilotos/DRV_0114.jpg',
      'Will Power': '/pilotos/DRV_0077.jpg',
      'William Bryon': '/pilotos/DRV_0078.jpg',
    }

    for (const [name, expectedPath] of Object.entries(bloco2Map)) {
      const resolved = resolveCanonicalDriverImagePath(null, name)
      expect(resolved, `Path para ${name} não deveria ser nulo`).toBe(expectedPath)
      const photo = resolveDriverPhoto({ name })
      expect(photo.url).toBe(expectedPath)

      // Prova de existência do arquivo local
      const physicalPath = path.resolve(process.cwd(), 'public', expectedPath.replace(/^\//, ''))
      expect(fs.existsSync(physicalPath), `Arquivo físico ${physicalPath} deve existir`).toBe(true)
    }
  })
})
