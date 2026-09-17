import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, Users, AlertCircle } from 'lucide-react'

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
    <Card className="bg-white border-neutral-200/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E10600] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900 font-sans block">
                Equipe Técnica
              </span>
              <span className="text-[11px] text-neutral-400 font-medium block">
                Pilares que transformam ambição em performance.
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFullStaff}
            className="text-[11px] text-[#E10600] hover:text-[#B00500] hover:bg-red-50/50 font-bold p-0 h-auto flex items-center gap-0.5 shrink-0"
          >
            Ver todos
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Lista Premium de Staff */}
        <div className="mt-2 divide-y divide-neutral-100">
          {staffList.slice(0, 4).map((member) => {
            const isExpiringOrExpired =
              member.contractBadgeVariant === 'expiring' ||
              member.contractBadgeVariant === 'expired'

            const moralColor =
              member.moralStatus === 'Alta'
                ? 'text-emerald-600'
                : member.moralStatus === 'Estável'
                  ? 'text-amber-600'
                  : 'text-red-600'

            const moralDotBg =
              member.moralStatus === 'Alta'
                ? 'bg-emerald-500'
                : member.moralStatus === 'Estável'
                  ? 'bg-amber-500'
                  : 'bg-red-500'

            const formattedContract = member.contractEnd
              ? `Até ${member.contractEnd}`
              : member.contractBadgeLabel || 'Até 2028'

            return (
              <div
                key={member.id}
                onClick={() => onSelectMember && onSelectMember(member)}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-neutral-50/80 rounded-xl px-2 transition-colors cursor-pointer group text-xs"
              >
                {/* Avatar + Nome + Função */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200">
                    <img
                      src={
                        member.photoUrl ||
                        `https://img.usecurling.com/ppl/thumbnail?gender=male&seed=${member.name.length * 7}`
                      }
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-neutral-900 truncate group-hover:text-[#E10600] transition-colors leading-tight">
                      {member.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate leading-tight mt-0.5">
                      {member.role}
                    </div>
                  </div>
                </div>

                {/* Rating GER */}
                <div className="text-right shrink-0 px-2">
                  <span className="text-[9px] uppercase font-bold text-neutral-400 block font-mono leading-none">
                    GER
                  </span>
                  <span className="font-mono font-black text-sm text-neutral-900 leading-tight">
                    {member.overallRating}
                  </span>
                </div>

                {/* Moral */}
                <div className="flex items-center gap-1.5 shrink-0 min-w-[60px]">
                  <span className={`w-2 h-2 rounded-full ${moralDotBg} shrink-0`} />
                  <span className={`text-[11px] font-semibold ${moralColor}`}>
                    {member.moralStatus}
                  </span>
                </div>

                {/* Contrato + Alerta */}
                <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-[70px] text-right">
                  <span className="text-[11px] font-medium text-neutral-600">
                    {formattedContract}
                  </span>
                  {isExpiringOrExpired && (
                    <span
                      title="Contrato próximo do término ou vencido"
                      className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black"
                    >
                      !
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
