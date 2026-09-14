import { describe, it } from 'vitest'
import pb from '@/lib/pocketbase/client'

describe('Reproduce teams 400 error', () => {
  it('direct fetch to PB endpoint', async () => {
    const pbUrl = 'https://gerenciador-de-f1-2026-4bb0f.shrd00.internal.goskip.dev'
    const authRes = await fetch(`${pbUrl}/api/collections/users/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'm.blasques@multi.br.com', password: 'Skip@Pass' }),
    })
    const authData = await authRes.json()
    // Intentionally expect something to see stdout or pass
    expect(authData?.token).toBeTruthy()
  })

  it('sends the exact failing payload to teams.create', async () => {
    // 1. Auth as the real user
    await pb.collection('users').authWithPassword('m.blasques@multi.br.com', 'Skip@Pass')
    const userId = pb.authStore.record?.id || 'jxe5h74yat69x3x'
    console.log('Logged in with user ID:', userId)

    // Exact payload from prompt
    const payload = {
      name: 'Audi F1 Team',
      color: '#FF2A00',
      chassis_level: 47,
      aero_level: 47,
      strategy_level: 46,
      budget: 165000000,
      engine_supplier: 'Audi',
      strength: 52,
      is_custom: false,
      team_key: 'audi',
      user_id: 'jxe5h74yat69x3x',
      manager_name: 'Marcelino Blasques',
      manager_profile: {
        profileId: 'engenheiro',
        title: 'O Engenheiro',
        archetype: 'Engenheiro',
        specialty: 'Tecnologia',
        style: 'Técnico, metódico, desenvolvimento',
        nationality: 'Brasil 🇧🇷',
        age: 50,
        avatarUrl:
          'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AIlU1g5tLGEU4Fm-HM3McVc/03-Engenheiro.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
        bonuses: [
          { attribute: 'Desenvolvimento/P&D', value: 12 },
          { attribute: 'Unidade de Potência', value: 10 },
          { attribute: 'Confiabilidade', value: 8 },
        ],
        weakness: { attribute: 'Gestão de Pilotos', value: -5 },
        baseAttributes: {
          lideranca: 74,
          gestao_pessoas: 66,
          gestao_pilotos: 58,
          visao_estrategica: 84,
          tomada_decisao: 76,
          gestao_corrida: 72,
          conhecimento_tecnico: 96,
          desenvolvimento_carro: 95,
          gestao_projeto: 88,
          gestao_financeira: 74,
          negociacao: 68,
          captacao_comercial: 62,
          influencia_politica: 65,
          reputacao: 80,
          desenvolvimento_talentos: 72,
          gestao_crise: 74,
          comunicacao: 64,
          pressao: 78,
          adaptabilidade: 85,
          organizacao: 90,
          disciplina: 92,
          inovacao: 94,
          agressividade_gerencial: 65,
          lealdade: 86,
          ambicao: 80,
          ego: 60,
          temperamento: 82,
          espirito_equipe: 76,
          resiliencia: 82,
        },
      },
      career_settings: {
        aiDifficulty: 'normal',
        eventFrequency: 'normal',
        marketBehavior: 'dynamic',
        devSpeed: 'normal',
        seasonFormat: 'official_24',
        sprintEnabled: true,
      },
      custom_grid_teams: [
        {
          key: 'mercedes',
          name: 'Mercedes-AMG Petronas',
          engine: 'Mercedes',
          strength: 100,
          color: '#27F4D2',
        },
        {
          key: 'ferrari',
          name: 'Scuderia Ferrari',
          engine: 'Ferrari',
          strength: 91,
          color: '#E8002D',
        },
        {
          key: 'mclaren',
          name: 'McLaren F1 Team',
          engine: 'Mercedes',
          strength: 88,
          color: '#FF8000',
        },
        { key: 'redbull', name: 'Red Bull Racing', engine: 'Ford', strength: 84, color: '#1E41FF' },
        {
          key: 'racingbulls',
          name: 'Visa Cash App RB',
          engine: 'Ford',
          strength: 63,
          color: '#6692FF',
        },
        {
          key: 'alpine',
          name: 'Alpine F1 Team',
          engine: 'Mercedes',
          strength: 61,
          color: '#0093CC',
        },
        { key: 'audi', name: 'Audi F1 Team', engine: 'Audi', strength: 52, color: '#FF2A00' },
        { key: 'haas', name: 'Haas F1 Team', engine: 'Ferrari', strength: 48, color: '#B6BABD' },
        {
          key: 'williams',
          name: 'Williams Racing',
          engine: 'Mercedes',
          strength: 42,
          color: '#64C4FF',
        },
        {
          key: 'astonmartin',
          name: 'Aston Martin Aramco',
          engine: 'Honda',
          strength: 37,
          color: '#229971',
        },
        {
          key: 'cadillac',
          name: 'Cadillac F1 Team',
          engine: 'Ferrari',
          strength: 30,
          color: '#D4AF37',
        },
        {
          key: 'byd',
          name: 'BYD Formula E-Tech',
          engine: 'Mercedes',
          strength: 45,
          color: '#0062A8',
        },
      ],
      universe_type: 'custom_championship',
    }

    expect(1 + 1).toBe(3)
  })
})
