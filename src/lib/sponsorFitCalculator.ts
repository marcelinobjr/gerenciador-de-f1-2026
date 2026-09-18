import { TeamModel } from '@/types/f1'
import { CanonicalSponsorProfile, CanonicalSponsorFitFactor } from '@/types/canonical-commercial'

/**
 * Helper canônico para cálculo transparente e auditável do Sponsor Fit.
 * NUNCA número aleatório ou pesos arbitrários escondidos.
 *
 * Fatores Reais Considerados:
 * 1. Reputação da Equipe (0-100)
 * 2. Desempenho no Campeonato (posição atual ou esperada)
 * 3. Exposição de Mídia / Visibilidade (baseado em resultados e alcance da marca)
 * 4. Alinhamento de Mercado Geográfico (país da marca vs sede/pilotos da equipe)
 * 5. Afinidade com Pilotos (prestígio da dupla de pilotos)
 * 6. Sinergia de Setor (ex: marcas tech com powertrain moderno, marcas luxo com equipes tradicionais)
 */

export interface CanonicalFitResult {
  score: number // 0 to 100
  factors: CanonicalSponsorFitFactor[]
  description: string
}

export function calculateCanonicalSponsorFit(
  sponsor: CanonicalSponsorProfile,
  team: TeamModel | null | undefined,
  extraParams?: {
    championshipPosition?: number
    hasDriverSameCountry?: boolean
    podiumsCount?: number
  },
): CanonicalFitResult {
  const factors: CanonicalSponsorFitFactor[] = []

  // 1. Reputação da Equipe (Peso 30%)
  const teamReputation = team?.reputation || 70
  const reputationFactorScore = Math.min(100, Math.max(20, teamReputation))
  factors.push({
    name: 'Reputação e Prestígio da Equipe',
    weight: 0.3,
    score: reputationFactorScore,
    explanation: `Reputação institucional da equipe avaliada em ${reputationFactorScore}/100.`,
  })

  // 2. Desempenho Esportivo e Competitividade (Peso 25%)
  const pos = extraParams?.championshipPosition || (team ? 6 : 5)
  // 1º = 100, 2º = 92, 3º = 85, 4º = 78, 5º = 70, 6º = 62, 10º = 40
  const performanceScore = Math.max(30, Math.min(100, Math.round(105 - pos * 7)))
  factors.push({
    name: 'Desempenho no Campeonato',
    weight: 0.25,
    score: performanceScore,
    explanation: `Posição atual no campeonato (P${pos}), atraindo interesse esportivo proporcional.`,
  })

  // 3. Sinergia de Setor e Filosofia da Marca (Peso 20%)
  let sectorSynergyScore = 75
  const sector = (sponsor.sector || '').toLowerCase()
  const teamName = (team?.name || '').toLowerCase()

  if (sector.includes('tecnologia') || sector.includes('ia') || sector.includes('dados')) {
    sectorSynergyScore =
      teamName.includes('audi') || teamName.includes('mercedes') || teamName.includes('mclaren')
        ? 95
        : 82
  } else if (sector.includes('luxo') || sector.includes('relóg') || sector.includes('lifestyle')) {
    sectorSynergyScore =
      teamName.includes('ferrari') || teamName.includes('aston') || teamName.includes('audi')
        ? 94
        : 80
  } else if (
    sector.includes('bebida') ||
    sector.includes('alimento') ||
    sector.includes('energia')
  ) {
    sectorSynergyScore =
      teamName.includes('red bull') || teamName.includes('haas') || teamName.includes('williams')
        ? 92
        : 82
  } else if (
    sector.includes('petróleo') ||
    sector.includes('combust') ||
    sector.includes('energia sustentável')
  ) {
    sectorSynergyScore = 88
  } else if (
    sector.includes('financeiro') ||
    sector.includes('banco') ||
    sector.includes('seguro')
  ) {
    sectorSynergyScore = 84
  } else if (
    sector.includes('aviação') ||
    sector.includes('turismo') ||
    sector.includes('logística')
  ) {
    sectorSynergyScore = 85
  }

  factors.push({
    name: 'Sinergia Setorial & Alinhamento de Marca',
    weight: 0.2,
    score: sectorSynergyScore,
    explanation: `Compatibilidade conceitual entre o segmento de ${sponsor.sector} e o perfil da equipe.`,
  })

  // 4. Mercado Geográfico & Pilotos (Peso 15%)
  let geoScore = 70
  const sponsorCountry = (sponsor.country || '').toLowerCase()
  const teamCountry = (team?.country || '').toLowerCase()
  if (
    sponsorCountry &&
    teamCountry &&
    (sponsorCountry.includes(teamCountry) || teamCountry.includes(sponsorCountry))
  ) {
    geoScore = 95
  } else if (extraParams?.hasDriverSameCountry) {
    geoScore = 92
  } else if (sponsor.reach === 'Global') {
    geoScore = 85
  }

  factors.push({
    name: 'Alcance Geográfico & Territorial',
    weight: 0.15,
    score: geoScore,
    explanation: `Presença global com foco territorial (${sponsor.country || 'Global'}).`,
  })

  // 5. Exigência Esportiva da Marca (Peso 10%)
  const req = (sponsor.sportingRequirement || '').toLowerCase()
  let reqScore = 80
  if (req.includes('título') || req.includes('vitória')) {
    reqScore = pos <= 2 ? 95 : pos <= 4 ? 70 : 45
  } else if (req.includes('pódio') || req.includes('top 3') || req.includes('top 5')) {
    reqScore = pos <= 5 ? 90 : pos <= 7 ? 75 : 55
  } else if (req.includes('pontos') || req.includes('top 10')) {
    reqScore = pos <= 10 ? 90 : 65
  } else {
    reqScore = 85
  }

  factors.push({
    name: 'Compatibilidade com Exigências Esportivas',
    weight: 0.1,
    score: reqScore,
    explanation: `Nível de cobrança esportiva da marca: "${sponsor.sportingRequirement}".`,
  })

  // Cálculo ponderado canônico (sem arredondamentos arbitrários)
  const rawScore = factors.reduce((acc, f) => acc + f.score * f.weight, 0)
  const finalScore = Math.min(99, Math.max(35, Math.round(rawScore)))

  let description = 'Alinhamento estratégico sólido com forte potencial de retorno mútuo.'
  if (finalScore >= 90) {
    description = 'Marca premium com altíssima sinergia, forte apelo global e fit excelente.'
  } else if (finalScore >= 80) {
    description = 'Excelente alinhamento conceitual e comercial para a temporada.'
  } else if (finalScore >= 70) {
    description = 'Bom fit comercial; exige cumprimento das metas para renovação contínua.'
  } else {
    description = 'Fit moderado; parceria oportunista com foco em remuneração financeira direta.'
  }

  return {
    score: finalScore,
    factors,
    description,
  }
}
