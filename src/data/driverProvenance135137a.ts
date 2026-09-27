/**
 * Proveniência Documental dos Pilotos MBJ-128, MBJ-136 e MBJ-137 (IMPORT-DRIVERS-135-137A).
 *
 * Regra Arquitetural: A arte gráfica dos retratos (DRV_*.jpg) NUNCA autoriza preenchimento
 * de preferredNumber, equipes, contratos, estatísticas ou atributos desportivos.
 * Os valores adotados como preferência de cadastro são justificados unicamente por fontes
 * documentais primárias da Fórmula 1.
 */

export interface DriverPreferredNumberProvenance {
  driverId: string
  driverName: string
  preferredNumber: number | null
  portraitAsset: string
  sourceTitle: string
  sourceAuthor: string
  sourceDate: string
  sourceUrl: string
  evidence: string
  documentedFact: string
  gameDecision: string
  provenanceType: 'PRIMARY_DOCUMENT' | 'NO_VALIDATED_PREFERENCE'
}

export const DRIVER_PROVENANCE_135_137A: Record<string, DriverPreferredNumberProvenance> = {
  'mbj-136': {
    driverId: 'mbj-136',
    driverName: 'Nikita Mazepin',
    preferredNumber: 9,
    portraitAsset: 'DRV_0135.jpg',
    sourceTitle: 'São Paulo Grand Prix: Race Recap',
    sourceAuthor: 'Haas F1 Team',
    sourceDate: '2021-11-14',
    sourceUrl: 'https://www.haasf1team.com/news/sao-paulo-grand-prix-race-recap',
    evidence:
      'O comunicado oficial identifica "Nikita Mazepin, Driver No. 9, Uralkali Haas F1 Team".',
    documentedFact: 'Mazepin competiu na F1 com o número fixo #9 na temporada 2021 pela Haas.',
    gameDecision: 'Adotado como preferredNumber=9 no cadastro canônico inicial.',
    provenanceType: 'PRIMARY_DOCUMENT',
  },
  'mbj-137': {
    driverId: 'mbj-137',
    driverName: 'Daniil Kvyat',
    preferredNumber: 26,
    portraitAsset: 'DRV_0136.jpg',
    sourceTitle: "What's in a number? The truth behind the drivers' new digits",
    sourceAuthor: 'Formula 1',
    sourceDate: '2014-03-12',
    sourceUrl:
      'https://www.formula1.com/en/latest/article/whats-in-a-number-the-truth-behind-the-drivers-new-digits.u5yr5QdYKqwu0vZnMSiLJ.u5yr5QdYKqwu0vZnMSiLJ',
    evidence: 'Seção "Daniil Kvyat - 26" documenta a escolha do número permanente pelo piloto.',
    documentedFact:
      'Kvyat escolheu e utilizou o #26 desde a implantação do sistema permanente de numeração em 2014.',
    gameDecision: 'Adotado como preferredNumber=26 no cadastro canônico inicial.',
    provenanceType: 'PRIMARY_DOCUMENT',
  },
  'mbj-128': {
    driverId: 'mbj-128',
    driverName: 'Sébastien Bourdais',
    preferredNumber: null,
    portraitAsset: 'DRV_0137.jpg',
    sourceTitle: 'Auditoria de cadastro pré-2014',
    sourceAuthor: 'Apex GP Manager Data Governance',
    sourceDate: '2025-01-01',
    sourceUrl: 'N/A',
    evidence:
      'Piloto competiu na era pré-números permanentes (2008-2009 com #14 e #11 pela Toro Rosso). O numeral "25" visível na arte gráfica DRV_0137.jpg é arte conceitual/WEC e NÃO autoriza preenchimento.',
    documentedFact:
      'Não há escolha de número permanente na era moderna da F1 validada para este campo.',
    gameDecision:
      'preferredNumber mantido estritamente null (undefined), sem preferência cadastrada.',
    provenanceType: 'NO_VALIDATED_PREFERENCE',
  },
}
