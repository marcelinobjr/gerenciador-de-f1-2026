import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { seasonTransitionService } from '@/services/seasonTransitionService'
import { AlertCircle, RotateCw } from 'lucide-react'

interface OrphanResumeBannerProps {
  teamId?: string
  fromSeasonYear?: number
  toSeasonYear?: number
  onTransitionComplete?: () => void
}

export function OrphanTransitionResumeBanner({
  teamId,
  fromSeasonYear = 2026,
  toSeasonYear = 2027,
  onTransitionComplete,
}: OrphanResumeBannerProps) {
  const { toast } = useToast()
  const [orphanRecord, setOrphanRecord] = useState<any | null>(null)
  const [isResuming, setIsResuming] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkOrphan() {
      try {
        const res = await seasonTransitionService.detectOrphanTransition({
          teamId,
          fromSeasonYear,
          toSeasonYear,
        })
        if (mounted && res.isOrphan && res.transitionRecord) {
          setOrphanRecord(res.transitionRecord)
        }
      } catch {
        // ignore
      }
    }
    checkOrphan()
    return () => {
      mounted = false
    }
  }, [teamId, fromSeasonYear, toSeasonYear])

  if (!orphanRecord) return null

  const handleResume = async () => {
    setIsResuming(true)
    try {
      const res = await seasonTransitionService.resumeOrphanTransition({
        transitionRecordId: orphanRecord.id,
        teamId: teamId || orphanRecord.team_id,
        fromSeasonYear,
        toSeasonYear,
      })

      if (res.success) {
        toast({
          title: 'Transição Concluída!',
          description: `A virada para a temporada ${toSeasonYear} foi concluída com sucesso.`,
        })
        setOrphanRecord(null)
        onTransitionComplete?.()
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha ao retomar transição',
          description: res.error || 'Erro desconhecido durante a retomada.',
        })
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de Retomada',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsResuming(false)
    }
  }

  return (
    <Card className="border-amber-400 bg-amber-500/10 mb-4 overflow-hidden">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Transição {fromSeasonYear} → {toSeasonYear} Interrompida
            </h4>
            <p className="text-xs text-muted-foreground">
              Uma transição anterior parou no passo{' '}
              <span className="font-mono font-semibold">
                {orphanRecord.current_step || 'RUNNING'}
              </span>
              . Você pode retomar de onde parou de forma segura.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleResume}
          disabled={isResuming}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer"
        >
          {isResuming ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Retomando...
            </>
          ) : (
            'Retomar Transição'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
export default OrphanTransitionResumeBanner
