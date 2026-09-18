import React from 'react'
import { TeamModel } from '@/types/f1'

export interface TeamTechnicalRow {
  id: string
  name: string
  color: string
  overall: number
  aero: number
  topSpeed: number
  traction: number
  tires: number
  reliability: number
  isOurTeam?: boolean
}

export interface GridCompetitivenessProps {
  teams: TeamTechnicalRow[]
  currentTeamId?: string
}

export const GridCompetitiveness: React.FC<GridCompetitivenessProps> = ({
  teams,
  currentTeamId,
}) => {
  // Ordena por overall decrescente
  const sortedTeams = [...teams].sort((a, b) => b.overall - a.overall)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Header com Legenda */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">🏁 Competitividade no Grid</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Comparação técnica com as principais equipes (índice por área).
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
            <span className="font-semibold text-slate-800">Nosso carro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
            <span className="text-slate-500">Top 3 do grid</span>
          </div>
        </div>
      </div>

      {/* Tabela de Competitividade */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-[11px] font-mono text-slate-400 border-b border-slate-100">
              <th className="pb-2 font-normal">Equipe</th>
              <th className="pb-2 text-center font-normal">Overall</th>
              <th className="pb-2 text-center font-normal">Aerodinâmica</th>
              <th className="pb-2 text-center font-normal">Vel. Máx.</th>
              <th className="pb-2 text-center font-normal">Tração</th>
              <th className="pb-2 text-center font-normal">Pneus</th>
              <th className="pb-2 text-center font-normal">Confiabilidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTeams.map((t) => {
              const isSelected = t.isOurTeam || (currentTeamId && t.id === currentTeamId)

              return (
                <tr
                  key={t.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-red-50/70 font-semibold' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Nome da Equipe com bolinha da cor */}
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color || '#94A3B8' }}
                      />
                      <span
                        className={`truncate max-w-[140px] sm:max-w-[200px] ${
                          isSelected ? 'text-red-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {t.name}
                      </span>
                    </div>
                  </td>

                  {/* Overall com mini barra */}
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`font-mono font-bold ${
                        isSelected ? 'text-red-700' : 'text-slate-800'
                      }`}
                    >
                      {t.overall}
                    </span>
                  </td>

                  {/* Aerodinâmica */}
                  <td className="py-2.5 px-2 text-center">
                    <span className="font-mono text-slate-700">{t.aero}</span>
                  </td>

                  {/* Vel. Máx */}
                  <td className="py-2.5 px-2 text-center">
                    <span className="font-mono text-slate-700">{t.topSpeed}</span>
                  </td>

                  {/* Tração */}
                  <td className="py-2.5 px-2 text-center">
                    <span className="font-mono text-slate-700">{t.traction}</span>
                  </td>

                  {/* Pneus */}
                  <td className="py-2.5 px-2 text-center">
                    <span className="font-mono text-slate-700">{t.tires}</span>
                  </td>

                  {/* Confiabilidade */}
                  <td className="py-2.5 px-2 text-center">
                    <span className="font-mono text-slate-700">{t.reliability}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default GridCompetitiveness
