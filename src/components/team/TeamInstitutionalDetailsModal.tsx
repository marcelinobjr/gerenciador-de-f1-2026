import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Building2, Cpu, Flag, TrendingUp, Trophy, History, Shield, Users } from 'lucide-react'

interface TeamInstitutionalDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: any
  teamName: string
  teamHq: string
  teamCountry: string
  engineSupplier: string
  teamIntro: string
}

export const TeamInstitutionalDetailsModal: React.FC<TeamInstitutionalDetailsModalProps> = ({
  open,
  onOpenChange,
  team,
  teamName,
  teamHq,
  teamCountry,
  engineSupplier,
  teamIntro,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0C1017] text-white border-neutral-800 p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-[#E10600] flex items-center justify-center font-black text-lg border border-red-600/30">
              {teamName.charAt(0)}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white uppercase tracking-tight">
                {teamName}
              </DialogTitle>
              <DialogDescription className="text-neutral-400 text-xs">
                Perfil institucional, sede operacional e histórico da montadora
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-3 text-xs">
          {/* Manifesto / Resumo Institucional */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
              Missão & Filosofia
            </span>
            <p className="text-neutral-200 text-sm leading-relaxed italic font-serif">
              &ldquo;{teamIntro}&rdquo;
            </p>
          </div>

          {/* Grid de Fatos Técnicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                <Building2 className="w-3.5 h-3.5" />
                <span>Base Operacional</span>
              </div>
              <div className="text-sm font-bold text-white">{teamHq}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                <Cpu className="w-3.5 h-3.5" />
                <span>Unidade de Potência</span>
              </div>
              <div className="text-sm font-bold text-white">
                UP {engineSupplier} 50/50 Turbo Híbrido
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                <Flag className="w-3.5 h-3.5" />
                <span>Nacionalidade da Licença</span>
              </div>
              <div className="text-sm font-bold text-white">{teamCountry}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Status Competitivo</span>
              </div>
              <div className="text-sm font-bold text-emerald-400">
                Projeto de Fábrica em Ascensão
              </div>
            </div>
          </div>

          {/* Histórico & Estrutura */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <History className="w-4 h-4 text-[#E10600]" />
              Estrutura Organizacional e Herança
            </h4>
            <p className="text-neutral-300 leading-relaxed text-xs">
              A equipe opera sob o regulamento técnico da era 2026, integrando fábrica de motores e
              chassi com foco em eficiência aerodinâmica ativa e recuperação elétrica de 350kW. O
              centro de excelência de Neuburg conta com bancadas dinâmicas e simulador de última
              geração, suportados por uma cadeia de engenheiros de classe mundial.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
