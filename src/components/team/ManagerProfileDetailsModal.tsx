import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { UserCheck, Shield, Award, Target, TrendingUp } from 'lucide-react'
import { ManagerOfficialPortraitMeta } from '@/lib/manager-official-assets'

interface ManagerProfileDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  managerName: string
  roleTitle: string
  portraitMeta: ManagerOfficialPortraitMeta
  boardConfidence: number
  allAttributes?: { key: string; label: string; value: number }[]
}

export const ManagerProfileDetailsModal: React.FC<ManagerProfileDetailsModalProps> = ({
  open,
  onOpenChange,
  managerName,
  roleTitle,
  portraitMeta,
  boardConfidence,
  allAttributes = [],
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white text-[#0F172A] border-[#E2E8F0] p-6 max-h-[85vh] overflow-y-auto shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#E10600]" />
            Ficha Executiva do Team Principal
          </DialogTitle>
          <DialogDescription className="text-[#64748B] text-xs">
            Perfil profissional, arquétipo de liderança e atributos estratégicos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* Card superior com retrato oficial e resumo */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-neutral-100 border border-[#CBD5E1] shrink-0">
              <img
                src={portraitMeta.imageUrl}
                alt={managerName}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div>
              <div className="text-base font-bold text-[#0F172A]">{managerName}</div>
              <div className="text-xs text-[#64748B]">{roleTitle}</div>
              <Badge className="mt-2 bg-[#E10600]/10 text-[#E10600] border border-[#E10600]/30 text-xs font-semibold">
                {portraitMeta.archetypeTitle}
              </Badge>
            </div>
          </div>

          {/* Confiança do Conselho */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#334155] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                Confiança do Conselho de Administração
              </span>
              <span className="font-bold text-emerald-600 font-mono text-sm">
                {boardConfidence}%
              </span>
            </div>
            <Progress
              value={boardConfidence}
              className="h-2 bg-neutral-200 [&>div]:bg-emerald-500"
            />
          </div>

          {/* Atributos do Manager */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">
              Competências de Gestão
            </span>
            <div className="grid grid-cols-2 gap-3">
              {(allAttributes.length > 0 ? allAttributes : portraitMeta.topAttributes).map(
                (attr) => (
                  <div
                    key={attr.key || attr.label}
                    className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-between text-xs"
                  >
                    <span className="text-[#64748B] truncate pr-2">{attr.label}</span>
                    <span className="font-mono font-bold text-[#0F172A]">{attr.value}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
