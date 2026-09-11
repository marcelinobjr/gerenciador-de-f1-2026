import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { CircuitBlueprint } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import { AmbientBackground } from '@/components/AmbientBackground'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { CircuitModel, RaceResultModel, DriverModel, GrandPrixInfo } from '@/types/f1'
import {
  Calendar,
  MapPin,
  Trophy,
  Zap,
  Camera,
  Loader2,
  CheckCircle2,
  Clock,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'

export default function CalendarPage() {
  const { team, season } = useAuth()
  const { toast } = useToast()

  const [circuits, setCircuits] = useState<CircuitModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>([])
  const [allDbDrivers, setAllDbDrivers] = useState<DriverModel[]>([])
  const [allDbTeams, setAllDbTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros e busca
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'concluidos' | 'proximos'>('todos')

  // Upload state
  const [uploadingRound, setUploadingRound] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeRoundRef = useRef<GrandPrixInfo | null>(null)

  const loadData = async () => {
    if (!season || !team) {
      setLoading(false)
      return
    }
    try {
      const [circuitsList, resultsList, driversList] = await Promise.all([
        f1Service.getAllCircuits(),
        f1Service.getSeasonRaceResults(season.id),
        f1Service.getTeamDrivers(team.id),
      ])
      setCircuits(circuitsList)
      setRaceResults(resultsList)
      setPlayerDrivers(driversList)
    } catch (err) {
      console.error('Erro ao carregar dados do calendário:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [season?.id, team?.id])

  // Carga de apoio para resolução de nomes caso o expand de driver_id ou team_id falhe
  useEffect(() => {
    let active = true
    Promise.all([
      pb
        .collection('drivers')
        .getFullList<DriverModel>({ fields: 'id,name,nationality' })
        .catch(() => []),
      pb
        .collection('teams')
        .getFullList<any>({ fields: 'id,name,color' })
        .catch(() => []),
    ]).then(([drivers, teams]) => {
      if (!active) return
      setAllDbDrivers(drivers)
      setAllDbTeams(teams)
    })
    return () => {
      active = false
    }
  }, [])

  useRealtime('circuits', () => {
    loadData()
  })
  useRealtime('race_results', () => {
    loadData()
  })

  // Mapa de circuitos salvos no banco indexados por round
  const circuitDbMap = useMemo(() => {
    const map = new Map<number, CircuitModel>()
    circuits.forEach((c) => {
      map.set(c.round, c)
    })
    return map
  }, [circuits])

  // Mapas de resolução rápida de nomes e escuderias
  const driverMap = useMemo(() => {
    const map = new Map<string, DriverModel>()
    allDbDrivers.forEach((d) => map.set(d.id, d))
    playerDrivers.forEach((d) => map.set(d.id, d))
    return map
  }, [allDbDrivers, playerDrivers])

  const teamMap = useMemo(() => {
    const map = new Map<string, any>()
    allDbTeams.forEach((t) => map.set(t.id, t))
    if (team?.id) map.set(team.id, team)
    return map
  }, [allDbTeams, team])

  // Resultados agrupados por rodada com ordenação estrita por posição
  const resultsByRound = useMemo(() => {
    const map = new Map<
      number,
      {
        p1?: RaceResultModel
        p2?: RaceResultModel
        p3?: RaceResultModel
        fastestLap?: RaceResultModel
        playerResults: RaceResultModel[]
        playerTotalPoints: number
        allResults: RaceResultModel[]
      }
    >()

    raceResults.forEach((res) => {
      const r = res.round
      if (!map.has(r)) {
        map.set(r, {
          playerResults: [],
          playerTotalPoints: 0,
          allResults: [],
        })
      }
      const entry = map.get(r)!
      entry.allResults.push(res)

      if (res.fastest_lap) entry.fastestLap = res

      // Verifica se é piloto da equipe do jogador
      const isPlayerResult =
        res.team_id === team?.id ||
        (res.expand?.team_id && res.expand.team_id.name === team?.name) ||
        playerDrivers.some((d) => d.id === res.driver_id)

      if (isPlayerResult) {
        entry.playerResults.push(res)
        entry.playerTotalPoints += res.points || 0
      }
    })

    // Ordenar allResults por posição e fixar P1, P2 e P3
    map.forEach((entry) => {
      entry.allResults.sort((a, b) => (a.position || 99) - (b.position || 99))
      entry.p1 = entry.allResults.find((r) => r.position === 1)
      entry.p2 = entry.allResults.find((r) => r.position === 2)
      entry.p3 = entry.allResults.find((r) => r.position === 3)
      if (!entry.fastestLap) {
        entry.fastestLap = entry.allResults.find((r) => r.fastest_lap)
      }
    })

    return map
  }, [raceResults, team, playerDrivers])

  // Tratar upload de imagem do traçado
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const targetGP = activeRoundRef.current
    if (!file || !targetGP) return

    // Validação de formato
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem em formato JPEG, PNG ou WEBP.',
      })
      return
    }

    // Validação de tamanho (máximo 2MB)
    if (file.size > 2097152) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo da imagem é de 2MB.',
      })
      return
    }

    try {
      setUploadingRound(targetGP.round)
      const formData = new FormData()
      formData.append('photo', file)

      const updated = await f1Service.updateCircuitPhoto(targetGP.round, formData, {
        name: targetGP.name,
        circuit_name: targetGP.circuit,
        country: targetGP.country,
      })

      setCircuits((prev) => {
        const exists = prev.some((c) => c.round === targetGP.round)
        if (exists) {
          return prev.map((c) => (c.round === targetGP.round ? updated : c))
        }
        return [...prev, updated]
      })

      toast({
        title: 'Imagem do circuito atualizada!',
        description: `O traçado do ${targetGP.name} foi atualizado com sucesso.`,
      })
    } catch (err: any) {
      console.error('Erro ao enviar imagem do circuito:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar imagem',
        description: err?.message || 'Não foi possível salvar a imagem do circuito.',
      })
    } finally {
      setUploadingRound(null)
      activeRoundRef.current = null
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerUploadForRound = (gp: GrandPrixInfo) => {
    activeRoundRef.current = gp
    fileInputRef.current?.click()
  }

  // Filtragem dos GPs
  const currentRound = season?.current_round || 1
  const filteredGPs = useMemo(() => {
    return F1_2026_CALENDAR.filter((gp) => {
      const matchesSearch =
        search.trim() === '' ||
        gp.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        gp.circuit.toLowerCase().includes(search.toLowerCase().trim()) ||
        gp.country.toLowerCase().includes(search.toLowerCase().trim())

      const isCompleted = resultsByRound.has(gp.round) || gp.round < currentRound
      const matchesStatus =
        filterStatus === 'todos' ||
        (filterStatus === 'concluidos' && isCompleted) ||
        (filterStatus === 'proximos' && !isCompleted)

      return matchesSearch && matchesStatus
    })
  }, [search, filterStatus, resultsByRound, currentRound])

  return (
    <div className="relative space-y-6 animate-fade-in-up pb-10">
      <AmbientBackground />

      {/* Input de arquivo global oculto para upload de imagem de circuito */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
        disabled={uploadingRound !== null}
      />

      {/* PageHeader oficial Race Operations */}
      <PageHeader
        eyebrow="RACE OPERATIONS // CALENDÁRIO 2026"
        title="Calendário de Corridas"
        description="As 24 etapas do Campeonato Mundial: especificações técnicas de cada autódromo, traçados oficiais com suporte a upload de imagem e resultados de cada GP."
        badge={
          <span className="px-2.5 py-1 rounded-md text-xs font-num font-semibold bg-[#11161F] border border-[#1F2733] text-[#00A6FB] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00A6FB]" />
            Rodada {currentRound}/24
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-num font-semibold bg-[#11161F] border border-[#1F2733] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {Math.max(0, currentRound - 1)} Disputadas
            </span>
          </div>
        }
      />

      {/* Barra de Filtros e Busca (Camada 1: #11161F, borda #1F2733) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11161F] border border-[#1F2733] p-3 rounded-xl text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
          <input
            type="text"
            placeholder="Buscar por GP, circuito ou país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB] placeholder:text-[#8B95A7]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8B95A7] text-[11px] uppercase tracking-wider font-semibold shrink-0">
            Status:
          </span>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0E131B] border border-[#1F2733]">
            {[
              { id: 'todos', label: 'Todos (24)' },
              { id: 'concluidos', label: 'Concluídos' },
              { id: 'proximos', label: 'A Disputar' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-[#161D29] text-[#F5F7FA] font-bold border border-[#1F2733] shadow-sm'
                    : 'text-[#8B95A7] hover:text-[#F5F7FA]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid das 24 Etapas (2 colunas no desktop, 1 no mobile) */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-full bg-[#11161F] rounded-xl" />
          ))}
        </div>
      ) : filteredGPs.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhuma etapa encontrada"
          description="Nenhum GP corresponde aos filtros aplicados. Tente limpar os termos de busca."
          action={
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilterStatus('todos')
              }}
              className="text-xs text-[#00A6FB] hover:underline cursor-pointer font-medium"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredGPs.map((gp) => {
            const dbCircuit = circuitDbMap.get(gp.round)
            const roundResults = resultsByRound.get(gp.round)
            const isCompleted = !!roundResults || gp.round < currentRound
            const isCurrent = gp.round === currentRound
            const isUploading = uploadingRound === gp.round

            const uploadedPhotoUrl = dbCircuit?.photo
              ? pb.files.getUrl(dbCircuit, dbCircuit.photo)
              : null
            const defaultAsset = gp.round === 1 ? defaultAustraliaMap : null
            const activeCircuitImage = uploadedPhotoUrl || defaultAsset

            // Helpers de resolução de nomes e cores para os resultados
            const resolveDriverName = (result?: RaceResultModel) => {
              if (!result) return null
              if (result.expand?.driver_id?.name) return result.expand.driver_id.name
              if (result.driver_id && driverMap.has(result.driver_id)) {
                return driverMap.get(result.driver_id)!.name
              }
              return 'Piloto'
            }

            const resolveTeamInfo = (result?: RaceResultModel) => {
              if (!result) return { name: 'Equipe', color: '#8B95A7' }
              if (result.expand?.team_id?.name) {
                return {
                  name: result.expand.team_id.name,
                  color: result.expand.team_id.color || '#8B95A7',
                }
              }
              if (result.team_id && teamMap.has(result.team_id)) {
                const t = teamMap.get(result.team_id)!
                return { name: t.name, color: t.color || '#8B95A7' }
              }
              return { name: 'Equipe', color: '#8B95A7' }
            }

            const p1DriverName = resolveDriverName(roundResults?.p1)
            const p1TeamInfo = resolveTeamInfo(roundResults?.p1)
            const p2DriverName = resolveDriverName(roundResults?.p2)
            const p2TeamInfo = resolveTeamInfo(roundResults?.p2)
            const p3DriverName = resolveDriverName(roundResults?.p3)
            const p3TeamInfo = resolveTeamInfo(roundResults?.p3)
            const fastestDriverName = resolveDriverName(roundResults?.fastestLap)

            return (
              <div
                key={gp.round}
                className={`overflow-hidden rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-[#11161F] border-[#00A6FB] shadow-xl ring-1 ring-[#00A6FB]/40'
                    : 'bg-[#11161F] border-[#1F2733] hover:border-[#2C3849]'
                }`}
              >
                {/* Barra de status de 3px no topo */}
                <div
                  className={`h-[3px] w-full ${
                    isCurrent ? 'bg-[#00A6FB]' : isCompleted ? 'bg-emerald-500' : 'bg-[#1F2733]'
                  }`}
                />

                {/* Banner 16:9 do Traçado */}
                <div className="relative w-full aspect-[16/9] max-h-60 bg-[#080B10] overflow-hidden border-b border-[#1F2733] group flex items-center justify-center">
                  {activeCircuitImage ? (
                    <div className="w-full h-full relative bg-[#080B10] overflow-hidden flex items-center justify-center p-3">
                      <CircuitTrackImage
                        src={activeCircuitImage}
                        alt={`Traçado do ${gp.circuit}`}
                        className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/90 via-transparent to-black/30 pointer-events-none" />

                      <div className="absolute bottom-2.5 left-3 flex items-center gap-2 text-[10px] text-[#F5F7FA] drop-shadow-md z-10">
                        <span className="w-2 h-2 rounded-full bg-[#00A6FB] animate-pulse" />
                        <span className="eyebrow text-[#F5F7FA]">
                          {uploadedPhotoUrl ? 'TRAÇADO HOMOLOGADO // UPLOAD' : 'MAPA OFICIAL FIA'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative">
                      <CircuitBlueprint
                        round={gp.round}
                        circuitName={gp.name}
                        laps={gp.laps}
                        lengthKm={gp.circuitLengthKm}
                        className="h-full border-none rounded-none !p-3 bg-[#080B10]"
                      />
                    </div>
                  )}

                  {/* Badge de Rodada "Rn/24" (canto superior esquerdo) */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                    <span
                      className={`font-num text-xs font-bold px-2.5 py-1 rounded-md border shadow-md backdrop-blur-md ${
                        isCurrent
                          ? 'bg-[#00A6FB] text-white border-[#00A6FB]'
                          : isCompleted
                            ? 'bg-[#161D29]/95 text-emerald-400 border-emerald-500/40'
                            : 'bg-[#0B0E14]/90 text-[#8B95A7] border-[#1F2733]'
                      }`}
                    >
                      {isCurrent ? '⚡ GP ATUAL • ' : ''}R{gp.round}/24
                    </span>
                  </div>

                  {/* Botão "Trocar Imagem" / "Imagem do Circuito" com o mesmo fluxo de upload */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <button
                      type="button"
                      onClick={() => triggerUploadForRound(gp)}
                      disabled={uploadingRound !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0E14]/90 hover:bg-[#161D29] text-[#F5F7FA] border border-[#1F2733] shadow-lg backdrop-blur-md transition-all hover:border-[#00A6FB] disabled:opacity-60 cursor-pointer"
                      title={`Carregar foto/mapa do traçado do ${gp.circuit}`}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00A6FB]" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 text-[#00A6FB]" />
                          <span>{activeCircuitImage ? 'Trocar Imagem' : 'Imagem do Circuito'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Conteúdo Informativo Completo do Card */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Cabeçalho informativo: bandeira + país (eyebrow), nome do GP, circuito com ícone de localização, e badge de status */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xl leading-none" role="img" aria-label={gp.country}>
                            {gp.flag}
                          </span>
                          <span className="eyebrow text-[#8B95A7]">{gp.country}</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-[#F5F7FA] mt-1 tracking-tight truncate">
                          {gp.name}
                        </h2>
                        <p className="text-xs text-[#00A6FB] flex items-center gap-1.5 mt-0.5 truncate">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-[#00A6FB]" />
                          <span className="truncate">{gp.circuit}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#00A6FB]/15 text-[#00A6FB] border border-[#00A6FB]/40">
                            <Clock className="w-3 h-3 animate-pulse" />
                            Próxima Etapa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#161D29] text-[#8B95A7] border border-[#1F2733]">
                            A Disputar
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ficha técnica em grid de 4: Extensão (3 casas decimais), Voltas, Curvas, Distância Total */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 sm:p-3 bg-[#0E131B] border border-[#1F2733] rounded-xl text-xs">
                      <div className="space-y-0.5">
                        <span className="eyebrow block text-[10px] text-[#8B95A7]">Extensão</span>
                        <strong className="text-[#00A6FB] text-sm font-bold font-num block">
                          {gp.circuitLengthKm.toFixed(3)} km
                        </strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="eyebrow block text-[10px] text-[#8B95A7]">Voltas</span>
                        <strong className="text-[#F5F7FA] text-sm font-bold font-num block">
                          {gp.laps}
                        </strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="eyebrow block text-[10px] text-[#8B95A7]">Curvas</span>
                        <strong className="text-amber-400 text-sm font-bold font-num block">
                          {gp.turns || '—'}
                        </strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="eyebrow block text-[10px] text-[#8B95A7]">
                          Distância Total
                        </span>
                        <strong className="text-emerald-400 text-sm font-bold font-num block">
                          {(gp.laps * gp.circuitLengthKm).toFixed(1)} km
                        </strong>
                      </div>
                    </div>

                    {/* Característica técnica do traçado (frase do dado characteristic) */}
                    <div className="p-2.5 rounded-lg bg-[#0E131B]/60 border border-[#1F2733]/80">
                      <span className="eyebrow block text-[9px] text-[#6A768A] mb-0.5">
                        CARACTERÍSTICA TÉCNICA DO TRAÇADO
                      </span>
                      <p className="text-xs text-[#8B95A7] italic leading-relaxed">
                        "{gp.characteristic}"
                      </p>
                    </div>
                  </div>

                  {/* Resultado Oficial da Etapa nas etapas disputadas ou estado Pendente */}
                  <div className="pt-3 border-t border-[#1F2733]">
                    {roundResults && roundResults.allResults.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-xs font-bold text-[#F5F7FA] uppercase tracking-wider flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            Resultado Oficial da Etapa
                          </span>
                          <span className="font-num text-[11px] text-[#8B95A7] px-2 py-0.5 rounded bg-[#0E131B] border border-[#1F2733]">
                            {roundResults.allResults.length} classificados
                          </span>
                        </div>

                        {/* Pódio P1/P2/P3 (ouro/prata/bronze) com piloto, equipe e pontos */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {/* P1 - Ouro */}
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-amber-500 text-black font-extrabold flex items-center justify-center text-xs shrink-0 font-num shadow-sm">
                              P1
                            </span>
                            <div className="overflow-hidden min-w-0 flex-1">
                              <span className="eyebrow text-amber-400 block text-[9px] leading-none truncate">
                                Vencedor
                              </span>
                              <span className="font-bold text-[#F5F7FA] truncate block mt-0.5 text-xs">
                                {p1DriverName || 'Vencedor P1'}
                              </span>
                              <span className="text-[10px] text-[#8B95A7] truncate block font-num mt-0.5">
                                {p1TeamInfo.name} •{' '}
                                <strong className="text-amber-400 font-bold">
                                  {roundResults.p1?.points ?? 25} pts
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* P2 - Prata */}
                          <div className="p-2.5 rounded-xl bg-slate-400/10 border border-slate-400/25 flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-slate-300 text-black font-extrabold flex items-center justify-center text-xs shrink-0 font-num shadow-sm">
                              P2
                            </span>
                            <div className="overflow-hidden min-w-0 flex-1">
                              <span className="eyebrow text-slate-300 block text-[9px] leading-none truncate">
                                2º Lugar
                              </span>
                              <span className="font-bold text-[#F5F7FA] truncate block mt-0.5 text-xs">
                                {p2DriverName || 'Piloto P2'}
                              </span>
                              <span className="text-[10px] text-[#8B95A7] truncate block font-num mt-0.5">
                                {p2TeamInfo.name} •{' '}
                                <strong className="text-slate-300 font-bold">
                                  {roundResults.p2?.points ?? 18} pts
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* P3 - Bronze */}
                          <div className="p-2.5 rounded-xl bg-amber-700/15 border border-amber-700/35 flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-amber-700 text-white font-extrabold flex items-center justify-center text-xs shrink-0 font-num shadow-sm">
                              P3
                            </span>
                            <div className="overflow-hidden min-w-0 flex-1">
                              <span className="eyebrow text-amber-600 block text-[9px] leading-none truncate">
                                3º Lugar
                              </span>
                              <span className="font-bold text-[#F5F7FA] truncate block mt-0.5 text-xs">
                                {p3DriverName || 'Piloto P3'}
                              </span>
                              <span className="text-[10px] text-[#8B95A7] truncate block font-num mt-0.5">
                                {p3TeamInfo.name} •{' '}
                                <strong className="text-amber-500 font-bold">
                                  {roundResults.p3?.points ?? 15} pts
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Volta mais rápida (+1 pt) e pontos da escuderia do jogador */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 bg-[#0E131B] border border-[#1F2733] rounded-xl text-xs">
                          {/* Volta Mais Rápida */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                              <Zap className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <div className="truncate">
                              <span className="text-[10px] text-[#8B95A7] block leading-none">
                                Volta Mais Rápida (+1 pt)
                              </span>
                              <strong className="text-purple-300 font-bold text-xs truncate block mt-0.5">
                                {fastestDriverName || 'Piloto Homologado'}
                              </strong>
                            </div>
                          </div>

                          {/* Pontos da Escuderia do Jogador */}
                          <div className="flex items-center gap-2 sm:border-l sm:border-[#1F2733] sm:pl-3 shrink-0">
                            <span className="text-[#8B95A7] text-[11px]">
                              {team?.name || 'Sua Escuderia'}:
                            </span>
                            <span
                              className={`font-num font-bold text-xs px-2.5 py-1 rounded-md border ${
                                roundResults.playerTotalPoints > 0
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                  : 'bg-[#161D29] text-[#8B95A7] border-[#1F2733]'
                              }`}
                            >
                              {roundResults.playerTotalPoints > 0
                                ? `+${roundResults.playerTotalPoints} pts na etapa`
                                : '0 pts nesta etapa'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : isCompleted ? (
                      // Etapa concluída sem registro
                      <div className="p-3.5 rounded-xl bg-[#0E131B] border border-[#1F2733] text-center text-xs text-[#8B95A7] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-left">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="font-semibold text-[#F5F7FA] block text-xs">
                              Etapa Concluída
                            </span>
                            <span className="text-[11px] text-[#8B95A7]">
                              Resultados oficiais registrados nos arquivos do campeonato.
                            </span>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-num">
                          Finalizado
                        </Badge>
                      </div>
                    ) : (
                      // Etapa futura -> bloco "A Disputar"
                      <div className="p-4 rounded-xl bg-[#0E131B] border border-dashed border-[#1F2733] text-center text-xs text-[#8B95A7] flex flex-col items-center justify-center gap-1.5">
                        <Clock
                          className={`w-4 h-4 ${isCurrent ? 'text-[#00A6FB]' : 'text-[#8B95A7]'}`}
                        />
                        <span className="font-medium text-[#F5F7FA]">
                          {isCurrent
                            ? 'Etapa Atual — Pronta para Disputa'
                            : 'Etapa a Disputar no Campeonato 2026'}
                        </span>
                        <span className="text-[11px] text-[#8B95A7]">
                          {isCurrent
                            ? 'Acesse a aba "Fim de Semana" para iniciar os treinos e a corrida!'
                            : 'Aguardando a conclusão das rodadas anteriores.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
