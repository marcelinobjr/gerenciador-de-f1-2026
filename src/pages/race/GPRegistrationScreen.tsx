import React, { useState, useMemo } from 'react'
import type { DriverModel, TeamModel } from '@/types/f1'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'
import { teamRosterService } from '@/services/teamRosterService'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users2,
  Car,
  ChevronRight,
  ArrowLeft,
  Info,
} from 'lucide-react'

interface GPRegistrationScreenProps {
  round: number
  totalRounds: number
  gpName: string
  circuitName?: string
  team: TeamModel
  allDrivers: DriverModel[]
  onConfirmRegistration: (car1DriverId: string, car2DriverId: string) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export const GPRegistrationScreen: React.FC<GPRegistrationScreenProps> = ({
  round,
  totalRounds,
  gpName,
  circuitName,
  team,
  allDrivers,
  onConfirmRegistration,
  onCancel,
  isSubmitting = false,
}) => {
  // Construir o roster canônico da equipe
  const roster = useMemo(() => {
    return teamRosterService.buildTeamRoster(team, allDrivers)
  }, [team, allDrivers])

  // Identificar os dois titulares vigentes
  const titular1 = roster.driver1 || roster.titulars[0] || null
  const titular2 = roster.driver2 || roster.titulars.find((t) => t.id !== titular1?.id) || null

  // Verificar se os titulares são elegíveis inicialmente para pré-seleção
  const isTitular1Eligible = useMemo(() => {
    if (!titular1) return false
    const view = canonicalHomologationAdapter.toCanonicalView(titular1)
    const isInc = Boolean(
      titular1.is_incapacitated || (titular1.incapacitated_rounds_left ?? 0) > 0,
    )
    return (view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat) && !isInc
  }, [titular1])

  const isTitular2Eligible = useMemo(() => {
    if (!titular2) return false
    const view = canonicalHomologationAdapter.toCanonicalView(titular2)
    const isInc = Boolean(
      titular2.is_incapacitated || (titular2.incapacitated_rounds_left ?? 0) > 0,
    )
    return (view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat) && !isInc
  }, [titular2])

  // Pré-seleção: titulares vigentes se ambos elegíveis, senão mantém se elegível ou vazio
  const [selectedCar1DriverId, setSelectedCar1DriverId] = useState<string>(
    isTitular1Eligible && titular1 ? titular1.id : '',
  )
  const [selectedCar2DriverId, setSelectedCar2DriverId] = useState<string>(
    isTitular2Eligible && titular2 ? titular2.id : '',
  )

  // Lista de todos os pilotos vinculados à equipe (titulares, reservas, academia)
  const availableTeamDrivers = useMemo(() => {
    return allDrivers.filter((d) => d.team_id === team.id || d.reserve_team_id === team.id)
  }, [allDrivers, team.id])

  // Piloto selecionado Carro 1 e Carro 2
  const car1Driver = useMemo(
    () => availableTeamDrivers.find((d) => d.id === selectedCar1DriverId) || null,
    [availableTeamDrivers, selectedCar1DriverId],
  )
  const car2Driver = useMemo(
    () => availableTeamDrivers.find((d) => d.id === selectedCar2DriverId) || null,
    [availableTeamDrivers, selectedCar2DriverId],
  )

  // Status canônico de cada carro
  const car1View = useMemo(
    () => (car1Driver ? canonicalHomologationAdapter.toCanonicalView(car1Driver) : null),
    [car1Driver],
  )
  const car2View = useMemo(
    () => (car2Driver ? canonicalHomologationAdapter.toCanonicalView(car2Driver) : null),
    [car2Driver],
  )

  const isCar1Incapacitated = Boolean(
    car1Driver?.is_incapacitated || (car1Driver?.incapacitated_rounds_left ?? 0) > 0,
  )
  const isCar2Incapacitated = Boolean(
    car2Driver?.is_incapacitated || (car2Driver?.incapacitated_rounds_left ?? 0) > 0,
  )

  // Checagens de Validação
  const checkTwoSelected = Boolean(selectedCar1DriverId && selectedCar2DriverId)
  const checkDifferent = Boolean(
    selectedCar1DriverId && selectedCar2DriverId && selectedCar1DriverId !== selectedCar2DriverId,
  )
  const checkCar1License = Boolean(
    car1View && (car1View.licenseStatus === 'nivel_a' || car1View.isEligibleForF1Seat),
  )
  const checkCar2License = Boolean(
    car2View && (car2View.licenseStatus === 'nivel_a' || car2View.isEligibleForF1Seat),
  )
  const checkBothLicenses = checkCar1License && checkCar2License
  const checkBothAvailable = !isCar1Incapacitated && !isCar2Incapacitated

  const isFormValid = checkTwoSelected && checkDifferent && checkBothLicenses && checkBothAvailable

  const handleConfirm = () => {
    if (!isFormValid) return
    onConfirmRegistration(selectedCar1DriverId, selectedCar2DriverId)
  }

  // Helpers de Badge de Licença
  const renderLicenseBadge = (licenseStatus: 'nivel_a' | 'nivel_b' | 'nivel_c') => {
    switch (licenseStatus) {
      case 'nivel_a':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            LICENÇA A (FIA)
          </span>
        )
      case 'nivel_b':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            LICENÇA B (TL1)
          </span>
        )
      case 'nivel_c':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            LICENÇA C (FORMAÇÃO)
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* 1. CABEÇALHO DO GP */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge className="bg-[#E10600] text-white hover:bg-[#E10600] font-black text-[10px] tracking-wider uppercase">
              FIA OFFICIAL ENTRY
            </Badge>
            <span className="text-xs font-bold text-[#64748B]">
              Rodada {round} de {totalRounds}
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight uppercase">
            INSCRIÇÃO FORMAL DE PILOTOS — {gpName}
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Selecione e homologue os dois pilotos que guiarão para a{' '}
            <strong className="text-[#0F172A]">{team.name}</strong> neste Grande Prêmio. Apenas
            pilotos portadores de Licença A (Superlicença FIA) ativa são elegíveis para os assentos
            de corrida.
          </p>
        </div>

        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="text-xs font-bold border-[#CBD5E1] text-[#0F172A] gap-1.5 self-start md:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Button>
        )}
      </div>

      {/* 2. OS DOIS CARROS (CARRO 1 E CARRO 2) LADO A LADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARRO 1 */}
        <Card className="p-5 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#0F172A] text-white flex items-center justify-center font-black text-xs">
                #1
              </span>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Assento de GP
                </span>
                <strong className="text-sm font-black text-[#0F172A]">CARRO 1</strong>
              </div>
            </div>
            {car1View && renderLicenseBadge(car1View.licenseStatus)}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#334155] block">
              Selecione o Piloto para o Carro 1:
            </label>
            <select
              value={selectedCar1DriverId}
              onChange={(e) => setSelectedCar1DriverId(e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E10600]/20"
            >
              <option value="">-- Selecione o Piloto do Carro 1 --</option>
              {availableTeamDrivers.map((d) => {
                const view = canonicalHomologationAdapter.toCanonicalView(d)
                const isInc = Boolean(d.is_incapacitated || (d.incapacitated_rounds_left ?? 0) > 0)
                const isElig =
                  (view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat) && !isInc
                const roleLabel =
                  d.role === 'titular'
                    ? 'Titular'
                    : d.role === 'reserva'
                      ? 'Reserva'
                      : d.is_academy
                        ? 'Academia'
                        : 'Piloto'
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} ({roleLabel} | Licença{' '}
                    {view.licenseStatus.replace('nivel_', '').toUpperCase()}
                    {isInc ? ' - INDISPONÍVEL' : ''}
                    {!isElig && !isInc ? ' - SEM LICENÇA A' : ''})
                  </option>
                )
              })}
            </select>
          </div>

          {/* DETALHES DO PILOTO CARRO 1 */}
          {car1Driver && car1View ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Função Contratual:</span>
                <span className="font-bold text-[#0F172A] capitalize">
                  {car1Driver.role || (car1Driver.is_academy ? 'Academia' : 'Piloto')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Status FIA:</span>
                <span className="font-bold text-[#0F172A] capitalize">
                  {car1View.legacyHomologationStatus} ({car1View.legacySuperlicensePoints} pts)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Elegibilidade FIA:</span>
                {car1View.isEligibleForF1Seat ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Apto para GP
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Inelegível (Sem Licença A)
                  </span>
                )}
              </div>
              {isCar1Incapacitated && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    PILOTO INDISPONÍVEL: {car1Driver.incapacitated_reason || 'Impedimento médico'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-[#CBD5E1] text-center text-xs text-[#94A3B8]">
              Nenhum piloto escalado para o Carro 1.
            </div>
          )}
        </Card>

        {/* CARRO 2 */}
        <Card className="p-5 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#0F172A] text-white flex items-center justify-center font-black text-xs">
                #2
              </span>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Assento de GP
                </span>
                <strong className="text-sm font-black text-[#0F172A]">CARRO 2</strong>
              </div>
            </div>
            {car2View && renderLicenseBadge(car2View.licenseStatus)}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#334155] block">
              Selecione o Piloto para o Carro 2:
            </label>
            <select
              value={selectedCar2DriverId}
              onChange={(e) => setSelectedCar2DriverId(e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E10600]/20"
            >
              <option value="">-- Selecione o Piloto do Carro 2 --</option>
              {availableTeamDrivers.map((d) => {
                const view = canonicalHomologationAdapter.toCanonicalView(d)
                const isInc = Boolean(d.is_incapacitated || (d.incapacitated_rounds_left ?? 0) > 0)
                const isElig =
                  (view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat) && !isInc
                const roleLabel =
                  d.role === 'titular'
                    ? 'Titular'
                    : d.role === 'reserva'
                      ? 'Reserva'
                      : d.is_academy
                        ? 'Academia'
                        : 'Piloto'
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} ({roleLabel} | Licença{' '}
                    {view.licenseStatus.replace('nivel_', '').toUpperCase()}
                    {isInc ? ' - INDISPONÍVEL' : ''}
                    {!isElig && !isInc ? ' - SEM LICENÇA A' : ''})
                  </option>
                )
              })}
            </select>
          </div>

          {/* DETALHES DO PILOTO CARRO 2 */}
          {car2Driver && car2View ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Função Contratual:</span>
                <span className="font-bold text-[#0F172A] capitalize">
                  {car2Driver.role || (car2Driver.is_academy ? 'Academia' : 'Piloto')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Status FIA:</span>
                <span className="font-bold text-[#0F172A] capitalize">
                  {car2View.legacyHomologationStatus} ({car2View.legacySuperlicensePoints} pts)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Elegibilidade FIA:</span>
                {car2View.isEligibleForF1Seat ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Apto para GP
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Inelegível (Sem Licença A)
                  </span>
                )}
              </div>
              {isCar2Incapacitated && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    PILOTO INDISPONÍVEL: {car2Driver.incapacitated_reason || 'Impedimento médico'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-[#CBD5E1] text-center text-xs text-[#94A3B8]">
              Nenhum piloto escalado para o Carro 2.
            </div>
          )}
        </Card>
      </div>

      {/* 3. TABELA DE PILOTOS VINCULADOS DISPONÍVEIS */}
      <Card className="p-5 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="w-4 h-4 text-[#E10600]" />
            <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
              PILOTOS DISPONÍVEIS NO PLANTÃO DA EQUIPE
            </h3>
          </div>
          <span className="text-xs text-[#64748B]">
            Total: <strong>{availableTeamDrivers.length} piloto(s)</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[#64748B] text-[11px] font-bold">
                <th className="py-2.5 px-3">PILOTO</th>
                <th className="py-2.5 px-3">FUNÇÃO</th>
                <th className="py-2.5 px-3">LICENÇA FIA</th>
                <th className="py-2.5 px-3">DISPONIBILIDADE</th>
                <th className="py-2.5 px-3">ELEGIBILIDADE GP</th>
                <th className="py-2.5 px-3 text-right">AÇÕES RÁPIDAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {availableTeamDrivers.map((d) => {
                const view = canonicalHomologationAdapter.toCanonicalView(d)
                const isInc = Boolean(d.is_incapacitated || (d.incapacitated_rounds_left ?? 0) > 0)
                const isElig =
                  (view.licenseStatus === 'nivel_a' || view.isEligibleForF1Seat) && !isInc
                const roleLabel =
                  d.role === 'titular'
                    ? 'Titular'
                    : d.role === 'reserva'
                      ? 'Reserva'
                      : d.is_academy
                        ? 'Academia'
                        : 'Piloto'

                return (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#0F172A]">{d.name}</td>
                    <td className="py-2.5 px-3 text-[#475569]">{roleLabel}</td>
                    <td className="py-2.5 px-3">{renderLicenseBadge(view.licenseStatus)}</td>
                    <td className="py-2.5 px-3">
                      {isInc ? (
                        <span className="text-rose-600 font-bold text-[11px]">
                          Indisponível ({d.incapacitated_reason || 'Médico'})
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[11px]">Apto / Ativo</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {isElig ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-black">
                          ELEGÍVEL (LICENÇA A)
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-rose-600 border-rose-300 text-[10px] font-bold"
                        >
                          BLOQUEADO P/ GP
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!isElig}
                        onClick={() => setSelectedCar1DriverId(d.id)}
                        className={`h-7 px-2 text-[10px] font-bold ${
                          selectedCar1DriverId === d.id
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'border-[#CBD5E1] text-[#0F172A]'
                        }`}
                      >
                        Carro 1
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!isElig}
                        onClick={() => setSelectedCar2DriverId(d.id)}
                        className={`h-7 px-2 text-[10px] font-bold ${
                          selectedCar2DriverId === d.id
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'border-[#CBD5E1] text-[#0F172A]'
                        }`}
                      >
                        Carro 2
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. VALIDAÇÃO E CONFIRMAÇÃO DA INSCRIÇÃO */}
      <Card className="p-6 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 text-xs">
            <span className="font-black text-[#0F172A] uppercase tracking-wider block text-xs">
              Checklist Regulamentar FIA para Inscrição:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {checkTwoSelected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span className={checkTwoSelected ? 'text-[#0F172A] font-bold' : 'text-[#64748B]'}>
                  2 pilotos selecionados
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {checkDifferent ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span className={checkDifferent ? 'text-[#0F172A] font-bold' : 'text-[#64748B]'}>
                  Nenhum piloto duplicado entre carros
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {checkBothLicenses ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span className={checkBothLicenses ? 'text-[#0F172A] font-bold' : 'text-[#64748B]'}>
                  Ambos possuem Superlicença / Licença A
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {checkBothAvailable ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span
                  className={checkBothAvailable ? 'text-[#0F172A] font-bold' : 'text-[#64748B]'}
                >
                  Ambos disponíveis (sem lesão/suspensão)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
            <Button
              type="button"
              disabled={!isFormValid || isSubmitting}
              onClick={handleConfirm}
              className={`h-11 px-6 text-xs font-black shadow-xs gap-2 ${
                isFormValid
                  ? 'bg-[#E10600] hover:bg-[#C00400] text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  CONFIRMANDO...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  CONFIRMAR INSCRIÇÃO DO GP
                </>
              )}
            </Button>
          </div>
        </div>

        {/* FEEDBACK EXPLÍCITO */}
        {!isFormValid && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {!checkTwoSelected
                ? '✕ Selecione um piloto para cada carro da equipe.'
                : !checkDifferent
                  ? '✕ O mesmo piloto não pode ser escalado para ambos os carros.'
                  : !checkBothLicenses
                    ? '✕ Um ou mais pilotos selecionados não possuem Licença A (Superlicença FIA).'
                    : '✕ Um dos pilotos está indisponível para correr neste GP.'}
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}
