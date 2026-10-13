import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useF1 } from '@/contexts/F1Context'
import pb from '@/lib/pocketbase/client'
import { Check, Shield, Trophy, Users, Zap, AlertCircle } from 'lucide-react'

export function TeamSwitchSelector() {
  const { team, season, refreshTeamAndSeason } = useF1()
  const { toast } = useToast()
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [switchingTeamId, setSwitchingTeamId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function loadGridTeams() {
      try {
        const records = await pb.collection('teams').getFullList({
          sort: 'name',
        })
        if (mounted) {
          // Filtrar equipes do grid: não duplicadas, preferir não customizadas e Toyota/grid oficial
          const valid = records.filter(
            (t) =>
              !t.is_custom ||
              t.id === 'jsxe8t2ks3kt322' ||
              t.name?.toLowerCase().includes('toyota'),
          )
          setAllTeams(valid.length > 0 ? valid : records)
        }
      } catch (err) {
        console.warn('Erro ao carregar equipes para seleção:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadGridTeams()
    return () => {
      mounted = false
    }
  }, [])

  const handleSelectTeam = async (targetTeam: any) => {
    if (!targetTeam?.id || targetTeam.id === team?.id) return

    setSwitchingTeamId(targetTeam.id)
    try {
      // 1. Atualizar temporada ativa vinculando ao novo team_id de forma idempotente
      if (season?.id) {
        await pb.collection('seasons').update(season.id, {
          team_id: targetTeam.id,
        })
      }

      // 2. Persistir localmente a escolha do jogador
      localStorage.setItem('apex_player_team_id', targetTeam.id)
      localStorage.setItem('f1_player_team_id', targetTeam.id)

      toast({
        title: 'Equipe Comandada Alterada!',
        description: `Agora você gerencia a escuderia ${targetTeam.name}.`,
      })

      // 3. Atualizar contexto global
      await refreshTeamAndSeason()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao trocar de equipe',
        description: err?.message || 'Falha ao salvar equipe no banco.',
      })
    } finally {
      setSwitchingTeamId(null)
    }
  }

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 text-xs text-muted-foreground animate-pulse">
          Carregando escuderias disponíveis no grid...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden mb-6">
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Comando da Escuderia
            </CardTitle>
            <CardDescription className="text-xs">
              Escolha qual equipe existente do grid você deseja comandar na carreira ativa.
            </CardDescription>
          </div>
          {team && (
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              Comandando: {team.name}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allTeams.map((t) => {
            const isCurrent = t.id === team?.id
            const isSwitching = switchingTeamId === t.id

            return (
              <div
                key={t.id}
                className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/60 hover:border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: t.color || '#333' }}
                      />
                      <h4 className="font-bold text-sm tracking-tight text-foreground">{t.name}</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Motor:{' '}
                      <span className="font-semibold text-foreground">
                        {t.engine_supplier || 'Cliente'}
                      </span>{' '}
                      • Força:{' '}
                      <span className="font-mono font-bold text-foreground">
                        {t.strength || 70}
                      </span>
                    </p>
                  </div>
                  {isCurrent && (
                    <Badge variant="default" className="text-[10px] h-5 bg-primary font-bold">
                      Ativa
                    </Badge>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    R$ {((t.budget || 0) / 1e6).toFixed(0)}M
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isCurrent ? 'secondary' : 'default'}
                    disabled={isCurrent || isSwitching}
                    onClick={() => handleSelectTeam(t)}
                    className="h-7 text-xs font-bold px-3 cursor-pointer"
                  >
                    {isCurrent ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-primary" />
                        Comandando
                      </span>
                    ) : isSwitching ? (
                      'Alterando...'
                    ) : (
                      'Assumir Equipe'
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
export default TeamSwitchSelector
