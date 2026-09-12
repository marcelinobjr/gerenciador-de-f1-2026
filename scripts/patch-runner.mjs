import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('src/pages/RaceSlim.tsx')
const bakPath = path.resolve('src/pages/RaceSlim.tsx.bak')

const originalContent = fs.readFileSync(filePath, 'utf8')
fs.writeFileSync(bakPath, originalContent, 'utf8')

let content = originalContent

function applyReplace(target, replacement, name) {
  if (!content.includes(target)) {
    throw new Error(`Alvo não encontrado: ${name}`)
  }
  const count = content.split(target).length - 1
  if (count > 1) {
    throw new Error(`Múltiplas ocorrências encontradas para o alvo: ${name} (${count})`)
  }
  content = content.replace(target, replacement)
}

// (a1) initialGrid.push lapsCompleted: 0
applyReplace(
  `      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        nationality: (driver as any).nationality,
        score: gridScoreAdvantage - penalty,`,
  `      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        nationality: (driver as any).nationality,
        score: gridScoreAdvantage - penalty,
        lapsCompleted: 0,`,
  'initialGrid.push (lapsCompleted: 0)',
)

// (a2) ponto 1 loop intermediateStates
applyReplace(
  `        const updatedEntry: SimDriverEntry = {
          ...entry,
          tireWear: effectiveWear,
          tireCompound: nextCompound,
          pitStopsDone: pitStops,
          lapsOnCurrentTire: effectiveLapsOnTire,
          cliffStatus,
          fuelRemaining: nextFuelRemaining,`,
  `        const updatedEntry: SimDriverEntry = {
          ...entry,
          lapsCompleted: (entry.lapsCompleted || 0) + (entry.dnf || isRanOutOfFuel ? 0 : 1),
          tireWear: effectiveWear,
          tireCompound: nextCompound,
          pitStopsDone: pitStops,
          lapsOnCurrentTire: effectiveLapsOnTire,
          cliffStatus,
          fuelRemaining: nextFuelRemaining,`,
  'intermediateStates map updatedEntry',
)

// (a3) ponto 2 loop updatedGridIntermediate
applyReplace(
  `      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
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
          accumulatedTimeSec: Number(newAccumulated.toFixed(3)),`,
  `      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
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
          accumulatedTimeSec: Number(newAccumulated.toFixed(3)),`,
  'updatedGridIntermediate map',
)

// (b) clamp pos-ultrapassagem 0.051
applyReplace(
  `      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por -0.250s
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
      }`,
  `      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por mais de 0.051s
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
      }`,
  'clamp pos-ultrapassagem 0.051',
)

// (c) finishRaceSimulation ordenacao e formatGap
applyReplace(
  `    const activeDrivers = resultsWithPenalties
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
    })`,
  `    const activeDrivers = resultsWithPenalties
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
    })`,
  'finishRaceSimulation',
)

// (d) handleAdvanceRound laps_completed e accumulated_time_sec
applyReplace(
  `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
            })`,
  `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
              laps_completed: res.lapsCompleted ?? gpInfo.laps,
              accumulated_time_sec: res.accumulatedTimeSec,
            })`,
  'handleAdvanceRound createRaceResult',
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('PATCH APLICADO COM SUCESSO EM src/pages/RaceSlim.tsx')
