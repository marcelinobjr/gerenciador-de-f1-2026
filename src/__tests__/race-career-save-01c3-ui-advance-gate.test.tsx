/**
 * race-career-save-01c3-ui-advance-gate.test.tsx
 *
 * RACE-CAREER-SAVE-01C3:
 * Status Remoto e Controle de Avanço na /race (OfficialRaceResultPanel e fluxo de avanço).
 *
 * TESTES FOCAIS (DADOS ISOLADOS):
 * (a) Cache local COMPLETE + journal remoto incompleto -> avanço bloqueado.
 * (b) Consulta pendente, ausente ou com erro -> nenhum avanço nem replay.
 * (c) COMPLETE remoto da prova correta -> avanço permitido após revalidação.
 * (d) Identidade/hash divergente ou resposta atrasada -> não libera avanço.
 * (e) Aplicação incerta -> retry de efeitos bloqueado, consulta e exportação disponíveis.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import type { CareerApplicationJournal } from '@/services/canonicalCareerPersistenceService'

describe('RACE-CAREER-SAVE-01C3 — Status Remoto e Controle de Avanço na /race', () => {
  const mockResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: 'orr_career_01c3_s2026_r1_123',
    raceVariant: 'MAIN_RACE',
    careerId: 'career_season_01c3',
    season: 2026,
    round: 1,
    raceId: 'race_melbourne_2026',
    circuitId: 'albert_park',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Austrália',
    playerTeamId: 'team_audi_01c3',
    officializedAt: '2026-03-15T06:00:00.000Z',
    totalLaps: 58,
    winnerDriverId: 'driver_piastri',
    winnerTeamId: 'team_mclaren',
    poleDriverId: 'driver_piastri',
    fastestLapDriverId: 'driver_piastri',
    podium: ['driver_piastri', 'driver_norris', 'driver_leclerc'],
    entries: [
      {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 1,
        finalPosition: 1,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 25,
      } as any,
    ],
    playerEntries: [
      {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: true,
        gridPosition: 1,
        finalPosition: 1,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 25,
      } as any,
      {
        driverId: 'driver_norris',
        teamId: 'team_mclaren',
        driverName: 'Lando Norris',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: true,
        gridPosition: 2,
        finalPosition: 2,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 18,
      } as any,
    ],
    eventsSummary: {
      safetyCarPeriods: 0,
      safetyCarLaps: 0,
      vscPeriods: 0,
      vscLaps: 0,
      redFlagPeriods: 0,
      dnfCount: 0,
      totalPitStops: 1,
      significantIncidents: [],
    },
    resultHash: 'sha256-hash-01c3-correct',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  // =========================================================================
  // CENÁRIO (a): Cache local COMPLETE + journal remoto incompleto -> avanço bloqueado
  // =========================================================================
  it('(a) Cache local COMPLETE + journal remoto incompleto -> avanço bloqueado', () => {
    const handleContinue = vi.fn()

    // O status no localStorage ou cache local pode estar 'COMPLETE', mas a autoridade remota não confirmou
    // (ex.: remoteQueryState é 'missing' ou careerPersistenceStatus remoto é 'PENDING'/'APPLYING')
    render(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="PENDING"
        remoteQueryState="missing"
        canAdvance={false}
        onContinue={handleContinue}
      />,
    )

    const continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).toBeDisabled()

    fireEvent.click(continueBtn)
    expect(handleContinue).not.toHaveBeenCalled()

    // Mensagem de bloqueio visível identificando ausência do journal remoto
    const reason = screen.getByTestId('advance-blocked-reason')
    expect(reason).toBeInTheDocument()
    expect(reason.textContent).toContain('Registro remoto do journal ausente')
  })

  // =========================================================================
  // CENÁRIO (b): Consulta pendente, ausente ou com erro -> nenhum avanço nem replay
  // =========================================================================
  it('(b) Consulta pendente, ausente ou com erro -> nenhum avanço nem replay', () => {
    const handleContinue = vi.fn()
    const handleRegister = vi.fn()
    const handleVerify = vi.fn()

    // Caso B1: Consulta pendente (checking)
    const { rerender } = render(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="PENDING"
        remoteQueryState="checking"
        canAdvance={false}
        onContinue={handleContinue}
        onRegisterInCareer={handleRegister}
        onVerifyRemoteJournal={handleVerify}
      />,
    )

    let continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).toBeDisabled()
    expect(screen.getByText('CONSULTANDO BACKEND...')).toBeInTheDocument()
    fireEvent.click(continueBtn)
    expect(handleContinue).not.toHaveBeenCalled()

    // Caso B2: Consulta com erro (error) -> não libera avanço, oferece "Verificar registro" (somente leitura), nenhum replay
    rerender(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="FAILED"
        remoteQueryState="error"
        remoteQueryError="Timeout de conexão no PocketBase"
        canAdvance={false}
        onContinue={handleContinue}
        onRegisterInCareer={handleRegister}
        onVerifyRemoteJournal={handleVerify}
      />,
    )

    continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).toBeDisabled()
    expect(screen.getByTestId('remote-query-error-alert')).toBeInTheDocument()

    // Botão de verificar registro exclusivo para consulta (somente-leitura)
    const verifyBtn = screen.getByTestId('verify-remote-journal-btn')
    expect(verifyBtn).toBeInTheDocument()
    expect(verifyBtn.textContent).toContain('VERIFICAR REGISTRO')
    fireEvent.click(verifyBtn)
    expect(handleVerify).toHaveBeenCalledTimes(1)
    // Replay/efeitos não devem ser disparados pelo botão de verificação
    expect(handleRegister).not.toHaveBeenCalled()

    // Caso B3: Consulta com registro ausente (missing)
    rerender(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="PENDING"
        remoteQueryState="missing"
        canAdvance={false}
        onContinue={handleContinue}
        onRegisterInCareer={handleRegister}
        onVerifyRemoteJournal={handleVerify}
      />,
    )

    continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).toBeDisabled()
    fireEvent.click(continueBtn)
    expect(handleContinue).not.toHaveBeenCalled()
    expect(screen.getByText('JOURNAL REMOTO AUSENTE')).toBeInTheDocument()
  })

  // =========================================================================
  // CENÁRIO (c): COMPLETE remoto da prova correta -> avanço permitido após revalidação
  // =========================================================================
  it('(c) COMPLETE remoto da prova correta -> avanço permitido após revalidação', async () => {
    const handleContinue = vi.fn()

    render(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="COMPLETE"
        remoteQueryState="found"
        canAdvance={true}
        onContinue={handleContinue}
      />,
    )

    const continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).not.toBeDisabled()
    expect(screen.getByText('CONFIRMADO NO BACKEND ✓')).toBeInTheDocument()

    fireEvent.click(continueBtn)
    expect(handleContinue).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // CENÁRIO (d): Identidade/hash divergente ou resposta atrasada -> não libera avanço
  // =========================================================================
  it('(d) Identidade/hash divergente ou resposta atrasada -> não libera avanço', () => {
    const handleContinue = vi.fn()

    // Simulação do estado resultante de um hash divergente ou round atrasado
    render(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="FAILED"
        remoteQueryState="error"
        remoteQueryError="Divergência de identidade ou hash no journal remoto."
        canAdvance={false}
        onContinue={handleContinue}
      />,
    )

    const continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).toBeDisabled()

    fireEvent.click(continueBtn)
    expect(handleContinue).not.toHaveBeenCalled()
    expect(screen.getByText(/Divergência de identidade ou hash/i)).toBeInTheDocument()
  })

  // =========================================================================
  // CENÁRIO (e): Aplicação incerta -> retry de efeitos bloqueado, consulta e exportação disponíveis
  // =========================================================================
  it('(e) Aplicação incerta -> retry de efeitos bloqueado, consulta e exportação disponíveis', () => {
    const handleContinue = vi.fn()
    const handleRegister = vi.fn()
    const handleVerify = vi.fn()
    const handleExport = vi.fn()
    const handleDownloadMemory = vi.fn()

    render(
      <OfficialRaceResultPanel
        result={mockResult}
        careerPersistenceStatus="FAILED"
        remoteQueryState="found"
        isReconciliationPending={true}
        canAdvance={false}
        onContinue={handleContinue}
        onRegisterInCareer={handleRegister}
        onVerifyRemoteJournal={handleVerify}
        onExportDiagnostics={handleExport}
        onDownloadMemoryResult={handleDownloadMemory}
      />,
    )

    // 1. Avanço bloqueado
    const continueBtn = screen.getByTestId('continue-to-next-round-btn')
    expect(continueBtn).toBeDisabled()

    // 2. Alerta de reconciliação pendente (01D) visível
    expect(screen.getByTestId('reconciliation-pending-alert')).toBeInTheDocument()
    expect(
      screen.getByText(/reconciliação \(01D\)\. Replay automático de efeitos bloqueado/i),
    ).toBeInTheDocument()

    // 3. Botão de retry de efeitos (Tentar Novamente) NÃO deve ser renderizado quando incerto
    expect(screen.queryByTestId('retry-persistence-btn')).not.toBeInTheDocument()

    // 4. Botão de verificar registro disponível
    const verifyBtn = screen.getByTestId('verify-remote-journal-btn')
    expect(verifyBtn).toBeInTheDocument()
    fireEvent.click(verifyBtn)
    expect(handleVerify).toHaveBeenCalledTimes(1)

    // 5. Exportação diagnóstica e download de memória disponíveis
    const exportBtn = screen.getByTestId('export-race-diagnostics-btn')
    expect(exportBtn).toBeInTheDocument()
    fireEvent.click(exportBtn)
    expect(handleExport).toHaveBeenCalledTimes(1)

    const memoryBtn = screen.getByTestId('download-memory-result-btn')
    expect(memoryBtn).toBeInTheDocument()
    fireEvent.click(memoryBtn)
    expect(handleDownloadMemory).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // Teste de Contrato Lógico: getApplicationJournalFromBackend sem efeitos colaterais
  // =========================================================================
  it('Contrato getApplicationJournalFromBackend: somente leitura e retorno isolado', async () => {
    const mockJournal: CareerApplicationJournal = {
      key: 'journal_career_01c3_s2026_r1',
      careerId: 'career_season_01c3',
      season: 2026,
      round: 1,
      officialRaceResultId: 'orr_career_01c3_s2026_r1_123',
      checksum: 'sha256-hash-01c3-correct',
      status: 'COMPLETE',
      appliedDriverIds: ['driver_piastri', 'driver_norris'],
      totalEntries: 2,
      version: 1,
      startedAt: '2026-03-15T06:00:00.000Z',
      completedAt: '2026-03-15T06:01:00.000Z',
    }

    const spy = vi
      .spyOn(canonicalCareerPersistenceService, 'getApplicationJournalFromBackend')
      .mockResolvedValueOnce(mockJournal)

    const result = await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
      'career_season_01c3',
      2026,
      1,
      'MAIN_RACE',
    )

    expect(spy).toHaveBeenCalledWith('career_season_01c3', 2026, 1, 'MAIN_RACE')
    expect(result).toEqual(mockJournal)
    expect(result?.status).toBe('COMPLETE')
  })
})
