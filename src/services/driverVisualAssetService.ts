/**
 * Provedor e Serviço de Assets Visuais de Pilotos (DriverVisualAssetService)
 * F1 Manager 2026 — Implementação Nº 4C
 *
 * Princípios Fundamentais:
 * - A IMAGEM É UM ASSET DO PILOTO; NÃO É O PILOTO.
 * - Desacoplado: falhas de geração nunca interrompem nem deletam entidades de pilotos.
 * - Permite fallback determinístico para fotos/avatares locais da CDN Curl/Skip.
 * - Suporta troca de equipe (novo poster, mesmo visualIdentityId).
 * - Cache e idempotência: sem regenerações desnecessárias ao abrir páginas.
 */

import { DriverVisualAssetIdentity, VisualGenerationProvider } from '@/types/procedural-driver'

export class PlaceholderVisualProvider implements VisualGenerationProvider {
  id = 'skip_curling_provider'
  name = 'Provedor de Avatar Curling Skip'

  async isAvailable(): Promise<boolean> {
    return true
  }

  async generateDriverPoster(params: {
    driverId: string
    visualIdentity: DriverVisualAssetIdentity
    teamName: string
    teamColor: string
  }): Promise<{ success: boolean; assetUrl?: string; error?: string }> {
    const seed = params.visualIdentity.visualSeed || 42
    const gender = params.visualIdentity.gender || 'male'
    // Utiliza URL permitida pelo sistema de imagens
    const url = `https://img.usecurling.com/ppl/large?gender=${gender}&seed=${seed}`
    return {
      success: true,
      assetUrl: url,
    }
  }
}

export class DriverVisualAssetService {
  private provider: VisualGenerationProvider

  constructor(provider?: VisualGenerationProvider) {
    this.provider = provider || new PlaceholderVisualProvider()
  }

  setProvider(provider: VisualGenerationProvider) {
    this.provider = provider
  }

  /**
   * Cria identidade visual básica consistente com etnia, gênero e características faciais
   */
  createVisualIdentity(params: {
    driverId: string
    gender?: 'male' | 'female'
    nationality: string
    age: number
    seed?: number
  }): DriverVisualAssetIdentity {
    const seed = params.seed || Math.floor(Math.random() * 999999) + 1
    const gender = params.gender || (seed % 10 === 0 ? 'female' : 'male')

    // Mapeamento cultural de tons e cabelos baseado na nacionalidade
    const nat = params.nationality.toLowerCase()
    let skinTone: DriverVisualAssetIdentity['skinTone'] = 'light'
    let hairColor: DriverVisualAssetIdentity['hairColor'] = 'brown'
    let eyeColor: DriverVisualAssetIdentity['eyeColor'] = 'brown'

    if (nat.includes('brasil') || nat.includes('espanha') || nat.includes('itália')) {
      skinTone = seed % 3 === 0 ? 'fair' : seed % 3 === 1 ? 'light' : 'medium'
      hairColor = seed % 4 === 0 ? 'black' : 'dark_brown'
    } else if (nat.includes('alemanha') || nat.includes('suécia') || nat.includes('dinamarca')) {
      skinTone = 'fair'
      hairColor = seed % 2 === 0 ? 'blonde' : 'brown'
      eyeColor = seed % 2 === 0 ? 'blue' : 'green'
    } else if (nat.includes('japão') || nat.includes('china')) {
      skinTone = 'light'
      hairColor = 'black'
      eyeColor = 'black'
    } else if (nat.includes('reino unido') || nat.includes('frança')) {
      skinTone = seed % 4 === 0 ? 'medium' : 'fair'
      hairColor = seed % 3 === 0 ? 'auburn' : 'dark_brown'
    }

    const hairStyles: DriverVisualAssetIdentity['hairStyle'][] = [
      'short',
      'curly',
      'wavy',
      'buzz',
      'straight',
    ]
    const hairStyle = hairStyles[seed % hairStyles.length]

    const visualIdentityId = `vid_${params.driverId}_${seed}`

    return {
      visualIdentityId,
      portraitAssetId: `https://img.usecurling.com/ppl/thumbnail?gender=${gender}&seed=${seed % 100}`,
      posterAssetId: `https://img.usecurling.com/ppl/large?gender=${gender}&seed=${seed % 100}`,
      gender,
      skinTone,
      hairStyle,
      hairColor,
      eyeColor,
      baseAge: params.age,
      visualSeed: seed,
      generationStatus: 'ready',
    }
  }

  /**
   * Gera ou atualiza o pôster de equipe com retry seguro e isolamento de falhas
   */
  async updateTeamPoster(
    visualIdentity: DriverVisualAssetIdentity,
    teamId: string,
    teamName: string,
    teamColor: string,
    driverId: string,
  ): Promise<{ success: boolean; updatedIdentity: DriverVisualAssetIdentity }> {
    // Se já estiver com pôster da equipe atual, mantém
    if (
      visualIdentity.currentPosterTeamId === teamId &&
      visualIdentity.generationStatus === 'ready'
    ) {
      return { success: true, updatedIdentity: visualIdentity }
    }

    try {
      const isAvailable = await this.provider.isAvailable()
      if (!isAvailable) {
        // Fallback gracioso
        return {
          success: true,
          updatedIdentity: {
            ...visualIdentity,
            currentPosterTeamId: teamId,
            generationStatus: 'fallback',
          },
        }
      }

      const outcome = await this.provider.generateDriverPoster({
        driverId,
        visualIdentity,
        teamName,
        teamColor,
      })

      if (outcome.success && outcome.assetUrl) {
        return {
          success: true,
          updatedIdentity: {
            ...visualIdentity,
            posterAssetId: outcome.assetUrl,
            currentPosterTeamId: teamId,
            generationStatus: 'ready',
            lastGenerationAttempt: new Date().toISOString(),
          },
        }
      }

      // Em caso de retorno falso sem throw
      return {
        success: true,
        updatedIdentity: {
          ...visualIdentity,
          currentPosterTeamId: teamId,
          generationStatus: 'fallback',
        },
      }
    } catch {
      // Falha nunca propaga e nunca corrompe o piloto
      return {
        success: false,
        updatedIdentity: {
          ...visualIdentity,
          currentPosterTeamId: teamId,
          generationStatus: 'fallback',
          lastGenerationAttempt: new Date().toISOString(),
        },
      }
    }
  }
}

export const driverVisualAssetService = new DriverVisualAssetService()
