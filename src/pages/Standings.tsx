import React, { useState, useEffect, useMemo } from 'react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { DriverStanding, TeamStanding } from '@/services/standingsService'
import { Trophy, Award, Users, Scale, Medal, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AmbientBackground } from '@/components/AmbientBackground'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, DataTableColumn } from '@/components/DataTable'
import { ProgressBar } from '@/components/ProgressBar'
import { EmptyState } from '@/components/EmptyState'
import { formatCurrency } from '@/lib/formatters'

export type { DriverStanding, TeamStanding }

export default function StandingsPage() {
  const {
    team,
    season,
    driverStandings,
    constructorStandings,
    loading,
    currentRound,
    totalRounds,
  } = useUnifiedSeason()

  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors'>('drivers')

  // Máximo de pontos para calcular as mini-barras relativas ao líder
  const maxDriverPoints = useMemo(() => {
    if (driverStandings.length === 0) return 1
    return Math.max(1, driverStandings[0]?.points || 1)
  }, [driverStandings])

  const maxConstructorPoints = useMemo(() => {
    if (constructorStandings.length === 0) return 1
    return Math.max(1, constructorStandings[0]?.points || 1)
  }, [constructorStandings])

  const prizeByRank: Record<number, number> = {
    1: 175000000,
    2: 160000000,
    3: 147000000,
    4: 135000000,
    5: 124000000,
    6: 114000000,
    7: 104000000,
    8: 95000000,
    9: 87000000,
    10: 80000000,
    11: 74000000,
    12: 70000000,
  }

  // Colunas de Pilotos para o DataTable
  const driverColumns: DataTableColumn<DriverStanding>[] = [
    {
      key: 'position',
      header: 'Pos',
      width: '64px',
      render: (_, index) => {
        const pos = index + 1
        return (
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-num font-bold text-xs ${
              pos === 1
                ? 'bg-amber-400 text-black'
                : pos === 2
                  ? 'bg-slate-300 text-black'
                  : pos === 3
                    ? 'bg-amber-700 text-white'
                    : 'text-[#8B95A7] bg-[#161D29]'
            }`}
          >
            {pos}
          </span>
        )
      },
    },
    {
      key: 'name',
      header: 'Piloto',
      render: (driver) => (
        <div className="flex items-center gap-2">
          {/* Barra lateral 3px da cor da equipe */}
          <span
            className="w-[3px] h-4 rounded-full shrink-0"
            style={{ backgroundColor: driver.teamColor || '#8B95A7' }}
          />
          <span
            title={driver.nationality}
            className="text-base select-none cursor-default leading-none"
          >
            {driver.flag}
          </span>
          <span
            className={
              driver.isPlayer
                ? 'font-bold text-[#F5F7FA] text-xs sm:text-sm'
                : 'text-[#F5F7FA] text-xs'
            }
          >
            {driver.name}
          </span>
          {driver.isPlayer && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E10600]/20 text-red-300 border border-[#E10600]/40">
              Sua Equipe
            </span>
          )}
          {(driver.totalPenaltiesSec || 0) > 0 && (
            <Badge
              className="bg-amber-950/80 text-amber-300 border border-amber-500/60 text-[9px] px-1.5 py-0 h-4 font-num font-bold flex items-center gap-0.5"
              title={`Penalidades acumuladas nesta temporada: +${driver.totalPenaltiesSec}s (${driver.penaltiesCount || 1} infração(ões))`}
            >
              <Scale className="w-2.5 h-2.5" />+{driver.totalPenaltiesSec}s
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'teamName',
      header: 'Escuderia',
      render: (driver) => (
        <span style={{ color: driver.teamColor }} className="text-xs font-medium">
          {driver.teamName}
        </span>
      ),
    },
    {
      key: 'wins',
      header: 'Vitórias',
      align: 'center',
      render: (driver) =>
        driver.wins > 0 ? (
          <span className="font-num text-amber-400 font-bold text-xs">{driver.wins}</span>
        ) : (
          <span className="font-num text-[#8B95A7] text-xs">0</span>
        ),
    },
    {
      key: 'podiums',
      header: 'Pódios',
      align: 'center',
      render: (driver) =>
        driver.podiums > 0 ? (
          <span className="font-num text-emerald-400 font-bold text-xs">{driver.podiums}</span>
        ) : (
          <span className="font-num text-[#8B95A7] text-xs">0</span>
        ),
    },
    {
      key: 'points',
      header: 'Pontos & Barra',
      align: 'right',
      render: (driver, index) => {
        const leaderPts = driverStandings[0]?.points || 0
        const gap = index === 0 ? 'LÍDER' : `-${leaderPts - driver.points}`
        const ratio = Math.round((driver.points / maxDriverPoints) * 100)

        return (
          <div className="flex items-center justify-end gap-3 min-w-[140px]">
            {/* Mini barra de pontos proporcional ao líder */}
            <div className="w-20 hidden md:block">
              <ProgressBar
                value={ratio}
                max={100}
                showValue={false}
                size="sm"
                trackClassName="bg-[#161D29] border-[#1F2733]"
              />
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={`font-num text-sm font-bold ${
                    driver.isPlayer ? 'text-[#00A6FB]' : 'text-[#F5F7FA]'
                  }`}
                >
                  {driver.points}
                </span>
                <span className="text-[10px] text-[#8B95A7]">pts</span>
              </div>
              <span className="font-num text-[10px] text-[#8B95A7] block leading-none">{gap}</span>
            </div>
          </div>
        )
      },
    },
  ]

  // Colunas de Construtores para o DataTable
  const constructorColumns: DataTableColumn<TeamStanding>[] = [
    {
      key: 'position',
      header: 'Pos',
      width: '64px',
      render: (_, index) => {
        const pos = index + 1
        return (
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-num font-bold text-xs ${
              pos === 1
                ? 'bg-amber-400 text-black'
                : pos === 2
                  ? 'bg-slate-300 text-black'
                  : pos === 3
                    ? 'bg-amber-700 text-white'
                    : 'text-[#8B95A7] bg-[#161D29]'
            }`}
          >
            {pos}
          </span>
        )
      },
    },
    {
      key: 'name',
      header: 'Escuderia',
      render: (cTeam) => (
        <div className="flex items-center gap-2">
          {/* Barra lateral 3px da cor da equipe */}
          <span
            className="w-[3px] h-4 rounded-full shrink-0"
            style={{ backgroundColor: cTeam.color || '#8B95A7' }}
          />
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: cTeam.color }}
          />
          <span
            className={`text-xs sm:text-sm ${
              cTeam.isPlayer ? 'font-bold text-[#F5F7FA]' : 'text-[#F5F7FA]'
            }`}
          >
            {cTeam.name}
          </span>
          {cTeam.isPlayer && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E10600]/20 text-red-300 border border-[#E10600]/40">
              Sua Escuderia
            </span>
          )}
          {cTeam.isPlayer && (team?.constructors_points_deduction || 0) > 0 && (
            <Badge
              className="bg-red-950/80 text-red-400 border border-red-500/50 text-[9px] px-1.5 py-0 h-4 font-num font-bold"
              title="Penalidade FIA por exceder teto de gastos"
            >
              -{team?.constructors_points_deduction} pts FIA
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'engine',
      header: 'Motor 50/50',
      render: (cTeam) => <span className="text-xs text-[#8B95A7]">{cTeam.engine}</span>,
    },
    {
      key: 'wins',
      header: 'Vitórias',
      align: 'center',
      render: (cTeam) =>
        cTeam.wins > 0 ? (
          <span className="font-num text-amber-400 font-bold text-xs">{cTeam.wins}</span>
        ) : (
          <span className="font-num text-[#8B95A7] text-xs">0</span>
        ),
    },
    {
      key: 'podiums',
      header: 'Pódios',
      align: 'center',
      render: (cTeam) =>
        cTeam.podiums > 0 ? (
          <span className="font-num text-emerald-400 font-bold text-xs">{cTeam.podiums}</span>
        ) : (
          <span className="font-num text-[#8B95A7] text-xs">0</span>
        ),
    },
    {
      key: 'prize',
      header: 'Premiação FIA',
      align: 'right',
      render: (_, index) => {
        const pos = index + 1
        const estimatedPrize = prizeByRank[pos] || 70000000
        return (
          <span className="font-num text-xs font-semibold text-emerald-400">
            {formatCurrency(estimatedPrize)}
          </span>
        )
      },
    },
    {
      key: 'points',
      header: 'Pontos & Barra',
      align: 'right',
      render: (cTeam, index) => {
        const leaderPts = constructorStandings[0]?.points || 0
        const gap = index === 0 ? 'LÍDER' : `-${leaderPts - cTeam.points}`
        const ratio = Math.round((cTeam.points / maxConstructorPoints) * 100)

        return (
          <div className="flex items-center justify-end gap-3 min-w-[140px]">
            {/* Mini barra de pontos proporcional ao líder */}
            <div className="w-20 hidden md:block">
              <ProgressBar
                value={ratio}
                max={100}
                showValue={false}
                size="sm"
                trackClassName="bg-[#161D29] border-[#1F2733]"
              />
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={`font-num text-sm font-bold ${
                    cTeam.isPlayer ? 'text-[#00A6FB]' : 'text-[#F5F7FA]'
                  }`}
                >
                  {cTeam.points}
                </span>
                <span className="text-[10px] text-[#8B95A7]">pts</span>
              </div>
              <span className="font-num text-[10px] text-[#8B95A7] block leading-none">{gap}</span>
            </div>
          </div>
        )
      },
    },
  ]

  return (
    <div className="relative z-10 space-y-6 animate-fade-in-up">
      <AmbientBackground />

      {/* Header oficial da fundação Race Operations */}
      <PageHeader
        eyebrow="RACE OPERATIONS // CLASSIFICAÇÕES"
        title={`Classificação Geral F1 ${season?.year || 2026}`}
        description={
          <span>
            Grid oficial com{' '}
            {team?.is_custom ? '12 equipes (11 oficiais + 12ª sua escuderia)' : '11 equipes'} •
            Pontuação FIA (25-18-15-12-10-8-6-4-2-1), vitórias e pódios ao longo das 24 etapas.
          </span>
        }
        badge={
          <span className="px-2.5 py-1 rounded-md text-xs font-num font-semibold bg-[#11161F] border border-[#1F2733] text-[#8B95A7]">
            Temporada {season?.year || 2026} • Rodada {currentRound} de {totalRounds}
          </span>
        }
        actions={
          /* Alternador Construtores ⇄ Pilotos */
          <div className="inline-flex items-center p-1 rounded-lg bg-[#0E131B] border border-[#1F2733]">
            <button
              type="button"
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'drivers'
                  ? 'bg-[#161D29] text-[#F5F7FA] font-bold border border-[#1F2733] shadow-sm'
                  : 'text-[#8B95A7] hover:text-[#F5F7FA]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pilotos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('constructors')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'constructors'
                  ? 'bg-[#161D29] text-[#F5F7FA] font-bold border border-[#1F2733] shadow-sm'
                  : 'text-[#8B95A7] hover:text-[#F5F7FA]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Construtores</span>
            </button>
          </div>
        }
      />

      {/* Conteúdo da Tabela Selecionada */}
      {loading ? (
        <div className="space-y-2 p-4 rounded-xl border border-[#1F2733] bg-[#11161F]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-[#161D29]" />
          ))}
        </div>
      ) : activeTab === 'drivers' ? (
        driverStandings.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#11161F] border border-[#1F2733] text-center space-y-3">
            <EmptyState
              icon={Award}
              title="Sem pontuação registrada ainda"
              description={`A tabela de pilotos será preenchida automaticamente após a conclusão das sessões de corrida da temporada ${season?.year || 2026}.`}
            />
            <p className="text-xs text-[#8B95A7]">
              Você está na Rodada {currentRound}. Acesse a aba "Fim de Semana" para iniciar o GP!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1 text-[#8B95A7]">
              <span className="eyebrow text-[#8B95A7]">Mundial de Pilotos • Temporada Oficial</span>
              <span className="font-num text-[11px]">
                {driverStandings.length} pilotos registrados
              </span>
            </div>
            <DataTable
              columns={driverColumns}
              data={driverStandings}
              keyExtractor={(row) => row.id}
              playerRowPredicate={(row) => !!row.isPlayer}
              playerRowTeamColor={team?.color || '#E10600'}
              playerBadgeLabel="SUA EQUIPE"
              emptyMessage="Nenhum piloto encontrado."
            />
          </div>
        )
      ) : constructorStandings.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#11161F] border border-[#1F2733] text-center space-y-3">
          <EmptyState
            icon={Trophy}
            title="Sem classificação de equipes ainda"
            description={`A tabela de construtores será atualizada com os pontos FIA e premiação após cada GP da temporada ${season?.year || 2026}.`}
          />
          <p className="text-xs text-[#8B95A7]">
            Você está na Rodada {currentRound}. Acesse a aba "Fim de Semana" para iniciar o GP!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1 text-[#8B95A7]">
            <span className="eyebrow text-[#8B95A7]">
              Mundial de Construtores • Premiação Oficial FIA
            </span>
            <span className="font-num text-[11px]">
              {constructorStandings.length} escuderias na temporada
            </span>
          </div>
          <DataTable
            columns={constructorColumns}
            data={constructorStandings}
            keyExtractor={(row) => row.id}
            playerRowPredicate={(row) => !!row.isPlayer}
            playerRowTeamColor={team?.color || '#E10600'}
            playerBadgeLabel="SUA ESCUDERIA"
            emptyMessage="Nenhuma escuderia encontrada."
          />
        </div>
      )}
    </div>
  )
}
