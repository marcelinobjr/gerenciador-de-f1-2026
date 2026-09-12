import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('apply-race-patch', () => {
  it('aplica correções necessárias em src/pages/RaceSlim.tsx', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/RaceSlim.tsx')
    const bakPath = path.resolve(process.cwd(), 'src/pages/RaceSlim.tsx.bak')

    const originalContent = fs.readFileSync(filePath, 'utf8')

    // PRIMEIRO grava uma cópia de segurança em src/pages/RaceSlim.tsx.bak
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

    // ALVO (a1): initialGrid.push lapsCompleted: 0
    const targetA1 = `      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        nationality: (driver as any).nationality,
        score: gridScoreAdvantage - penalty,`

    const replaceA1 = `      initialGrid.push({
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

    applyReplace(targetA1, replaceA1, 'initialGrid.push (lapsCompleted: 0)')

    // ALVO (a2): ponto 1 do loop onde os estados intermediários são mapeados (intermediateStates = currentGrid.map)
    const targetA2 = `        const updatedEntry: SimDriverEntry = {
          ...entry,
          tireWear: effectiveWear,
          tireCompound: nextCompound,
          pitStopsDone: pitStops,
          lapsOnCurrentTire: effectiveLapsOnTire,
          cliffStatus,
          fuelRemaining: nextFuelRemaining,`

    const replaceA2 = `        const updatedEntry: SimDriverEntry = {
          ...entry,
          lapsCompleted: (entry.lapsCompleted || 0) + (entry.dnf || isRanOutOfFuel ? 0 : 1),
          tireWear: effectiveWear,
          tireCompound: nextCompound,
          pitStopsDone: pitStops,
          lapsOnCurrentTire: effectiveLapsOnTire,
          cliffStatus,
          fuelRemaining: nextFuelRemaining,`

    applyReplace(targetA2, replaceA2, 'loop intermediateStates (ponto 1 increment lapsCompleted)')

    // ALVO (a3): ponto 2 do loop onde os estados intermediários são mapeados (updatedGridIntermediate = intermediateStates.map)
    const targetA3 = `      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
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

    const replaceA3 = `      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
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

    applyReplace(
      targetA3,
      replaceA3,
      'loop updatedGridIntermediate (ponto 2 increment lapsCompleted)',
    )

    // ALVO (b): clamp pós-ultrapassagem: garantir que o carro que ultrapassou fique estritamente a mais de 0.051s do carro da frente
    // Mantendo a troca de posições e clamp no tempo acumulado e gapFrontSec
    const targetB = `      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por -0.250s
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

    const replaceB = `      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por mais de 0.051s
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

    applyReplace(targetB, replaceB, 'clamp pos-ultrapassagem (0.051s)')

    // ALVO (c): finishRaceSimulation ordenar não-DNFs por lapsCompleted DESC + accumulatedTimeSec ASC; DNFs por dnfLap DESC; position = idx + 1; formatGap(diffSec, false, lapsBehind)
    const targetC = `    const activeDrivers = resultsWithPenalties
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

    const replaceC = `    const activeDrivers = resultsWithPenalties
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

    applyReplace(targetC, replaceC, 'finishRaceSimulation (ordenacao e formatGap)')

    // ALVO (d): handleAdvanceRound gravar laps_completed e accumulated_time_sec
    const targetD = `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
            })`

    const replaceD = `            await f1Service.createRaceResult({
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

    applyReplace(
      targetD,
      replaceD,
      'handleAdvanceRound (gravar laps_completed e accumulated_time_sec)',
    )

    // Gravar o arquivo modificado de volta em src/pages/RaceSlim.tsx
    fs.writeFileSync(filePath, content, 'utf8')
    expect(fs.readFileSync(filePath, 'utf8')).toContain('lapsCompleted: 0')
  })
})
