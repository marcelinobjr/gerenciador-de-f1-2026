import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  AUDITED_ROUTES,
  AUDITED_PAGES,
  HIGH_LEVERAGE_COMPONENTS,
  DARK_SCREENS_EXPLICT_LIST,
} from '@/services/lightUiAudit'

describe('LIGHT-UI-01B — Migração Visual do Fluxo Inicial (Auth, Lobby, Onboarding, Configurações)', () => {
  const readProjectFile = (relPath: string) => {
    const fullPath = path.resolve(process.cwd(), relPath)
    return fs.readFileSync(fullPath, 'utf-8')
  }

  it('LUI01B-01: Auth não usa shell estrutural escuro (#0B0E14) e adota background/cards claros', () => {
    const authContent = readProjectFile('src/pages/Auth.tsx')

    // Verifica que o container principal não usa fundo escuro #0B0E14
    expect(authContent).toContain('bg-[#F8FAFC]')
    expect(authContent).toContain('bg-white')
    expect(authContent).not.toMatch(/className="[^"]*bg-\[#0B0E14\][^"]*text-\[#F5F7FA\]/)

    // Verifica que o card central é branco com tipografia escura
    expect(authContent).toContain('text-[#0F172A]')
  })

  it('LUI01B-02: Lobby inicial está claro (LobbyLayout e StepStart)', () => {
    const lobbyLayout = readProjectFile('src/components/LobbyLayout.tsx')
    const stepStart = readProjectFile('src/components/lobby/StepStart.tsx')

    // LobbyLayout
    expect(lobbyLayout).toContain('bg-[#F8FAFC]')
    expect(lobbyLayout).toContain('text-[#0F172A]')
    expect(lobbyLayout).toContain('bg-white/90')

    // StepStart
    expect(stepStart).toContain('text-[#0F172A]')
    expect(stepStart).toContain('bg-white')
  })

  it('LUI01B-03: Manager selection está clara com badges verde/vermelho suaves', () => {
    const stepManager = readProjectFile('src/components/lobby/StepManager.tsx')

    expect(stepManager).toContain('text-[#0F172A]')
    expect(stepManager).toContain('bg-white')
    expect(stepManager).toContain('bg-emerald-50')
    expect(stepManager).toContain('bg-rose-50')
  })

  it('LUI01B-04: Universe selection está clara com dois cards bem definidos', () => {
    const stepUniverse = readProjectFile('src/components/lobby/StepUniverse.tsx')

    expect(stepUniverse).toContain('text-[#0F172A]')
    expect(stepUniverse).toContain('bg-white')
    expect(stepUniverse).toContain('bg-[#F8FAFC]')
  })

  it('LUI01B-05: Team selection está clara (StepOfficialTeamSelection e StepCustomGrid)', () => {
    const stepOfficial = readProjectFile('src/components/lobby/StepOfficialTeamSelection.tsx')
    const stepCustomGrid = readProjectFile('src/components/lobby/StepCustomGrid.tsx')

    expect(stepOfficial).toContain('text-[#0F172A]')
    expect(stepOfficial).toContain('bg-white')

    expect(stepCustomGrid).toContain('text-[#0F172A]')
    expect(stepCustomGrid).toContain('bg-white')
  })

  it('LUI01B-06: Career Settings está clara com opções legíveis', () => {
    const stepSettings = readProjectFile('src/components/lobby/StepCareerSettings.tsx')

    expect(stepSettings).toContain('text-[#0F172A]')
    expect(stepSettings).toContain('bg-white')
    expect(stepSettings).toContain('border-[#E2E8F0]')
  })

  it('LUI01B-07: Final Review está clara com cards de resumo brancos', () => {
    const stepReview = readProjectFile('src/components/lobby/StepReview.tsx')

    expect(stepReview).toContain('text-[#0F172A]')
    expect(stepReview).toContain('bg-white')
    expect(stepReview).toContain('COMEÇAR CARREIRA')
  })

  it('LUI01B-08: Settings modal está claro', () => {
    const settingsModal = readProjectFile('src/components/SettingsModal.tsx')

    expect(settingsModal).toContain('bg-white')
    expect(settingsModal).toContain('text-[#0F172A]')
    expect(settingsModal).toContain('bg-[#F8FAFC]')
  })

  it('LUI01B-09: Stepper usa tokens compartilhados (verde para complete, vermelho APEX para current, cinza para future)', () => {
    const stepper = readProjectFile('src/components/lobby/WizardStepper.tsx')

    expect(stepper).toContain('bg-emerald-600')
    expect(stepper).toContain('bg-[#E10600]')
    expect(stepper).toContain('bg-[#F1F5F9]')
  })

  it('LUI01B-10: Nenhuma dessas 8 páginas/views depende de bg-black/zinc-950/slate-950/#0B0E14 como superfície estrutural principal', () => {
    const files = [
      'src/pages/Auth.tsx',
      'src/components/LobbyLayout.tsx',
      'src/components/lobby/StepStart.tsx',
      'src/components/lobby/StepManager.tsx',
      'src/components/lobby/StepUniverse.tsx',
      'src/components/lobby/StepOfficialTeamSelection.tsx',
      'src/components/lobby/StepCareerSettings.tsx',
      'src/components/lobby/StepReview.tsx',
      'src/components/SettingsModal.tsx',
    ]

    files.forEach((file) => {
      const content = readProjectFile(file)
      // O container raiz não pode ter bg-[#0B0E14] ou bg-zinc-950/slate-950
      expect(content).not.toMatch(/className="[^"]*bg-(black|zinc-950|slate-950|neutral-950)[^"]*"/)
      // Não deve ter a combinação antiga de container estrutural escuro
      expect(content).not.toContain('min-h-screen bg-[#0B0E14]')
    })
  })

  it('LUI01B-11: Dados e bindings permanecem intactos (credenciais demo, 6 perfis, 12 equipes oficiais)', () => {
    const authContent = readProjectFile('src/pages/Auth.tsx')
    expect(authContent).toContain('m.blasques@multi.br.com')
    expect(authContent).toContain('Skip@Pass')
    expect(authContent).toContain('Acessar Paddock')

    const stepManager = readProjectFile('src/components/lobby/StepManager.tsx')
    expect(stepManager).toContain('MANAGER_PROFILES')
    expect(stepManager).toContain('Dados Pessoais do Chefe de Equipe')

    const stepReview = readProjectFile('src/components/lobby/StepReview.tsx')
    expect(stepReview).toContain('onConfirmCreateCareer')
  })

  it('LUI01B-12: Mapeamento canônico em lightUiAudit reflete status LIGHT_OK para Auth, Lobby, TeamSelection e SettingsModal', () => {
    const authRoute = AUDITED_ROUTES.find((r) => r.path === '/auth')
    expect(authRoute?.classification).toBe('LIGHT_OK')

    const lobbyRoute = AUDITED_ROUTES.find((r) => r.path === '/lobby')
    expect(lobbyRoute?.classification).toBe('LIGHT_OK')

    const authPage = AUDITED_PAGES.find((p) => p.name === 'AuthPage')
    expect(authPage?.classification).toBe('LIGHT_OK')

    const lobbyPage = AUDITED_PAGES.find((p) => p.name === 'LobbyPage')
    expect(lobbyPage?.classification).toBe('LIGHT_OK')

    const teamSelectionPage = AUDITED_PAGES.find((p) => p.name === 'TeamSelectionPage')
    expect(teamSelectionPage?.classification).toBe('LIGHT_OK')

    const settingsModal = HIGH_LEVERAGE_COMPONENTS.find((c) => c.name === 'SettingsModal')
    expect(settingsModal?.classification).toBe('LIGHT_OK')

    const lobbyLayout = HIGH_LEVERAGE_COMPONENTS.find((c) => c.name === 'LobbyLayout')
    expect(lobbyLayout?.classification).toBe('LIGHT_OK')

    // As telas migradas foram removidas de DARK_SCREENS_EXPLICT_LIST
    const darkListStr = DARK_SCREENS_EXPLICT_LIST.join(' ')
    expect(darkListStr).not.toContain('/auth')
    expect(darkListStr).not.toContain('/lobby')
  })
})
