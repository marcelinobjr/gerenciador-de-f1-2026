import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  Calendar,
  Shield,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import {
  DriverContractRole,
  DriverContractOffer,
  CounterofferTerms,
  EstimatedMarketValueRange,
  NegotiationOfferAssessment,
} from '@/types/canonical-driver-market'
import { driverContractService } from '@/services/driverContractService'
import { TeamModel, DriverModel } from '@/types/f1'
import { useToast } from '@/hooks/use-toast'

export interface DriverNegotiationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver: Partial<DriverModel> & {
    id: string
    name: string
    salary?: number
    speed?: number
    consistency?: number
    age?: number
  }
  playerTeam: TeamModel
  currentRound: number
  seasonYear: number
  onContractSigned?: () => void
}

export function DriverNegotiationModal({
  open,
  onOpenChange,
  driver,
  playerTeam,
  currentRound,
  seasonYear,
  onContractSigned,
}: DriverNegotiationModalProps) {
  const { toast } = useToast()
  const marketRange: EstimatedMarketValueRange =
    driverContractService.estimateMarketValueRange(driver)
  const careerIntent = driverContractService.deriveCareerIntent(
    driver,
    playerTeam,
    playerTeam.strength || 70,
  )

  // Estados negociáveis
  const [salary, setSalary] = useState<number>(
    Math.round((marketRange.minAnnualSalary + marketRange.maxAnnualSalary) / 2),
  )
  const [durationYears, setDurationYears] = useState<number>(2)
  const [role, setRole] = useState<DriverContractRole>('EQUAL_STATUS')
  const [signingBonus, setSigningBonus] = useState<number>(Math.round(salary * 0.1))
  const [teamOption, setTeamOption] = useState<boolean>(true)
  const [driverOption, setDriverOption] = useState<boolean>(false)
  const [buyoutAmount, setBuyoutAmount] = useState<number>(Math.round(salary * 1.5))
  const [isConfidential, setIsConfidential] = useState<boolean>(true)
  const [startSeason, setStartSeason] = useState<number>(
    currentRound >= 12 ? seasonYear + 1 : seasonYear,
  )

  // Rodadas e paciência
  const [roundsOfTalks, setRoundsOfTalks] = useState<number>(1)
  const [driverPatienceRemaining, setDriverPatienceRemaining] = useState<number>(4)
  const [counteroffer, setCounteroffer] = useState<CounterofferTerms | null>(null)
  const [assessment, setAssessment] = useState<NegotiationOfferAssessment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Submeter oferta para avaliação do piloto
  const handleEvaluateOffer = () => {
    const offer: DriverContractOffer = {
      offerId: `offer_${playerTeam.id}_${driver.id}_r${roundsOfTalks}`,
      teamId: playerTeam.id,
      teamName: playerTeam.name,
      driverId: driver.id,
      driverName: driver.name,
      annualSalary: salary,
      durationYears,
      role,
      signingBonus,
      performanceBonuses: [],
      teamOptionIncluded: teamOption,
      driverOptionIncluded: driverOption,
      buyoutAmount,
      offeredSeason: seasonYear,
      startSeason,
      expirationRound: currentRound + 2,
      status: 'OFFER_SUBMITTED',
      isConfidential,
      roundsOfTalks,
      driverPatienceRemaining,
    }

    const evaluation = driverContractService.evaluateContractOffer(
      offer,
      driver,
      playerTeam,
      seasonYear,
    )

    setAssessment(evaluation.assessment)
    if (evaluation.counteroffer) {
      setCounteroffer(evaluation.counteroffer)
      setDriverPatienceRemaining((prev) => Math.max(0, prev - 1))
      setRoundsOfTalks((prev) => prev + 1)
      toast({
        title: 'Contraproposta recebida',
        description: evaluation.counteroffer.driverMessage,
      })
    } else if (evaluation.isAccepted) {
      toast({
        title: 'Proposta Aceita pelo Piloto!',
        description: 'Os termos foram aprovados. Você já pode formalizar a assinatura do contrato.',
      })
    } else {
      setDriverPatienceRemaining((prev) => Math.max(0, prev - 1))
      toast({
        variant: 'destructive',
        title: 'Oferta Recusada',
        description: evaluation.explanationText,
      })
    }
  }

  // Aceitar termos da contraproposta
  const handleApplyCounteroffer = () => {
    if (!counteroffer) return
    setSalary(counteroffer.requestedSalary)
    setDurationYears(counteroffer.requestedDurationYears)
    setRole(counteroffer.requestedRole)
    setSigningBonus(counteroffer.requestedSigningBonus)
    setCounteroffer(null)
    setAssessment('competitive')
  }

  // Confirmar e assinar contrato no sistema
  const handleSignContract = async () => {
    setIsSubmitting(true)
    try {
      const offer: DriverContractOffer = {
        offerId: `offer_final_${playerTeam.id}_${driver.id}`,
        teamId: playerTeam.id,
        teamName: playerTeam.name,
        driverId: driver.id,
        driverName: driver.name,
        annualSalary: salary,
        durationYears,
        role,
        signingBonus,
        performanceBonuses: [],
        teamOptionIncluded: teamOption,
        driverOptionIncluded: driverOption,
        buyoutAmount,
        offeredSeason: seasonYear,
        startSeason,
        expirationRound: currentRound + 2,
        status: 'AGREEMENT',
        isConfidential,
        roundsOfTalks,
        driverPatienceRemaining,
      }

      const res = await driverContractService.finalizeAndSignContract(
        offer,
        playerTeam,
        driver as any,
        currentRound,
        seasonYear,
      )

      if (res.success) {
        toast({
          title: 'Contrato Formalizado com Sucesso!',
          description: isConfidential
            ? `${driver.name} assinou em sigilo para iniciar em ${startSeason}.`
            : `${driver.name} assinou publicamente com a ${playerTeam.name}!`,
        })
        onContractSigned?.()
        onOpenChange(false)
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha ao assinar',
          description: res.error || 'Não foi possível formalizar o acordo.',
        })
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: err?.message || 'Falha na negociação.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E2E8F0] text-[#0F172A] max-w-2xl sm:max-w-3xl p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-[#F1F5F9] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs text-[#E10600] uppercase tracking-wider font-bold">
              <Briefcase className="w-4 h-4" />
              Mesa de Negociação Contratual
            </div>
            <Badge
              variant="outline"
              className="font-mono text-xs border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"
            >
              Paciência do Piloto: {driverPatienceRemaining} rodadas
            </Badge>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black text-[#0F172A] flex items-center justify-between mt-1">
            <span>{driver.name}</span>
            <span className="text-sm font-normal text-[#64748B] font-mono">
              Início: {startSeason}
            </span>
          </DialogTitle>

          <DialogDescription className="text-xs text-[#64748B]">
            Career Intent: <strong className="text-cyan-700">{careerIntent.state}</strong> —{' '}
            {careerIntent.qualitativeReason}
          </DialogDescription>
        </DialogHeader>

        {/* Quadro Informativo de Mercado */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-xs">
          <div>
            <span className="text-[#64748B] block uppercase text-[10px]">
              Faixa de Mercado Estimada
            </span>
            <strong className="text-emerald-600 font-bold">{marketRange.displayRange}</strong>
          </div>
          <div>
            <span className="text-[#64748B] block uppercase text-[10px]">Demanda no Paddock</span>
            <strong className="text-amber-600 font-bold uppercase">
              {marketRange.perceivedDemandLevel}
            </strong>
          </div>
          <div>
            <span className="text-[#64748B] block uppercase text-[10px]">Orçamento Disponível</span>
            <strong className="text-[#0F172A] font-bold">
              {formatCurrency(playerTeam.budget || 0)}
            </strong>
          </div>
        </div>

        {/* Alerta de Contraproposta Ativa */}
        {counteroffer && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2 text-amber-800 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Contraproposta dos Representantes do Piloto:
            </div>
            <p className="text-[#334155] text-[11px] italic">
              &ldquo;{counteroffer.driverMessage}&rdquo;
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div>
                Salário Requisitado:{' '}
                <strong className="text-emerald-600">
                  {formatCurrency(counteroffer.requestedSalary)}
                </strong>
              </div>
              <div>
                Papel:{' '}
                <strong className="text-[#0F172A]">
                  {counteroffer.requestedRole === 'LEAD_DRIVER'
                    ? '1º Piloto'
                    : counteroffer.requestedRole === 'EQUAL_STATUS'
                      ? 'Paridade'
                      : 'Suporte'}
                </strong>
              </div>
              <div>
                Duração:{' '}
                <strong className="text-[#0F172A]">
                  {counteroffer.requestedDurationYears} anos
                </strong>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleApplyCounteroffer}
              className="mt-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
            >
              Aceitar Termos da Contraproposta
            </Button>
          </div>
        )}

        {/* Formulário de Negociação */}
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-[#0F172A]">Salário Anual (USD)</Label>
              <Input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="bg-white border-[#CBD5E1] text-[#0F172A] font-bold font-mono text-sm"
              />
              <span className="text-[10px] text-[#64748B] block">
                Valor Formatado: {formatCurrency(salary)} / ano
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-[#0F172A]">Signing Bonus (Luvas Imediatas)</Label>
              <Input
                type="number"
                value={signingBonus}
                onChange={(e) => setSigningBonus(Number(e.target.value))}
                className="bg-white border-[#CBD5E1] text-[#0F172A] font-bold font-mono text-sm"
              />
              <span className="text-[10px] text-[#64748B] block">
                Debitado pelo Financial Ledger na assinatura
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-[#0F172A]">Papel Esportivo</Label>
              <Select value={role} onValueChange={(val: any) => setRole(val)}>
                <SelectTrigger className="bg-white border-[#CBD5E1] text-[#0F172A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#CBD5E1] text-[#0F172A]">
                  <SelectItem value="LEAD_DRIVER">1º Piloto (Prioridade)</SelectItem>
                  <SelectItem value="EQUAL_STATUS">Status Igual (Paridade)</SelectItem>
                  <SelectItem value="SUPPORT_DRIVER">Piloto de Apoio</SelectItem>
                  <SelectItem value="RESERVE">Piloto Reserva</SelectItem>
                  <SelectItem value="TEST_DEVELOPMENT">Desenvolvimento / Testes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-[#0F172A]">Duração Contratual</Label>
              <Select
                value={String(durationYears)}
                onValueChange={(val) => setDurationYears(Number(val))}
              >
                <SelectTrigger className="bg-white border-[#CBD5E1] text-[#0F172A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#CBD5E1] text-[#0F172A]">
                  <SelectItem value="1">1 Temporada</SelectItem>
                  <SelectItem value="2">2 Temporadas</SelectItem>
                  <SelectItem value="3">3 Temporadas</SelectItem>
                  <SelectItem value="4">4 Temporadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <Label className="text-[#0F172A]">Início do Vínculo</Label>
              <Select
                value={String(startSeason)}
                onValueChange={(val) => setStartSeason(Number(val))}
              >
                <SelectTrigger className="bg-white border-[#CBD5E1] text-[#0F172A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#CBD5E1] text-[#0F172A]">
                  <SelectItem value={String(seasonYear)}>Imediato ({seasonYear})</SelectItem>
                  <SelectItem value={String(seasonYear + 1)}>Futuro ({seasonYear + 1})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cláusulas e Opções */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={teamOption}
                onChange={(e) => setTeamOption(e.target.checked)}
                className="rounded border-[#CBD5E1] bg-white text-red-600 focus:ring-0"
              />
              <span className="text-[#334155]">Opção de Renovação da Equipe (+1 ano)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={driverOption}
                onChange={(e) => setDriverOption(e.target.checked)}
                className="rounded border-[#CBD5E1] bg-white text-red-600 focus:ring-0"
              />
              <span className="text-[#334155]">Opção Unilateral do Piloto (+1 ano)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="rounded border-[#CBD5E1] bg-white text-red-600 focus:ring-0"
              />
              <span className="text-[#334155]">Contrato Inicialmente Confidencial</span>
            </label>
          </div>
        </div>

        {/* Avaliação Qualitativa da Proposta (SEM porcentagem de chance exata) */}
        {assessment && (
          <div className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] font-mono text-xs flex items-center justify-between">
            <span className="text-[#64748B]">Avaliação do Piloto:</span>
            <Badge
              className={`font-bold uppercase ${
                assessment === 'strong'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : assessment === 'competitive'
                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                    : assessment === 'uncertain'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {assessment === 'strong' && 'Excelente Proposta'}
              {assessment === 'competitive' && 'Competitiva'}
              {assessment === 'uncertain' && 'Incerta / Exige Concessões'}
              {assessment === 'weak' && 'Abaixo do Esperado'}
              {assessment === 'unacceptable' && 'Inaceitável'}
            </Badge>
          </div>
        )}

        <DialogFooter className="border-t border-[#F1F5F9] pt-4 flex flex-col sm:flex-row gap-2 justify-between items-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#CBD5E1] text-[#64748B] text-xs w-full sm:w-auto"
          >
            Fechar Mesa
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleEvaluateOffer}
              disabled={isSubmitting || driverPatienceRemaining <= 0}
              className="border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#0F172A] text-xs flex-1 sm:flex-none"
            >
              Apresentar Oferta aos Agentes
            </Button>

            <Button
              onClick={handleSignContract}
              disabled={isSubmitting || (assessment !== 'strong' && assessment !== 'competitive')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex-1 sm:flex-none"
            >
              {isSubmitting ? 'Formalizando...' : 'Firmar Contrato Definitivo'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
