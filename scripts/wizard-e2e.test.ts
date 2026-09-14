import { describe, it, expect } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { BASE_MANAGER_ATTRIBUTES } from '@/lib/manager-profiles'

describe('Wizard E2E create and delete verification on teams collection', () => {
  it('creates a team record with the exact wizard payload and deletes it cleanly', async () => {
    // 1. Autenticar com o usuário padrão caso não esteja autenticado
    const envUrl = import.meta.env.VITE_POCKETBASE_URL
    console.log('VITE_POCKETBASE_URL:', envUrl)
    expect(envUrl).toBeDefined()
    expect(envUrl).not.toBe('')

    const authData = await pb
      .collection('users')
      .authWithPassword('m.blasques@multi.br.com', 'Skip@Pass')
    console.log(
      'Autenticado com sucesso! Token presente:',
      !!authData.token,
      'User ID:',
      authData.record?.id,
    )

    expect(pb.authStore.isValid).toBe(true)
    const currentUserId = pb.authStore.record?.id || 'jxe5h74yat69x3x'

    // 2. Montar payload idêntico ao solicitado pelo teste de verificação
    const customGridSample = [
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
      { key: 'alpine', name: 'Alpine F1 Team', engine: 'Mercedes', strength: 61, color: '#0093CC' },
      { key: 'audi', name: 'Audi F1 Team', engine: 'Audi', strength: 52, color: '#FF2A00' },
      { key: 'haas', name: 'Haas F1 Team', engine: 'Ferrari', strength: 48, color: '#B6BABD' },
      {
        key: 'williams',
        name: 'Williams Racing',
        engine: 'Mercedes',
        strength: 42,
        color: '#041E42',
      },
      {
        key: 'astonmartin',
        name: 'Aston Martin Aramco',
        engine: 'Honda',
        strength: 37,
        color: '#00594F',
      },
      { key: 'andretti', name: 'Andretti Global', engine: 'Ford', strength: 35, color: '#D40000' },
      {
        key: 'cadillac',
        name: 'Cadillac F1 Team',
        engine: 'Ferrari',
        strength: 30,
        color: '#FFD700',
      },
    ]

    const exactUserPayload = {
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
      user_id: currentUserId,
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
        baseAttributes: BASE_MANAGER_ATTRIBUTES,
      },
      career_settings: {
        aiDifficulty: 'normal',
        eventFrequency: 'normal',
        marketBehavior: 'dynamic',
        devSpeed: 'normal',
        seasonFormat: 'official_24',
        sprintEnabled: true,
      },
      custom_grid_teams: customGridSample,
      universe_type: 'custom_championship',
    }

    const testPayload = exactUserPayload

    // 3. Executar o create
    let createdRecord: any = null
    try {
      console.log('Tentando criar registro com testPayload...')
      createdRecord = await pb.collection('teams').create(testPayload)
      console.log('Sucesso na criação:', createdRecord?.id)
    } catch (err: any) {
      throw new Error(
        `PB_FAIL: status=${err?.status} data=${JSON.stringify(err?.data)} resp=${JSON.stringify(err?.response)}`,
      )
    }

    expect(createdRecord).toBeDefined()
    expect(createdRecord.id).toBeTruthy()
    expect(createdRecord.name).toBe('Audi F1 Team')
    expect(createdRecord.engine_supplier).toBe('Audi')
    expect(createdRecord.manager_name).toBe('Marcelino Blasques')
    expect(createdRecord.universe_type).toBe('custom_championship')

    // 4. Limpar o registro de teste imediatamente (DELETE)
    let deleteSuccess = false
    try {
      await pb.collection('teams').delete(createdRecord.id)
      deleteSuccess = true
    } catch (delErr: any) {
      console.error('Falha ao deletar registro de teste:', delErr)
      throw delErr
    }

    expect(deleteSuccess).toBe(true)

    // Confirmar que não existe mais
    let verifyGone = false
    try {
      await pb.collection('teams').getOne(createdRecord.id)
    } catch (notFoundErr: any) {
      verifyGone = notFoundErr?.status === 404
    }
    expect(verifyGone).toBe(true)
  })
})
