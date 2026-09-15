import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('src/pages/RaceSlim.tsx')
let content = fs.readFileSync(filePath, 'utf-8')
const originalLength = Buffer.byteLength(content, 'utf-8')
console.log(`Original byte size: ${originalLength}`)

// 0. Remoção das 3 chamadas órfãs em handleStartSimulateWeekend
const orphanTarget = `      // Atualizar sessões completadas
      const allSess: WeekendSession[] = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
      setCompletedSessions(allSess)
      setHasRaceFinished(true)
      setHasQualyFinished(true)
      setPracticeDone(true)

      setWeekendSummaryReport(res.report)`

const orphanReplacement = `      // Atualizar sessões completadas
      const allSess: WeekendSession[] = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
      setCompletedSessions(allSess)

      setWeekendSummaryReport(res.report)`

if (content.includes(orphanTarget)) {
  content = content.replace(orphanTarget, orphanReplacement)
  console.log('✓ Substituição 0 realizada: remoção das 3 chamadas órfãs')
} else if (
  content.includes('setHasRaceFinished(true)') ||
  content.includes('setHasQualyFinished(true)') ||
  content.includes('setPracticeDone(true)')
) {
  content = content.replace(/\r\n/g, '\n')
  content = content.replace(
    orphanTarget.replace(/\r\n/g, '\n'),
    orphanReplacement.replace(/\r\n/g, '\n'),
  )
  // Fallback regex se houver variação de espaçamento
  content = content.replace(
    /setCompletedSessions\(allSess\)\s+setHasRaceFinished\(true\)\s+setHasQualyFinished\(true\)\s+setPracticeDone\(true\)/g,
    'setCompletedSessions(allSess)',
  )
  console.log('✓ Substituição 0 realizada via regex fallback')
}

// 1. Linha ~4744: Math.round(d.salary / 24) -> Math.round(d.salary / totalRounds)
const driversTarget =
  'const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)'
const driversReplacement =
  'const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / totalRounds), 0)'
if (content.includes(driversTarget)) {
  content = content.replace(driversTarget, driversReplacement)
  console.log('✓ Substituição 1 realizada: driversCost com totalRounds')
}

// 2. Linha ~4745: Math.round(currentEngine.costAnnual / 24) -> Math.round(currentEngine.costAnnual / totalRounds)
const engineTarget = 'const engineCost = Math.round(currentEngine.costAnnual / 24)'
const engineReplacement = 'const engineCost = Math.round(currentEngine.costAnnual / totalRounds)'
if (content.includes(engineTarget)) {
  content = content.replace(engineTarget, engineReplacement)
  console.log('✓ Substituição 2 realizada: engineCost com totalRounds')
}

// 3. Imports dos componentes se não existirem
const importsToAdd = [
  "import { TrackInfoPanel } from '@/pages/race/TrackInfoPanel'",
  "import { WeatherRadarCard } from '@/pages/race/WeatherRadarCard'",
  "import { TireStockCard } from '@/pages/race/TireStockCard'",
]

for (const imp of importsToAdd) {
  if (!content.includes(imp)) {
    const marker = "import { TeamRadioDialog } from '@/components/TeamRadioDialog'"
    if (content.includes(marker)) {
      content = content.replace(marker, `${marker}\n${imp}`)
      console.log(`✓ Import adicionado: ${imp}`)
    } else {
      content = `${imp}\n${content}`
      console.log(`✓ Import adicionado no topo: ${imp}`)
    }
  }
}

// 4. Se blocos ainda existirem, substitui
const block1Header =
  '{/* PAINEL TÉCNICO DO CIRCUITO: IMAGEM HOMOLOGADA / BLUEPRINT + VOLTAS TOTAIS (EDIT 4) */}\n      {(() => {'
const block1Closer = '})()}'

const block1IdxStart = content.indexOf(block1Header)
if (block1IdxStart !== -1) {
  const block1IdxEnd = content.indexOf(block1Closer, block1IdxStart)
  if (block1IdxEnd !== -1) {
    const fullBlock1EndPos = block1IdxEnd + block1Closer.length

    // Bloco 2: WeatherRadarCard
    const block2Header =
      '{/* PAINEL DE PREVISÃO METEOROLÓGICA OFICIAL DA FIA 2026 */}\n      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">'
    const block2Closer = '</Card>'

    const block2IdxStart = content.indexOf(block2Header, fullBlock1EndPos)
    if (block2IdxStart !== -1) {
      const block2IdxEnd = content.indexOf(block2Closer, block2IdxStart)
      if (block2IdxEnd !== -1) {
        const fullBlock2EndPos = block2IdxEnd + block2Closer.length

        // Bloco 3: TireStockCard
        const block3Header =
          '{/* TIRE ALLOTMENT STATUS BAR (FIA 2026 Regulation) */}\n      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">'
        const block3Closer = '</Card>'

        const block3IdxStart = content.indexOf(block3Header, fullBlock2EndPos)
        if (block3IdxStart !== -1) {
          const block3IdxEnd = content.indexOf(block3Closer, block3IdxStart)
          if (block3IdxEnd !== -1) {
            const fullBlock3EndPos = block3IdxEnd + block3Closer.length

            const block1Replacement = `<TrackInfoPanel
        currentRound={currentRound}
        gpInfo={gpInfo}
        circuits={circuits}
        defaultAustraliaMap={defaultAustraliaMap}
        puPoolStatus={puPoolStatus}
        team={team}
      />`

            const block2Replacement = `<WeatherRadarCard forecast={forecast} weather={weather} />`

            const block3Replacement = `<TireStockCard tireStock={tireStock} calculateCompoundLaps={calculateCompoundLaps} />`

            content =
              content.substring(0, block1IdxStart) +
              block1Replacement +
              content.substring(fullBlock1EndPos, block2IdxStart) +
              block2Replacement +
              content.substring(fullBlock2EndPos, block3IdxStart) +
              block3Replacement +
              content.substring(fullBlock3EndPos)
          }
        }
      }
    }
  }
}

fs.writeFileSync(filePath, content, 'utf-8')

const newByteLength = Buffer.byteLength(content, 'utf-8')
console.log(`✓ Arquivo gravado com sucesso!`)
console.log(
  `Novo tamanho em bytes: ${newByteLength} (redução de ${originalLength - newByteLength} bytes)`,
)
