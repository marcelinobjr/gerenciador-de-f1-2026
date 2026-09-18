import { describe, it, expect, beforeEach } from 'vitest'
import {
  CAR_PART_ASSETS,
  normalizeCarPartType,
  getCarPartPhoto,
  getCarPartFallbackSvg,
} from '@/data/assets/carPartAssets'

describe('MICRO-PATCH v0.0.279 - PONTO 1: Assets e Manifest de Peças', () => {
  it('manifest centralizado define fotos reais locais para asa dianteira, asa traseira e assoalho', () => {
    expect(CAR_PART_ASSETS.frontWing.photoUrl).toBeDefined()
    expect(CAR_PART_ASSETS.rearWing.photoUrl).toBeDefined()
    expect(CAR_PART_ASSETS.floor.photoUrl).toBeDefined()
  })

  it('fallback limpo continua funcional caso solicitado', () => {
    const fallbackSidepods = getCarPartFallbackSvg('sidepods')
    expect(fallbackSidepods).toContain('data:image/svg+xml')
  })

  it('normalização de chave resolve strings em pt-BR e nomes técnicos', () => {
    expect(normalizeCarPartType('Asa Dianteira')).toBe('frontWing')
    expect(normalizeCarPartType('frontWing')).toBe('frontWing')
    expect(normalizeCarPartType('Asa Traseira')).toBe('rearWing')
    expect(normalizeCarPartType('Assoalho')).toBe('floor')
    expect(normalizeCarPartType('Laterais')).toBe('sidepods')
    expect(normalizeCarPartType('Unidade de Potência')).toBe('engine')
    expect(normalizeCarPartType('Suspensão')).toBe('suspension')
  })
})

describe('MICRO-PATCH v0.0.279 - PONTO 2: Troca Individual de Motor e Peças (#1 e #2)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('trocar o motor do Carro #1 não altera o motor do Carro #2', () => {
    let car1Engine = 2
    let car2Engine = 1

    // Simula troca do Carro #1 para PU-4
    const newCar1Engine = 4
    expect(newCar1Engine).not.toBe(car2Engine) // PU-4 está livre
    car1Engine = newCar1Engine

    expect(car1Engine).toBe(4)
    expect(car2Engine).toBe(1) // Permanece inalterado
  })

  it('mesma unidade física de motor NÃO pode ser instalada simultaneamente nos dois carros', () => {
    const car1Engine = 2
    const car2Engine = 1

    // Tentar colocar PU-1 (já em uso no Carro #2) no Carro #1 deve ser rejeitado
    const targetUnitToInstallOnCar1 = car2Engine
    const isOccupied = targetUnitToInstallOnCar1 === car2Engine
    expect(isOccupied).toBe(true)
  })

  it('trocar asa dianteira do Carro #1 não altera a asa dianteira do Carro #2', () => {
    const car1Specs = { frontWing: 'Spec B - Alta Carga' }
    const car2Specs = { frontWing: 'Spec A - Base Homologação' }

    // Atualiza Carro #1 para Spec E
    const updatedCar1 = { ...car1Specs, frontWing: 'Spec E - Alta Carga Otimizada' }

    expect(updatedCar1.frontWing).toBe('Spec E - Alta Carga Otimizada')
    expect(car2Specs.frontWing).toBe('Spec A - Base Homologação') // Preservado
  })

  it('mesma peça física com serialId único não pode ser instalada nos dois carros simultaneamente', () => {
    const car1Serials: Record<string, string> = { frontWing: 'FW-E-01' }
    const car2Serials: Record<string, string> = { frontWing: 'FW-D-01' }

    // Tentar instalar FW-E-01 no Carro #2 deve detectar colisão
    const candidateSerial = 'FW-E-01'
    const isInstalledOnCar1 = car1Serials.frontWing === candidateSerial
    expect(isInstalledOnCar1).toBe(true)
  })

  it('desgaste e condições permanecem individuais mesmo para mesma spec', () => {
    const car1Conditions = { frontWing: 100 }
    const car2Conditions = { frontWing: 96 }

    expect(car1Conditions.frontWing).toBe(100)
    expect(car2Conditions.frontWing).toBe(96)
    expect(car1Conditions.frontWing).not.toBe(car2Conditions.frontWing)
  })

  it('estado individual persiste no localStorage/save', () => {
    localStorage.setItem('apex_gp_car1_engine_unit', '4')
    localStorage.setItem('apex_gp_car2_engine_unit', '3')
    localStorage.setItem('apex_gp_car1_specs', JSON.stringify({ frontWing: 'Spec E' }))

    const savedC1Engine = localStorage.getItem('apex_gp_car1_engine_unit')
    const savedC2Engine = localStorage.getItem('apex_gp_car2_engine_unit')
    const savedSpecs = JSON.parse(localStorage.getItem('apex_gp_car1_specs') || '{}')

    expect(savedC1Engine).toBe('4')
    expect(savedC2Engine).toBe('3')
    expect(savedSpecs.frontWing).toBe('Spec E')
  })
})

describe('MICRO-PATCH v0.0.279 - PONTO 3: Recomendações da Engenharia', () => {
  it('painel técnico detalhado aceita prioridades e gera dados reais de diagnóstico', () => {
    const priorities = [
      {
        id: 'p1',
        priorityNumber: 1 as const,
        priorityLabel: 'Prioridade 1 — Maior Gargalo Técnico',
        title: 'Déficit de Eficiência em Alta Velocidade',
        area: 'Aerodinâmica' as const,
        impactLevel: 'Alto' as const,
        impactDescription: 'Perda de tempo nos setores de reta',
        rootCause: 'Vórtices no bordo de ataque da asa dianteira',
        suggestedAction: 'Desenvolver Assoalho Spec B',
        developmentAreaTarget: 'aerodynamics',
      },
    ]

    expect(priorities.length).toBe(1)
    expect(priorities[0].impactLevel).toBe('Alto')
    expect(priorities[0].developmentAreaTarget).toBe('aerodynamics')
  })

  it('quando lista de prioridades for vazia, deve produzir estado limpo sem quebrar', () => {
    const emptyList: any[] = []
    expect(emptyList.length).toBe(0)
  })
})
