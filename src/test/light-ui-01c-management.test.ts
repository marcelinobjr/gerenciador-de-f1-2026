import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  AUDITED_ROUTES,
  AUDITED_PAGES,
  HIGH_LEVERAGE_COMPONENTS,
  DARK_SCREENS_EXPLICT_LIST,
} from '@/services/lightUiAudit'

describe('LIGHT-UI-01C — Gestão: Central, Equipe, Comercial & Finanças', () => {
  const readProjectFile = (relPath: string) => {
    const fullPath = path.resolve(process.cwd(), relPath)
    return fs.readFileSync(fullPath, 'utf-8')
  }

  it('LUI01C-01: Central está LIGHT_OK na auditoria e em runtime', () => {
    const centralRoute = AUDITED_ROUTES.find((r) => r.path === '/')
    expect(centralRoute?.classification).toBe('LIGHT_OK')

    const centralPage = AUDITED_PAGES.find((p) => p.name === 'IndexPage')
    expect(centralPage?.classification).toBe('LIGHT_OK')

    const indexContent = readProjectFile('src/pages/Index.tsx')
    expect(indexContent).toContain('bg-[#F4F5F7]')
  })

  it('LUI01C-02: Hero da Central não usa surface estrutural escura', () => {
    const indexContent = readProjectFile('src/pages/Index.tsx')
    // Verifica que o hero da equipe usa card branco com borda suave
    expect(indexContent).toContain(
      'lg:col-span-8 relative rounded-xl bg-white border border-[#E2E8F0]',
    )
    expect(indexContent).not.toContain('bg-[#0B0E14] border border-[#E2E8F0]/20')
  })

  it('LUI01C-03: News feed da Central está claro e continua usando resolveNewsIcon()', () => {
    const indexContent = readProjectFile('src/pages/Index.tsx')
    expect(indexContent).toContain('resolveNewsIcon')
    // News icon container claro
    expect(indexContent).toContain('w-12 h-12 rounded-md bg-white border border-[#E2E8F0]')
    expect(indexContent).not.toContain('w-12 h-12 rounded-md bg-[#0F172A]')
  })

  it('LUI01C-04: Equipe está LIGHT_OK', () => {
    const teamRoute = AUDITED_ROUTES.find((r) => r.path === '/team')
    expect(teamRoute?.classification).toBe('LIGHT_OK')

    const teamPage = AUDITED_PAGES.find((p) => p.name === 'TeamPage')
    expect(teamPage?.classification).toBe('LIGHT_OK')
  })

  it('LUI01C-05: Pilot profile modal está claro', () => {
    const pilotDialog = readProjectFile('src/components/PilotProfileDialog.tsx')
    expect(pilotDialog).toContain('bg-white border border-[#E2E8F0] text-[#0F172A]')
    expect(pilotDialog).not.toContain('bg-zinc-950 border border-zinc-800')
    const pilotComponent = HIGH_LEVERAGE_COMPONENTS.find((c) => c.name === 'PilotProfileDialog')
    expect(pilotComponent?.classification).toBe('LIGHT_OK')
  })

  it('LUI01C-06: Contrato/renovação estão claros', () => {
    const teamContent = readProjectFile('src/pages/Team.tsx')
    expect(teamContent).toContain('Renegociar Contrato —')
    expect(teamContent).toContain('bg-white border border-[#E2E8F0] text-[#0F172A] shadow-xl')
    expect(teamContent).not.toContain('bg-[#090D15]/95 backdrop-blur-md border border-[#1A2333]')
  })

  it('LUI01C-07: Rescisão/dispensa está clara', () => {
    const teamContent = readProjectFile('src/pages/Team.tsx')
    expect(teamContent).toContain('Rescisão Unilateral de Contrato')
    expect(teamContent).toContain('bg-red-50 border border-red-200')
  })

  it('LUI01C-08: Staff dialogs/drawers ativos estão claros', () => {
    const staffModal = readProjectFile('src/components/team/StaffContractDetailsModal.tsx')
    expect(staffModal).toContain('bg-white border-[#E2E8F0] text-[#0F172A]')
    expect(staffModal).not.toContain('bg-neutral-900 border-neutral-800 text-white')
  })

  it('LUI01C-09: Comercial & Finanças está LIGHT_OK', () => {
    const sponsorsRoute = AUDITED_ROUTES.find((r) => r.path === '/sponsors')
    expect(sponsorsRoute?.classification).toBe('LIGHT_OK')

    const sponsorsPage = AUDITED_PAGES.find((p) => p.name === 'SponsorsPage')
    expect(sponsorsPage?.classification).toBe('LIGHT_OK')

    const sponsorsContent = readProjectFile('src/pages/Sponsors.tsx')
    expect(sponsorsContent).toContain(
      'bg-white border border-[#E2E8F0] shadow-sm p-6 sm:p-8 text-[#0F172A]',
    )
  })

  it('LUI01C-10: Mapa do carro não usa dark shell estrutural', () => {
    const sponsorMap = readProjectFile('src/components/commercial/CarSponsorMap.tsx')
    expect(sponsorMap).toContain('bg-white border border-[#E2E8F0]')

    const sideview = readProjectFile('src/components/commercial/CarSideViewHotspots.tsx')
    expect(sideview).toContain(
      'relative w-full rounded-2xl overflow-hidden bg-white border border-[#E2E8F0]',
    )
  })

  it('LUI01C-11: Sponsor/financial dialogs estão claros', () => {
    const negModal = readProjectFile('src/components/commercial/NegotiationModal.tsx')
    expect(negModal).toContain('rounded-2xl bg-white border border-[#E2E8F0] shadow-2xl')

    const driverNegModal = readProjectFile('src/components/commercial/DriverNegotiationModal.tsx')
    expect(driverNegModal).toContain('bg-white border border-[#E2E8F0] text-[#0F172A]')
  })

  it('LUI01C-12: Zero superfície estrutural ativa usa bg-black/zinc-950/#090D15 nas três áreas', () => {
    const darkListStr = DARK_SCREENS_EXPLICT_LIST.join(' ')
    expect(darkListStr).not.toContain('IndexPage')
    expect(darkListStr).not.toContain('TeamPage')
    expect(darkListStr).not.toContain('SponsorsPage')
  })

  it('LUI01C-13: Retratos continuam canônicos', () => {
    const pilotDialog = readProjectFile('src/components/PilotProfileDialog.tsx')
    expect(pilotDialog).toContain('DriverPoster')

    const teamContent = readProjectFile('src/pages/Team.tsx')
    expect(teamContent).toContain('DriverPhotoAvatar')
  })

  it('LUI01C-14: News icons continuam canônicos', () => {
    const indexContent = readProjectFile('src/pages/Index.tsx')
    expect(indexContent).toContain('resolveNewsIcon')
    expect(indexContent).toContain('newsIconCatalog')
  })

  it('LUI01C-15: Bindings e ações permanecem funcionais', () => {
    const teamContent = readProjectFile('src/pages/Team.tsx')
    expect(teamContent).toContain('handleRenegotiate')
    expect(teamContent).toContain('handleFire')

    const sponsorsContent = readProjectFile('src/pages/Sponsors.tsx')
    expect(sponsorsContent).toContain('handleAcceptOffer')
    expect(sponsorsContent).toContain('handleRejectOffer')
  })
})
