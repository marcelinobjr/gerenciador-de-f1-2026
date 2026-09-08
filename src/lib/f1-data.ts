import { GrandPrixInfo, EngineSupplierSpec } from '@/types/f1'

export const F1_2026_CALENDAR: GrandPrixInfo[] = [
  {
    round: 1,
    name: 'Grande Prêmio da Austrália',
    circuit: 'Circuito de Albert Park, Melbourne',
    country: 'Austrália',
    flag: '🇦🇺',
    laps: 58,
    circuitLengthKm: 5.278,
    characteristic: 'Misto rápido com frenagens fortes',
  },
  {
    round: 2,
    name: 'Grande Prêmio da China',
    circuit: 'Circuito Internacional de Xangai',
    country: 'China',
    flag: '🇨🇳',
    laps: 56,
    circuitLengthKm: 5.451,
    characteristic: 'Reta longa e curvas fechadas',
  },
  {
    round: 3,
    name: 'Grande Prêmio do Japão',
    circuit: 'Circuito de Suzuka',
    country: 'Japão',
    flag: '🇯🇵',
    laps: 53,
    circuitLengthKm: 5.807,
    characteristic: 'Alta pressão aerodinâmica em S',
  },
  {
    round: 4,
    name: 'Grande Prêmio do Bahrein',
    circuit: 'Circuito Internacional do Bahrein, Sakhir',
    country: 'Bahrein',
    flag: '🇧🇭',
    laps: 57,
    circuitLengthKm: 5.412,
    characteristic: 'Exigência de tração e frenagens',
  },
  {
    round: 5,
    name: 'Grande Prêmio da Arábia Saudita',
    circuit: 'Circuito de Corniche de Jeddah',
    country: 'Arábia Saudita',
    flag: '🇸🇦',
    laps: 50,
    circuitLengthKm: 6.174,
    characteristic: 'Circuito de rua de altíssima velocidade',
  },
  {
    round: 6,
    name: 'Grande Prêmio de Miami',
    circuit: 'Autódromo Internacional de Miami',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    laps: 57,
    circuitLengthKm: 5.412,
    characteristic: 'Misto de rua com longas retas',
  },
  {
    round: 7,
    name: 'Grande Prêmio da Emília-Romanha',
    circuit: 'Autodromo Enzo e Dino Ferrari, Imola',
    country: 'Itália',
    flag: '🇮🇹',
    laps: 63,
    circuitLengthKm: 4.909,
    characteristic: 'Técnico tradicional, poucas ultrapassagens',
  },
  {
    round: 8,
    name: 'Grande Prêmio de Mônaco',
    circuit: 'Circuito de Mônaco, Monte Carlo',
    country: 'Mônaco',
    flag: '🇲🇨',
    laps: 78,
    circuitLengthKm: 3.337,
    characteristic: 'Travado, chassi ágil e qualificação vital',
  },
  {
    round: 9,
    name: 'Grande Prêmio da Espanha',
    circuit: 'Circuito de Barcelona-Catalunha',
    country: 'Espanha',
    flag: '🇪🇸',
    laps: 66,
    circuitLengthKm: 4.657,
    characteristic: 'Referência aerodinâmica global',
  },
  {
    round: 10,
    name: 'Grande Prêmio do Canadá',
    circuit: 'Circuito Gilles Villeneuve, Montreal',
    country: 'Canadá',
    flag: '🇨🇦',
    laps: 70,
    circuitLengthKm: 4.361,
    characteristic: 'Stop-and-go com zebras altas',
  },
  {
    round: 11,
    name: 'Grande Prêmio da Áustria',
    circuit: 'Red Bull Ring, Spielberg',
    country: 'Áustria',
    flag: '🇦🇹',
    laps: 71,
    circuitLengthKm: 4.318,
    characteristic: 'Volta rápida em montanha com elevação',
  },
  {
    round: 12,
    name: 'Grande Prêmio da Grã-Bretanha',
    circuit: 'Circuito de Silverstone',
    country: 'Reino Unido',
    flag: '🇬🇧',
    laps: 52,
    circuitLengthKm: 5.891,
    characteristic: 'Curvas lendárias de alta velocidade',
  },
  {
    round: 13,
    name: 'Grande Prêmio da Bélgica',
    circuit: 'Circuito de Spa-Francorchamps',
    country: 'Bélgica',
    flag: '🇧🇪',
    laps: 44,
    circuitLengthKm: 7.004,
    characteristic: 'Eau Rouge, clima instável e potência 50/50',
  },
  {
    round: 14,
    name: 'Grande Prêmio da Hungria',
    circuit: 'Hungaroring, Budapeste',
    country: 'Hungria',
    flag: '🇭🇺',
    laps: 70,
    circuitLengthKm: 4.381,
    characteristic: 'Travado e quente, sem descanso',
  },
  {
    round: 15,
    name: 'Grande Prêmio dos Países Baixos',
    circuit: 'Circuito de Zandvoort',
    country: 'Holanda',
    flag: '🇳🇱',
    laps: 72,
    circuitLengthKm: 4.259,
    characteristic: 'Curvas inclinadas e vento costeiro',
  },
  {
    round: 16,
    name: 'Grande Prêmio da Itália',
    circuit: 'Autodromo Nazionale Monza',
    country: 'Itália',
    flag: '🇮🇹',
    laps: 53,
    circuitLengthKm: 5.793,
    characteristic: 'Templo da velocidade, baixo arrasto',
  },
  {
    round: 17,
    name: 'Grande Prêmio do Azerbaijão',
    circuit: 'Circuito de Rua de Baku',
    country: 'Azerbaijão',
    flag: '🇦🇿',
    laps: 51,
    circuitLengthKm: 6.003,
    characteristic: 'Reta gigantesca e castelo estreito',
  },
  {
    round: 18,
    name: 'Grande Prêmio de Singapura',
    circuit: 'Circuito de Rua de Marina Bay',
    country: 'Singapura',
    flag: '🇸🇬',
    laps: 62,
    circuitLengthKm: 4.94,
    characteristic: 'Noturna, umidade extrema e calor',
  },
  {
    round: 19,
    name: 'Grande Prêmio dos Estados Unidos',
    circuit: 'Circuito das Américas, Austin',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    laps: 56,
    circuitLengthKm: 5.513,
    characteristic: 'Subida na curva 1 e sequências velozes',
  },
  {
    round: 20,
    name: 'Grande Prêmio do México',
    circuit: 'Autódromo Hermanos Rodríguez, Cidade do México',
    country: 'México',
    flag: '🇲🇽',
    laps: 71,
    circuitLengthKm: 4.304,
    characteristic: 'Ar rarefeito a 2.200m de altitude',
  },
  {
    round: 21,
    name: 'Grande Prêmio de São Paulo',
    circuit: 'Autódromo José Carlos Pace, Interlagos',
    country: 'Brasil',
    flag: '🇧🇷',
    laps: 71,
    circuitLengthKm: 4.309,
    characteristic: 'Sentido anti-horário, fãs fervorosos e clima imprevisível',
  },
  {
    round: 22,
    name: 'Grande Prêmio de Las Vegas',
    circuit: 'Circuito da Las Vegas Strip',
    country: 'Estados Unidos',
    flag: '🇺🇸',
    laps: 50,
    circuitLengthKm: 6.201,
    characteristic: 'Frio noturno na Strip a mais de 340 km/h',
  },
  {
    round: 23,
    name: 'Grande Prêmio do Catar',
    circuit: 'Circuito Internacional de Lusail',
    country: 'Catar',
    flag: '🇶🇦',
    laps: 57,
    circuitLengthKm: 5.419,
    characteristic: 'Sequência fluida de curvas rápidas sob holofotes',
  },
  {
    round: 24,
    name: 'Grande Prêmio de Abu Dhabi',
    circuit: 'Circuito de Yas Marina',
    country: 'Emirados Árabes Unidos',
    flag: '🇦🇪',
    laps: 58,
    circuitLengthKm: 5.281,
    characteristic: 'Final do campeonato ao entardecer',
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
]

export interface OfficialGridTeam {
  key: string
  name: string
  color: string
  engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
  strength: number // 0-100 rating
  carLevel: number
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

// As 11 equipes oficiais do grid da F1 2026 com 2 titulares confirmados + 1 piloto reserva real
export const OFFICIAL_GRID_TEAMS: OfficialGridTeam[] = [
  {
    key: 'mclaren',
    name: 'McLaren F1 Team',
    color: '#FF8000',
    engine: 'Mercedes',
    strength: 92,
    carLevel: 92,
    budget: 175000000,
    historySummary:
      '8 Mundiais de Construtores e 12 de Pilotos. Uma das marcas mais lendárias do automobilismo.',
    currentSituation:
      'Campeã dominante e veloz. Vem de temporadas vitoriosas (2024-2025) com Norris e Piastri.',
    driver1: {
      name: 'Lando Norris',
      speed: 89,
      consistency: 86,
      rain: 84,
      defense: 82,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 26,
      salary: 30000000,
    },
    driver2: {
      name: 'Oscar Piastri',
      speed: 88,
      consistency: 87,
      rain: 82,
      defense: 81,
      nationality: 'Austrália',
      flag: '🇦🇺',
      age: 25,
      salary: 28000000,
    },
    reserveDriver: {
      name: "Patricio O'Ward",
      speed: 81,
      consistency: 80,
      rain: 79,
      defense: 78,
      nationality: 'México',
      flag: '🇲🇽',
      age: 26,
      salary: 5000000,
    },
  },
  {
    key: 'ferrari',
    name: 'Scuderia Ferrari',
    color: '#E8002D',
    engine: 'Ferrari',
    strength: 88,
    carLevel: 89,
    budget: 180000000,
    historySummary:
      'A escuderia mais antiga e laureada da história da F1 (16 Construtores, 15 Pilotos).',
    currentSituation:
      'Pressão máxima por títulos. Hamilton chegou a Maranello para formar uma superdupla com Leclerc.',
    driver1: {
      name: 'Lewis Hamilton',
      speed: 91,
      consistency: 88,
      rain: 87,
      defense: 84,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 41,
      salary: 45000000,
    },
    driver2: {
      name: 'Charles Leclerc',
      speed: 90,
      consistency: 85,
      rain: 82,
      defense: 84,
      nationality: 'Mônaco',
      flag: '🇲🇨',
      age: 28,
      salary: 35000000,
    },
    reserveDriver: {
      name: 'Antonio Giovinazzi',
      speed: 79,
      consistency: 81,
      rain: 78,
      defense: 79,
      nationality: 'Itália',
      flag: '🇮🇹',
      age: 32,
      salary: 4500000,
    },
  },
  {
    key: 'redbull',
    name: 'Red Bull Racing',
    color: '#1E41FF',
    engine: 'Ford',
    strength: 87,
    carLevel: 88,
    budget: 180000000,
    historySummary: 'Hexacampeã mundial de construtores e heptacampeã de pilotos na era moderna.',
    currentSituation:
      'Revolução técnica com os novos motores Red Bull-Ford, liderança de Max Verstappen e promoção de Isack Hadjar.',
    driver1: {
      name: 'Max Verstappen',
      speed: 95,
      consistency: 91,
      rain: 88,
      defense: 90,
      nationality: 'Holanda',
      flag: '🇳🇱',
      age: 28,
      salary: 50000000,
    },
    driver2: {
      name: 'Isack Hadjar',
      speed: 82,
      consistency: 79,
      rain: 78,
      defense: 76,
      nationality: 'França',
      flag: '🇫🇷',
      age: 21,
      salary: 5000000,
    },
    reserveDriver: {
      name: 'Ayumu Iwasa',
      speed: 79,
      consistency: 78,
      rain: 77,
      defense: 76,
      nationality: 'Japão',
      flag: '🇯🇵',
      age: 24,
      salary: 3500000,
    },
  },
  {
    key: 'mercedes',
    name: 'Mercedes-AMG Petronas',
    color: '#27F4D2',
    engine: 'Mercedes',
    strength: 85,
    carLevel: 86,
    budget: 175000000,
    historySummary: '8 títulos consecutivos de construtores (2014-2021) na era híbrida original.',
    currentSituation:
      'Nova era liderada por George Russell e a promessa italiana Andrea Kimi Antonelli sob Toto Wolff.',
    driver1: {
      name: 'George Russell',
      speed: 87,
      consistency: 86,
      rain: 82,
      defense: 84,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 28,
      salary: 26000000,
    },
    driver2: {
      name: 'Andrea Kimi Antonelli',
      speed: 85,
      consistency: 80,
      rain: 79,
      defense: 78,
      nationality: 'Itália',
      flag: '🇮🇹',
      age: 19,
      salary: 9000000,
    },
    reserveDriver: {
      name: 'Frederik Vesti',
      speed: 79,
      consistency: 80,
      rain: 78,
      defense: 77,
      nationality: 'Dinamarca',
      flag: '🇩🇰',
      age: 24,
      salary: 4000000,
    },
  },
  {
    key: 'astonmartin',
    name: 'Aston Martin Aramco',
    color: '#229971',
    engine: 'Honda',
    strength: 80,
    carLevel: 82,
    budget: 160000000,
    historySummary:
      'Tradição britânica operando em nova fábrica ultramoderna em Silverstone com túnel de vento próprio.',
    currentSituation:
      'Equipe oficial de fábrica da Honda em 2026, com Fernando Alonso buscando mais glórias e Drugovich como reserva.',
    driver1: {
      name: 'Fernando Alonso',
      speed: 88,
      consistency: 86,
      rain: 90,
      defense: 87,
      nationality: 'Espanha',
      flag: '🇪🇸',
      age: 44,
      salary: 20000000,
    },
    driver2: {
      name: 'Lance Stroll',
      speed: 78,
      consistency: 76,
      rain: 81,
      defense: 76,
      nationality: 'Canadá',
      flag: '🇨🇦',
      age: 27,
      salary: 10000000,
    },
    reserveDriver: {
      name: 'Felipe Drugovich',
      speed: 81,
      consistency: 82,
      rain: 83,
      defense: 78,
      nationality: 'Brasil',
      flag: '🇧🇷',
      age: 25,
      salary: 5000000,
    },
  },
  {
    key: 'williams',
    name: 'Williams Racing',
    color: '#64C4FF',
    engine: 'Mercedes',
    strength: 77,
    carLevel: 79,
    budget: 150000000,
    historySummary:
      '9 Mundiais de Construtores e 7 de Pilotos. Um dos nomes sagrados da história da categoria.',
    currentSituation:
      'Forte ascensão com James Vowles, chegada de peso de Carlos Sainz e Alexander Albon em grande fase.',
    driver1: {
      name: 'Carlos Sainz',
      speed: 86,
      consistency: 85,
      rain: 81,
      defense: 83,
      nationality: 'Espanha',
      flag: '🇪🇸',
      age: 31,
      salary: 24000000,
    },
    driver2: {
      name: 'Alexander Albon',
      speed: 84,
      consistency: 83,
      rain: 79,
      defense: 81,
      nationality: 'Tailândia',
      flag: '🇹🇭',
      age: 29,
      salary: 14000000,
    },
    reserveDriver: {
      name: 'Luke Browning',
      speed: 78,
      consistency: 77,
      rain: 76,
      defense: 75,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 24,
      salary: 3200000,
    },
  },
  {
    key: 'racingbulls',
    name: 'Visa Cash App RB',
    color: '#6692FF',
    engine: 'Ford',
    strength: 73,
    carLevel: 76,
    budget: 135000000,
    historySummary:
      'Herdeira da Toro Rosso e Minardi em Faenza, famosa por forjar grandes campeões.',
    currentSituation:
      'Equipe irmã da Red Bull com Liam Lawson liderando o desenvolvimento ao lado da jovem revelação Arvid Lindblad.',
    driver1: {
      name: 'Liam Lawson',
      speed: 82,
      consistency: 80,
      rain: 78,
      defense: 80,
      nationality: 'Nova Zelândia',
      flag: '🇳🇿',
      age: 24,
      salary: 8000000,
    },
    driver2: {
      name: 'Arvid Lindblad',
      speed: 81,
      consistency: 78,
      rain: 77,
      defense: 75,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 18,
      salary: 4000000,
    },
    reserveDriver: {
      name: 'Jak Crawford',
      speed: 78,
      consistency: 77,
      rain: 75,
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
    strength: 72,
    carLevel: 75,
    budget: 140000000,
    historySummary:
      'Origens na Renault campeã em 2005-2006 com Alonso e equipe Benetton dos anos 90.',
    currentSituation:
      'Adotando motores Mercedes cliente e escalação com Pierre Gasly e o promissor Franco Colapinto.',
    driver1: {
      name: 'Pierre Gasly',
      speed: 83,
      consistency: 82,
      rain: 81,
      defense: 81,
      nationality: 'França',
      flag: '🇫🇷',
      age: 30,
      salary: 15000000,
    },
    driver2: {
      name: 'Franco Colapinto',
      speed: 82,
      consistency: 79,
      rain: 77,
      defense: 77,
      nationality: 'Argentina',
      flag: '🇦🇷',
      age: 23,
      salary: 8000000,
    },
    reserveDriver: {
      name: 'Paul Aron',
      speed: 78,
      consistency: 77,
      rain: 75,
      defense: 74,
      nationality: 'Estônia',
      flag: '🇪🇪',
      age: 22,
      salary: 3500000,
    },
  },
  {
    key: 'haas',
    name: 'Haas F1 Team',
    color: '#B6BABD',
    engine: 'Ferrari',
    strength: 71,
    carLevel: 75,
    budget: 130000000,
    historySummary:
      'Operação americana ágil em parceria reforçada com Ferrari e Toyota Gazoo Racing.',
    currentSituation:
      'Comandada por Ayao Komatsu com a experiente dupla Esteban Ocon e Oliver Bearman.',
    driver1: {
      name: 'Esteban Ocon',
      speed: 83,
      consistency: 82,
      rain: 83,
      defense: 84,
      nationality: 'França',
      flag: '🇫🇷',
      age: 29,
      salary: 12000000,
    },
    driver2: {
      name: 'Oliver Bearman',
      speed: 81,
      consistency: 79,
      rain: 78,
      defense: 78,
      nationality: 'Reino Unido',
      flag: '🇬🇧',
      age: 20,
      salary: 6000000,
    },
    reserveDriver: {
      name: 'Ryo Hirakawa',
      speed: 78,
      consistency: 79,
      rain: 77,
      defense: 77,
      nationality: 'Japão',
      flag: '🇯🇵',
      age: 32,
      salary: 3500000,
    },
  },
  {
    key: 'audi',
    name: 'Audi F1 Team',
    color: '#FF2A00',
    engine: 'Ferrari',
    strength: 70,
    carLevel: 74,
    budget: 155000000,
    historySummary:
      'A gigante alemã das 24h de Le Mans assumiu o controle integral da Sauber para sua estreia oficial.',
    currentSituation:
      'Primeiro ano histórico da Audi na F1 sob liderança de Mattia Binotto, Nico Hülkenberg e o brasileiro Gabriel Bortoleto.',
    driver1: {
      name: 'Nico Hülkenberg',
      speed: 83,
      consistency: 84,
      rain: 82,
      defense: 82,
      nationality: 'Alemanha',
      flag: '🇩🇪',
      age: 38,
      salary: 10000000,
    },
    driver2: {
      name: 'Gabriel Bortoleto',
      speed: 83,
      consistency: 81,
      rain: 83,
      defense: 79,
      nationality: 'Brasil',
      flag: '🇧🇷',
      age: 21,
      salary: 7000000,
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
    key: 'cadillac',
    name: 'Cadillac F1 Team',
    color: '#D4AF37',
    engine: 'Ferrari',
    strength: 67,
    carLevel: 71,
    budget: 140000000,
    historySummary:
      'A marca de luxo e alta performance da GM estreia como a 11ª equipe do grid da Fórmula 1 em 2026.',
    currentSituation:
      'Estreante com grande investimento e a experiente dupla Sergio Pérez e Valtteri Bottas, com Zhou Guanyu na reserva.',
    driver1: {
      name: 'Sergio Pérez',
      speed: 82,
      consistency: 83,
      rain: 80,
      defense: 83,
      nationality: 'México',
      flag: '🇲🇽',
      age: 36,
      salary: 14000000,
    },
    driver2: {
      name: 'Valtteri Bottas',
      speed: 82,
      consistency: 84,
      rain: 80,
      defense: 81,
      nationality: 'Finlândia',
      flag: '🇫🇮',
      age: 36,
      salary: 13000000,
    },
    reserveDriver: {
      name: 'Zhou Guanyu',
      speed: 79,
      consistency: 80,
      rain: 77,
      defense: 78,
      nationality: 'China',
      flag: '🇨🇳',
      age: 26,
      salary: 5000000,
    },
  },
]

export interface AICompetitor {
  id: string
  name: string
  color: string
  engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
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
  return OFFICIAL_GRID_TEAMS.filter((team) => {
    // Se o jogador assumiu uma equipe oficial existente (ex: ferrari), remove ela da IA
    if (!isCustomTeam && playerTeamKey && team.key === playerTeamKey) {
      return false
    }
    return true
  }).map((team) => ({
    id: `ai_${team.key}`,
    name: team.name,
    color: team.color,
    engine: team.engine,
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
    name: 'Petrobras Energy',
    valuePerRound: 28000000,
    requirement: 'Top 6 construtores',
    minConstructorPos: 6,
    minTeamMorale: 0,
    rounds: 12,
    description:
      'Investimento de grande porte focado em combustíveis sintéticos 100% sustentáveis.',
  },
  {
    name: 'Embraer Aerospace Tech',
    valuePerRound: 24000000,
    requirement: 'Top 8 construtores',
    minConstructorPos: 8,
    minTeamMorale: 0,
    rounds: 10,
    description: 'Parceria aeroespacial focada na telemetria de asas ativas e túnel de vento.',
  },
  {
    name: 'Nubank Ultra',
    valuePerRound: 22000000,
    requirement: 'Moral da equipe acima de 65',
    minConstructorPos: 11,
    minTeamMorale: 65,
    rounds: 14,
    description: 'Patrocinador jovem focado na presença digital e engajamento com os fãs.',
  },
  {
    name: 'Vale Verde Sustentabilidade',
    valuePerRound: 18000000,
    requirement: 'Sem exigência de posição',
    minConstructorPos: 11,
    minTeamMorale: 0,
    rounds: 8,
    description: 'Compensação de carbono das viagens e suporte à matriz elétrica 350kW.',
  },
  {
    name: 'Itaú Private Motorsport',
    valuePerRound: 35000000,
    requirement: 'Top 3 construtores',
    minConstructorPos: 3,
    minTeamMorale: 75,
    rounds: 16,
    description: 'Patrocínio master de alta exigência esportiva e bônus expressivos.',
  },
  {
    name: 'Claro 5G Telemetria',
    valuePerRound: 19500000,
    requirement: 'Top 7 construtores',
    minConstructorPos: 7,
    minTeamMorale: 50,
    rounds: 12,
    description: 'Conectividade de borda em tempo real entre a garagem e a fábrica.',
  },
]
