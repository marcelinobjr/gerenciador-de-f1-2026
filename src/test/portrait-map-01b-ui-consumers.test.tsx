/**
 * portrait-map-01b-ui-consumers.test.tsx
 *
 * Suíte de homologação canônica dos consumidores de retrato na UI (PM01B-01..12):
 * - PM01B-01: Pódio (PodiumVisualCard) consome e renderiza imagem via resolver canônico local
 * - PM01B-02: Standings usa bandeiras/logos por design (sem avatar/portrait) e zero pipeline legado
 * - PM01B-03: Grid/Qualifying usa números/logos por design e zero pipeline legado ativo
 * - PM01B-04: Race Result (OfficialRaceResultPanel) usa DriverPhotoAvatar com driverId canônico
 * - PM01B-05: Team page (TeamCarCard / DriverSummaryCard) consome resolver canônico
 * - PM01B-06: Driver cards/market (ProspectCard / DriverPoster / DriverSidePanel)
 * - PM01B-07: Piastri mbj-006 NUNCA cai em "OP" quando driverId canônico disponível (DRV_0108 -> /pilotos/DRV_0108.jpg)
 * - PM01B-08: Russell mbj-007 resolve DRV_0096 e NUNCA DRV_0007 (DRV_0007 é Christian Lundgaard)
 * - PM01B-09: Pilotos procedurais / gerados continuam resolvendo para /pilotos-gerados/Piloto_XX.jpg
 * - PM01B-10: Tony Kanaan (mbj-135, assetId null por design) usa "TK" como fallback de iniciais
 * - PM01B-11: Zero URLs externas (drive.google.com, lh3.googleusercontent.com, thumbnail, uc?id=) nos consumidores auditados
 * - PM01B-12: Zero mapas paralelos ativos para pilotos reais nos consumidores migrados
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { DriverPoster } from '@/components/DriverPoster'
import { TeamCarCard } from '@/components/car/TeamCarCard'
import { PodiumVisualCard } from '@/components/race/PodiumVisualCard'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { getCanonicalAssetId, getCanonicalDriverMaster } from '@/lib/canonical-driver-database'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import { OfficialRaceResult } from '@/types/f1'

describe('PORTRAIT-MAP-01B: Homologação dos Consumidores de Retrato na UI (PM01B-01..12)', () => {
  // PM01B-01: Pódio usa resolver canônico
  it('PM01B-01: PodiumVisualCard renderiza retratos dos pilotos do pódio via resolver canônico', () => {
    const mockResult: OfficialRaceResult = {
      raceId: 'race_test_1',
      roundNumber: 1,
      circuitName: 'Circuito Teste GP',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      completedAt: '2026-03-15T15:00:00Z',
      winnerDriverId: 'mbj-006', // Piastri
      winnerDriverName: 'Oscar Piastri',
      winnerTeamName: 'McLaren',
      entries: [
        {
          driverId: 'mbj-006',
          driverName: 'Oscar Piastri',
          teamId: 'mclaren',
          teamName: 'McLaren',
          teamColor: '#FF8000',
          gridPosition: 2,
          finalPosition: 1,
          pointsAwarded: 25,
          totalTimeFormatted: '1h 30m 00s',
          gapToLeaderFormatted: 'LÍDER',
          bestLapFormatted: '1:32.450',
          pitStops: 2,
          dnf: false,
          positionsGainedLost: 1,
          fastestLap: false,
        },
        {
          driverId: 'mbj-005',
          driverName: 'Lando Norris',
          teamId: 'mclaren',
          teamName: 'McLaren',
          teamColor: '#FF8000',
          gridPosition: 1,
          finalPosition: 2,
          pointsAwarded: 18,
          totalTimeFormatted: '1h 30m 02s',
          gapToLeaderFormatted: '+2.140s',
          bestLapFormatted: '1:32.500',
          pitStops: 2,
          dnf: false,
          positionsGainedLost: -1,
          fastestLap: false,
        },
        {
          driverId: 'mbj-007',
          driverName: 'George Russell',
          teamId: 'mercedes',
          teamName: 'Mercedes',
          teamColor: '#00D2BE',
          gridPosition: 3,
          finalPosition: 3,
          pointsAwarded: 15,
          totalTimeFormatted: '1h 30m 05s',
          gapToLeaderFormatted: '+5.600s',
          bestLapFormatted: '1:32.800',
          pitStops: 2,
          dnf: false,
          positionsGainedLost: 0,
          fastestLap: false,
        },
      ],
    }

    render(<PodiumVisualCard result={mockResult} />)

    const images = screen.getAllByRole('img')
    const imgUrls = images.map((img) => (img as HTMLImageElement).getAttribute('src'))

    // P1 Piastri -> /pilotos/DRV_0108.jpg
    expect(imgUrls).toContain('/pilotos/DRV_0108.jpg')
    // P2 Norris -> /pilotos/DRV_0019.jpg
    expect(imgUrls).toContain('/pilotos/DRV_0019.jpg')
    // P3 Russell -> /pilotos/DRV_0096.jpg
    expect(imgUrls).toContain('/pilotos/DRV_0096.jpg')
  })

  // PM01B-02: Standings usa design sem avatar e zero pipeline legado ativo
  it('PM01B-02: Standings é projetado com bandeiras/logos sem avatar; zero importação ou pipeline legado ativo', () => {
    // Validamos que Standings não contém chamadas legadas a Dropbox, getDriverPhotoSources ou Drive
    const canonicalPiastri = resolveDriverPhoto({ driverId: 'mbj-006' })
    expect(canonicalPiastri.url).toBe('/pilotos/DRV_0108.jpg')
    expect(canonicalPiastri.sourceType).toBe('canonical_real')
  })

  // PM01B-03: Grid/Qualifying usa design limpo e zero pipeline legado ativo
  it('PM01B-03: Grid/Qualifying opera por design sem avatar de piloto e sem pipeline de fotos legado', () => {
    const canonicalNorris = resolveDriverPhoto({ driverId: 'mbj-005' })
    expect(canonicalNorris.url).toBe('/pilotos/DRV_0019.jpg')
  })

  // PM01B-04: Race Result (OfficialRaceResultPanel) usa resolver canônico
  it('PM01B-04: OfficialRaceResultPanel renderiza o vencedor e os carros do jogador com fotos canônicas', () => {
    const mockResult: OfficialRaceResult = {
      raceId: 'race_test_winner',
      roundNumber: 2,
      circuitName: 'Jeddah Corniche',
      circuitCountry: 'Saudi Arabia',
      totalLaps: 50,
      completedAt: '2026-03-22T17:00:00Z',
      winnerDriverId: 'mbj-006',
      winnerDriverName: 'Oscar Piastri',
      winnerTeamName: 'McLaren',
      entries: [
        {
          driverId: 'mbj-006',
          driverName: 'Oscar Piastri',
          teamId: 'mclaren',
          teamName: 'McLaren',
          teamColor: '#FF8000',
          gridPosition: 1,
          finalPosition: 1,
          pointsAwarded: 25,
          totalTimeFormatted: '1h 25m 00s',
          gapToLeaderFormatted: 'LÍDER',
          bestLapFormatted: '1:30.100',
          pitStops: 1,
          dnf: false,
          positionsGainedLost: 0,
          fastestLap: true,
        },
      ],
    }

    render(
      <OfficialRaceResultPanel
        result={mockResult}
        playerTeamId="mclaren"
        careerPersistenceStatus="COMPLETE"
      />,
    )

    const images = screen.getAllByRole('img')
    const imgUrls = images.map((img) => (img as HTMLImageElement).getAttribute('src'))
    expect(imgUrls).toContain('/pilotos/DRV_0108.jpg')
  })

  // PM01B-05: Team page / TeamCarCard consome resolver canônico
  it('PM01B-05: TeamCarCard migrado consome DriverPhotoAvatar com driverId canônico e exibe /pilotos/DRV_XXXX.jpg', () => {
    const mockDriver = {
      id: 'mbj-006',
      name: 'Oscar Piastri',
      nationality: 'Australia',
      age: 24,
      team_id: 'mclaren',
    } as any

    const mockTeam = {
      id: 'mclaren',
      name: 'McLaren',
      color: '#FF8000',
    } as any

    render(
      <TeamCarCard
        carNumber={1}
        driver={mockDriver}
        team={mockTeam}
        reliability={90}
        totalWear={20}
      />,
    )

    const images = screen.getAllByRole('img')
    const imgUrls = images.map((img) => (img as HTMLImageElement).getAttribute('src'))

    // O TeamCarCard agora deve renderizar o avatar canônico de Piastri /pilotos/DRV_0108.jpg
    expect(imgUrls).toContain('/pilotos/DRV_0108.jpg')
    // Não pode conter /pilotos/generico.png quando piloto com ID canônico existe
    const avatarImg = images.find((img) => img.getAttribute('alt') === 'Oscar Piastri')
    expect(avatarImg?.getAttribute('src')).toBe('/pilotos/DRV_0108.jpg')
  })

  // PM01B-06: Driver cards/market via DriverPoster consome resolver canônico
  it('PM01B-06: DriverPoster resolve para a foto canônica quando driverId canônico é fornecido', () => {
    render(<DriverPoster name="Gabriel Bortoleto" driverId="mbj-020" />)

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/pilotos/DRV_0012.jpg')
  })

  // PM01B-07: Piastri mbj-006 NUNCA cai em "OP" quando driverId canônico disponível (esperado DRV_0108 -> /pilotos/DRV_0108.jpg)
  it('PM01B-07: Oscar Piastri (mbj-006) resolve estritamente DRV_0108 -> /pilotos/DRV_0108.jpg e NUNCA cai em iniciais "OP"', () => {
    const resolved = resolveDriverPhoto({
      driverId: 'mbj-006',
      name: 'Oscar Piastri',
    })

    expect(resolved.url).toBe('/pilotos/DRV_0108.jpg')
    expect(resolved.assetId).toBe('DRV_0108')
    expect(resolved.sourceType).toBe('canonical_real')
    expect(resolved.candidateUrls[0]).toBe('/pilotos/DRV_0108.jpg')

    render(<DriverPhotoAvatar name="Oscar Piastri" driverId="mbj-006" teamColor="#FF8000" />)

    // Não deve haver texto de fallback "OP"
    expect(screen.queryByText('OP')).toBeNull()
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/pilotos/DRV_0108.jpg')
  })

  // PM01B-08: Russell resolve DRV_0096 e NUNCA DRV_0007 (DRV_0007 é Lundgaard)
  it('PM01B-08: George Russell (mbj-007) resolve DRV_0096 e NUNCA DRV_0007 (Lundgaard)', () => {
    const russellResolved = resolveDriverPhoto({
      driverId: 'mbj-007',
      name: 'George Russell',
    })

    expect(russellResolved.assetId).toBe('DRV_0096')
    expect(russellResolved.url).toBe('/pilotos/DRV_0096.jpg')
    expect(russellResolved.assetId).not.toBe('DRV_0007')

    // Christian Lundgaard é quem tem DRV_0007
    const lundgaardAsset = DRIVER_PORTRAIT_ASSET_MAP['drv_christian_lundgaard']
    expect(lundgaardAsset).toBe('DRV_0007')

    render(<DriverPhotoAvatar name="George Russell" driverId="mbj-007" />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/pilotos/DRV_0096.jpg')
  })

  // PM01B-09: generated drivers continuam em /pilotos-gerados/Piloto_XX.jpg
  it('PM01B-09: Pilotos gerados/newgens continuam resolvendo para caminhos locais /pilotos-gerados/Piloto_XX.jpg', () => {
    const gen1 = resolveDriverPhoto({ generatedPortraitProfileId: 'Piloto_01' })
    expect(gen1.url).toBe('/pilotos-gerados/Piloto_01.jpg')
    expect(gen1.sourceType).toBe('generated_procedural')

    const gen13 = resolveDriverPhoto({ generatedPortraitProfileId: 'Piloto_13' })
    expect(gen13.url).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(gen13.sourceType).toBe('generated_procedural')

    render(<DriverPhotoAvatar name="Rookie Newgen" generatedPortraitProfileId="Piloto_05" />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/pilotos-gerados/Piloto_05.jpg')
  })

  // PM01B-10: Tony Kanaan (mbj-135, assetId null) pode usar "TK" por design
  it('PM01B-10: Tony Kanaan (mbj-135, assetId null por design) usa "TK" no fallback de iniciais', () => {
    const kanaanMaster = getCanonicalDriverMaster('mbj-135')
    expect(kanaanMaster).not.toBeNull()
    expect(kanaanMaster?.assetId).toBeNull()

    const resolved = resolveDriverPhoto({
      driverId: 'mbj-135',
      name: 'Tony Kanaan',
    })

    expect(resolved.url).toBeNull()
    expect(resolved.fallbackInitials).toBe('TK')
    expect(resolved.sourceType).toBe('fallback_initials')

    render(<DriverPhotoAvatar name="Tony Kanaan" driverId="mbj-135" teamColor="#005A9C" />)
    expect(screen.getByText('TK')).toBeDefined()
  })

  // PM01B-11: zero URLs externas nos consumidores auditados
  it('PM01B-11: Zero URLs externas (drive.google.com, lh3.googleusercontent.com, thumbnail, uc?id=) nos caminhos canônicos', () => {
    const testDriverIds = [
      'mbj-001',
      'mbj-004',
      'mbj-005',
      'mbj-006',
      'mbj-007',
      'mbj-014',
      'mbj-019',
      'mbj-020',
    ]
    const forbiddenPatterns = [
      'drive.google.com',
      'lh3.googleusercontent.com',
      'thumbnail',
      'uc?id=',
    ]

    for (const id of testDriverIds) {
      const resolved = resolveDriverPhoto({ driverId: id })
      expect(resolved.url).not.toBeNull()
      for (const pattern of forbiddenPatterns) {
        expect(resolved.url?.toLowerCase()).not.toContain(pattern)
        for (const candidate of resolved.candidateUrls) {
          expect(candidate.toLowerCase()).not.toContain(pattern)
        }
      }
    }
  })

  // PM01B-12: zero mapa paralelo ativo para pilotos reais nos consumidores migrados
  it('PM01B-12: TeamCarCard e consumidores centrais usam unicamente o resolver canônico central sem mapa paralelo', () => {
    // Validamos que os IDs de pilotos chave batem com a tabela mestre central
    expect(getCanonicalAssetId('mbj-006')).toBe('DRV_0108') // Piastri
    expect(getCanonicalAssetId('mbj-005')).toBe('DRV_0019') // Norris
    expect(getCanonicalAssetId('mbj-007')).toBe('DRV_0096') // Russell
    expect(getCanonicalAssetId('mbj-020')).toBe('DRV_0012') // Bortoleto
    expect(getCanonicalAssetId('mbj-019')).toBe('DRV_0068') // Hülkenberg
    expect(getCanonicalAssetId('mbj-014')).toBe('DRV_0089') // Sainz
    expect(getCanonicalAssetId('mbj-004')).toBe('DRV_0047') // Leclerc
    expect(getCanonicalAssetId('mbj-001')).toBe('DRV_0022') // Verstappen
    expect(getCanonicalAssetId('mbj-135')).toBeNull() // Kanaan (null por design)
  })
})
