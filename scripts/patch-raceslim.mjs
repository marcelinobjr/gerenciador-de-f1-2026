import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('src/pages/RaceSlim.tsx')
console.log('Lendo arquivo:', filePath)
let content = fs.readFileSync(filePath, 'utf8')
console.log('Tamanho inicial:', content.length, 'bytes, linhas:', content.split('\n').length)

function applyReplace(target, replacement, description) {
  if (!content.includes(target)) {
    throw new Error(
      `FALHA LOUD: Alvo não encontrado para: "${description}"\nAlvo:\n${target.slice(0, 120)}...`,
    )
  }
  const occurrences = content.split(target).length - 1
  if (occurrences > 1) {
    throw new Error(
      `FALHA LOUD: Mais de uma ocorrência (${occurrences}) encontrada para: "${description}"`,
    )
  }
  content = content.replace(target, replacement)
  console.log(`✓ Aplicado com sucesso: "${description}"`)
}

// CORREÇÃO (1) lapsCompleted: no initialGrid.push (linha ~1950) inicializar lapsCompleted: 0
const target1A = `      initialGrid.push({
        driverId: drv.id,
        driverName: drv.name,
        teamId: targetTeam.id,
        teamName: targetTeam.name,
        teamColor: targetTeam.color,
        isPlayer: drv.team_id === team.id,
        flag: getCountryFlag(drv.nationality),
        position: idx + 1,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        score: drv.speed,
        accumulatedTimeSec: 0,
        lastLapTimeSec: 0,
        lapsInDirtyAir: 0,
        tireCompound: startingCompound,
        secondCompound: secondCompound,
        pitLap: driverPitLap,
        tireWear: 0,
        lapsOnCurrentTire: 0,
        cliffStatus: undefined,
        driverFatigue: 0,
        morale: drv.morale ?? 80,
        physicalCondition: drv.physical_condition ?? 90,
        pitStopsDone: 0,
        hasWingDamage: false,
        fuelRemaining: initialFuelLoad,
        strategyPlan,
        wearMultiplier,
        wearProfileName,
        aiStrategyProfile,
      })`

const replace1A = `      initialGrid.push({
        driverId: drv.id,
        driverName: drv.name,
        teamId: targetTeam.id,
        teamName: targetTeam.name,
        teamColor: targetTeam.color,
        isPlayer: drv.team_id === team.id,
        flag: getCountryFlag(drv.nationality),
        position: idx + 1,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        score: drv.speed,
        accumulatedTimeSec: 0,
        lastLapTimeSec: 0,
        lapsInDirtyAir: 0,
        tireCompound: startingCompound,
        secondCompound: secondCompound,
        pitLap: driverPitLap,
        tireWear: 0,
        lapsOnCurrentTire: 0,
        cliffStatus: undefined,
        driverFatigue: 0,
        morale: drv.morale ?? 80,
        physicalCondition: drv.physical_condition ?? 90,
        pitStopsDone: 0,
        hasWingDamage: false,
        fuelRemaining: initialFuelLoad,
        strategyPlan,
        wearMultiplier,
        wearProfileName,
        aiStrategyProfile,
        lapsCompleted: 0,
      })`

applyReplace(target1A, replace1A, '(1) initialGrid.push lapsCompleted: 0')

// CORREÇÃO (1) no runLiveRaceLoop (~linhas 2254 e 2909), a cada volta completada, incrementar lapsCompleted
// Linha ~2254:
const target1B = `          currentGrid = currentGrid.map((entry) => ({
            ...entry,
            position:
              sortedActiveGrid.findIndex((s) => s.driverId === entry.driverId) !== -1
                ? sortedActiveGrid.findIndex((s) => s.driverId === entry.driverId) + 1
                : entry.position,
            gapToLeader: entry.position === 1 ? 'LÍDER' : \`+\${((entry.position - 1) * 1.8).toFixed(1)}s\`,
            gapToFront: entry.position === 1 ? '-' : '+1.8s',
            lastLapTime: formatLapTime(entry.lastLapTimeSec || 78.42),
          }))`

const replace1B = `          currentGrid = currentGrid.map((entry) => ({
            ...entry,
            lapsCompleted: entry.dnf ? (entry.lapsCompleted || 0) : (entry.lapsCompleted || 0) + 1,
            position:
              sortedActiveGrid.findIndex((s) => s.driverId === entry.driverId) !== -1
                ? sortedActiveGrid.findIndex((s) => s.driverId === entry.driverId) + 1
                : entry.position,
            gapToLeader: entry.position === 1 ? 'LÍDER' : \`+\${((entry.position - 1) * 1.8).toFixed(1)}s\`,
            gapToFront: entry.position === 1 ? '-' : '+1.8s',
            lastLapTime: formatLapTime(entry.lastLapTimeSec || 78.42),
          }))`

applyReplace(target1B, replace1B, '(1) fast-forward runLiveRaceLoop lapsCompleted increment')

// Linha ~2909:
const target1C = `      currentGrid = intermediateStates.map((entry) => {
        if (entry.dnf) {
          return {
            ...entry,
            gapToLeader: 'DNF',
            gapToFront: '-',
          }
        }`

const replace1C = `      currentGrid = intermediateStates.map((entry) => {
        if (entry.dnf) {
          return {
            ...entry,
            gapToLeader: 'DNF',
            gapToFront: '-',
          }
        }

        entry.lapsCompleted = (entry.lapsCompleted || 0) + 1`

applyReplace(target1C, replace1C, '(1) main tick runLiveRaceLoop lapsCompleted increment')

// CORREÇÃO (2) Clamp de gap ao vivo:
// Bloco passedFront && i > 0 (linhas ~2931-2942), após ajuste de accumulatedTimeSec:
const target2A = `        if (lapData?.passedFront && i > 0) {
          const ahead = sortedActiveGrid[i - 1]
          if (entry.accumulatedTimeSec >= ahead.accumulatedTimeSec) {
            entry.accumulatedTimeSec = ahead.accumulatedTimeSec - 0.05
          }
        }`

const replace2A = `        if (lapData?.passedFront && i > 0) {
          const ahead = sortedActiveGrid[i - 1]
          if (entry.accumulatedTimeSec >= ahead.accumulatedTimeSec) {
            entry.accumulatedTimeSec = ahead.accumulatedTimeSec - 0.051
          }
        }`

applyReplace(target2A, replace2A, '(2) passedFront accumulatedTimeSec clamp (-0.051)')

// Cálculo de gapFrontSec (~linha 2970), clampar com Math.max(0.051, gapFrontSec) — nunca gaps <= 0 ou +0.000s em cadeia
const target2B = `        const gapFrontSec =
          idx === 0
            ? 0
            : Math.max(0, entry.accumulatedTimeSec - sortedActiveGrid[idx - 1].accumulatedTimeSec)`

const replace2B = `        const rawGapFront =
          idx === 0
            ? 0
            : entry.accumulatedTimeSec - sortedActiveGrid[idx - 1].accumulatedTimeSec
        const gapFrontSec = idx === 0 ? 0 : Math.max(0.051, rawGapFront)`

applyReplace(target2B, replace2B, '(2) gapFrontSec clamp Math.max(0.051, gapFrontSec)')

// CORREÇÃO (3) finishRaceSimulation (~linhas 4455-4492):
// ordenar não-DNFs por lapsCompleted DESC + accumulatedTimeSec ASC (critério combinado); DNFs por último, por dnfLap DESC; position = idx+1;
// gaps recalculados APÓS essa ordenação via formatGap(accumulatedTimeSec − tempo do vencedor, winnerLaps − lapsCompleted) — garantindo "+1 VOLTA" para suchados.
const target3 = `    // FIAÇÃO PARTE 1 - Homologação de penalidades FIA antes da ordenação final
    const resultsWithPenalties = applyPenaltiesToResults(grid, penalties)

    const activeDrivers = resultsWithPenalties
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

const replace3 = `    // FIAÇÃO PARTE 1 - Homologação de penalidades FIA antes da ordenação final
    const resultsWithPenalties = applyPenaltiesToResults(grid, penalties)

    const activeDrivers = resultsWithPenalties
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
    const winnerLaps = finalOrderedGrid[0]?.lapsCompleted ?? totalLaps
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
        const diffSec = Math.max(0, (entry.accumulatedTimeSec || 0) - winnerAccTime)
        const lapDiff = Math.max(0, winnerLaps - (entry.lapsCompleted ?? winnerLaps))
        entry.totalTime = formatGap(diffSec, lapDiff)
      }
    })`

applyReplace(target3, replace3, '(3) finishRaceSimulation combined sort & formatGap with lapDiff')

// CORREÇÃO (4) handleAdvanceRound (~linhas 4694-4702):
// incluir laps_completed (res.lapsCompleted ?? totalLaps) e accumulated_time_sec (res.accumulatedTimeSec)
const target4 = `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
            })`

const replace4 = `            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
              laps_completed: res.lapsCompleted ?? totalLaps,
              accumulated_time_sec: res.accumulatedTimeSec,
            })`

applyReplace(
  target4,
  replace4,
  '(4) handleAdvanceRound persist laps_completed and accumulated_time_sec',
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Gravação concluída com sucesso! Novo tamanho:', content.length, 'bytes.')
