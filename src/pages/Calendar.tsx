import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { CircuitBlueprint } from '@/components/CircuitBlueprint'
import { AmbientBackground } from '@/components/AmbientBackground'
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
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// Imagem padrao anexada pelo usuario no projeto como referencia/seed para Albert Park (Round 1)
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'

export default function CalendarPage() {
  const { team, season } = useAuth()
  const { toast } = useToast()

  const [circuits, setCircuits] = useState<CircuitModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>([])
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
      console.error('Erro ao carregar dados do calendario:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [season?.id, team?.id])

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

  // Resultados agrupados por rodada
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

      if (res.position === 1) entry.p1 = res
      if (res.position === 2) entry.p2 = res
      if (res.position === 3) entry.p3 = res
      if (res.fastest_lap) entry.fastestLap = res

      // Verifica se e piloto da equipe do jogador
      const isPlayerResult =
        res.team_id === team?.id ||
        (res.expand?.team_id && res.expand.team_id.name === team?.name) ||
        playerDrivers.some((d) => d.id === res.driver_id)

      if (isPlayerResult) {
        entry.playerResults.push(res)
        entry.playerTotalPoints += res.points || 0
      }
    })

    return map
  }, [raceResults, team, playerDrivers])

  // Tratar upload de imagem do tracado
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const targetGP = activeRoundRef.current
    if (!file || !targetGP) return

    // Validacao de formato
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem em formato JPEG, PNG ou WEBP.',
      })
      return
    }

    // Validacao de tamanho (maximo 2MB)
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
    <div className="relative space-y-8 animate-fade-in-up">
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

      {/* Header da Pagina */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-black tracking-widest text-[#E10600] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E10600] shadow-[0_0_8px_#E10600] animate-pulse" />
            Temporada Oficial F1 2026 // Calendário FIA
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white mt-1 drop-shadow-md">
            Calendário de Corridas
          </h1>
          <p className="text-xs sm:text-sm text-[#8B95A7] font-mono mt-1">
            As 24 etapas do Campeonato Mundial: especificações técnicas de cada autódromo, traçados
            oficiais com suporte a upload de imagem e resultados de cada GP.
          </p>
        </div>

        {/* Indicadores de Rodada / Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="font-mono text-xs px-3 py-1.5 border-[#00A6FB]/40 text-[#00A6FB] bg-[#00A6FB]/10 flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-[#00A6FB]" />
            <span>Rodada Atual: {currentRound}/24</span>
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-xs px-3 py-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{Math.max(0, currentRound - 1)} Disputadas</span>
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] shadow-xl p-3.5 rounded-2xl font-mono text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
          <input
            type="text"
            placeholder="Buscar por GP, circuito ou país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#080C14]/90 border border-[#1A2333] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-cyan-400 placeholder:text-[#8B95A7]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8B95A7] shrink-0">Status:</span>
          <div className="flex items-center gap-1">
            {[
              { id: 'todos', label: 'Todos (24)' },
              { id: 'concluidos', label: 'Concluídos' },
              { id: 'proximos', label: 'A Disputar' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-[#E10600] text-white font-bold shadow'
                    : 'bg-[#080C14]/90 text-[#8B95A7] hover:text-[#F5F7FA] border border-[#1A2333]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid das 24 Etapas */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-full bg-[#11161F] rounded-2xl" />
          ))}
        </div>
      ) : filteredGPs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#1F2733] rounded-2xl text-[#8B95A7] font-mono text-xs space-y-2">
          <p>Nenhuma etapa encontrada com os filtros aplicados.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFilterStatus('todos')
            }}
            className="text-[#00A6FB] underline underline-offset-4 cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredGPs.map((gp) => {
            const dbCircuit = circuitDbMap.get(gp.round)
            const roundResults = resultsByRound.get(gp.round)
            const isCompleted = !!roundResults || gp.round < currentRound
            const isCurrent = gp.round === currentRound
            const isUploading = uploadingRound === gp.round

            // Prioridade de exibicao da imagem do tracado:
            // 1. Foto enviada pelo usuario salva no PocketBase
            // 2. Se for round 1 (Australia) e nao houver upload do usuario, usa a imagem anexada pelo usuario
            // 3. Tracado vetorial CircuitBlueprint
            const uploadedPhotoUrl = dbCircuit?.photo
              ? pb.files.getUrl(dbCircuit, dbCircuit.photo)
              : null
            const defaultAsset = gp.round === 1 ? defaultAustraliaMap : null
            const activeCircuitImage = uploadedPhotoUrl || defaultAsset

            return (
              <Card
                key={gp.round}
                className={`relative z-10 overflow-hidden transition-all duration-200 flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-[#090D15]/90 backdrop-blur-md border-[#00A6FB] shadow-xl ring-2 ring-[#00A6FB]/40'
                    : isCompleted
                      ? 'bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] hover:border-cyan-500/40 shadow-lg'
                      : 'bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] opacity-95 hover:border-cyan-500/40 shadow-lg'
                }`}
              >
                {/* Linha de status no topo do card */}
                <div
                  className={`h-1.5 w-full ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#00A6FB] to-[#38BDF8]'
                      : isCompleted
                        ? 'bg-[#E10600]'
                        : 'bg-[#1F2733]'
                  }`}
                />

                {/* Banner de Exibicao do Circuito (~16:9) */}
                <div className="relative w-full aspect-[16/9] max-h-64 bg-[#080B10] overflow-hidden border-b border-[#1F2733]/80 group flex items-center justify-center">
                  {activeCircuitImage ? (
                    // Exibicao da imagem (fundo adaptavel neutro para funcionar perfeitamente com imagens claras ou escuras)
                    <div className="w-full h-full relative bg-[#F5F7FA] overflow-hidden flex items-center justify-center">
                      <img
                        src={activeCircuitImage}
                        alt={`Traçado do ${gp.circuit}`}
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Leve gradiente escuro no rodape para legibilidade das tags */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/80 via-transparent to-black/30 pointer-events-none" />

                      {/* Tag sutil de identificacao da imagem */}
                      <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] font-mono text-[#F5F7FA] drop-shadow-md z-10">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="font-semibold tracking-wider uppercase">
                          {uploadedPhotoUrl ? 'TRAÇADO HOMOLOGADO (UPLOAD)' : 'MAPA OFICIAL FIA'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // Fallback vetorial: CircuitBlueprint renderizado com o tracado tecnico
                    <div className="w-full h-full relative">
                      <CircuitBlueprint
                        round={gp.round}
                        circuitName={gp.name}
                        laps={gp.laps}
                        lengthKm={gp.circuitLengthKm}
                        className="h-full border-none rounded-none !p-3"
                      />
                    </div>
                  )}

                  {/* Badge de Rodada (canto superior esquerdo) */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                    <Badge
                      className={`font-mono text-xs font-bold px-2.5 py-1 shadow-md border ${
                        isCurrent
                          ? 'bg-[#00A6FB] text-white border-cyan-400'
                          : isCompleted
                            ? 'bg-[#E10600] text-white border-red-500'
                            : 'bg-[#0B0E14]/85 text-[#8B95A7] border-[#1F2733]'
                      }`}
                    >
                      {isCurrent ? '⚡ GP ATUAL • ' : ''}R{gp.round}/24
                    </Badge>
                  </div>

                  {/* Botao de Upload da Imagem do Circuito (canto superior direito) */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <button
                      type="button"
                      onClick={() => triggerUploadForRound(gp)}
                      disabled={uploadingRound !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#0B0E14]/85 hover:bg-[#0B0E14] text-[#F5F7FA] border border-[#1F2733] shadow-lg backdrop-blur-md transition-all hover:border-cyan-400 disabled:opacity-60 cursor-pointer"
                      title={`Carregar foto/mapa do traçado do ${gp.circuit}`}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{activeCircuitImage ? 'Trocar Imagem' : 'Imagem do Circuito'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Conteudo do Card */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Cabecalho da Etapa: Nome, Pais e Bandeira */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl leading-none" role="img" aria-label={gp.country}>
                            {gp.flag}
                          </span>
                          <span className="text-xs font-mono text-[#8B95A7] uppercase tracking-wider">
                            {gp.country}
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-[#F5F7FA] mt-1 tracking-tight">
                          {gp.name}
                        </h2>
                        <p className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{gp.circuit}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {isCompleted ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                            ✓ Concluído
                          </Badge>
                        ) : isCurrent ? (
                          <Badge className="bg-[#00A6FB]/15 text-[#00A6FB] border border-[#00A6FB]/30 text-[10px] font-mono animate-pulse">
                            ● Próxima Etapa
                          </Badge>
                        ) : (
                          <Badge className="bg-[#1F2733] text-[#8B95A7] border border-[#1F2733] text-[10px] font-mono">
                            A Disputar
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Especificacoes Tecnicas da Pista */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 p-3 bg-[#080C14]/80 border border-[#1A2333] rounded-xl font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block uppercase">Extensão</span>
                        <strong className="text-cyan-400 text-sm font-bold">
                          {gp.circuitLengthKm.toFixed(3)} km
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block uppercase">Voltas</span>
                        <strong className="text-[#F5F7FA] text-sm font-bold">{gp.laps}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block uppercase">Curvas</span>
                        <strong className="text-amber-400 text-sm font-bold">
                          {gp.turns || '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block uppercase">
                          Distância
                        </span>
                        <strong className="text-emerald-400 text-sm font-bold">
                          {(gp.laps * gp.circuitLengthKm).toFixed(1)} km
                        </strong>
                      </div>
                    </div>

                    {/* Caracteristica da Pista */}
                    <p className="text-xs text-[#8B95A7] italic mt-2.5 font-mono">
                      "{gp.characteristic}"
                    </p>
                  </div>

                  {/* Secao de Resultados da Temporada */}
                  <div className="pt-3 border-t border-[#1F2733]/80">
                    {roundResults && roundResults.allResults.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-xs font-bold text-[#F5F7FA] uppercase tracking-wider flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            Resultado Oficial da Etapa
                          </span>
                          <span className="text-[11px] text-[#8B95A7]">
                            {roundResults.allResults.length} pilotos classificados
                          </span>
                        </div>

                        {/* Podio P1, P2, P3 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                          {/* P1 - Vencedor */}
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-amber-500 text-black font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm">
                              P1
                            </span>
                            <div className="overflow-hidden">
                              <span className="text-[10px] text-amber-400 block font-bold uppercase leading-none">
                                Vencedor
                              </span>
                              <span className="font-bold text-[#F5F7FA] truncate block mt-0.5">
                                {roundResults.p1?.expand?.driver_id?.name || 'Vencedor P1'}
                              </span>
                              <span className="text-[10px] text-[#8B95A7] truncate block">
                                {roundResults.p1?.expand?.team_id?.name || 'Equipe'} • 25 pts
                              </span>
                            </div>
                          </div>

                          {/* P2 */}
                          <div className="p-2.5 rounded-lg bg-slate-400/10 border border-slate-400/20 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-300 text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                              P2
                            </span>
                            <div className="overflow-hidden">
                              <span className="text-[10px] text-slate-300 block font-bold uppercase leading-none">
                                2º Lugar
                              </span>
                              <span className="font-bold text-[#F5F7FA] truncate block mt-0.5">
                                {roundResults.p2?.expand?.driver_id?.name || 'Piloto P2'}
                              </span>
                              <span className="text-[10px] text-[#8B95A7] truncate block">
                                {roundResults.p2?.expand?.team_id?.name || 'Equipe'} • 18 pts
                              </span>
                            </div>
                          </div>

                          {/* P3 */}
                          <div className="p-2.5 rounded-lg bg-amber-700/15 border border-amber-700/30 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-amber-700 text-white font-extrabold flex items-center justify-center text-xs shrink-0">
                              P3
                            </span>
                            <div className="overflow-hidden">
                              <span className="text-[10px] text-amber-600 block font-bold uppercase leading-none">
                                3º Lugar
                              </span>
                              <span className="font-bold text-[#F5F7FA] truncate block mt-0.5">
                                {roundResults.p3?.expand?.driver_id?.name || 'Piloto P3'}
                              </span>
                              <span className="text-[10px] text-[#8B95A7] truncate block">
                                {roundResults.p3?.expand?.team_id?.name || 'Equipe'} • 15 pts
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Volta mais rapida & Pontos da Equipe do Jogador */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 bg-[#0B0E14] border border-[#1F2733] rounded-lg text-xs font-mono">
                          {/* Volta Mais Rapida */}
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="text-[#8B95A7]">Volta Mais Rápida:</span>
                            <strong className="text-purple-300 font-bold">
                              {roundResults.fastestLap?.expand?.driver_id?.name || 'Piloto (+1 pt)'}
                            </strong>
                          </div>

                          {/* Desempenho da Escuderia do Jogador */}
                          <div className="flex items-center gap-2 sm:border-l sm:border-[#1F2733] sm:pl-3">
                            <span className="text-[#8B95A7]">{team?.name || 'Sua Escuderia'}:</span>
                            <Badge className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
                              {roundResults.playerTotalPoints > 0
                                ? `+${roundResults.playerTotalPoints} pts marcados`
                                : '0 pts nesta etapa'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Etapa ainda nao disputada
                      <div className="p-4 rounded-xl bg-[#0B0E14]/60 border border-dashed border-[#1F2733] text-center font-mono text-xs text-[#8B95A7] flex flex-col items-center justify-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#8B95A7]/70" />
                        <span>Etapa a disputar na temporada 2026</span>
                        <span className="text-[10px] text-[#8B95A7]/60">
                          {isCurrent
                            ? 'Esta é a próxima corrida agendada na aba "Corrida"!'
                            : `Aguardando a conclusão das rodadas anteriores.`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
