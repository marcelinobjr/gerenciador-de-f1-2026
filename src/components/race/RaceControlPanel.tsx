import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Radio } from 'lucide-react'
import type { RaceControlStatus } from '@/types/canonical-race-v2'

export interface RaceControlPanelProps {
  currentFlag: RaceControlStatus
  safetyCarActive: boolean
  vscActive: boolean
  redFlagActive: boolean
  isSuspended?: boolean
  currentLap: number
  weatherCondition?: string
  compact?: boolean
}

export const RaceControlPanel: React.FC<RaceControlPanelProps> = ({
  currentFlag,
  safetyCarActive,
  vscActive,
  redFlagActive,
  isSuspended,
  currentLap,
  weatherCondition,
  compact = false,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  // DRS: Liberado a partir da volta 2 sob bandeira verde, sem SC/VSC/Red Flag e em pista seca
  const isDrsEligible =
    currentLap >= 2 &&
    currentFlag === 'GREEN' &&
    !safetyCarActive &&
    !vscActive &&
    !redFlagActive &&
    !isSuspended &&
    weatherCondition !== 'wet' &&
    weatherCondition !== 'chuva_extrema'

  const drsStatus = isDrsEligible ? 'ATIVO' : 'DESATIVADO'

  const flagText = () => {
    switch (currentFlag) {
      case 'GREEN':
        return { label: 'VERDE', color: 'text-emerald-400 bg-emerald-500' }
      case 'YELLOW_LOCAL':
      case 'YELLOW':
        return { label: 'AMARELA', color: 'text-yellow-400 bg-yellow-400' }
      case 'VSC':
        return { label: 'VSC', color: 'text-amber-400 bg-amber-400' }
      case 'SAFETY_CAR':
        return { label: 'SAFETY CAR', color: 'text-orange-400 bg-orange-500' }
      case 'RESTART':
        return { label: 'RELARGADA', color: 'text-emerald-300 bg-emerald-400' }
      case 'RED_FLAG':
        return { label: 'VERMELHA', color: 'text-red-400 bg-red-500' }
      case 'FINISHED':
        return { label: 'FINALIZADA', color: 'text-slate-300 bg-slate-400' }
      default:
        return { label: 'VERDE', color: 'text-emerald-400 bg-emerald-500' }
    }
  }

  const flagInfo = flagText()

  return (
    <Card className="bg-[#090d18] border border-slate-800/80 rounded-xl shadow-md overflow-hidden text-white font-mono">
      <CardHeader
        onClick={() => setCollapsed(!collapsed)}
        className={`${
          compact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'
        } bg-[#0e1628] border-b border-slate-800 flex flex-row items-center justify-between cursor-pointer select-none`}
      >
        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ESTADO DA CORRIDA
        </CardTitle>
        <button
          type="button"
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </CardHeader>

      {!collapsed && (
        <CardContent className={`${compact ? 'p-2 space-y-1' : 'p-3 space-y-2'} text-xs`}>
          {/* BANDEIRA */}
          <div className="flex items-center justify-between py-0.5 border-b border-slate-800/40">
            <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">
              BANDEIRA
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs"
                style={{
                  backgroundColor: flagInfo.color.split(' ')[1]?.replace('bg-', '') || '#10b981',
                }}
              />
              <span className={`font-black text-xs tracking-wider ${flagInfo.color.split(' ')[0]}`}>
                {flagInfo.label}
              </span>
            </div>
          </div>

          {/* SAFETY CAR */}
          <div className="flex items-center justify-between py-0.5 border-b border-slate-800/40">
            <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">
              SAFETY CAR
            </span>
            <span
              className={`font-black text-xs ${
                safetyCarActive ? 'text-orange-400 animate-pulse' : 'text-slate-500'
              }`}
            >
              {safetyCarActive ? 'ATIVO' : '—'}
            </span>
          </div>

          {/* VSC */}
          <div className="flex items-center justify-between py-0.5 border-b border-slate-800/40">
            <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">VSC</span>
            <span
              className={`font-black text-xs ${
                vscActive ? 'text-amber-400 animate-pulse' : 'text-slate-500'
              }`}
            >
              {vscActive ? 'ATIVO' : '—'}
            </span>
          </div>

          {/* DRS */}
          <div className="flex items-center justify-between py-0.5">
            <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">DRS</span>
            <span
              className={`font-black text-xs tracking-wider ${
                isDrsEligible ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {drsStatus}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
