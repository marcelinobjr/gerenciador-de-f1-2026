import { describe, it, expect } from 'vitest'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  resolveCanonicalDriverImagePath,
  normalizeDriverNameToken,
} from '@/lib/driver-canonical-service'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('BUG-PILOTOS-01: UI and Search Acceptance Tests', () => {
  it('garante que a busca por alias encontra o canônico na lógica de filtro', () => {
    const driversList = [
      { id: '1', name: 'Alexander Albon', nationality: 'Tailândia' },
      { id: '2', name: 'Alexander Dunne', nationality: 'Irlanda' },
      { id: '3', name: 'Álex Palou', nationality: 'Espanha' },
      { id: '4', name: 'André Lotterer', nationality: 'Alemanha' },
      { id: '5', name: 'António Félix da Costa', nationality: 'Portugal' },
      { id: '6', name: 'Gabriele Mini', nationality: 'Itália' },
      { id: '7', name: 'Brad Keselowski', nationality: 'Estados Unidos' },
      { id: '8', name: 'Callum Ilott', nationality: 'Reino Unido' },
    ]

    // Helper simulando a filtragem implementada em DriversPage.tsx
    const filterDrivers = (query: string) => {
      const q = query.toLowerCase().trim()
      const normQuery = normalizeDriverNameToken(q)
      const aliasCanonicalName = getCanonicalDisplayName(q)

      return driversList.filter((pilot) => {
        const normPilotName = normalizeDriverNameToken(pilot.name)
        const matchesName =
          pilot.name.toLowerCase().includes(q) ||
          (normQuery.length >= 3 && normPilotName.includes(normQuery))
        const matchesNat = pilot.nationality.toLowerCase().includes(q)
        const matchesAlias =
          aliasCanonicalName && pilot.name.toLowerCase() === aliasCanonicalName.toLowerCase()

        return matchesName || matchesNat || matchesAlias
      })
    }

    // Busca por "Alex Albon" deve encontrar "Alexander Albon"
    const resAlbon = filterDrivers('Alex Albon')
    expect(resAlbon.length).toBe(1)
    expect(resAlbon[0].name).toBe('Alexander Albon')

    // Busca por "Alex Dunne" deve encontrar "Alexander Dunne"
    const resDunne = filterDrivers('Alex Dunne')
    expect(resDunne.length).toBe(1)
    expect(resDunne[0].name).toBe('Alexander Dunne')

    // Busca por "Alex Palou" deve encontrar "Álex Palou"
    const resPalou = filterDrivers('Alex Palou')
    expect(resPalou.length).toBe(1)
    expect(resPalou[0].name).toBe('Álex Palou')

    // Busca por "Andre Lotterer" deve encontrar "André Lotterer"
    const resLotterer = filterDrivers('Andre Lotterer')
    expect(resLotterer.length).toBe(1)
    expect(resLotterer[0].name).toBe('André Lotterer')

    // Busca por "Antonio Felix da Costa" deve encontrar "António Félix da Costa"
    const resCosta = filterDrivers('Antonio Felix da Costa')
    expect(resCosta.length).toBe(1)
    expect(resCosta[0].name).toBe('António Félix da Costa')

    // Busca por "Brad Keselowiski" deve encontrar "Brad Keselowski"
    const resBrad = filterDrivers('Brad Keselowiski')
    expect(resBrad.length).toBe(1)
    expect(resBrad[0].name).toBe('Brad Keselowski')

    // Busca por "Callum Llott" deve encontrar "Callum Ilott"
    const resCallum = filterDrivers('Callum Llott')
    expect(resCallum.length).toBe(1)
    expect(resCallum[0].name).toBe('Callum Ilott')
  })

  it('valida que nenhum dos pilotos corrigidos retorna url vazia ou null no resolvedor', () => {
    const targets = [
      'Alba Hurup Larsen',
      'Alessandro Pier Guidi',
      'Alex Dunne',
      'Alexander Dunne',
      'Alex Lynn',
      'Alisha Palmowski',
      'Amauri Cordell',
      'Amaury Cordeel',
      'Antonio Fuoco',
      'Ava Dobson',
      'Brad Keselowiski',
      'Brad Keselowski',
      'Callum Hedge',
      'Callum Ilott',
      'Callum Llott',
      'Callum Voisin',
      'Chase Elliott',
      'Christian Mansell',
      'Christopher Bell',
      'Connor de Phillippi',
      'Dane Cameron',
      'Daniil Kvyat',
      'Dennis Hauger',
      'Denny Hamlin',
      'Dries Vanthoor',
      'Earl Bamber',
      'Edoardo Mortara',
      'Ella Lloyd',
      'Ella Stevens',
      'Emerson Fittipaldi Jr.',
      'Emma Felbermayr',
      'Enzo Fittipaldi',
      'Esmee Kosterman',
      'Freddie Slater',
      'Gabriele Mini',
      'Helio Castroneves',
      'Felipe Albuquerque',
    ]

    for (const name of targets) {
      const res = resolveDriverPhoto({ name })
      expect(res.url, `Foto para ${name} não deveria ser nula`).not.toBeNull()
      expect(res.candidateUrls.length).toBeGreaterThan(0)
    }
  })
})
