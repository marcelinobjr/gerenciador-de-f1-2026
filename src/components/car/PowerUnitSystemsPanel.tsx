import React from 'react'
import { RefreshCw, Clock, RotateCcw, AlertCircle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PowerUnitSubcomponent {
  name: string
  condition: number
  trend?: string
}

export interface PowerUnitSystemsPanelProps {
  supplierName?: string
  overallIntegrity: number
  activeUnitIndex: number // 1 a 4
  totalUnitsLimit?: number
  currentKm?: number
  usageCycles?: number
  estimatedWear?: number
  subcomponents?: PowerUnitSubcomponent[]
  energyEfficiency?: number
  engineMode?: string
  onIntroduceNewEngine?: () => void
  isChangingEngine?: boolean
  costCapAvailable?: number
}

const DEFAULT_SUBCOMPONENTS: PowerUnitSubcomponent[] = [
  { name: 'Motor de combustão (ICE)', condition: 86, trend: '+2' },
  { name: 'Turbo', condition: 78, trend: '+3' },
  { name: 'MGU-H', condition: 82, trend: '+1' },
  { name: 'MGU-K', condition: 79, trend: '+1' },
  { name: 'ERS (Recovery)', condition: 81, trend: '+2' },
  { name: 'Eletrônica e Controle', condition: 85, trend: '+2' },
]

export const PowerUnitSystemsPanel: React.FC<PowerUnitSystemsPanelProps> = ({
  supplierName = 'Audi Sport',
  overallIntegrity = 79,
  activeUnitIndex = 2,
  totalUnitsLimit = 4,
  currentKm = 1482,
  usageCycles = 4,
  estimatedWear = 21,
  subcomponents = DEFAULT_SUBCOMPONENTS,
  energyEfficiency = 79,
  engineMode = 'Padrão / Equilibrado',
  onIntroduceNewEngine,
  isChangingEngine = false,
}) => {
  const isPenaltyRisk = activeUnitIndex > totalUnitsLimit

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
      {/* Top Banner com Fornecedor e Botão de Ação Real Trocar Motor */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
          <h3 className="text-sm font-bold text-slate-900">Power Unit & Sistemas</h3>
          <span className="text-xs text-slate-400 font-mono">{supplierName} 2026</span>
        </div>

        {onIntroduceNewEngine && (
          <Button
            onClick={onIntroduceNewEngine}
            disabled={isChangingEngine}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChangingEngine ? 'animate-spin' : ''}`} />
            <span>{isChangingEngine ? 'Trocando...' : 'Trocar motor'}</span>
          </Button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-2 mb-3">
        Desempenho, confiabilidade e gestão da unidade de potência.
      </p>

      {/* Integridade Geral da PU */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-700">Integridade do motor</span>
          <span className="text-lg font-black font-mono text-slate-900">{overallIntegrity}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              overallIntegrity >= 80
                ? 'bg-emerald-500'
                : overallIntegrity >= 60
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${overallIntegrity}%` }}
          />
        </div>
      </div>

      {/* Ciclo de Unidades da Temporada (1 a 4) */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-slate-800">Motores da temporada</span>
          <div className="text-[11px] text-right">
            <span className="font-bold text-slate-900">
              PU {activeUnitIndex} de {totalUnitsLimit}
            </span>
            <div className="text-[10px] text-slate-500">
              {isPenaltyRisk
                ? 'Sujeito a penalidade de grid (excedeu limite)'
                : `Troca sem punição até a ${totalUnitsLimit}ª unidade.`}
            </div>
          </div>
        </div>

        {/* 4 Caixas de Motores */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: totalUnitsLimit }).map((_, idx) => {
            const unitNumber = idx + 1
            const isCurrent = unitNumber === activeUnitIndex
            const isUsed = unitNumber < activeUnitIndex

            let bgClass = 'bg-slate-100 border-slate-200 text-slate-400'
            if (isCurrent) {
              bgClass = 'bg-red-600 border-red-700 text-white shadow-sm'
            } else if (isUsed) {
              bgClass = 'bg-slate-700 border-slate-800 text-slate-300'
            }

            return (
              <div
                key={unitNumber}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${bgClass}`}
              >
                <div className="text-sm font-black font-mono">{unitNumber}</div>
                <div className="text-[9px] font-mono mt-0.5 opacity-80">
                  {isCurrent ? 'EM USO' : isUsed ? 'UTILIZADO' : 'NOVO'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3 Métricas Rápidas: Km, Ciclos, Desgaste */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-xs mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500">Quilometragem</div>
            <div className="font-bold font-mono text-slate-800">
              {currentKm.toLocaleString('pt-BR')} km
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500">Ciclos de uso</div>
            <div className="font-bold font-mono text-slate-800">{usageCycles} corridas</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500">Desgaste estim.</div>
            <div className="font-bold font-mono text-amber-600">{estimatedWear}%</div>
          </div>
        </div>
      </div>

      {/* Subcomponentes Detalhados da PU */}
      <div className="space-y-2 mb-4">
        {subcomponents.map((comp) => (
          <div key={comp.name} className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-600">{comp.name}</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-slate-800">{comp.condition}%</span>
                {comp.trend && <span className="text-[10px] text-emerald-600">▲ {comp.trend}</span>}
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${comp.condition}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé: Eficiência Energética + Modo de Motor + Risco de Penalidade */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
        <div>
          <span className="text-slate-500 text-[10px] block">Efic. Energética</span>
          <span className="font-bold font-mono text-slate-800">{energyEfficiency}%</span>
          <span className="text-[10px] text-emerald-600 font-mono ml-1">▲ +4</span>
        </div>

        <div>
          <span className="text-slate-500 text-[10px] block">Modo de motor atual</span>
          <span className="font-semibold text-slate-800">{engineMode}</span>
        </div>

        <div>
          <span className="text-slate-500 text-[10px] block">Risco de penalidade</span>
          <div className="flex items-center gap-1 font-bold">
            <ShieldAlert
              className={`w-3.5 h-3.5 ${isPenaltyRisk ? 'text-red-500' : 'text-emerald-500'}`}
            />
            <span className={isPenaltyRisk ? 'text-red-600' : 'text-emerald-700'}>
              {isPenaltyRisk ? 'Alto (Penalidade)' : 'Baixo (Sem risco)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PowerUnitSystemsPanel
