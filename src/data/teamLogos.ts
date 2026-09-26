/**
 * Catálogo canônico de Logos Reais e Crests de Equipes da F1.
 * EMBLEMAS-02 — Resolução de identidade visual de construtores.
 *
 * Mapeia as 29 equipes canônicas da F1 (12 do grid oficial 2026 + 16 históricas/alternativas + custom).
 * Para equipes reais com vetores/logos locais (src/assets/logos/*.svg), logoUrl aponta para o asset local.
 * Para equipes fictícias ou sem logo vetorial direto, gera crest SVG procedural baseado nas cores e sigla oficiais.
 * Fallback honesto: string desconhecida -> sigla textual simples, sem inventar escudo nem visual falso.
 */

// Importação estática dos assets locais de logos vetoriais (SVG locais, zero hotlink)
import ferrariLogo from '@/assets/logos/ferrari.svg'
import mercedesLogo from '@/assets/logos/mercedes.svg'
import mclarenLogo from '@/assets/logos/mclaren.svg'
import redbullLogo from '@/assets/logos/redbull.svg'
import astonmartinLogo from '@/assets/logos/astonmartin.svg'
import alpineLogo from '@/assets/logos/alpine.svg'
import williamsLogo from '@/assets/logos/williams.svg'
import haasLogo from '@/assets/logos/haas.svg'
import audiLogo from '@/assets/logos/audi.svg'
import racingbullsLogo from '@/assets/logos/racingbulls.svg'
import cadillacLogo from '@/assets/logos/cadillac.svg'
import andrettiLogo from '@/assets/logos/andretti.svg'
import porscheLogo from '@/assets/logos/porsche.svg'
import hondaLogo from '@/assets/logos/honda.svg'
import lamborghiniLogo from '@/assets/logos/lamborghini.svg'
import alfaromeoLogo from '@/assets/logos/alfaromeo.svg'
import lotusLogo from '@/assets/logos/lotus.svg'
import renaultLogo from '@/assets/logos/renault.svg'
import toyotaLogo from '@/assets/logos/toyota.svg'
import sauberLogo from '@/assets/logos/sauber.svg'

export interface TeamCrestDef {
  primaryColor: string
  secondaryColor: string
  acronym: string
  textColor?: string
}

export interface TeamLogoEntry {
  teamId: string
  displayName: string
  logoUrl?: string
  crest: TeamCrestDef
  aliases?: string[]
}

/**
 * Catálogo canônico único com todas as 29 equipes do universo Apex GP Manager
 */
export const TEAM_LOGOS: Record<string, TeamLogoEntry> = {
  // ----------------------------------------------------
  // GRID OFICIAL 2026 (12 Equipes Consagradas)
  // ----------------------------------------------------
  ferrari: {
    teamId: 'ferrari',
    displayName: 'Scuderia Ferrari',
    logoUrl: ferrariLogo,
    crest: {
      primaryColor: '#DC0000',
      secondaryColor: '#FFF200',
      acronym: 'FER',
      textColor: '#FFFFFF',
    },
    aliases: ['scuderia_ferrari', 'scuderia ferrari', 'ferrari hp', 'scuderia ferrari hp'],
  },
  mercedes: {
    teamId: 'mercedes',
    displayName: 'Mercedes-AMG Petronas',
    logoUrl: mercedesLogo,
    crest: {
      primaryColor: '#00D2BE',
      secondaryColor: '#000000',
      acronym: 'MER',
      textColor: '#0F172A',
    },
    aliases: [
      'mercedes-amg',
      'mercedes amg',
      'mercedes_amg',
      'mercedes-amg petronas',
      'mercedes f1',
    ],
  },
  mclaren: {
    teamId: 'mclaren',
    displayName: 'McLaren Formula 1 Team',
    logoUrl: mclarenLogo,
    crest: {
      primaryColor: '#FF8000',
      secondaryColor: '#000000',
      acronym: 'MCL',
      textColor: '#FFFFFF',
    },
    aliases: ['mclaren f1', 'mclaren f1 team', 'mclaren racing', 'mclaren formula 1'],
  },
  redbull: {
    teamId: 'redbull',
    displayName: 'Oracle Red Bull Racing',
    logoUrl: redbullLogo,
    crest: {
      primaryColor: '#1E2A5A',
      secondaryColor: '#E10600',
      acronym: 'RBR',
      textColor: '#FFFFFF',
    },
    aliases: ['red bull', 'red bull racing', 'oracle red bull racing', 'rbr'],
  },
  astonmartin: {
    teamId: 'astonmartin',
    displayName: 'Aston Martin Aramco Formula One Team',
    logoUrl: astonmartinLogo,
    crest: {
      primaryColor: '#00594F',
      secondaryColor: '#CEDC00',
      acronym: 'AMR',
      textColor: '#FFFFFF',
    },
    aliases: ['aston martin', 'aston martin aramco', 'amr', 'aston martin f1'],
  },
  alpine: {
    teamId: 'alpine',
    displayName: 'BWT Alpine F1 Team',
    logoUrl: alpineLogo,
    crest: {
      primaryColor: '#0090FF',
      secondaryColor: '#FD4BC7',
      acronym: 'ALP',
      textColor: '#FFFFFF',
    },
    aliases: ['alpine f1', 'alpine f1 team', 'bwt alpine', 'bwt alpine f1 team'],
  },
  williams: {
    teamId: 'williams',
    displayName: 'Williams Racing',
    logoUrl: williamsLogo,
    crest: {
      primaryColor: '#041E42',
      secondaryColor: '#00A0DE',
      acronym: 'WIL',
      textColor: '#FFFFFF',
    },
    aliases: ['williams racing', 'williams f1', 'williams f1 team'],
  },
  haas: {
    teamId: 'haas',
    displayName: 'MoneyGram Haas F1 Team',
    logoUrl: haasLogo,
    crest: {
      primaryColor: '#E10600',
      secondaryColor: '#FFFFFF',
      acronym: 'HAA',
      textColor: '#FFFFFF',
    },
    aliases: ['haas f1', 'haas f1 team', 'moneygram haas', 'moneygram haas f1 team'],
  },
  audi: {
    teamId: 'audi',
    displayName: 'Audi Revolut F1 Team',
    logoUrl: audiLogo,
    crest: {
      primaryColor: '#00E701',
      secondaryColor: '#0F172A',
      acronym: 'AUD',
      textColor: '#0F172A',
    },
    aliases: ['audi f1', 'audi f1 team', 'audi revolut', 'audi revolut f1 team', 'audi sport'],
  },
  racingbulls: {
    teamId: 'racingbulls',
    displayName: 'Visa Cash App RB',
    logoUrl: racingbullsLogo,
    crest: {
      primaryColor: '#6692FF',
      secondaryColor: '#FFFFFF',
      acronym: 'RB',
      textColor: '#FFFFFF',
    },
    aliases: ['rb', 'vcarb', 'visa cash app rb', 'racing bulls', 'toro rosso'],
  },
  andretti: {
    teamId: 'andretti',
    displayName: 'Andretti Global',
    logoUrl: andrettiLogo,
    crest: {
      primaryColor: '#0A1E3F',
      secondaryColor: '#E10600',
      acronym: 'AND',
      textColor: '#FFFFFF',
    },
    aliases: ['andretti global', 'andretti f1', 'andretti cadillac'],
  },
  cadillac: {
    teamId: 'cadillac',
    displayName: 'Cadillac Formula 1 Team',
    logoUrl: cadillacLogo,
    crest: {
      primaryColor: '#111111',
      secondaryColor: '#D4AF37',
      acronym: 'CAD',
      textColor: '#D4AF37',
    },
    aliases: ['cadillac f1', 'cadillac f1 team', 'gm cadillac', 'cadillac racing'],
  },

  // ----------------------------------------------------
  // DEMAIS EQUIPES CANÔNICAS (HISTÓRICAS E ADICIONAIS)
  // ----------------------------------------------------
  porsche: {
    teamId: 'porsche',
    displayName: 'TAG Heuer Porsche Motorsport',
    logoUrl: porscheLogo,
    crest: {
      primaryColor: '#B12B00',
      secondaryColor: '#D4AF37',
      acronym: 'POR',
      textColor: '#FFFFFF',
    },
    aliases: ['porsche motorsport', 'tag heuer porsche', 'porsche f1'],
  },
  honda: {
    teamId: 'honda',
    displayName: 'Honda Racing F1 Team',
    logoUrl: hondaLogo,
    crest: {
      primaryColor: '#CC0000',
      secondaryColor: '#FFFFFF',
      acronym: 'HON',
      textColor: '#FFFFFF',
    },
    aliases: ['honda racing', 'honda f1', 'hrc', 'honda hrc'],
  },
  lamborghini: {
    teamId: 'lamborghini',
    displayName: 'Lamborghini Squadra Corse',
    logoUrl: lamborghiniLogo,
    crest: {
      primaryColor: '#111111',
      secondaryColor: '#D4AF37',
      acronym: 'LAM',
      textColor: '#D4AF37',
    },
    aliases: ['lamborguini', 'lamborghini sc', 'squadra corse'],
  },
  byd: {
    teamId: 'byd',
    displayName: 'BYD Formula Racing',
    // Equipe contemporânea/fictícia na F1 -> crest gerado
    crest: {
      primaryColor: '#00529B',
      secondaryColor: '#E3000F',
      acronym: 'BYD',
      textColor: '#FFFFFF',
    },
    aliases: ['byd racing', 'byd formula', 'bydf1'],
  },
  penske: {
    teamId: 'penske',
    displayName: 'Team Penske F1',
    // Crest gerado (Team Penske vermelho/branco)
    crest: {
      primaryColor: '#DD0000',
      secondaryColor: '#FFFFFF',
      acronym: 'PEN',
      textColor: '#FFFFFF',
    },
    aliases: ['team penske', 'penske racing'],
  },
  lotus: {
    teamId: 'lotus',
    displayName: 'Classic Team Lotus',
    logoUrl: lotusLogo,
    crest: {
      primaryColor: '#004225',
      secondaryColor: '#F4B223',
      acronym: 'LOT',
      textColor: '#F4B223',
    },
    aliases: ['team lotus', 'lotus f1', 'classic lotus'],
  },
  toyota: {
    teamId: 'toyota',
    displayName: 'Toyota Gazoo Racing F1',
    logoUrl: toyotaLogo,
    crest: {
      primaryColor: '#CC0000',
      secondaryColor: '#111111',
      acronym: 'TOY',
      textColor: '#FFFFFF',
    },
    aliases: ['toyota racing', 'panasonic toyota', 'toyota gazoo', 'gazoo racing'],
  },
  benetton: {
    teamId: 'benetton',
    displayName: 'Benetton Formula',
    // Crest gerado (Verde e Azul Benetton)
    crest: {
      primaryColor: '#00965E',
      secondaryColor: '#0085CA',
      acronym: 'BEN',
      textColor: '#FFFFFF',
    },
    aliases: ['benetton formula', 'benetton f1'],
  },
  copersucar: {
    teamId: 'copersucar',
    displayName: 'Copersucar-Fittipaldi',
    // Crest gerado (Verde e Amarelo brasileiro)
    crest: {
      primaryColor: '#009B3A',
      secondaryColor: '#FEDF00',
      acronym: 'COP',
      textColor: '#FFFFFF',
    },
    aliases: ['copersucar fittipaldi', 'copersucar racing'],
  },
  alfaromeo: {
    teamId: 'alfaromeo',
    displayName: 'Alfa Romeo F1 Team',
    logoUrl: alfaromeoLogo,
    crest: {
      primaryColor: '#981E32',
      secondaryColor: '#0A3871',
      acronym: 'ALF',
      textColor: '#FFFFFF',
    },
    aliases: ['alfa romeo', 'alfa romeo racing', 'alfa'],
  },
  alphatauri: {
    teamId: 'alphatauri',
    displayName: 'Scuderia AlphaTauri',
    // Crest gerado (Azul Marinho e Branco)
    crest: {
      primaryColor: '#021B35',
      secondaryColor: '#FFFFFF',
      acronym: 'AT',
      textColor: '#FFFFFF',
    },
    aliases: ['alpha tauri', 'scuderia alphatauri'],
  },
  fittipaldi: {
    teamId: 'fittipaldi',
    displayName: 'Fittipaldi Automotive',
    // Crest gerado (Amarelo e Preto)
    crest: {
      primaryColor: '#FFD700',
      secondaryColor: '#111111',
      acronym: 'FIT',
      textColor: '#111111',
    },
    aliases: ['fittipaldi automotive', 'fittipaldi f1'],
  },
  jordan: {
    teamId: 'jordan',
    displayName: 'Jordan Grand Prix',
    // Crest gerado (Amarelo vibrante 1999 + Preto)
    crest: {
      primaryColor: '#FFE500',
      secondaryColor: '#111111',
      acronym: 'JOR',
      textColor: '#111111',
    },
    aliases: ['jordan grand prix', 'jordan f1'],
  },
  renault: {
    teamId: 'renault',
    displayName: 'Renault F1 Team',
    logoUrl: renaultLogo,
    crest: {
      primaryColor: '#FFD800',
      secondaryColor: '#111111',
      acronym: 'REN',
      textColor: '#111111',
    },
    aliases: ['renault f1', 'renault dp world', 'renaut'],
  },
  sauber: {
    teamId: 'sauber',
    displayName: 'Stake F1 Team Kick Sauber',
    logoUrl: sauberLogo,
    crest: {
      primaryColor: '#00E701',
      secondaryColor: '#111111',
      acronym: 'SAU',
      textColor: '#111111',
    },
    aliases: ['stake f1', 'kick sauber', 'sauber motorsport'],
  },
  toleman: {
    teamId: 'toleman',
    displayName: 'Toleman Motorsport',
    // Crest gerado (Azul Royal e Branco)
    crest: {
      primaryColor: '#002B7F',
      secondaryColor: '#FFFFFF',
      acronym: 'TOL',
      textColor: '#FFFFFF',
    },
    aliases: ['tolleman', 'toleman motorsport', 'tg184'],
  },

  // ----------------------------------------------------
  // EQUIPE PADRÃO DO JOGADOR / CUSTOMIZADA
  // ----------------------------------------------------
  custom: {
    teamId: 'custom',
    displayName: 'Escuderia Apex Brasil',
    // Crest gerado dinâmico
    crest: {
      primaryColor: '#E10600',
      secondaryColor: '#0F172A',
      acronym: 'APX',
      textColor: '#FFFFFF',
    },
    aliases: ['sua escuderia', 'minha equipe', 'escuderia brasil', 'apex gp', 'player_team'],
  },
}

/**
 * Normaliza strings e identificadores de equipe para busca determinística
 */
export function normalizeTeamKey(input: string | null | undefined): string {
  if (!input) return ''
  const clean = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/^ai_/, '')
    .replace(/^team_/, '')
    .replace(/[-\s_]+/g, '')

  // 1. Direct match on normalized keys
  for (const key of Object.keys(TEAM_LOGOS)) {
    const normKey = key.replace(/[-\s_]+/g, '')
    if (clean === normKey) return key
  }

  // 2. Alias match
  for (const [key, entry] of Object.entries(TEAM_LOGOS)) {
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        const normAlias = alias
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[-\s_]+/g, '')
        if (clean === normAlias || clean.includes(normAlias) || normAlias.includes(clean)) {
          return key
        }
      }
    }
  }

  // 3. Substring / displayName match
  for (const [key, entry] of Object.entries(TEAM_LOGOS)) {
    const normDisplay = entry.displayName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-\s_]+/g, '')
    if (clean.includes(normDisplay) || normDisplay.includes(clean)) {
      return key
    }
  }

  // 4. Fallback: chave original limpa
  return clean
}

export interface ResolvedTeamVisual {
  type: 'logo' | 'crest' | 'fallback'
  logoUrl?: string
  crest?: TeamCrestDef
  teamKey: string
  displayName: string
  fallbackText: string
}

/**
 * Resolver canônico de emblema/logo de equipe.
 * Retorna tipo 'logo' quando houver logoUrl local,
 * 'crest' para equipes canônicas sem logo vetorial direto,
 * ou 'fallback' para IDs desconhecidos/corrompidos (sem inventar escudo falso).
 */
export function resolveTeamLogo(teamCodeOrName: string | null | undefined): ResolvedTeamVisual {
  if (!teamCodeOrName || !teamCodeOrName.trim()) {
    return {
      type: 'fallback',
      teamKey: '',
      displayName: 'Equipe',
      fallbackText: '—',
    }
  }

  const raw = teamCodeOrName.trim()
  const key = normalizeTeamKey(raw)
  const entry = TEAM_LOGOS[key]

  if (entry) {
    if (entry.logoUrl) {
      return {
        type: 'logo',
        logoUrl: entry.logoUrl,
        crest: entry.crest,
        teamKey: entry.teamId,
        displayName: entry.displayName,
        fallbackText: entry.crest.acronym,
      }
    }
    return {
      type: 'crest',
      crest: entry.crest,
      teamKey: entry.teamId,
      displayName: entry.displayName,
      fallbackText: entry.crest.acronym,
    }
  }

  // Fallback honesto: equipe não cadastrada -> sigla textual simples de até 3 letras, sem visual falso
  const fallbackAcronym =
    raw
      .replace(/^ai_|^team_/i, '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .join('')
      .substring(0, 3)
      .toUpperCase() || raw.substring(0, 3).toUpperCase()

  return {
    type: 'fallback',
    teamKey: key,
    displayName: raw,
    fallbackText: fallbackAcronym,
  }
}
