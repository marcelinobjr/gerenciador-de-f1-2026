import { GrandPrixInfo, EngineSupplierSpec, EngineSupplierName } from '@/types/f1'

export const F1_2026_CALENDAR: GrandPrixInfo[] = [
  {
    round: 1,
    name: 'Grande Prêmio da Austrália',
    circuit: 'Circuito de Albert Park, Melbourne',
    country: 'Austrália',
    flag: '🇦🇺',
    laps: 58,
    circuitLengthKm: 5.278,
    turns: 14,
    characteristic: 'Misto rápido com frenagens fortes',
    tireAbrasiveness: 5,
    downforceIdeal: 6,
    suspensionIdeal: 6,
  },
  {
    round: 2,
    name: 'Grande Prêmio da China',
    circuit: 'Circuito Internacional de Xangai',
    country: 'China',
    flag: '🇨🇳',
    laps: 56,
    circuitLengthKm: 5.451,
    turns: 16,
    characteristic: 'Reta longa e curvas fechadas',
    tireAbrasiveness: 7,
    downforceIdeal: 5,
    suspensionIdeal: 5,
  },
  {
    round: 3,
    name: 'Grande Prêmio do Japão',
    circuit: 'Circuito de Suzuka',
    country: 'Japão',
    flag: '🇯🇵',
    laps: 53,
    circuitLengthKm: 5.807,
    turns: 18,
    characteristic: 'Alta pressão aerodinâmica em S',
    tireAbrasiveness: 8,
    downforceIdeal: 8,
    suspensionIdeal: 7,
  },
  {
    round: 4,
    name: 'Grande Prêmio do Bahrein',
    circuit: 'Circuito Internacional do Bahrein, Sakhir',
    country: 'Bahrein',
    flag: '🇧🇭',
    laps: 57,
    circuitLengthKm: 5.412,
    turns: 15,
    characteristic: 'Exigência de tração e frenagens',
    tireAbrasiveness: 9,
    downforceIdeal: 6,
    suspensionIdeal: 6,
  },
  {
    round: 5,
    name: 'Grande Prêmio da Arábia Saudita',
    circuit: 'Circuito de Corniche de Jeddah',
    country: 'Arábia Saudita',
    flag: '🇸🇦',
    laps: 50,
    circuitLengthKm: 6.174,
    turns: 27,
    characteristic: 'Circuito de rua de altíssima velocidade',
    tireAbrasiveness: 4,
    downforceIdeal: 4,
    suspensionIdeal: 8,
  },
  {
    round: 6,
    name: 'Grande Prêmio de Miami',
    circuit: 'Autódromo Internacional de Miami',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    laps: 57,
    circuitLengthKm: 5.412,
    turns: 19,
    characteristic: 'Misto de rua com longas retas',
    tireAbrasiveness: 5,
    downforceIdeal: 5,
    suspensionIdeal: 6,
  },
  {
    round: 7,
    name: 'Grande Prêmio do Canadá',
    circuit: 'Circuito Gilles Villeneuve, Montreal',
    country: 'Canadá',
    flag: '🇨🇦',
    laps: 70,
    circuitLengthKm: 4.361,
    turns: 14,
    characteristic: 'Stop-and-go com zebras altas',
    tireAbrasiveness: 4,
    downforceIdeal: 4,
    suspensionIdeal: 4,
  },
  {
    round: 8,
    name: 'Grande Prêmio de Mônaco',
    circuit: 'Circuito de Mônaco, Monte Carlo',
    country: 'Mônaco',
    flag: '🇲🇨',
    laps: 78,
    circuitLengthKm: 3.337,
    turns: 19,
    characteristic: 'Travado, chassi ágil e qualificação vital',
    tireAbrasiveness: 2,
    downforceIdeal: 10,
    suspensionIdeal: 3,
  },
  {
    round: 9,
    name: 'Grande Prêmio da Espanha (Barcelona)',
    circuit: 'Circuito de Barcelona-Catalunha',
    country: 'Espanha',
    flag: '🇪🇸',
    laps: 66,
    circuitLengthKm: 4.657,
    turns: 14,
    characteristic: 'Referência aerodinâmica global',
    tireAbrasiveness: 8,
    downforceIdeal: 8,
    suspensionIdeal: 7,
  },
  {
    round: 10,
    name: 'Grande Prêmio da Áustria',
    circuit: 'Red Bull Ring, Spielberg',
    country: 'Áustria',
    flag: '🇦🇹',
    laps: 71,
    circuitLengthKm: 4.318,
    turns: 10,
    characteristic: 'Volta rápida em montanha com elevação',
    tireAbrasiveness: 6,
    downforceIdeal: 5,
    suspensionIdeal: 6,
  },
  {
    round: 11,
    name: 'Grande Prêmio da Grã-Bretanha',
    circuit: 'Circuito de Silverstone',
    country: 'Reino Unido',
    flag: '🇬🇧',
    laps: 52,
    circuitLengthKm: 5.891,
    turns: 18,
    characteristic: 'Curvas lendárias de alta velocidade',
    tireAbrasiveness: 9,
    downforceIdeal: 8,
    suspensionIdeal: 7,
  },
  {
    round: 12,
    name: 'Grande Prêmio da Bélgica',
    circuit: 'Circuito de Spa-Francorchamps',
    country: 'Bélgica',
    flag: '🇧🇪',
    laps: 44,
    circuitLengthKm: 7.004,
    turns: 19,
    characteristic: 'Eau Rouge, clima instável e potência 50/50',
    tireAbrasiveness: 7,
    downforceIdeal: 4,
    suspensionIdeal: 6,
  },
  {
    round: 13,
    name: 'Grande Prêmio da Hungria',
    circuit: 'Hungaroring, Budapeste',
    country: 'Hungria',
    flag: '🇭🇺',
    laps: 70,
    circuitLengthKm: 4.381,
    turns: 14,
    characteristic: 'Travado e quente, sem descanso',
    tireAbrasiveness: 6,
    downforceIdeal: 9,
    suspensionIdeal: 5,
  },
  {
    round: 14,
    name: 'Grande Prêmio dos Países Baixos',
    circuit: 'Circuito de Zandvoort',
    country: 'Holanda',
    flag: '🇳🇱',
    laps: 72,
    circuitLengthKm: 4.259,
    turns: 14,
    characteristic: 'Curvas inclinadas e vento costeiro',
    tireAbrasiveness: 7,
    downforceIdeal: 8,
    suspensionIdeal: 7,
  },
  {
    round: 15,
    name: 'Grande Prêmio da Itália',
    circuit: 'Autodromo Nazionale Monza',
    country: 'Itália',
    flag: '🇮🇹',
    laps: 53,
    circuitLengthKm: 5.793,
    turns: 11,
    characteristic: 'Templo da velocidade, baixo arrasto',
    tireAbrasiveness: 5,
    downforceIdeal: 1,
    suspensionIdeal: 8,
  },
  {
    round: 16,
    name: 'Grande Prêmio de Madri',
    circuit: 'Circuito Madring, Madrid',
    country: 'Espanha',
    flag: '🇪🇸',
    laps: 66,
    circuitLengthKm: 5.474,
    turns: 22,
    characteristic: 'Reta de 1,3 km, modo overtake favorável e trechos técnicos',
    tireAbrasiveness: 6,
    downforceIdeal: 6,
    suspensionIdeal: 6,
  },
  {
    round: 17,
    name: 'Grande Prêmio do Azerbaijão',
    circuit: 'Circuito de Rua de Baku',
    country: 'Azerbaijão',
    flag: '🇦🇿',
    laps: 51,
    circuitLengthKm: 6.003,
    turns: 20,
    characteristic: 'Reta gigantesca e castelo estreito',
    tireAbrasiveness: 4,
    downforceIdeal: 3,
    suspensionIdeal: 7,
  },
  {
    round: 18,
    name: 'Grande Prêmio de Singapura',
    circuit: 'Circuito de Rua de Marina Bay',
    country: 'Singapura',
    flag: '🇸🇬',
    laps: 62,
    circuitLengthKm: 4.94,
    turns: 19,
    characteristic: 'Noturna, umidade extrema e calor',
    tireAbrasiveness: 6,
    downforceIdeal: 10,
    suspensionIdeal: 4,
  },
  {
    round: 19,
    name: 'Grande Prêmio dos Estados Unidos',
    circuit: 'Circuito das Américas, Austin',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    laps: 56,
    circuitLengthKm: 5.513,
    turns: 20,
    characteristic: 'Subida na curva 1 e sequências velozes',
    tireAbrasiveness: 7,
    downforceIdeal: 7,
    suspensionIdeal: 6,
  },
  {
    round: 20,
    name: 'Grande Prêmio do México',
    circuit: 'Autódromo Hermanos Rodríguez, Cidade do México',
    country: 'México',
    flag: '🇲🇽',
    laps: 71,
    circuitLengthKm: 4.304,
    turns: 17,
    characteristic: 'Ar rarefeito a 2.200m de altitude',
    tireAbrasiveness: 5,
    downforceIdeal: 9,
    suspensionIdeal: 6,
  },
  {
    round: 21,
    name: 'Grande Prêmio de São Paulo',
    circuit: 'Autódromo José Carlos Pace, Interlagos',
    country: 'Brasil',
    flag: '🇧🇷',
    laps: 71,
    circuitLengthKm: 4.309,
    turns: 15,
    characteristic: 'Sentido anti-horário, fãs fervorosos e clima imprevisível',
    tireAbrasiveness: 7,
    downforceIdeal: 7,
    suspensionIdeal: 5,
  },
  {
    round: 22,
    name: 'Grande Prêmio de Las Vegas',
    circuit: 'Circuito da Las Vegas Strip',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    laps: 50,
    circuitLengthKm: 6.201,
    turns: 17,
    characteristic: 'Frio noturno na Strip a mais de 340 km/h',
    tireAbrasiveness: 4,
    downforceIdeal: 2,
    suspensionIdeal: 8,
  },
  {
    round: 23,
    name: 'Grande Prêmio do Catar',
    circuit: 'Circuito Internacional de Lusail',
    country: 'Catar',
    flag: '🇶🇦',
    laps: 57,
    circuitLengthKm: 5.419,
    turns: 16,
    characteristic: 'Sequência fluida de curvas rápidas sob holofotes',
    tireAbrasiveness: 9,
    downforceIdeal: 8,
    suspensionIdeal: 7,
  },
  {
    round: 24,
    name: 'Grande Prêmio de Abu Dhabi',
    circuit: 'Circuito de Yas Marina',
    country: 'Emirados Árabes Unidos',
    flag: '🇦🇪',
    laps: 58,
    circuitLengthKm: 5.281,
    turns: 16,
    characteristic: 'Final do campeonato ao entardecer',
    tireAbrasiveness: 6,
    downforceIdeal: 6,
    suspensionIdeal: 6,
  },
]

export const ENGINE_SUPPLIERS: EngineSupplierSpec[] = [
  {
    name: 'Ferrari',
    power: 92,
    reliability: 86,
    costAnnual: 32000000,
    description:
      'Unidade de potência Scuderia Ferrari 067/26 com recuperação elétrica agressiva e alto pico elétrico nas retas.',
    techBadge: '50/50 Turbo-Híbrido Maranello',
  },
  {
    name: 'Mercedes',
    power: 90,
    reliability: 93,
    costAnnual: 30000000,
    description:
      'Brixworth High Performance Powertrains. Referência em gerenciamento térmico, eficiência do MGU-K e consistência exemplar.',
    techBadge: '50/50 M17 E-Performance',
  },
  {
    name: 'Honda',
    power: 91,
    reliability: 88,
    costAnnual: 28000000,
    description:
      'Honda Racing Corporation (HRC). Entrega linear de torque híbrido e aerodinâmica compacta do pacote.',
    techBadge: 'HRC RA626H',
  },
  {
    name: 'Ford',
    power: 94,
    reliability: 82,
    costAnnual: 34000000,
    description:
      'Red Bull Ford Powertrains. Monstro de aceleração com software preditivo de deploy elétrico, porém maior taxa de desgaste.',
    techBadge: 'Ford Red Bull EcoBoost F1',
  },
  {
    name: 'Audi',
    power: 91,
    reliability: 85,
    costAnnual: 31000000,
    description:
      'Audi Formula Racing Powertrain (Neuburg an der Donau). Projeto 100% de fábrica da Audi para o regulamento 2026, com foco em alta eficiência térmica do MGU-K e integração direta com o chassi.',
    techBadge: 'Audi F1 Hybrid V6 2026',
  },
]

export interface OfficialGridTeam {
  key: string
  name: string
  color: string
  engine: EngineSupplierName
  strengthRating: number // Nota exata de 0.0 a 10.0 definida pelo usuário
  strengthVerdict: string // Parecer textual exato da hierarquia
  strength: number // 0-100 rating (strengthRating * 10)
  carLevel: number // 0-100 car base level
  budget: number
  historySummary: string
  currentSituation: string
  driver1: {
    name: string
    speed: number
    consistency: number
    rain: number
    defense: number
    nationality: string
    flag: string
    age: number
    salary: number
  }
  driver2: {
    name: string
    speed: number
    consistency: number
    rain: number
    defense: number
    nationality: string
    flag: string
    age: number
    salary: number
  }
  reserveDriver: {
    name: string
    speed: number
    consistency: number
    rain: number
    defense: number
    nationality: string
    flag: string
    age: number
    salary: number
  }
}

// As 12 equipes oficiais do grid da F1 2026 com 2 titulares confirmados + 1 piloto reserva real
// Ordenadas estritamente pela nota de força (0-10) fornecida pelo usuário:
// Mercedes 10.0 > Ferrari 9.1 > McLaren 8.8 > Red Bull 8.4 > Racing Bulls 6.3 > Alpine 6.1 >
// Audi 5.5 > Haas 4.8 > Williams 4.2 > Aston Martin 3.7 > Andretti 3.5 > Cadillac 3.0
export const OFFICIAL_GRID_TEAMS: OfficialGridTeam[] = [
  {
    key: 'mercedes',
    name: 'Mercedes-AMG Petronas',
    color: '#27F4D2',
    engine: 'Mercedes',
    strengthRating: 10.0,
    strengthVerdict: 'Referência absoluta',
    strength: 100,
    carLevel: 100,
    budget: 215000000,
    historySummary: '8 títulos consecutivos de construtores (2014-2021) na era híbrida original.',
    currentSituation:
      'Referência absoluta no novo regulamento com Russel e Kimi Antonelli acelerando o pacote mais completo do grid.',
    driver1: {
      name: 'George Russell',
      speed: 94,
      consistency: 93,
      rain: 90,
      defense: 91,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 28,
      salary: 32000000,
    },
    driver2: {
      name: 'Andrea Kimi Antonelli',
      speed: 91,
      consistency: 88,
      rain: 86,
      defense: 87,
      nationality: 'Itália',
      flag: '🇮🇹',
      age: 19,
      salary: 12000000,
    },
    reserveDriver: {
      name: 'Frederik Vesti',
      speed: 80,
      consistency: 81,
      rain: 79,
      defense: 78,
      nationality: 'Dinamarca',
      flag: '🇩🇰',
      age: 24,
      salary: 4000000,
    },
  },
  {
    key: 'ferrari',
    name: 'Scuderia Ferrari',
    color: '#E8002D',
    engine: 'Ferrari',
    strengthRating: 9.1,
    strengthVerdict: 'Principal adversária',
    strength: 91,
    carLevel: 91,
    budget: 210000000,
    historySummary:
      'A escuderia mais antiga e laureada da história da F1 (16 Construtores, 15 Pilotos).',
    currentSituation:
      'Principal adversária da Mercedes na disputa direta por vitórias. Superdupla de elite com Hamilton e Leclerc.',
    driver1: {
      name: 'Lewis Hamilton',
      speed: 94,
      consistency: 92,
      rain: 95,
      defense: 92,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 41,
      salary: 45000000,
    },
    driver2: {
      name: 'Charles Leclerc',
      speed: 95,
      consistency: 89,
      rain: 88,
      defense: 89,
      nationality: 'Mônaco',
      flag: '🇲🇨',
      age: 28,
      salary: 38000000,
    },
    reserveDriver: {
      name: 'Antonio Giovinazzi',
      speed: 80,
      consistency: 81,
      rain: 79,
      defense: 79,
      nationality: 'Itália',
      flag: '🇮🇹',
      age: 32,
      salary: 4500000,
    },
  },
  {
    key: 'mclaren',
    name: 'McLaren F1 Team',
    color: '#FF8000',
    engine: 'Mercedes',
    strengthRating: 8.8,
    strengthVerdict: 'Muito próxima da Ferrari',
    strength: 88,
    carLevel: 88,
    budget: 205000000,
    historySummary:
      '8 Mundiais de Construtores e 12 de Pilotos. Uma das marcas mais lendárias do automobilismo.',
    currentSituation:
      'Muito próxima da Ferrari, brigando por vitórias e pódios com a dupla consolidada Norris e Piastri.',
    driver1: {
      name: 'Lando Norris',
      speed: 93,
      consistency: 90,
      rain: 89,
      defense: 88,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 26,
      salary: 30000000,
    },
    driver2: {
      name: 'Oscar Piastri',
      speed: 92,
      consistency: 91,
      rain: 87,
      defense: 88,
      nationality: 'Austrália',
      flag: '🇦🇺',
      age: 25,
      salary: 28000000,
    },
    reserveDriver: {
      name: "Patricio O'Ward",
      speed: 81,
      consistency: 80,
      rain: 80,
      defense: 79,
      nationality: 'México',
      flag: '🇲🇽',
      age: 26,
      salary: 5000000,
    },
  },
  {
    key: 'redbull',
    name: 'Red Bull Racing',
    color: '#1E41FF',
    engine: 'Ford',
    strengthRating: 8.4,
    strengthVerdict: 'Já voltou à briga do pelotão da frente',
    strength: 84,
    carLevel: 84,
    budget: 200000000,
    historySummary: 'Hexacampeã mundial de construtores e heptacampeã de pilotos na era moderna.',
    currentSituation:
      'Já voltou à briga do pelotão da frente liderada pelo talento geracional de Max Verstappen e os novos motores Red Bull-Ford.',
    driver1: {
      name: 'Max Verstappen',
      speed: 96,
      consistency: 94,
      rain: 95,
      defense: 94,
      nationality: 'Holanda',
      flag: '🇳🇱',
      age: 28,
      salary: 52000000,
    },
    driver2: {
      name: 'Isack Hadjar',
      speed: 83,
      consistency: 80,
      rain: 80,
      defense: 78,
      nationality: 'França',
      flag: '🇫🇷',
      age: 21,
      salary: 6000000,
    },
    reserveDriver: {
      name: 'Ayumu Iwasa',
      speed: 79,
      consistency: 79,
      rain: 78,
      defense: 77,
      nationality: 'Japão',
      flag: '🇯🇵',
      age: 24,
      salary: 3500000,
    },
  },
  {
    key: 'racingbulls',
    name: 'Visa Cash App RB',
    color: '#6692FF',
    engine: 'Ford',
    strengthRating: 6.3,
    strengthVerdict: 'Melhor do segundo pelotão',
    strength: 63,
    carLevel: 63,
    budget: 160000000,
    historySummary:
      'Herdeira da Toro Rosso e Minardi em Faenza, famosa por forjar grandes campeões.',
    currentSituation:
      'Melhor do segundo pelotão. Consistente na zona de pontos com Liam Lawson e o jovem Arvid Lindblad.',
    driver1: {
      name: 'Liam Lawson',
      speed: 84,
      consistency: 83,
      rain: 82,
      defense: 83,
      nationality: 'Nova Zelândia',
      flag: '🇳🇿',
      age: 24,
      salary: 9000000,
    },
    driver2: {
      name: 'Arvid Lindblad',
      speed: 82,
      consistency: 80,
      rain: 79,
      defense: 78,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 18,
      salary: 4500000,
    },
    reserveDriver: {
      name: 'Jak Crawford',
      speed: 78,
      consistency: 77,
      rain: 76,
      defense: 76,
      nationality: 'Estados Unidos',
      flag: '🇺🇸',
      age: 20,
      salary: 3000000,
    },
  },
  {
    key: 'alpine',
    name: 'Alpine F1 Team',
    color: '#0093CC',
    engine: 'Mercedes',
    strengthRating: 6.1,
    strengthVerdict: 'Velocidade existe, consistência ainda não',
    strength: 61,
    carLevel: 61,
    budget: 155000000,
    historySummary:
      'Origens na Renault bicampeã em 2005-2006 com Alonso e equipe Benetton dos anos 90.',
    currentSituation:
      'Velocidade existe, consistência ainda não. Motor Mercedes garante picos de ritmo com Pierre Gasly e Franco Colapinto.',
    driver1: {
      name: 'Pierre Gasly',
      speed: 84,
      consistency: 81,
      rain: 82,
      defense: 82,
      nationality: 'França',
      flag: '🇫🇷',
      age: 30,
      salary: 16000000,
    },
    driver2: {
      name: 'Franco Colapinto',
      speed: 83,
      consistency: 79,
      rain: 79,
      defense: 79,
      nationality: 'Argentina',
      flag: '🇦🇷',
      age: 23,
      salary: 8500000,
    },
    reserveDriver: {
      name: 'Paul Aron',
      speed: 78,
      consistency: 77,
      rain: 76,
      defense: 75,
      nationality: 'Estônia',
      flag: '🇪🇪',
      age: 22,
      salary: 3500000,
    },
  },
  {
    key: 'audi',
    name: 'Audi F1 Team',
    color: '#FF2A00',
    engine: 'Audi',
    strengthRating: 5.5,
    strengthVerdict: 'Claramente evoluindo',
    strength: 55,
    carLevel: 55,
    budget: 165000000,
    historySummary:
      'A gigante alemã das 24h de Le Mans assumiu o controle integral da Sauber para sua estreia oficial.',
    currentSituation:
      'Claramente evoluindo. Mattia Binotto lidera reestruturação com Nico Hülkenberg e o talento brasileiro Gabriel Bortoleto.',
    driver1: {
      name: 'Nico Hülkenberg',
      speed: 83,
      consistency: 83,
      rain: 82,
      defense: 82,
      nationality: 'Alemanha',
      flag: '🇩🇪',
      age: 38,
      salary: 11000000,
    },
    driver2: {
      name: 'Gabriel Bortoleto',
      speed: 83,
      consistency: 82,
      rain: 83,
      defense: 80,
      nationality: 'Brasil',
      flag: '🇧🇷',
      age: 21,
      salary: 8000000,
    },
    reserveDriver: {
      name: 'Zane Maloney',
      speed: 78,
      consistency: 77,
      rain: 77,
      defense: 76,
      nationality: 'Barbados',
      flag: '🇧🇧',
      age: 22,
      salary: 3500000,
    },
  },
  {
    key: 'haas',
    name: 'Haas F1 Team',
    color: '#B6BABD',
    engine: 'Ferrari',
    strengthRating: 4.8,
    strengthVerdict: 'Começou melhor, mas praticamente parou de evoluir',
    strength: 48,
    carLevel: 48,
    budget: 140000000,
    historySummary:
      'Operação americana ágil em parceria reforçada com Ferrari e Toyota Gazoo Racing.',
    currentSituation:
      'Começou melhor, mas praticamente parou de evoluir. Esteban Ocon e Oliver Bearman lutam por pontos pontuais.',
    driver1: {
      name: 'Esteban Ocon',
      speed: 82,
      consistency: 81,
      rain: 82,
      defense: 83,
      nationality: 'França',
      flag: '🇫🇷',
      age: 29,
      salary: 12000000,
    },
    driver2: {
      name: 'Oliver Bearman',
      speed: 81,
      consistency: 78,
      rain: 78,
      defense: 78,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 20,
      salary: 6000000,
    },
    reserveDriver: {
      name: 'Ryo Hirakawa',
      speed: 77,
      consistency: 78,
      rain: 76,
      defense: 76,
      nationality: 'Japão',
      flag: '🇯🇵',
      age: 32,
      salary: 3500000,
    },
  },
  {
    key: 'williams',
    name: 'Williams Racing',
    color: '#64C4FF',
    engine: 'Mercedes',
    strengthRating: 4.2,
    strengthVerdict: 'Decepção grande em 2026',
    strength: 42,
    carLevel: 42,
    budget: 145000000,
    historySummary:
      '9 Mundiais de Construtores e 7 de Pilotos. Um dos nomes sagrados da história da categoria.',
    currentSituation:
      'Decepção grande em 2026. Mesmo com Carlos Sainz e Alexander Albon, o carro não encontrou ritmo no pelotão médio.',
    driver1: {
      name: 'Carlos Sainz',
      speed: 86,
      consistency: 85,
      rain: 82,
      defense: 83,
      nationality: 'Espanha',
      flag: '🇪🇸',
      age: 31,
      salary: 22000000,
    },
    driver2: {
      name: 'Alexander Albon',
      speed: 83,
      consistency: 82,
      rain: 79,
      defense: 80,
      nationality: 'Tailândia',
      flag: '🇹🇭',
      age: 29,
      salary: 13000000,
    },
    reserveDriver: {
      name: 'Luke Browning',
      speed: 77,
      consistency: 76,
      rain: 75,
      defense: 75,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 24,
      salary: 3200000,
    },
  },
  {
    key: 'astonmartin',
    name: 'Aston Martin Aramco',
    color: '#229971',
    engine: 'Honda',
    strengthRating: 3.7,
    strengthVerdict: 'Carro muito ruim, apesar dos sinais recentes de evolução',
    strength: 37,
    carLevel: 37,
    budget: 150000000,
    historySummary:
      'Tradição britânica operando em nova fábrica ultramoderna em Silverstone com túnel de vento próprio.',
    currentSituation:
      'Carro muito ruim, apesar dos sinais recentes de evolução. Em condições normais jamais briga por vitória ou pódio em 2026.',
    driver1: {
      name: 'Fernando Alonso',
      speed: 86,
      consistency: 85,
      rain: 89,
      defense: 86,
      nationality: 'Espanha',
      flag: '🇪🇸',
      age: 44,
      salary: 19000000,
    },
    driver2: {
      name: 'Lance Stroll',
      speed: 76,
      consistency: 75,
      rain: 78,
      defense: 75,
      nationality: 'Canadá',
      flag: '🇨🇦',
      age: 27,
      salary: 10000000,
    },
    reserveDriver: {
      name: 'Felipe Drugovich',
      speed: 80,
      consistency: 80,
      rain: 81,
      defense: 78,
      nationality: 'Brasil',
      flag: '🇧🇷',
      age: 25,
      salary: 5000000,
    },
  },
  {
    key: 'andretti',
    name: 'Andretti Global',
    color: '#002B49',
    engine: 'Honda',
    strengthRating: 3.5,
    strengthVerdict: 'Novata no grid',
    strength: 35,
    carLevel: 35,
    budget: 135000000,
    historySummary:
      'Tradicional equipe americana do automobilismo mundial completando o grid oficial de 12 escuderias e 24 carros em 2026.',
    currentSituation:
      'Novata no grid em 2026 sob comando de Michael Andretti, pagando pedágio de aprendizado com Colton Herta e Felipe Drugovich.',
    driver1: {
      name: 'Colton Herta',
      speed: 80,
      consistency: 77,
      rain: 78,
      defense: 78,
      nationality: 'Estados Unidos',
      flag: '🇺🇸',
      age: 25,
      salary: 8000000,
    },
    driver2: {
      name: 'Felipe Drugovich',
      speed: 80,
      consistency: 80,
      rain: 81,
      defense: 78,
      nationality: 'Brasil',
      flag: '🇧🇷',
      age: 25,
      salary: 7500000,
    },
    reserveDriver: {
      name: 'Pietro Fittipaldi',
      speed: 76,
      consistency: 77,
      rain: 76,
      defense: 75,
      nationality: 'Brasil',
      flag: '🇧🇷',
      age: 29,
      salary: 3500000,
    },
  },
  {
    key: 'cadillac',
    name: 'Cadillac F1 Team',
    color: '#D4AF37',
    engine: 'Ferrari',
    strengthRating: 3.0,
    strengthVerdict: 'Ainda é o parâmetro inferior',
    strength: 30,
    carLevel: 30,
    budget: 130000000,
    historySummary:
      'A marca de luxo e alta performance da GM estreia como a nova equipe do grid da Fórmula 1 em 2026.',
    currentSituation:
      'Ainda é o parâmetro inferior do grid da F1 2026. Estreante fechando a tabela, mesmo com os experientes Pérez e Bottas.',
    driver1: {
      name: 'Sergio Pérez',
      speed: 79,
      consistency: 80,
      rain: 78,
      defense: 80,
      nationality: 'México',
      flag: '🇲🇽',
      age: 36,
      salary: 12000000,
    },
    driver2: {
      name: 'Valtteri Bottas',
      speed: 79,
      consistency: 81,
      rain: 78,
      defense: 78,
      nationality: 'Finlândia',
      flag: '🇫🇮',
      age: 36,
      salary: 11000000,
    },
    reserveDriver: {
      name: 'Zhou Guanyu',
      speed: 76,
      consistency: 77,
      rain: 75,
      defense: 75,
      nationality: 'China',
      flag: '🇨🇳',
      age: 26,
      salary: 4000000,
    },
  },
]

export interface AICompetitor {
  id: string
  name: string
  color: string
  engine: EngineSupplierName
  strengthRating: number
  strengthVerdict: string
  carLevel: number
  strength: number
  driver1: {
    name: string
    speed: number
    consistency: number
    rain: number
    defense: number
    nationality: string
    flag: string
  }
  driver2: {
    name: string
    speed: number
    consistency: number
    rain: number
    defense: number
    nationality: string
    flag: string
  }
  reserveDriver: {
    name: string
    speed: number
    consistency: number
    rain: number
    defense: number
    nationality: string
    flag: string
  }
}

// Retorna as equipes IA rivais baseado se o jogador assumiu uma existente ou criou a 12ª
export function getAICompetitors(
  playerTeamKey?: string,
  isCustomTeam: boolean = true,
): AICompetitor[] {
  // O grid total possui 12 equipes (24 pilotos). Se o jogador criar uma equipe customizada,
  // pegamos 11 equipes oficiais rivais (para somar 11 + 1 = 12 equipes, 24 carros).
  // Se o jogador assumiu uma oficial (ex: ferrari), removemos a ferrari e sobram 11 oficiais (11 + 1 = 12 equipes).
  let list = OFFICIAL_GRID_TEAMS.filter((team) => {
    if (!isCustomTeam && playerTeamKey && team.key === playerTeamKey) {
      return false
    }
    return true
  })

  // Se o jogador é custom e a lista tem 12 equipes, removemos 1 oficial (a última) para manter exatos 22 carros rivais (22 + 2 do jogador = 24 pilotos)
  if (isCustomTeam && list.length > 11) {
    list = list.slice(0, 11)
  }

  return list.map((team) => ({
    id: `ai_${team.key}`,
    name: team.name,
    color: team.color,
    engine: team.engine,
    strengthRating: team.strengthRating,
    strengthVerdict: team.strengthVerdict,
    carLevel: team.carLevel,
    strength: team.strength,
    driver1: {
      name: team.driver1.name,
      speed: team.driver1.speed,
      consistency: team.driver1.consistency,
      rain: team.driver1.rain,
      defense: team.driver1.defense,
      nationality: team.driver1.nationality,
      flag: team.driver1.flag,
    },
    driver2: {
      name: team.driver2.name,
      speed: team.driver2.speed,
      consistency: team.driver2.consistency,
      rain: team.driver2.rain,
      defense: team.driver2.defense,
      nationality: team.driver2.nationality,
      flag: team.driver2.flag,
    },
    reserveDriver: {
      name: team.reserveDriver.name,
      speed: team.reserveDriver.speed,
      consistency: team.reserveDriver.consistency,
      rain: team.reserveDriver.rain,
      defense: team.reserveDriver.defense,
      nationality: team.reserveDriver.nationality,
      flag: team.reserveDriver.flag,
    },
  }))
}

// Fallback estático compatível para imports existentes
export const AI_GRID_TEAMS: AICompetitor[] = getAICompetitors()

export const AVAILABLE_MARKET_SPONSORS = [
  {
    name: 'Itaú Private Motorsport',
    slot: 'laterais' as const,
    slotLabel: 'Laterais / Sidepods (Master)',
    valuePerRound: 3600000,
    requirement: 'Top 3 construtores',
    minConstructorPos: 3,
    minTeamMorale: 75,
    rounds: 16,
    description: 'Cota Master nas laterais do carro cobrindo grande fatia das operações da equipe.',
  },
  {
    name: 'Petrobras Energy',
    slot: 'asa_traseira' as const,
    slotLabel: 'Asa Traseira',
    valuePerRound: 3450000,
    requirement: 'Top 4 construtores',
    minConstructorPos: 4,
    minTeamMorale: 0,
    rounds: 12,
    description: 'Investimento de alto impacto visual na asa traseira e combustíveis sintéticos.',
  },
  {
    name: 'Embraer Aerospace Tech',
    slot: 'bico' as const,
    slotLabel: 'Bico Dianteiro',
    valuePerRound: 3200000,
    requirement: 'Top 6 construtores',
    minConstructorPos: 6,
    minTeamMorale: 0,
    rounds: 10,
    description: 'Exposição aerodinâmica frontal no bico e cooperação tecnológica de CFD.',
  },
  {
    name: 'Claro 5G Telemetria',
    slot: 'halo' as const,
    slotLabel: 'Halo / Cockpit',
    valuePerRound: 3000000,
    requirement: 'Top 8 construtores',
    minConstructorPos: 8,
    minTeamMorale: 50,
    rounds: 12,
    description: 'Posição nobre no Halo da cabine com visibilidade constante em câmeras on-board.',
  },
  {
    name: 'Nubank Ultra',
    slot: 'macacao' as const,
    slotLabel: 'Macacão dos Pilotos',
    valuePerRound: 2850000,
    requirement: 'Moral da equipe acima de 65',
    minConstructorPos: 12,
    minTeamMorale: 65,
    rounds: 14,
    description: 'Destaque no peito e braços do macacão de corrida e entrevistas no paddock.',
  },
  {
    name: 'Vale Verde Sustentabilidade',
    slot: 'retrovisores' as const,
    slotLabel: 'Retrovisores / Endplates',
    valuePerRound: 2800000,
    requirement: 'Sem exigência de posição',
    minConstructorPos: 12,
    minTeamMorale: 0,
    rounds: 8,
    description: 'Compensação de carbono das viagens e presença lateral nos retrovisores e aletas.',
  },
]
