import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

export interface KeyStaffMemberItem {
  id: string
  name: string
  role: string
  overallRating: number
  moralStatus: 'Alta' | 'Estável' | 'Baixa'
  photoUrl: string
  contractEnd?: number | null
  contractBadgeLabel?: string
  contractBadgeVariant?: 'active' | 'expiring' | 'expired'
  rawMember?: any
}

interface TechnicalStaffSummaryCardProps {
  staffList: KeyStaffMemberItem[]
  onOpenFullStaff: () => void
  onSelectMember?: (member: KeyStaffMemberItem) => void
}

export const TechnicalStaffSummaryCard: React.FC<TechnicalStaffSummaryCardProps> = ({
  staffList,
  onOpenFullStaff,
  onSelectMember,
}) => {
  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 font-sans">
            EQUIPE TÉCNICA
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFullStaff}
            className="text-[11px] text-neutral-500 hover:text-neutral-900 font-semibold p-0 h-auto flex items-center gap-0.5"
          >
            VER EQUIPE TÉCNICA
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Tabela resumida de 5 cargos principais */}
        <div className="mt-2 divide-y divide-neutral-100">
          {/* Header das colunas */}
          <div className="grid grid-cols-12 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            <span className="col-span-5">NOME</span>
            <span className="col-span-4">FUNÇÃO</span>
            <span className="col-span-1 text-center">GER</span>
            <span className="col-span-2 text-right">MORAL</span>
          </div>

          {staffList.slice(0, 5).map((member) => {
            const moralColor =
              member.moralStatus === 'Alta'
                ? 'text-emerald-500'
                : member.moralStatus === 'Estável'
                  ? 'text-amber-500'
                  : 'text-red-500'

            const moralDotBg =
              member.moralStatus === 'Alta'
                ? 'bg-emerald-500'
                : member.moralStatus === 'Estável'
                  ? 'bg-amber-500'
                  : 'bg-red-500'

            return (
              <div
                key={member.id}
                onClick={() => onSelectMember && onSelectMember(member)}
                className="grid grid-cols-12 py-2.5 items-center hover:bg-neutral-50/80 rounded-lg px-1 transition-colors cursor-pointer group text-xs"
              >
                {/* Nome + Avatar */}
                <div className="col-span-5 flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-200 overflow-hidden shrink-0">
                    <img
                      src={
                        member.photoUrl ||
                        `https://img.usecurling.com/ppl/thumbnail?gender=male&seed=${member.name.length * 7}`
                      }
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-neutral-900 truncate group-hover:text-[#E10600] transition-colors">
                      {member.name}
                    </span>
                    {member.contractBadgeLabel && (
                      <span
                        className={`text-[9.5px] font-medium tracking-tight truncate ${
                          member.contractBadgeVariant === 'expired'
                            ? 'text-red-600 font-semibold'
                            : member.contractBadgeVariant === 'expiring'
                              ? 'text-amber-700 font-semibold'
                              : 'text-neutral-500'
                        }`}
                        title={member.contractBadgeLabel}
                      >
                        {member.contractBadgeLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Função */}
                <div className="col-span-4 text-neutral-500 text-[11px] truncate pr-2">
                  {member.role}
                </div>

                {/* GER */}
                <div className="col-span-1 text-center font-mono font-bold text-neutral-800">
                  {member.overallRating}
                </div>

                {/* Moral + Chevron */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${moralDotBg} shrink-0`} />
                  <span className={`font-medium ${moralColor}`}>{member.moralStatus}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-700 transition-colors ml-0.5" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
