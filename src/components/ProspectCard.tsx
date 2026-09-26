import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CountryFlag } from '@/components/CountryFlag'
import { ProspectScoutingCardViewModel } from '@/types/procedural-driver'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  Sparkles,
  Search,
  Eye,
  UserPlus,
  Shield,
  Gauge,
  Zap,
  TrendingUp,
  Award,
} from 'lucide-react'

interface ProspectCardProps {
  prospect: ProspectScoutingCardViewModel
  onEvaluateAgain?: (driverId: string) => void
  onInviteToAcademy?: (driverId: string) => void
  onRunTest?: (driverId: string) => void
  isProcessing?: boolean
}

export const ProspectCard: React.FC<ProspectCardProps> = ({
  prospect,
  onEvaluateAgain,
  onInviteToAcademy,
  onRunTest,
  isProcessing = false,
}) => {
  const [imageFailed, setImageFailed] = React.useState(false)

  const resolvedPhoto = React.useMemo(() => {
    return resolveDriverPhoto({
      driverId: prospect.driverId,
      name: prospect.name,
      visualIdentity: prospect.visualIdentity,
      generatedPortraitProfileId:
        prospect.generatedPortraitProfileId ||
        prospect.visualIdentity?.generatedPortraitProfileId ||
        (prospect.visualIdentity?.portraitAssetId?.startsWith('GEN_')
          ? prospect.visualIdentity.portraitAssetId
          : undefined),
    })
  }, [
    prospect.driverId,
    prospect.name,
    prospect.visualIdentity,
    prospect.generatedPortraitProfileId,
  ])
  const getPotentialBadgeColor = (label: string) => {
    switch (label) {
      case 'Excepcional':
        return 'bg-purple-950/80 text-purple-300 border-purple-600'
      case 'Muito Alto':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
      case 'Promissor':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-600'
      case 'Médio':
        return 'bg-amber-950/80 text-amber-300 border-amber-600'
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700'
    }
  }

  const getConfidenceBadgeColor = (grade: string) => {
    switch (grade) {
      case 'Muito Alta':
        return 'text-emerald-400'
      case 'Alta':
        return 'text-cyan-400'
      case 'Média':
        return 'text-amber-400'
      default:
        return 'text-zinc-500'
    }
  }

  return (
    <Card className="bg-[#0B0E14] border-neutral-800 hover:border-neutral-700 transition-all overflow-hidden flex flex-col justify-between">
      <div>
        {/* Top Header Card */}
        <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/30 flex items-start gap-3">
          <div className="w-16 h-20 rounded-lg overflow-hidden border border-neutral-800 shrink-0 bg-neutral-950">
            {resolvedPhoto.url && !imageFailed ? (
              <img
                src={resolvedPhoto.url}
                alt={prospect.name}
                className="w-full h-full object-cover object-top"
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center font-bold text-lg select-none text-white border"
                style={{
                  backgroundColor: `${resolvedPhoto.teamColor}20`,
                  borderColor: `${resolvedPhoto.teamColor}50`,
                  color: resolvedPhoto.teamColor || '#FFFFFF',
                }}
                data-testid={`prospect-fallback-${prospect.driverId}`}
              >
                <span>{resolvedPhoto.fallbackInitials}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-60 font-mono mt-0.5">
                  ACAD
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base">{prospect.countryFlag}</span>
              <h3 className="text-sm font-bold text-white truncate">{prospect.name}</h3>
            </div>

            <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2">
              <span>{prospect.age} anos</span>
              <span>•</span>
              <span className="text-neutral-300 font-medium flex items-center gap-1">
                <CountryFlag code={prospect.nationality} />
                <span>{prospect.nationality}</span>
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px] bg-neutral-900 border-neutral-700 text-neutral-300"
              >
                {prospect.categoryLabel}
              </Badge>
              {prospect.isLinkedToPlayerAcademy && (
                <Badge className="text-[10px] bg-cyan-950 text-cyan-300 border-cyan-800">
                  Nossa Academia
                </Badge>
              )}
              {prospect.isLinkedToRivalAcademy && (
                <Badge className="text-[10px] bg-amber-950 text-amber-300 border-amber-800">
                  Academia Rival
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Avaliação de Potencial Percebido (Fog-of-War) */}
        <div className="p-4 space-y-3">
          <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-mono">Potencial Percebido:</span>
              <Badge
                variant="outline"
                className={`text-xs font-bold ${getPotentialBadgeColor(prospect.perceivedPotentialLabel)}`}
              >
                {prospect.perceivedPotentialLabel}
              </Badge>
            </div>

            <div className="flex justify-between items-center text-[11px] text-neutral-400 pt-0.5">
              <span>Confiança da Avaliação:</span>
              <span
                className={`font-mono font-semibold ${getConfidenceBadgeColor(prospect.confidenceGrade)}`}
              >
                {prospect.evaluationConfidence}% ({prospect.confidenceGrade})
              </span>
            </div>

            {/* Barra de Confiança */}
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all"
                style={{ width: `${prospect.evaluationConfidence}%` }}
              />
            </div>
          </div>

          {/* Atributos Observados (Fog of War) */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Ritmo</span>
              <strong className="text-neutral-200">
                {prospect.perceivedSpeed?.value ?? prospect.perceivedSpeed?.range ?? 'Desconhecido'}
              </strong>
            </div>

            <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Consistência</span>
              <strong className="text-neutral-200">
                {prospect.perceivedConsistency?.value ??
                  prospect.perceivedConsistency?.range ??
                  'Desconhecido'}
              </strong>
            </div>

            <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Chuva</span>
              <strong className="text-neutral-200">
                {prospect.perceivedRain?.value ?? prospect.perceivedRain?.range ?? 'Desconhecido'}
              </strong>
            </div>

            <div className="p-2 rounded bg-neutral-900/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Feedback Técnico</span>
              <strong className="text-neutral-200">
                {prospect.perceivedFeedback?.value ??
                  prospect.perceivedFeedback?.range ??
                  'Desconhecido'}
              </strong>
            </div>
          </div>

          {/* Pontos Fortes e Fracos Derivados */}
          <div className="space-y-1.5 text-[11px] pt-1">
            <div className="text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {prospect.strengths[0] || 'Ritmo consistente em categorias júnior'}
              </span>
            </div>

            <div className="text-neutral-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span>Estilo: {prospect.drivingStyle}</span>
            </div>

            {prospect.lastSeasonSummary && (
              <div className="text-neutral-500 text-[10px]">{prospect.lastSeasonSummary}</div>
            )}
          </div>
        </div>
      </div>

      {/* Ações Disponíveis */}
      <div className="p-4 border-t border-neutral-800/80 bg-neutral-900/40 flex flex-wrap gap-2">
        {onEvaluateAgain && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEvaluateAgain(prospect.driverId)}
            disabled={isProcessing}
            className="flex-1 text-xs border-neutral-700 hover:bg-neutral-800 text-neutral-300"
          >
            <Search className="w-3.5 h-3.5 mr-1" />
            Reavaliar
          </Button>
        )}

        {onRunTest && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRunTest(prospect.driverId)}
            disabled={isProcessing}
            className="flex-1 text-xs border-neutral-700 hover:bg-neutral-800 text-cyan-300"
          >
            <Gauge className="w-3.5 h-3.5 mr-1" />
            Convidar Pista
          </Button>
        )}

        {onInviteToAcademy && !prospect.isLinkedToPlayerAcademy && (
          <Button
            size="sm"
            onClick={() => onInviteToAcademy(prospect.driverId)}
            disabled={isProcessing || prospect.isLinkedToRivalAcademy}
            className="w-full text-xs bg-red-600 hover:bg-red-500 text-white font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Contratar para Academia
          </Button>
        )}
      </div>
    </Card>
  )
}
export default ProspectCard
