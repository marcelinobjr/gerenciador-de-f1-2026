import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('src/pages/RaceSlim.tsx')
let content = fs.readFileSync(filePath, 'utf-8')
const originalLength = Buffer.byteLength(content, 'utf-8')
console.log(`Original byte size: ${originalLength}`)

// 1. Linha ~4744: Math.round(d.salary / 24) -> Math.round(d.salary / totalRounds)
const driversTarget =
  'const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)'
const driversReplacement =
  'const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / totalRounds), 0)'
if (!content.includes(driversTarget)) {
  throw new Error(`Target not found: "${driversTarget}"`)
}
content = content.replace(driversTarget, driversReplacement)
console.log('✓ Substituição 1 realizada: driversCost com totalRounds')

// 2. Linha ~4745: Math.round(currentEngine.costAnnual / 24) -> Math.round(currentEngine.costAnnual / totalRounds)
const engineTarget = 'const engineCost = Math.round(currentEngine.costAnnual / 24)'
const engineReplacement = 'const engineCost = Math.round(currentEngine.costAnnual / totalRounds)'
if (!content.includes(engineTarget)) {
  throw new Error(`Target not found: "${engineTarget}"`)
}
content = content.replace(engineTarget, engineReplacement)
console.log('✓ Substituição 2 realizada: engineCost com totalRounds')

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

// 4. Localizar e substituir os 3 blocos JSX inline de forma robusta e precisa

// Bloco 1: TrackInfoPanel
const block1Header =
  '{/* PAINEL TÉCNICO DO CIRCUITO: IMAGEM HOMOLOGADA / BLUEPRINT + VOLTAS TOTAIS (EDIT 4) */}\n      {(() => {'
const block1Closer = '})()}'

const block1IdxStart = content.indexOf(block1Header)
if (block1IdxStart === -1) {
  throw new Error(`Início do Bloco 1 não encontrado: "${block1Header}"`)
}
const block1IdxEnd = content.indexOf(block1Closer, block1IdxStart)
if (block1IdxEnd === -1) {
  throw new Error(`Fim do Bloco 1 não encontrado: "${block1Closer}"`)
}
const fullBlock1EndPos = block1IdxEnd + block1Closer.length

// Bloco 2: WeatherRadarCard
const block2Header =
  '{/* PAINEL DE PREVISÃO METEOROLÓGICA OFICIAL DA FIA 2026 */}\n      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">'
const block2Closer = '</Card>'

const block2IdxStart = content.indexOf(block2Header, fullBlock1EndPos)
if (block2IdxStart === -1) {
  throw new Error(`Início do Bloco 2 não encontrado: "${block2Header}"`)
}
const block2IdxEnd = content.indexOf(block2Closer, block2IdxStart)
if (block2IdxEnd === -1) {
  throw new Error(`Fim do Bloco 2 não encontrado: "${block2Closer}"`)
}
const fullBlock2EndPos = block2IdxEnd + block2Closer.length

// Bloco 3: TireStockCard
const block3Header =
  '{/* TIRE ALLOTMENT STATUS BAR (FIA 2026 Regulation) */}\n      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">'
const block3Closer = '</Card>'

const block3IdxStart = content.indexOf(block3Header, fullBlock2EndPos)
if (block3IdxStart === -1) {
  throw new Error(`Início do Bloco 3 não encontrado: "${block3Header}"`)
}
const block3IdxEnd = content.indexOf(block3Closer, block3IdxStart)
if (block3IdxEnd === -1) {
  throw new Error(`Fim do Bloco 3 não encontrado: "${block3Closer}"`)
}
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

// Reconstrução do arquivo em 4 fatias com as substituições
content =
  content.substring(0, block1IdxStart) +
  block1Replacement +
  content.substring(fullBlock1EndPos, block2IdxStart) +
  block2Replacement +
  content.substring(fullBlock2EndPos, block3IdxStart) +
  block3Replacement +
  content.substring(fullBlock3EndPos)

fs.writeFileSync(filePath, content, 'utf-8')

const newByteLength = Buffer.byteLength(content, 'utf-8')
console.log(`✓ Arquivo gravado com sucesso!`)
console.log(
  `Novo tamanho em bytes: ${newByteLength} (redução de ${originalLength - newByteLength} bytes)`,
)
