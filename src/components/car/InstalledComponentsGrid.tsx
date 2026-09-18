import React from 'react'
import { PartModel } from '@/types/f1'
import { CAR_PARTS_CATALOG, PartIllustration } from './CarPartsCatalog'

export interface InstalledComponentsGridProps {
  carNumber: 1 | 2
  parts: PartModel[]
  activeEngineCondition?: number
  engineSupplier?: string
  driverName?: string
  carSpecificSpecs?: Record<string, string>
  carSpecificConditions?: Record<string, number>
  onSwapPart?: (partType: string) => void
}

export const InstalledComponentsGrid: React.FC<InstalledComponentsGridProps> = ({
  carNumber,
  parts,
  activeEngineCondition = 82,
  driverName,
  carSpecificSpecs,
  carSpecificConditions,
  onSwapPart,
}) => {
  // Mapeia condições das peças reais do save ou aplica fallback
  const getComponentData = (catalogPartId: string, defaultSpec: string) => {
    // Busca peça correspondente nas partes da equipe
    let matchingPart: PartModel | undefined

    const pAny = (p: PartModel) => (p as any).type?.toLowerCase() || ''

    if (catalogPartId === 'frontWing') {
      matchingPart = parts.find(
        (p) =>
          p.name?.toLowerCase().includes('asa dianteira') ||
          pAny(p).includes('front') ||
          p.name?.toLowerCase().includes('front'),
      )
    } else if (catalogPartId === 'rearWing') {
      matchingPart = parts.find(
        (p) =>
          p.name?.toLowerCase().includes('asa traseira') ||
          pAny(p).includes('rear') ||
          p.name?.toLowerCase().includes('rear'),
      )
    } else if (catalogPartId === 'floor') {
      matchingPart = parts.find(
        (p) =>
          p.name?.toLowerCase().includes('assoalho') ||
          pAny(p).includes('floor') ||
          p.name?.toLowerCase().includes('floor'),
      )
    } else if (catalogPartId === 'sidepods') {
      matchingPart = parts.find(
        (p) =>
          p.name?.toLowerCase().includes('sidepod') ||
          p.name?.toLowerCase().includes('lateral') ||
          pAny(p).includes('sidepod'),
      )
    } else if (catalogPartId === 'engine') {
      matchingPart = parts.find(
        (p) => p.name?.toLowerCase().includes('motor') || pAny(p).includes('engine'),
      )
    } else if (catalogPartId === 'suspension') {
      matchingPart = parts.find(
        (p) => p.name?.toLowerCase().includes('suspens') || pAny(p).includes('suspension'),
      )
    }

    // Se houver condição configurada individualmente para este carro, usa-a com prioridade
    let condition = 80
    if (carSpecificConditions && typeof carSpecificConditions[catalogPartId] === 'number') {
      condition = Math.max(5, Math.min(100, carSpecificConditions[catalogPartId]))
    } else if (catalogPartId === 'engine') {
      condition = Math.max(10, Math.min(100, activeEngineCondition))
    } else if (matchingPart && typeof matchingPart.condition === 'number') {
      // Leve variação entre carro #1 e carro #2 para não ficarem cópias idênticas
      const delta = carNumber === 2 ? -4 : 0
      condition = Math.max(15, Math.min(100, matchingPart.condition + delta))
    } else {
      // Default coerente da imagem de referência
      const defaultConditions: Record<string, number> = {
        frontWing: carNumber === 1 ? 82 : 68,
        rearWing: carNumber === 1 ? 77 : 91,
        floor: carNumber === 1 ? 77 : 73,
        sidepods: carNumber === 1 ? 80 : 65,
        engine: carNumber === 1 ? 88 : 82,
        suspension: carNumber === 1 ? 83 : 72,
      }
      condition = defaultConditions[catalogPartId] || 80
    }

    // Se houver spec configurada individualmente para este carro, usa-a com prioridade
    const specName =
      carSpecificSpecs?.[catalogPartId] ||
      (matchingPart?.level
        ? `Spec ${String.fromCharCode(64 + Math.min(26, Math.max(1, matchingPart.level)))}`
        : defaultSpec)

    return {
      condition,
      specName,
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Título de seção */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">⚙ Componentes instalados</span>
          <span className="text-xs text-slate-400 font-mono">Carro #{carNumber}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">FIA 2026 Homologado</span>
      </div>

      {/* Grade de 6 componentes instalados (2 linhas x 3 colunas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {CAR_PARTS_CATALOG.map((part) => {
          const { condition, specName } = getComponentData(part.id, part.defaultSpec)

          // Cor da barra de progresso baseada na condição
          const barColor =
            condition >= 80 ? 'bg-emerald-500' : condition >= 60 ? 'bg-amber-500' : 'bg-red-500'

          return (
            <div
              key={part.id}
              className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between hover:bg-slate-100/60 transition-colors"
            >
              {/* Header do componente */}
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-xs font-semibold text-slate-800 leading-tight">
                  {part.label}
                </span>
              </div>

              {/* Ilustração Técnica Central */}
              <div className="flex items-center justify-center my-1.5 h-16">
                <PartIllustration partKey={part.id} className="h-14 w-full" />
              </div>

              {/* Rodapé: Spec + Barra de % de Condição + Ação de Troca */}
              <div className="mt-1 pt-1.5 border-t border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono font-medium truncate">{specName}</span>
                  <span className="font-bold font-mono text-slate-800 shrink-0">{condition}%</span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`${barColor} h-full rounded-full transition-all duration-300`}
                    style={{ width: `${condition}%` }}
                  />
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{carNumber} {driverName ? `• ${driverName.split(' ').pop()}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSwapPart?.(part.id)}
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 shadow-xs transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InstalledComponentsGrid
