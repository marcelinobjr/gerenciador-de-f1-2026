import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('apply-race-patch', () => {
  it('aplica correções necessárias em src/pages/RaceSlim.tsx', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/RaceSlim.tsx')
    const bakPath = path.resolve(process.cwd(), 'src/pages/RaceSlim.tsx.bak')

    const originalContent = fs.readFileSync(filePath, 'utf8')

    // Grava cópia de backup antes de qualquer edição
    fs.writeFileSync(bakPath, originalContent, 'utf8')

    let content = originalContent

    function applyReplace(target: string, replacement: string, name: string) {
      if (!content.includes(target)) {
        throw new Error(`Alvo não encontrado: ${name}`)
      }
      const count = content.split(target).length - 1
      if (count > 1) {
        throw new Error(`Múltiplas ocorrências encontradas para o alvo: ${name} (${count})`)
      }
      content = content.replace(target, replacement)
    }

    // PASSO 2 (a) lapsCompleted no grid inicial:
    // Alvo: initialGrid.push com score: gridScoreAdvantage - penalty,
    // Garantir que lapsCompleted: 0 esteja presente.
    const targetA = `      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        nationality: (driver as any).nationality,
        score: gridScoreAdvantage - penalty,
        lapsCompleted: 0,`

    if (!content.includes(targetA)) {
      const targetAOld = `      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        nationality: (driver as any).nationality,
        score: gridScoreAdvantage - penalty,`
      const replaceA = `      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        nationality: (driver as any).nationality,
        score: gridScoreAdvantage - penalty,
        lapsCompleted: 0,`
      applyReplace(targetAOld, replaceA, '(a) initialGrid.push (lapsCompleted: 0)')
    }

    // PASSO 2 (b) lapsCompleted no loop de voltas:
    // Alvo: updatedGridIntermediate: SimDriverEntry[] = intermediateStates.map
    // Incrementar entry.lapsCompleted += 1 para cada piloto não-DNF a cada volta processada
    const targetB = `      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
      const updatedGridIntermediate: SimDriverEntry[] = intermediateStates.map(({ entry }) => {
        if (entry.dnf) return entry

        const lapData = processedLaps.get(entry.driverId)
        const lapSec = lapData?.lapTimeSec || 78.42
        const extraWear = lapData?.extraWear || 0
        const dirtyAirCount = lapData?.dirtyAirCount || 0
        const didPass = lapData?.passedFront || false

        let newAccumulated = entry.accumulatedTimeSec + lapSec
        const finalWear = Math.min(100, (entry.tireWear || 5) + extraWear)

        return {
          ...entry,
          lapsCompleted: (entry.lapsCompleted || 0) + (entry.dnf ? 0 : 1),
          accumulatedTimeSec: Number(newAccumulated.toFixed(3)),`

    if (!content.includes(targetB)) {
      const targetBOld = `      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
      const updatedGridIntermediate: SimDriverEntry[] = intermediateStates.map(({ entry }) => {
        if (entry.dnf) return entry

        const lapData = processedLaps.get(entry.driverId)
        const lapSec = lapData?.lapTimeSec || 78.42
        const extraWear = lapData?.extraWear || 0
        const dirtyAirCount = lapData?.dirtyAirCount || 0
        const didPass = lapData?.passedFront || false

        let newAccumulated = entry.accumulatedTimeSec + lapSec
        const finalWear = Math.min(100, (entry.tireWear || 5) + extraWear)

        return {
          ...entry,
          accumulatedTimeSec: Number(newAccumulated.toFixed(3)),`
      applyReplace(targetBOld, targetB, '(b) updatedGridIntermediate (lapsCompleted increment)')
    }

    // PASSO 2 (c) Clamp de gap pós-ultrapassagem:
    // Onde carAhead.accumulatedTimeSec, garantir que o gap resultante sobre o carro da frente seja sempre > 0.051s
    const targetC = `      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por mais de 0.051s
      for (let i = 0; i < sortedActiveGrid.length; i++) {
        const car = sortedActiveGrid[i]
        if (car.dnf) continue
        const lapData = processedLaps.get(car.driverId)
        if (lapData?.passedFront && i > 0) {
          const carAhead = sortedActiveGrid[i - 1]
          if (car.accumulatedTimeSec >= carAhead.accumulatedTimeSec - 0.051) {
            car.accumulatedTimeSec = Number((carAhead.accumulatedTimeSec - 0.052).toFixed(3))
          }
        }
      }`

    if (!content.includes(targetC)) {
      const targetCOld = `      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por -0.250s
      for (let i = 0; i < sortedActiveGrid.length; i++) {
        const car = sortedActiveGrid[i]
        if (car.dnf) continue
        const lapData = processedLaps.get(car.driverId)
        if (lapData?.passedFront && i > 0) {
          const carAhead = sortedActiveGrid[i - 1]
          if (car.accumulatedTimeSec >= carAhead.accumulatedTimeSec) {
            car.accumulatedTimeSec = Number((carAhead.accumulatedTimeSec - 0.25).toFixed(3))
          }
        }
      }`
      applyReplace(targetCOld, targetC, '(c) clamp pós-ultrapassagem > 0.051s')
    }

    // PASSO 2 (d) finishRaceSimulation ordenação e formatGap:
    // ativos por lapsCompleted DESC + accumulatedTimeSec ASC; DNFs por último, por dnfLap DESC; position = idx + 1;
    // formatGap(exactGapSec, false, lapsBehind)
    const targetD = `    const activeDrivers = resultsWithPenalties
      .filter((e) => !e.dnf)
      .sort((a, b) => {
        const lapsA = a.lapsCompleted ?? 0
        const lapsB = b.lapsCompleted ?? 0
        if (lapsB !== lapsA) {
          return lapsB - lapsA
        }
        return (a.accumulatedTimeSec || 0) - (b.accumulatedTimeSec || 0)
      })

    const dnfDrivers = resultsWithPenalties
      .filter((e) => e.dnf)
      .sort((a, b) => {
        const lapA = a.dnfLap ?? 0
        const lapB = b.dnfLap ?? 0
        if (lapB !== lapA) {
          return lapB - lapA
        }
        return (a.position || 0) - (b.position || 0)
      })

    const finalOrderedGrid = [...activeDrivers, ...dnfDrivers]

    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    const winnerAccTime = finalOrderedGrid[0]?.accumulatedTimeSec || 0
    const winnerLaps = finalOrderedGrid[0]?.lapsCompleted ?? gpInfo.laps
    const winnerMinutes = Math.floor(winnerAccTime / 60)
    const winnerRemainingSec = (winnerAccTime % 60).toFixed(3)

    finalOrderedGrid.forEach((entry, idx) => {
      entry.position = idx + 1
      entry.points = !entry.dnf && idx < pointsTable.length ? pointsTable[idx] : 0

      if (entry.dnf) {
        entry.totalTime = 'ABANDONO (DNF)'
      } else if (idx === 0) {
        entry.totalTime = \`\${winnerMinutes}m \${winnerRemainingSec}s\`
      } else {
        const exactGapSec = Math.max(0, (entry.accumulatedTimeSec || 0) - winnerAccTime)
        const lapsBehind = Math.max(0, winnerLaps - (entry.lapsCompleted ?? winnerLaps))
        entry.totalTime = formatGap(exactGapSec, false, lapsBehind)
      }
    })`

    if (!content.includes(targetD)) {
      const targetDOld = `    const activeDrivers = resultsWithPenalties
      .filter((e) => !e.dnf)
      .sort((a, b) => (a.position || 0) - (b.position || 0))

    const dnfDrivers = resultsWithPenalties
      .filter((e) => e.dnf)
      .sort((a, b) => {
        const lapA = a.dnfLap ?? 0
        const lapB = b.dnfLap ?? 0
        if (lapB !== lapA) {
          return lapB - lapA
        }
        return (a.position || 0) - (b.position || 0)
      })

    const finalOrderedGrid = [...activeDrivers, ...dnfDrivers]

    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    const winnerAccTime = finalOrderedGrid[0]?.accumulatedTimeSec || 0
    const winnerMinutes = Math.floor(winnerAccTime / 60)
    const winnerRemainingSec = (winnerAccTime % 60).toFixed(3)

    finalOrderedGrid.forEach((entry, idx) => {
      entry.position = idx + 1
      entry.points = !entry.dnf && idx < pointsTable.length ? pointsTable[idx] : 0

      if (entry.dnf) {
        entry.totalTime = 'ABANDONO (DNF)'
      } else if (idx === 0) {
        entry.totalTime = \`\${winnerMinutes}m \${winnerRemainingSec}s\`
      } else {
        const exactGap = Math.max(0, (entry.accumulatedTimeSec || 0) - winnerAccTime).toFixed(3)
        entry.totalTime = \`+\${exactGap}s\`
      }
    })`
      applyReplace(targetDOld, targetD, '(d) finishRaceSimulation ordenação e formatGap')
    }

    // PASSO 3 Persistência (handleAdvanceRound):
    // Ao gravar race_results, enviar também laps_completed e accumulated_time_sec
    const targetE = `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
              laps_completed: res.lapsCompleted ?? gpInfo.laps,
              accumulated_time_sec: res.accumulatedTimeSec,
            })`

    if (!content.includes(targetE)) {
      const targetEOld = `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
            })`
      applyReplace(
        targetEOld,
        targetE,
        'handleAdvanceRound persistência laps_completed e accumulated_time_sec',
      )
    }

    fs.writeFileSync(filePath, content, 'utf8')

    // PASSO 4: Divisores financeiros de rodada baseados em season?.total_rounds || 24
    const targetDivisores = `      const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)\n      const engineCost = Math.round(currentEngine.costAnnual / 24)`
    const replaceDivisores = `      const driversCost = drivers.reduce(\n        (sum, d) => sum + Math.round(d.salary / (season?.total_rounds || 24)),\n        0,\n      )\n      const engineCost = Math.round(currentEngine.costAnnual / (season?.total_rounds || 24))`

    if (content.includes(targetDivisores)) {
      applyReplace(targetDivisores, replaceDivisores, 'divisores financeiros por rodada')
      fs.writeFileSync(filePath, content, 'utf8')
    } else {
      console.log('targetDivisores não encontrado no buffer inicial, verificando se já existe...')
    }

    // Verificações finais
    const saved = fs.readFileSync(filePath, 'utf8')
    expect(saved).toContain('lapsCompleted: 0')
    expect(saved).toContain('carAhead.accumulatedTimeSec - 0.051')
    expect(saved).toContain('formatGap(exactGapSec, false, lapsBehind)')
    expect(saved).toContain('laps_completed: res.lapsCompleted ?? gpInfo.laps')
    expect(saved).toContain('accumulated_time_sec: res.accumulatedTimeSec')
    expect(saved).toContain('season?.total_rounds || 24')
  })
})
