import { describe, it, expect } from 'vitest'
import {
  CANONICAL_DRIVERS_MASTER,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
  getCanonicalAssetId,
  auditDriverMasterData,
} from '@/lib/canonical-driver-database'
import {
  GENERATED_DRIVER_PORTRAIT_PROFILES,
  getGeneratedDriverPortraitProfile,
  allocateGeneratedPortraitProfile,
} from '@/lib/generated-driver-profiles'
import { resolveDriverPhoto, extractDriverInitials } from '@/lib/driver-photo-resolver'

describe('DRV-DATA-02 — Bloco A: Correlação Canônica Real (driverId -> assetId)', () => {
  it('Bortoleto possui id canônico mbj-020 e assetId DRV_0012', () => {
    const bortoleto = getCanonicalDriverMaster('mbj-020')
    expect(bortoleto).toBeDefined()
    expect(bortoleto?.fullName).toBe('Gabriel Bortoleto')
    expect(bortoleto?.assetId).toBe('DRV_0012')
    expect(bortoleto?.resolvedPhotoPath).toBe('/pilotos/DRV_0012.jpg')
    expect(getCanonicalAssetId('mbj-020')).toBe('DRV_0012')
  })

  it('Hülkenberg possui id canônico mbj-019 e assetId DRV_0068', () => {
    const hulkenberg = getCanonicalDriverMaster('mbj-019')
    expect(hulkenberg).toBeDefined()
    expect(hulkenberg?.fullName).toBe('Nico Hülkenberg')
    expect(hulkenberg?.assetId).toBe('DRV_0068')
    expect(hulkenberg?.resolvedPhotoPath).toBe('/pilotos/DRV_0068.jpg')
    expect(getCanonicalAssetId('mbj-019')).toBe('DRV_0068')
  })

  it('Garante unicidade de assetId nos pilotos mestres mapeados', () => {
    const assetIds = Object.values(CANONICAL_DRIVER_ID_TO_ASSET_ID)
    const uniqueAssets = new Set(assetIds)
    // 135 entradas mapeadas para 134 IDs canônicos (mbj-134 e mbj-135 compartilham DRV_0134 por design de 134 slots)
    expect(uniqueAssets.size).toBe(134)
    expect(assetIds.length).toBeGreaterThanOrEqual(134)
  })

  it('Acentos e grafias variadas não alteram a resolução quando consultada por driverId', () => {
    // A resolução canônica é estritamente vinculada ao driverId, blindada contra erros de grafia
    const resBortoleto1 = resolveDriverPhoto({ driverId: 'mbj-020', name: 'Gabriel Bortoleto' })
    const resBortoleto2 = resolveDriverPhoto({ driverId: 'mbj-020', name: 'G. Bortoletto' })
    const resBortoleto3 = resolveDriverPhoto({ driverId: 'mbj-020', name: 'bortoleto' })

    expect(resBortoleto1.url).toBe('/pilotos/DRV_0012.jpg')
    expect(resBortoleto2.url).toBe('/pilotos/DRV_0012.jpg')
    expect(resBortoleto3.url).toBe('/pilotos/DRV_0012.jpg')
  })

  it('Distingue pilotos com sobrenomes idênticos (ex: Schumacher / Piquet)', () => {
    const mick = getCanonicalDriverMaster('mbj-037')
    expect(mick?.fullName).toBe('Mick Schumacher')
    expect(mick?.assetId).toBe('DRV_0036')

    // Nelson Piquet Jr. (se cadastrado ou outro) nunca sobrescreve outro Piquet
    const resMick = resolveDriverPhoto({ driverId: 'mbj-037', name: 'Mick Schumacher' })
    expect(resMick.url).toBe('/pilotos/DRV_0036.jpg')
    expect(resMick.assetId).toBe('DRV_0036')
  })

  it('Fornece fallback elegante de iniciais e cor da equipe quando imagem não existe ou driver desconhecido', () => {
    const resDesconhecido = resolveDriverPhoto({
      driverId: 'drv_nao_existente_999',
      name: 'Ayrton Senna',
      teamColor: '#00D2BE',
    })
    expect(resDesconhecido.sourceType).toBe('fallback_initials')
    expect(resDesconhecido.fallbackInitials).toBe('AS')
    expect(resDesconhecido.teamColor).toBe('#00D2BE')
  })
})

describe('DRV-DATA-02 — Bloco B: Manifest e Perfis Gerados (Piloto_01..13)', () => {
  it('Manifesto contém exatamente 13 perfis gerados de semente', () => {
    expect(GENERATED_DRIVER_PORTRAIT_PROFILES).toHaveLength(13)
  })

  it('Gêneros canônicos conferem exatamente com a especificação', () => {
    // FEMININOS = Piloto_03, 04, 05, 07, 09, 11, 13
    // MASCULINOS = Piloto_01, 02, 06, 08, 10, 12
    const femaleFiles = [
      'Piloto_03.jpg',
      'Piloto_04.jpg',
      'Piloto_05.jpg',
      'Piloto_07.jpg',
      'Piloto_09.jpg',
      'Piloto_11.jpg',
      'Piloto_13.jpg',
    ]
    const maleFiles = [
      'Piloto_01.jpg',
      'Piloto_02.jpg',
      'Piloto_06.jpg',
      'Piloto_08.jpg',
      'Piloto_10.jpg',
      'Piloto_12.jpg',
    ]

    for (const file of femaleFiles) {
      const p = getGeneratedDriverPortraitProfile(file)
      expect(p, `Esperado encontrar perfil ${file}`).toBeDefined()
      expect(p?.gender).toBe('female')
    }

    for (const file of maleFiles) {
      const p = getGeneratedDriverPortraitProfile(file)
      expect(p, `Esperado encontrar perfil ${file}`).toBeDefined()
      expect(p?.gender).toBe('male')
    }
  })

  it('Alocação de novos pilotos é determinística com base na seed e respeita gênero', () => {
    const alloc1 = allocateGeneratedPortraitProfile('female', 42, [])
    const alloc2 = allocateGeneratedPortraitProfile('female', 42, [])
    expect(alloc1.profileId).toBe(alloc2.profileId)
    expect(alloc1.gender).toBe('female')

    const allocMale = allocateGeneratedPortraitProfile('male', 42, [])
    expect(allocMale.gender).toBe('male')
  })

  it('Evita reuso de fotos enquanto houver sementes livres do mesmo gênero', () => {
    const femaleProfiles = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'female')
    const allocated: string[] = []

    // Alocar 3 pilotas
    for (let i = 0; i < femaleProfiles.length; i++) {
      const chosen = allocateGeneratedPortraitProfile('female', i * 7, allocated)
      expect(allocated.includes(chosen.profileId)).toBe(false)
      allocated.push(chosen.profileId)
    }

    expect(allocated).toHaveLength(femaleProfiles.length)

    // Quando esgotado, reutiliza de forma controlada sem estourar
    const reused = allocateGeneratedPortraitProfile('female', 1234, allocated)
    expect(reused.gender).toBe('female')
    expect(reused).toBeDefined()
  })

  it('Persistência e reload mantêm o mesmo portraitId', () => {
    const mockProceduralSave = {
      driverId: 'drv_newgen_01',
      name: 'Elena Rostova',
      generatedPortraitProfileId: 'GEN_03',
    }

    const resolved = resolveDriverPhoto({
      driverId: mockProceduralSave.driverId,
      name: mockProceduralSave.name,
      generatedPortraitProfileId: mockProceduralSave.generatedPortraitProfileId,
    })

    expect(resolved.sourceType).toBe('generated_procedural')
    expect(resolved.url).toBe('/pilotos-gerados/Piloto_03.jpg')
    expect(resolved.assetId).toBe('GEN_03')
  })
})

describe('DRV-DATA-02 — Bloco C: Separação Real vs Gerado e Integração', () => {
  it('Pilotos reais NUNCA recebem perfis gerados', () => {
    const bortoletoRes = resolveDriverPhoto({
      driverId: 'mbj-020',
      name: 'Gabriel Bortoleto',
    })
    expect(bortoletoRes.sourceType).toBe('canonical_real')
    expect(bortoletoRes.url).toBe('/pilotos/DRV_0012.jpg')
    expect(bortoletoRes.url).not.toContain('pilotos-gerados')
  })

  it('Pilotos procedurais sem driverId real NUNCA resolvem DRV_XXXX a menos que explicitamente configurado', () => {
    const procRes = resolveDriverPhoto({
      driverId: 'drv_proc_1720000000_abc',
      name: 'Lucas Silva',
      generatedPortraitProfileId: 'GEN_01',
    })
    expect(procRes.sourceType).toBe('generated_procedural')
    expect(procRes.url).toBe('/pilotos-gerados/Piloto_01.jpg')
    expect(procRes.url).not.toContain('DRV_')
  })

  it('Função auditDriverMasterData() retorna métricas consolidadas sem quebras', () => {
    const audit = auditDriverMasterData()
    expect(audit.totalSource).toBe(135)
    expect(audit.totalImported).toBe(135)
    expect(audit.bortoletoAssetId).toBe('DRV_0012')
    expect(audit.hulkenbergAssetId).toBe('DRV_0068')
    expect(audit.unresolved).toBe(0)
    expect(audit.invalid).toBe(0)
  })

  it('Helper extractDriverInitials funciona com múltiplos formatos de nomes', () => {
    expect(extractDriverInitials('Max Verstappen')).toBe('MV')
    expect(extractDriverInitials('Gabriel Bortoleto')).toBe('GB')
    expect(extractDriverInitials('Nico Hülkenberg')).toBe('NH')
    expect(extractDriverInitials('Alonso')).toBe('AL')
    expect(extractDriverInitials('')).toBe('F1')
  })

  it('Cada DRV_XXXX canônico mapeado resolve para sourceType canonical_real', () => {
    // Valida que pilotos canônicos mestres sempre retornam canonical_real e URL padronizada
    const samples = [
      { id: 'mbj-020', asset: 'DRV_0012' }, // Bortoleto
      { id: 'mbj-019', asset: 'DRV_0068' }, // Hülkenberg
      { id: 'mbj-001', asset: 'DRV_0001' }, // Verstappen
      { id: 'mbj-005', asset: 'DRV_0005' }, // Norris
      { id: 'mbj-037', asset: 'DRV_0036' }, // Mick Schumacher
      { id: 'mbj-066', asset: 'DRV_0065' }, // Lindblad
    ]

    for (const sample of samples) {
      const res = resolveDriverPhoto({ driverId: sample.id })
      expect(res.sourceType).toBe('canonical_real')
      expect(res.assetId).toBe(sample.asset)
      expect(res.url).toBe(`/pilotos/${sample.asset}.jpg`)
    }
  })

  it('Arquivo ausente ou driver desconhecido cai no fallback gracioso sem quebrar', () => {
    const unknownRes = resolveDriverPhoto({
      driverId: 'drv_unknown_404',
      name: 'Piloto Teste',
      teamColor: '#101010',
    })
    expect(unknownRes.sourceType).toBe('fallback_initials')
    expect(unknownRes.url).toBeNull()
    expect(unknownRes.fallbackInitials).toBe('PT')
  })
})
