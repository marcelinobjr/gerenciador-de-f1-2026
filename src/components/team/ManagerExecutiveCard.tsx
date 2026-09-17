import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, ShieldCheck } from 'lucide-react'

interface ManagerExecutiveCardProps {
  managerName: string
  roleTitle?: string
  archetypeTitle: string
  portraitUrl: string
  attributes: { label: string; value: number }[]
  boardConfidenceText?: string
  onOpenProfile: () => void
}

export const ManagerExecutiveCard: React.FC<ManagerExecutiveCardProps> = ({
  managerName,
  roleTitle = 'Team Principal',
  archetypeTitle,
  portraitUrl,
  attributes,
  boardConfidenceText = 'Muito alta',
  onOpenProfile,
}) => {
  const [imgError, setImgError] = useState(false)

  return (
    <Card className="bg-[#0C1017] text-white border-neutral-800 shadow-md rounded-2xl p-5 overflow-hidden flex flex-col justify-between relative">
      {/* Glow de fundo sutil */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />

      <div>
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
            MANAGER
          </span>
        </div>

        {/* Corpo: Retrato do Manager à esquerda, Infos e Barras à direita */}
        <div className="grid grid-cols-12 gap-4 py-4 items-center">
          {/* Retrato oficial do Manager (Drive / Asset canônico) */}
          <div className="col-span-4 flex justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700/80 shadow-inner shrink-0 relative">
              <img
                src={
                  imgError
                    ? 'https://img.usecurling.com/ppl/medium?gender=male&seed=44'
                    : portraitUrl
                }
                alt={managerName}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl" />
            </div>
          </div>

          {/* Nome, Cargo, Arquétipo e Barras de Atributos */}
          <div className="col-span-8 space-y-2.5">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {managerName}
              </h3>
              <div className="text-xs text-neutral-400 font-medium">{roleTitle}</div>
              <div className="text-xs italic text-neutral-300 font-serif">
                &ldquo;{archetypeTitle}&rdquo;
              </div>
            </div>

            {/* 4 Características Principais em barras */}
            <div className="space-y-1.5 pt-1">
              {attributes.slice(0, 4).map((attr) => (
                <div key={attr.label} className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] text-neutral-300 w-28 shrink-0 truncate">
                    {attr.label}
                  </span>
                  <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E10600] rounded-full"
                      style={{ width: `${Math.min(100, Math.max(10, attr.value))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-white w-6 text-right">
                    {attr.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé: Confiança da Diretoria + Botão VER PERFIL CTA Vermelho */}
      <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          <span className="text-neutral-400 text-[11px]">Confiança da diretoria:</span>
          <span className="text-emerald-400 font-semibold text-[11px]">{boardConfidenceText}</span>
        </div>

        <Button
          onClick={onOpenProfile}
          size="sm"
          className="bg-[#E10600] hover:bg-[#c40500] text-white text-xs font-semibold px-3.5 py-1.5 h-8 rounded-lg shadow-sm flex items-center gap-1"
        >
          VER PERFIL
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  )
}
