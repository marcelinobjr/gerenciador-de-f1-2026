import React from 'react'
import { Card } from '@/components/ui/card'
import { Users, Cpu, Link2, Zap } from 'lucide-react'

export interface OrganizationHealthKpis {
  teamMorale: number // ex: 82 -> Alta
  operationalEfficiency: number // ex: 78 -> Boa
  cohesion: number // ex: 85 -> Alta
  internalPressure: number // ex: 36 -> Baixa
}

interface OrganizationHealthCardProps {
  kpis: OrganizationHealthKpis
}

export const OrganizationHealthCard: React.FC<OrganizationHealthCardProps> = ({ kpis }) => {
  const getStatusText = (score: number, kind: 'positive' | 'inverse' = 'positive') => {
    if (kind === 'inverse') {
      if (score <= 40) return { label: 'Baixa', color: 'text-emerald-600', ring: '#10B981' }
      if (score <= 65) return { label: 'Média', color: 'text-amber-600', ring: '#F59E0B' }
      return { label: 'Alta', color: 'text-red-600', ring: '#EF4444' }
    }
    if (score >= 80) return { label: 'Alta', color: 'text-emerald-600', ring: '#10B981' }
    if (score >= 65) return { label: 'Boa', color: 'text-emerald-600', ring: '#10B981' }
    if (score >= 50) return { label: 'Estável', color: 'text-amber-600', ring: '#F59E0B' }
    return { label: 'Baixa', color: 'text-red-600', ring: '#EF4444' }
  }

  const items = [
    {
      title: 'Moral da Equipe',
      val: kpis.teamMorale,
      icon: Users,
      ...getStatusText(kpis.teamMorale, 'positive'),
    },
    {
      title: 'Eficiência Operacional',
      val: kpis.operationalEfficiency,
      icon: Cpu,
      ...getStatusText(kpis.operationalEfficiency, 'positive'),
    },
    {
      title: 'Coesão',
      val: kpis.cohesion,
      icon: Link2,
      ...getStatusText(kpis.cohesion, 'positive'),
    },
    {
      title: 'Pressão Interna',
      val: kpis.internalPressure,
      icon: Zap,
      ...getStatusText(kpis.internalPressure, 'inverse'),
    },
  ]

  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl p-5">
      <div className="pb-3 border-b border-neutral-100">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 font-sans">
          SAÚDE DA ORGANIZAÇÃO
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
        {items.map((item) => {
          const Icon = item.icon
          const radius = 22
          const circumference = 2 * Math.PI * radius
          const strokeDashoffset = circumference - (item.val / 100) * circumference

          return (
            <div key={item.title} className="flex flex-col items-center text-center space-y-1.5">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium">
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{item.title}</span>
              </div>

              {/* Gauge circular */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 54 54">
                  <circle
                    cx="27"
                    cy="27"
                    r={radius}
                    stroke="#F1F3F5"
                    strokeWidth="3.5"
                    fill="none"
                  />
                  <circle
                    cx="27"
                    cy="27"
                    r={radius}
                    stroke={item.ring}
                    strokeWidth="3.5"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <span className="absolute font-mono font-black text-sm text-neutral-900">
                  {item.val}
                </span>
              </div>

              <span className={`text-[11px] font-semibold ${item.color}`}>{item.label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
