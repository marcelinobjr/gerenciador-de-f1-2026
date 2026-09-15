import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DriverModel, TeamModel } from '@/types/f1'
import { ProceduralDriverMetadata } from '@/types/procedural-driver'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import { Bug, ShieldAlert, Cpu, Award, User, RefreshCw } from 'lucide-react'

interface ProspectDebugAuditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: TeamModel
  drivers: DriverModel[]
}

export const ProspectDebugAuditModal: React.FC<ProspectDebugAuditModalProps> = ({
  open,
  onOpenChange,
  team,
  drivers,
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '')

  const audit = infrastructureCapabilityService.auditInfrastructure(team)
  const currentDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0]
  const meta = (currentDriver as any)?.procedural_data as ProceduralDriverMetadata | undefined

  const truePot = meta?.truePotential ?? (currentDriver as any)?.true_potential ?? 'N/A'
  const percPot =
    meta?.scoutingRecords?.[team.id]?.perceivedPotential ??
    (currentDriver as any)?.perceived_potential ??
    'N/A'
  const conf =
    meta?.scoutingRecords?.[team.id]?.evaluationConfidence ??
    (currentDriver as any)?.evaluation_confidence ??
    'N/A'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-amber-900/60 text-zinc-100 font-mono text-xs">
        <DialogHeader className="border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Bug className="w-5 h-5" />
            <DialogTitle className="text-base font-bold tracking-tight">
              PROSPECT & ACADEMY AUDIT / DEBUG TOOL (MODO ENGENHARIA INTERNA)
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-xs">
            Visualização técnica irrestrita para validação das regras 4C. (Campos de True Potential
            e Personalidade Oculta são confidenciais e NÃO existem na UI padrão).
          </DialogDescription>
        </DialogHeader>

        {/* Telemetria da Infraestrutura da Equipe */}
        <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Cpu className="w-4 h-4" />
            <span>
              Infraestrutura: {team.name} (Youth Academy Nv {team.youth_academy_level || 3})
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-zinc-300">
            <div>
              Scouting Reach:{' '}
              <strong className="text-white">{audit.capabilities.scoutingReach}</strong>
            </div>
            <div>
              Eval Accuracy:{' '}
              <strong className="text-white">{audit.capabilities.evaluationAccuracy}</strong>
            </div>
            <div>
              Talent Dev Cap:{' '}
              <strong className="text-white">{audit.capabilities.talentDevelopmentCapacity}</strong>
            </div>
            <div>
              Manager Talent Mod:{' '}
              <strong className="text-white">
                {(audit.managerTalentModifier * 100).toFixed(1)}%
              </strong>
            </div>
          </div>
        </div>

        {/* Seleção do piloto para inspecionar */}
        <div className="space-y-2">
          <label className="text-zinc-400 font-bold block">
            Selecione o Piloto para Auditoria:
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-zinc-900/40 rounded border border-zinc-800">
            {drivers.map((d) => {
              const isSelected = d.id === currentDriver?.id
              const isProc =
                (d as any).origin_type === 'procedural' || Boolean((d as any).procedural_data)
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDriverId(d.id)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-black font-bold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span>{d.name}</span>
                  {isProc ? (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 border-amber-600/50"
                    >
                      Proc
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-zinc-600">
                      Real
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Detalhes do Piloto Selecionado */}
        {currentDriver && (
          <div className="p-4 bg-black/60 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  {currentDriver.name}
                  <span className="text-xs text-zinc-400 font-normal">
                    ({currentDriver.age} anos, {currentDriver.nationality})
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  ID Universal Permanente:{' '}
                  <code className="text-amber-300">{currentDriver.id}</code>
                </p>
              </div>

              <div className="text-right space-y-0.5">
                <div className="text-xs">
                  Categoria Atual:{' '}
                  <strong className="text-white">
                    {meta?.juniorCategory?.toUpperCase() ||
                      currentDriver.category?.toUpperCase() ||
                      'F1'}
                  </strong>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Status:{' '}
                  <strong className="text-amber-300">
                    {(currentDriver as any).career_status ||
                      (currentDriver.team_id ? 'Vinculado' : 'Livre')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Comparativo Central: TRUE POTENTIAL vs PERCEIVED vs CONFIDENCE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
              <div className="p-2.5 rounded bg-black/40 border border-red-900/50">
                <div className="text-[11px] text-red-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  TRUE POTENTIAL (OCULTO)
                </div>
                <div className="text-2xl font-black text-red-400 mt-1">{truePot}</div>
                <div className="text-[10px] text-zinc-400">Teto biológico real do atleta</div>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-amber-900/50">
                <div className="text-[11px] text-amber-400 font-bold">PERCEIVED POTENTIAL</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{percPot}</div>
                <div className="text-[10px] text-zinc-400">Estimativa atual da equipe</div>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-cyan-900/50">
                <div className="text-[11px] text-cyan-400 font-bold">EVALUATION CONFIDENCE</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">{conf}%</div>
                <div className="text-[10px] text-zinc-400">Grau de certeza do scouting</div>
              </div>
            </div>

            {/* Atributos Reais */}
            <div className="space-y-1.5">
              <span className="text-zinc-400 font-bold">Atributos Técnicos Reais:</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Ritmo</span>
                  <strong className="text-white text-sm">{currentDriver.speed || 60}</strong>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Consistência</span>
                  <strong className="text-white text-sm">{currentDriver.consistency || 60}</strong>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Chuva</span>
                  <strong className="text-white text-sm">{currentDriver.rain || 60}</strong>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Defesa</span>
                  <strong className="text-white text-sm">{currentDriver.defense || 60}</strong>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Tech Feedback</span>
                  <strong className="text-white text-sm">
                    {currentDriver.technical_feedback || 60}
                  </strong>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Adaptação F1</span>
                  <strong className="text-white text-sm">
                    {currentDriver.f1_adaptation || 50}
                  </strong>
                </div>
              </div>
            </div>

            {/* Metadados de Personalidade & Visual Asset */}
            {meta && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px]">
                <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800 space-y-1">
                  <span className="font-bold text-zinc-300 block">Psicologia & Personalidade:</span>
                  <div>
                    Traço Dominante:{' '}
                    <strong className="text-amber-300">{meta.psychology?.dominantTrait}</strong>
                  </div>
                  <div>
                    Ambição: {meta.psychology?.ambition}/100 | Lealdade: {meta.psychology?.loyalty}
                    /100
                  </div>
                  <div>
                    Pressão: {meta.psychology?.pressureTolerance}/100 | Agressividade:{' '}
                    {meta.psychology?.aggression}/100
                  </div>
                  <div>
                    Estilo de Pilotagem: <strong className="text-white">{meta.drivingStyle}</strong>
                  </div>
                </div>

                <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800 space-y-1">
                  <span className="font-bold text-zinc-300 block">Asset Visual Desacoplado:</span>
                  <div>
                    VisualIdentityId:{' '}
                    <code className="text-cyan-300">{meta.visualIdentity?.visualIdentityId}</code>
                  </div>
                  <div>
                    Seed: {meta.visualIdentity?.visualSeed} | Gênero: {meta.visualIdentity?.gender}
                  </div>
                  <div>
                    Tom de Pele: {meta.visualIdentity?.skinTone} | Cabelo:{' '}
                    {meta.visualIdentity?.hairColor} ({meta.visualIdentity?.hairStyle})
                  </div>
                  <div>
                    Status Asset:{' '}
                    <Badge variant="outline" className="text-[9px] border-zinc-700">
                      {meta.visualIdentity?.generationStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
export default ProspectDebugAuditModal
