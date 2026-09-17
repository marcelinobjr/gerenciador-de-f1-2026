import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, UserCheck, Shield } from 'lucide-react'

interface AttributeItem {
  label: string
  key: string
  value: number
}

interface ManagerExecutiveCardProps {
  managerName: string
  roleTitle?: string
  archetypeTitle: string
  portraitUrl: string
  attributes: AttributeItem[]
  boardConfidencePct?: number
  boardConfidenceText?: string
  quote?: string
  onOpenProfile: () => void
}

export const ManagerExecutiveCard: React.FC<ManagerExecutiveCardProps> = ({
  managerName,
  roleTitle = 'Team Principal',
  archetypeTitle,
  portraitUrl,
  attributes,
  boardConfidencePct = 52,
  boardConfidenceText = 'Estável',
  quote = '“Estratégia transforma potencial em vitórias.”',
  onOpenProfile,
}) => {
  return (
    <Card
      onClick={onOpenProfile}
      className="bg-white border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl p-5 cursor-pointer flex flex-col justify-between group overflow-hidden"
    >
      <div>
        <div className="flex gap-4 sm:gap-5 items-start">
          {/* Foto Vertical à Esquerda */}
          <div className="relative w-28 sm:w-36 h-44 sm:h-52 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/70 shadow-inner">
            <img
              src={portraitUrl}
              alt={managerName}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Dados do Manager à Direita */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400">
              <span>{roleTitle}</span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight font-sans truncate group-hover:text-[#E10600] transition-colors">
                {managerName}
              </h2>
              <Badge className="bg-[#E10600] text-white hover:bg-[#E10600] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                {roleTitle}
              </Badge>
            </div>

            {/* Arquétipo */}
            <div className="mt-2.5 p-2 rounded-lg bg-neutral-50 border border-neutral-100 flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-red-100 text-[#E10600] flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-neutral-400">Arquétipo</div>
                <div className="text-xs font-bold text-neutral-800">{archetypeTitle}</div>
                <div className="text-[10px] text-neutral-500 italic mt-0.5 line-clamp-1">
                  &ldquo;Campeonatos são vencidos antes de o carro entrar na pista.&rdquo;
                </div>
              </div>
            </div>

            {/* Atributos em barras horizontais elegantes */}
            <div className="mt-3 space-y-2">
              {attributes.slice(0, 4).map((attr) => (
                <div key={attr.key} className="flex items-center gap-2.5 text-xs">
                  <span className="w-28 shrink-0 text-neutral-600 font-medium text-[11px] truncate">
                    {attr.label}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E10600] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, attr.value))}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono font-bold text-neutral-900 text-xs">
                    {attr.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé: Confiança da Direção + Citação */}
      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <StarIcon />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 leading-none">
              Confiança da Direção
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono font-black text-sm text-neutral-900">
                {boardConfidencePct}%
              </span>
              <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-0.5">
                {boardConfidenceText} <TrendingUp className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] italic text-neutral-400 font-serif text-right max-w-[200px] hidden sm:block">
          {quote}
        </p>
      </div>
    </Card>
  )
}

function StarIcon() {
  return (
    <svg className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}
