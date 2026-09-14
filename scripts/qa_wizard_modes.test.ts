import { describe, it, expect } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { f1Service } from '@/services/f1Service'
import { getOfficial2026GridTeams } from '@/lib/grid-teams-database'
import { MANAGER_PROFILES } from '@/lib/manager-profiles'
import { NewGameConfig } from '@/types/career-wizard'

describe('QA Obrigatório: Testes nos dois modos do Wizard', () => {
  const officialTeams = getOfficial2026GridTeams()

  it('Modo 1: Campeonato 2026 oficial (ex: Mercedes)', async () => {
    // 1. Autenticar com as credenciais reais
    await pb.collection('users').authWithPassword('m.blasques@multi.br.com', 'Skip@Pass')
    expect(pb.authStore.isValid).toBe(true)
    const userId = pb.authStore.record?.id
    expect(userId).toBeTruthy()

    // 2. Configurar modo championship_2026
    const chosenOfficial = officialTeams[0] // Mercedes
    const configOfficial: NewGameConfig = {
      manager: {
        name: 'QA Manager 2026',
        nationality: 'Brasil 🇧🇷',
        age: 42,
        profileId: MANAGER_PROFILES[0].id,
        avatarUrl: MANAGER_PROFILES[0].avatarUrl,
      },
      managerProfile: MANAGER_PROFILES[0],
      universeType: 'championship_2026',
      selectedTeams: officialTeams,
      playerTeam: {
        isCustom: false,
        teamKey: chosenOfficial.key,
        officialTeam: chosenOfficial,
      },
      careerSettings: {
        aiDifficulty: 'normal',
        eventFrequency: 'normal',
        marketBehavior: 'dynamic',
        devSpeed: 'normal',
        seasonFormat: 'official_24',
        sprintEnabled: true,
      },
    }

    // 3. Criar carreira via f1Service
    const createdTeam = await f1Service.initializeCareerWithConfig(userId!, configOfficial)
    expect(createdTeam).toBeDefined()
    expect(createdTeam.id).toBeTruthy()
    expect(createdTeam.name).toBe(chosenOfficial.name)

    // Verificar que temporada, peças e patrocinador foram criados
    const seasons = await pb
      .collection('seasons')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    expect(seasons.length).toBeGreaterThan(0)

    const parts = await pb
      .collection('parts')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    expect(parts.length).toBe(6)

    // 4. LIMPAR registro de teste criado para não poluir a base (sem tocar no save real do usuário)
    // Deletar seasons, parts, sponsors, events criados para esta equipe de teste
    for (const s of seasons) {
      await pb.collection('seasons').delete(s.id)
    }
    for (const p of parts) {
      await pb.collection('parts').delete(p.id)
    }
    const sponsors = await pb
      .collection('sponsors')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    for (const sp of sponsors) {
      await pb.collection('sponsors').delete(sp.id)
    }
    const events = await pb
      .collection('events')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    for (const ev of events) {
      await pb.collection('events').delete(ev.id)
    }
    await pb.collection('teams').delete(createdTeam.id)

    // Confirmar que o time de teste foi deletado
    let teamGone = false
    try {
      await pb.collection('teams').getOne(createdTeam.id)
    } catch (e: any) {
      teamGone = e?.status === 404
    }
    expect(teamGone).toBe(true)
  })

  it('Modo 2: Campeonato personalizado com grid custom e equipe customizada', async () => {
    // 1. Autenticar com as credenciais reais
    await pb.collection('users').authWithPassword('m.blasques@multi.br.com', 'Skip@Pass')
    expect(pb.authStore.isValid).toBe(true)
    const userId = pb.authStore.record?.id
    expect(userId).toBeTruthy()

    // 2. Configurar modo custom_championship
    const configCustom: NewGameConfig = {
      manager: {
        name: 'QA Custom Boss',
        nationality: 'Brasil 🇧🇷',
        age: 38,
        profileId: MANAGER_PROFILES[1].id,
        avatarUrl: MANAGER_PROFILES[1].avatarUrl,
      },
      managerProfile: MANAGER_PROFILES[1],
      universeType: 'custom_championship',
      selectedTeams: officialTeams,
      playerTeam: {
        isCustom: true,
        teamKey: 'custom_12th',
        customName: 'Apex Grand Prix QA',
        customColor: '#10B981',
        customEngine: 'Audi',
      },
      careerSettings: {
        aiDifficulty: 'hard',
        eventFrequency: 'normal',
        marketBehavior: 'dynamic',
        devSpeed: 'normal',
        seasonFormat: 'official_24',
        sprintEnabled: false,
      },
    }

    // 3. Criar carreira via f1Service
    const createdTeam = await f1Service.initializeCareerWithConfig(userId!, configCustom)
    expect(createdTeam).toBeDefined()
    expect(createdTeam.id).toBeTruthy()
    expect(createdTeam.name).toBe('Apex Grand Prix QA')
    expect(createdTeam.engine_supplier).toBe('Audi')
    expect(createdTeam.is_custom).toBe(true)

    // Verificar que temporada e peças foram criadas
    const seasons = await pb
      .collection('seasons')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    expect(seasons.length).toBeGreaterThan(0)

    const parts = await pb
      .collection('parts')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    expect(parts.length).toBe(6)

    // 4. LIMPAR registro de teste criado para não poluir a base
    for (const s of seasons) {
      await pb.collection('seasons').delete(s.id)
    }
    for (const p of parts) {
      await pb.collection('parts').delete(p.id)
    }
    const sponsors = await pb
      .collection('sponsors')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    for (const sp of sponsors) {
      await pb.collection('sponsors').delete(sp.id)
    }
    const events = await pb
      .collection('events')
      .getFullList({ filter: `team_id = "${createdTeam.id}"` })
    for (const ev of events) {
      await pb.collection('events').delete(ev.id)
    }
    await pb.collection('teams').delete(createdTeam.id)

    // Confirmar que o time de teste foi deletado
    let teamGone = false
    try {
      await pb.collection('teams').getOne(createdTeam.id)
    } catch (e: any) {
      teamGone = e?.status === 404
    }
    expect(teamGone).toBe(true)
  })
})
