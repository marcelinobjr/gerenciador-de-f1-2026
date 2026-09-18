/**
 * Catálogo Oficial de Retratos Fictícios do Google Drive
 * Diretório: 1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C
 *
 * Regras:
 * - 13 retratos fictícios sem nome de piloto real.
 * - URLs em resolução total CDN lh3 com terminação =s0 (fallback para thumbnail w800).
 * - Classificação estrita de gênero por inspeção visual:
 *   Piloto_01: Homem (male)
 *   Piloto_02: Pendente de revisão (pending_review)
 *   Piloto_03: Mulher (female)
 *   Piloto_04: Mulher (female)
 *   Piloto_05: Mulher (female)
 *   Piloto_06: Homem (male)
 *   Piloto_07: Homem (male)
 *   Piloto_08: Homem (male)
 *   Piloto_09: Homem (male)
 *   Piloto_10: Homem (male)
 *   Piloto_11: Mulher (female)
 *   Piloto_12: Homem (male)
 *   Piloto_13: Mulher (female)
 */

export type FictionalPortraitGender = 'male' | 'female' | 'pending_review'
export type FictionalPortraitStatus = 'available' | 'pending_review' | 'disabled'

export interface FictionalPortraitAsset {
  id: string
  fileId: string
  originalFilename: string
  sourceFolder: string
  category: 'fictional_portrait'
  gender: FictionalPortraitGender
  status: FictionalPortraitStatus
  displayUrl: string
  thumbnailUrl: string
  focalPoint?: { x: number; y: number }
}

export const FICTIONAL_PORTRAITS_CATALOG: FictionalPortraitAsset[] = [
  {
    id: 'fictional_pilot_01',
    fileId: '15rvf3g2FUF8BXCpaqvgj4Iaqx-1wCi17',
    originalFilename: 'Piloto_01.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNk9v0agnwEFDhsk4BlrIWGXYFcjuPf6ey2eX1O8hRWbMmglJ8JpZtpllSDjUTmEBDa1Vk0fluAy_e_NI-CRVNTUs3xEdjgoR58Gh6B=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=15rvf3g2FUF8BXCpaqvgj4Iaqx-1wCi17&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_02',
    fileId: '11mCknYt7xEy8AzdJxBHpHpFhYA4pfjCl',
    originalFilename: 'Piloto_02.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'pending_review',
    status: 'pending_review',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM7wFUKsMHMp_9Uf7mG2F0bzl0x-aJq_qwAZmaqTQkHEEZn96AFaB4qYNy0kT9SOUZMXLXNbibSI81TzQGz4eoOLENqAOvHYZW1vSXV=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=11mCknYt7xEy8AzdJxBHpHpFhYA4pfjCl&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_03',
    fileId: '1ETgX5d4zQQunsdbZbSDyC6TVWKTSH4rE',
    originalFilename: 'Piloto_03.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'female',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPf9sXKjsQMbGntNQ39RCxBKSSy31J7YWbQZjKOHAyvA-bXZ3olQ2ripcmBv9mOCAPkbdqfrLeE4dx0vdLuohC4bFcAK8Cu5h1U7QIX=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1ETgX5d4zQQunsdbZbSDyC6TVWKTSH4rE&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_04',
    fileId: '1mv5JWbr3ftcuj4tU3oxB4QSYfW34rU4T',
    originalFilename: 'Piloto_04.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'female',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPFqa0zqOvu_hDHyl0NOW7Q96cqPq6B77td-hAMWwqsaSAKHzSoZbfLuqOUuLHOWtZJ4X3kXfZjJbtoISSKT4LMoD534lhv95pmReGe=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1mv5JWbr3ftcuj4tU3oxB4QSYfW34rU4T&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_05',
    fileId: '1stC7-KpTO3msA-DBk6vJu-_zfI-uWv6O',
    originalFilename: 'Piloto_05.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'female',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOFf1ssHHgnesTnnFYEAIYXnL-t37HgniTvnjOifzVqq1oEaVpHyNPFvlADSVxoGzlsRjkqmWj1TLDs8f-QSf3Z8zrA_QhzB3eU9ueH=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1stC7-KpTO3msA-DBk6vJu-_zfI-uWv6O&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_06',
    fileId: '16N7sxJyUgk9Jjq9vV9ddluDpVpVp1iZZ',
    originalFilename: 'Piloto_06.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPVqUhuVFD_EZ0sQukpR-IqIAieRGU-UGf9kTHCAJ54ulSaiPVyIpzMEZqBbMGt_pA-wvj64S8zfjGQu-1RvQ8W5AYQYb8RSm6awpEb=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=16N7sxJyUgk9Jjq9vV9ddluDpVpVp1iZZ&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_07',
    fileId: '1o9395qvMaB_m-ReveVjTZXOPgZds26Xp',
    originalFilename: 'Piloto_07.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNTRj5aIZq_GOXLNlWLAnXtnLpUVc04xdWwuzb9szjpfmDW6HyFRB-FcihMSikZRE3GWrfcT0kz1I_T4zarnbvN7bCQn8C6HMlMPDsJ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1o9395qvMaB_m-ReveVjTZXOPgZds26Xp&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_08',
    fileId: '1Ib6FVPM-6dhfYnqhuev8UPLzmmb1D-aN',
    originalFilename: 'Piloto_08.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNlXpGhT3A0EoJrak0BB_uHUFUDCyTjCGEnhLdyEHAQP9tSUbvKG5T8Y7nMjef7dcJOpJD7yvmhIBgsHoxY3VWCXK2Zkwg-B95xdUwc=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Ib6FVPM-6dhfYnqhuev8UPLzmmb1D-aN&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_09',
    fileId: '1VqjXDZPuk5H93Jf2KCkA3--0rsyn_EsF',
    originalFilename: 'Piloto_09.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOCrjKF2aBQ9GdCAdgCDUX2F7dQXbcaOk9yZSw1Mp3DCdjYGgK179LcojC0UL3gWoPezNWmGo0d8vYAnp8upnGLSsZOAODRZAk5_1D1=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1VqjXDZPuk5H93Jf2KCkA3--0rsyn_EsF&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_10',
    fileId: '1-JtohPBJSr2EFHiW7eKV4tTwVdr1cree',
    originalFilename: 'Piloto_10.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMXJlwxapikxAUfaeKKjtr-nDj_DzfLjOarzOYdMcyl4WC8um4m02yw7XRMlX2246_-y5AYj72JKgWZHwAfldSkFC6wj_FdiDIvDbvH=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1-JtohPBJSr2EFHiW7eKV4tTwVdr1cree&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_11',
    fileId: '1Q3dvkZBUOOw0d7qzsFRPTnQTpu-rsFfU',
    originalFilename: 'Piloto_11.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'female',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOL7VfQ3qg3JdoIg9gqnmOK_VAk9QdEMkF8GFrNmdgNoMdlDEQYnLCRWsiZGovSKZUybdiMlIoCQQLgyPZLqScVVXbwMa8T9jWh3rm6=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Q3dvkZBUOOw0d7qzsFRPTnQTpu-rsFfU&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_12',
    fileId: '1_8vASWEERMslVPxOFK7855kdzpq1dJL9',
    originalFilename: 'Piloto_12.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'male',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOhYB_G-h4vylfwwgW-vpPt4xmKBpeG_unbyctjGbF6M3HVaGGwLSa1AHgim9A3pWcHdcv-6ZC59kmn0Oy4ewM9IA2ncRDThrvtWH-o=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1_8vASWEERMslVPxOFK7855kdzpq1dJL9&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
  {
    id: 'fictional_pilot_13',
    fileId: '1tZjUB3mbLaZJgXleYldo_icCgodFmD8P',
    originalFilename: 'Piloto_13.jpg',
    sourceFolder: '1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C',
    category: 'fictional_portrait',
    gender: 'female',
    status: 'available',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOZBFG9KyE_oDkgVysCjwjV0PhA-IaJTy-EnvbEAhIDauQ6YKvmjuQgTvriZuA2kVnbOZmfU9QroE4y9idBEZenmFImkmP_ThT7-eu5=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1tZjUB3mbLaZJgXleYldo_icCgodFmD8P&sz=w800',
    focalPoint: { x: 50, y: 20 },
  },
]

/**
 * Filtra retratos disponíveis por gênero
 */
export function getAvailableFictionalPortraits(
  gender?: 'male' | 'female',
): FictionalPortraitAsset[] {
  return FICTIONAL_PORTRAITS_CATALOG.filter((item) => {
    if (item.status !== 'available') return false
    if (!gender) return true
    return item.gender === gender
  })
}

/**
 * Busca retrato fictício por fileId ou asset id
 */
export function getFictionalPortraitById(idOrFileId: string): FictionalPortraitAsset | null {
  if (!idOrFileId) return null
  return (
    FICTIONAL_PORTRAITS_CATALOG.find(
      (p) => p.id === idOrFileId || p.fileId === idOrFileId || p.originalFilename === idOrFileId,
    ) || null
  )
}
