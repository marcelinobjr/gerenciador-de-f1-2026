import React from 'react'
import { DriverModel, TeamModel } from '@/types/f1'
import { getCountryFlag } from '@/lib/country-flags'
import { getDriverPhotoSources } from '@/lib/driver-photos'
import { getDriverImage } from '@/data/assets/driverAssets'
import { getTeamSideView } from '@/data/assets/teamAssets'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'

export interface TeamCarCardProps {
  carNumber: 1 | 2
  driver: DriverModel | null
  team: TeamModel | null
  aeroSpec?: string
  chassisSpec?: string
  puInUse?: string
  puCycleText?: string
  reliability: number
  totalWear: number
  setupOrientation: string
}

export const TeamCarCard: React.FC<TeamCarCardProps> = ({
  carNumber,
  driver,
  team,
  aeroSpec = 'Aero B',
  chassisSpec = 'Chassi A',
  puInUse = 'PU-3',
  puCycleText = 'Uso 2/4',
  reliability = 84,
  totalWear = 28,
  setupOrientation = 'Equilibrado',
}) => {
  const teamKey = team?.team_key || team?.id || 'audi'
  const isCustom = Boolean(team?.is_custom)
  const carImage = getTeamSideView(teamKey) || getCarroPorEquipeImage(teamKey, isCustom)

  // Foto do piloto usando pipeline canônico com fallback
  const driverIdentifier = driver?.id || driver?.name || ''
  const manifestPhoto = driverIdentifier ? getDriverImage(driverIdentifier) : null
  const photoSources = driver?.name ? getDriverPhotoSources(driver.name) : null
  const driverPhoto =
    manifestPhoto ||
    photoSources?.bundledImg ||
    photoSources?.localCandidates?.find(Boolean) ||
    photoSources?.dropboxUrl ||
    photoSources?.localPath ||
    photoSources?.fallbackLocal ||
    '/pilotos/generico.png'

  const driverNationality = driver?.nationality || 'Brasil'
  const driverFlag = getCountryFlag(driverNationality)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-slate-800 transition-all hover:border-slate-300">
      {/* Top Header com Número e Piloto */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
          <span className="text-base font-black tracking-tight text-slate-900">
            Carro #{carNumber}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <span>Mix de Especificação:</span>
          <span className="font-semibold text-slate-700">
            {aeroSpec} / {chassisSpec}
          </span>
        </div>
      </div>

      {/* Grid: Piloto + Imagem do Carro + Status rápido */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 items-center">
        {/* Piloto */}
        <div className="md:col-span-4 flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-200">
            <img
              src={driver ? driverPhoto : '/pilotos/generico.png'}
              alt={driver?.name || 'Cockpit vago'}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                // Fallback para genérico se falhar
                ;(e.target as HTMLImageElement).src = '/pilotos/generico.png'
              }}
            />
            <div className="absolute top-0.5 right-1 text-slate-400 font-black text-xs font-mono">
              #{carNumber}
            </div>
          </div>

          <div className="min-w-0">
            {driver ? (
              <>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="text-sm">{driverFlag}</span>
                  <span className="truncate">{driverNationality}</span>
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">{driver.name}</div>
                <div className="text-[10px] font-mono text-emerald-600 font-medium">
                  Piloto Titular Carro #{carNumber}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-slate-400">Vaga em aberto</div>
                <div className="text-sm font-bold text-amber-600 truncate">Cockpit vago</div>
                <div className="text-[10px] font-mono text-slate-400">
                  Defina o titular na aba Equipe
                </div>
              </>
            )}
          </div>
        </div>

        {/* Monoposto SideView */}
        <div className="md:col-span-4 flex items-center justify-center py-1">
          <img
            src={carImage}
            alt={`Monoposto Carro #${carNumber}`}
            className="max-h-20 max-w-full object-contain filter drop-shadow-md"
          />
        </div>

        {/* Status rápido do carro */}
        <div className="md:col-span-4 space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Motor em uso:</span>
            <span className="font-bold text-slate-800 font-mono">
              {puInUse} ({puCycleText})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Confiabilidade:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 font-mono">{reliability}%</span>
              <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${reliability}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Desgaste total:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-600 font-mono">{totalWear}%</span>
              <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${totalWear}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5 border-t border-slate-200/60">
            <span className="text-slate-500">Orientação de setup:</span>
            <span className="font-medium text-slate-800">{setupOrientation}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamCarCard
