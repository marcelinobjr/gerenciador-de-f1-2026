/**
 * fotos-geradas-01.test.ts
 *
 * Suíte de testes canônica para o BLOCO 1 — FOTOS-GERADAS-01:
 * Atribuição automática e determinística de foto por gênero para pilotos SEM foto,
 * usando as imagens já existentes em public/pilotos-gerados/ (arquivos Piloto_NN.jpg).
 *
 * Regras definidas pelo usuário:
 * - Homens: Piloto_01, 02, 06, 08, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58 (24 imagens).
 * - Mulheres: todos os demais arquivos do diretório (42 imagens).
 * - Total de imagens reais no diretório = 66 arquivos físicos.
 * - Atribuição DETERMINÍSTICA: o mesmo piloto sem foto sempre recebe a mesma imagem (sem Math.random).
 * - Plug no RESOLVEDOR CENTRAL (resolveDriverPhoto).
 * - NÃO tocar em quem já tem foto real: piloto com foto real nunca é sobrescrito.
 * - Sébastien Bourdais é DRV_0075 (aponta DRV_0075.jpg).
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  MALE_PORTRAIT_INDICES,
  MALE_PORTRAITS_POOL,
  FEMALE_PORTRAITS_POOL,
  TOTAL_ASSIGNABLE_PORTRAITS,
  hashDriverIdentifier,
  assignGeneratedPortrait,
  resolveDriverIdentityGender,
} from '@/services/driverPortraitAssignmentService'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('BLOCO 1 — FOTOS-GERADAS-01: Atribuição Automática e Determinística', () => {
  const USER_DEFINED_MALE_INDICES = [
    1, 2, 6, 8, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58,
  ]

  it('FG01-01: Pool masculino possui exatamente os 24 índices definidos pelo usuário', () => {
    expect(MALE_PORTRAIT_INDICES).toEqual(USER_DEFINED_MALE_INDICES)
    expect(MALE_PORTRAITS_POOL.length).toBe(24)
  })

  it('FG01-02: Pool feminino possui exatamente os 42 arquivos restantes e soma 66 arquivos', () => {
    expect(FEMALE_PORTRAITS_POOL.length).toBe(42)
    expect(MALE_PORTRAITS_POOL.length + FEMALE_PORTRAITS_POOL.length).toBe(66)
    expect(TOTAL_ASSIGNABLE_PORTRAITS).toBe(66)

    // Interseção entre homens e mulheres deve ser vazia
    const maleSet = new Set(MALE_PORTRAITS_POOL)
    for (const femalePath of FEMALE_PORTRAITS_POOL) {
      expect(maleSet.has(femalePath)).toBe(false)
    }
  })

  it('FG01-03: Todos os 66 arquivos físicos existem no disco em public/pilotos-gerados/', () => {
    const publicDir = path.resolve(process.cwd(), 'public')
    const allPools = [...MALE_PORTRAITS_POOL, ...FEMALE_PORTRAITS_POOL]

    expect(allPools.length).toBe(66)
    for (const imgPath of allPools) {
      const fullPath = path.join(publicDir, imgPath)
      expect(fs.existsSync(fullPath), `Arquivo físico deve existir: ${fullPath}`).toBe(true)
      const stat = fs.statSync(fullPath)
      expect(stat.size).toBeGreaterThan(0)
    }
  })

  it('FG01-04: Determinismo estrito — mesmo piloto sem foto recebe SEMPRE a mesma foto em chamadas repetidas', () => {
    const driverId = 'drv_rookie_roberto_101'
    const name = 'Roberto Navarro'

    const call1 = assignGeneratedPortrait({ driverId, name, gender: 'male' })
    const call2 = assignGeneratedPortrait({ driverId, name, gender: 'male' })
    const call3 = assignGeneratedPortrait({ driverId, name, gender: 'male' })

    expect(call1).toBe(call2)
    expect(call2).toBe(call3)
    expect(typeof call1).toBe('string')
    expect(call1.length).toBeGreaterThan(0)

    // Também determinístico via resolvedor central
    const res1 = resolveDriverPhoto({ driverId, name, gender: 'male' })
    const res2 = resolveDriverPhoto({ driverId, name, gender: 'male' })
    expect(res1.url).toBe(res2.url)
    expect(res1.url).toBe(call1)
  })

  it('FG01-05: Homens só recebem imagens do pool masculino (24 fotos)', () => {
    const testCases = [
      { id: 'drv_m1', name: 'Lucas Martin' },
      { id: 'drv_m2', name: 'Carlos Ramos' },
      { id: 'drv_m3', name: 'Arthur Leclerc' },
      { id: 'drv_m4', name: 'Oliver Bearman' },
      { id: 'drv_m5', name: 'Zane Maloney' },
      { id: 'drv_m6', name: 'Paul Aron' },
      { id: 'drv_m7', name: 'Kimi Antonelli' },
      { id: 'drv_m8', name: 'Isack Hadjar' },
    ]

    for (const tc of testCases) {
      const assigned = assignGeneratedPortrait({
        driverId: tc.id,
        name: tc.name,
        gender: 'male',
      })
      expect(MALE_PORTRAITS_POOL).toContain(assigned)
      expect(FEMALE_PORTRAITS_POOL).not.toContain(assigned)

      const centralResolved = resolveDriverPhoto({
        driverId: tc.id,
        name: tc.name,
        gender: 'male',
      })
      expect(MALE_PORTRAITS_POOL).toContain(centralResolved.url!)
      expect(FEMALE_PORTRAITS_POOL).not.toContain(centralResolved.url!)
      expect(centralResolved.sourceType).toBe('generated_procedural')
    }
  })

  it('FG01-06: Mulheres só recebem imagens do pool feminino (42 fotos)', () => {
    const testCases = [
      { id: 'drv_f1', name: 'Marta Garcia' },
      { id: 'drv_f2', name: 'Doriane Pin' },
      { id: 'drv_f3', name: 'Abbi Pulling' },
      { id: 'drv_f4', name: 'Maya Weug' },
      { id: 'drv_f5', name: 'Bianca Bustamante' },
      { id: 'drv_f6', name: 'Chloe Chambers' },
      { id: 'drv_f7', name: 'Hamda Al Qubaisi' },
      { id: 'drv_f8', name: 'Amna Al Qubaisi' },
    ]

    for (const tc of testCases) {
      const assigned = assignGeneratedPortrait({
        driverId: tc.id,
        name: tc.name,
        gender: 'female',
      })
      expect(FEMALE_PORTRAITS_POOL).toContain(assigned)
      expect(MALE_PORTRAITS_POOL).not.toContain(assigned)

      const centralResolved = resolveDriverPhoto({
        driverId: tc.id,
        name: tc.name,
        gender: 'female',
      })
      expect(FEMALE_PORTRAITS_POOL).toContain(centralResolved.url!)
      expect(MALE_PORTRAITS_POOL).not.toContain(centralResolved.url!)
      expect(centralResolved.sourceType).toBe('generated_procedural')
    }
  })

  it('FG01-07: Resolução de gênero anti-hardcode — consome de direct, visualIdentity ou prospect', () => {
    // 1. Diretamente no parâmetro
    expect(resolveDriverIdentityGender({ gender: 'female' })).toBe('female')
    expect(resolveDriverIdentityGender({ gender: 'f' })).toBe('female')
    expect(resolveDriverIdentityGender({ gender: 'mulher' })).toBe('female')
    expect(resolveDriverIdentityGender({ gender: 'male' })).toBe('male')
    expect(resolveDriverIdentityGender({ gender: 'm' })).toBe('male')
    expect(resolveDriverIdentityGender({ gender: 'homem' })).toBe('male')

    // 2. A partir de visualIdentity (banco/procedural_data)
    expect(resolveDriverIdentityGender({ visualIdentity: { gender: 'female' } })).toBe('female')
    expect(resolveDriverIdentityGender({ visualIdentity: { gender: 'male' } })).toBe('male')

    // 3. A partir de prospect (Scouting da Academia)
    expect(resolveDriverIdentityGender({ prospect: { gender: 'female' } })).toBe('female')
    expect(resolveDriverIdentityGender({ prospect: { gender: 'male' } })).toBe('male')

    // 4. Fallback documentado quando ausente
    expect(resolveDriverIdentityGender(null)).toBe('male')
    expect(resolveDriverIdentityGender({})).toBe('male')
  })

  it('FG01-08: Piloto com foto REAL NUNCA é sobrescrito pela atribuição gerada', () => {
    // Max Verstappen mbj-001 -> DRV_0001.jpg
    const max = resolveDriverPhoto({ driverId: 'mbj-001', name: 'Max Verstappen' })
    expect(max.url).toBe('/pilotos/DRV_0001.jpg')
    expect(max.sourceType).toBe('canonical_real')

    // Gabriel Bortoleto mbj-020 -> DRV_0020.jpg
    const bortoleto = resolveDriverPhoto({ driverId: 'mbj-020', name: 'Gabriel Bortoleto' })
    expect(bortoleto.url).toBe('/pilotos/DRV_0020.jpg')
    expect(bortoleto.sourceType).toBe('canonical_real')

    // Lewis Hamilton mbj-003 -> DRV_0003.jpg
    const hamilton = resolveDriverPhoto({ driverId: 'mbj-003', name: 'Lewis Hamilton' })
    expect(hamilton.url).toBe('/pilotos/DRV_0003.jpg')
    expect(hamilton.sourceType).toBe('canonical_real')
  })

  it('FG01-09: Sébastien Bourdais é DRV_0075 (DRV_0075.jpg) e NÃO sobrescrito', () => {
    // Bourdais pelo ID mbj-128
    const bourdaisById = resolveDriverPhoto({ driverId: 'mbj-128' })
    expect(bourdaisById.url).toBe('/pilotos/DRV_0075.jpg')
    expect(bourdaisById.sourceType).toBe('canonical_real')
    expect(bourdaisById.assetId).toBe('DRV_0075')

    // Bourdais pelo nome
    const bourdaisByName = resolveDriverPhoto({ name: 'Sébastien Bourdais' })
    expect(bourdaisByName.url).toBe('/pilotos/DRV_0075.jpg')
    expect(bourdaisByName.sourceType).toBe('canonical_real')

    // Bourdais com acento e sem acento
    const bourdaisNoAccent = resolveDriverPhoto({ name: 'Sebastien Bourdais' })
    expect(bourdaisNoAccent.url).toBe('/pilotos/DRV_0075.jpg')
  })

  it('FG01-10: Piloto sem id e sem nome cai no fallback seguro de iniciais (sourceType fallback_initials)', () => {
    const empty = resolveDriverPhoto({})
    expect(empty.url).toBeNull()
    expect(empty.sourceType).toBe('fallback_initials')
    expect(empty.fallbackInitials).toBe('F1')
  })
})
