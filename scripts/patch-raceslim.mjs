import fs from 'node:fs'
import path from 'node:path'

const targetFile = path.resolve('src/pages/RaceSlim.tsx')
let content = fs.readFileSync(targetFile, 'utf8')

console.log(`Initial file size: ${(content.length / 1024).toFixed(2)} KB (${content.length} bytes)`)

function replaceOnce(source, searchStr, replaceStr, label) {
  const parts = source.split(searchStr)
  const count = parts.length - 1
  if (count !== 1) {
    throw new Error(`[FAIL] ${label}: expected 1 occurrence, found ${count}`)
  }
  console.log(`[OK] ${label}: found exactly 1 occurrence. Replacing...`)
  return parts.join(replaceStr)
}

// -------------------------------------------------------------
// SUBSTITUIÇÃO 1: raceAdvance
// START: const handleAdvanceRound = async () => {
// END: setIsFinishing(false)\n  }
// -------------------------------------------------------------
const sub1Start = `const handleAdvanceRound = async () => {`
const sub1End = `setIsFinishing(false)\n  }`
const idx1Start = content.indexOf(sub1Start)
const idx1End = content.indexOf(sub1End, idx1Start)

if (idx1Start === -1 || idx1End === -1) {
  throw new Error(`[FAIL] Sub 1 anchors not found. idx1Start: ${idx1Start}, idx1End: ${idx1End}`)
}

// Check count of start anchor
const count1Start = content.split(sub1Start).length - 1
if (count1Start !== 1) {
  throw new Error(`[FAIL] Sub 1 start anchor has ${count1Start} occurrences`)
}

const sub1TargetBlock = content.slice(idx1Start, idx1End + sub1End.length)
const sub1Replacement = `const handleAdvanceRound = () => advanceRound({ raceResults, team, season, currentRound, totalRounds, gpInfo, sponsors, drivers, parts, setups, currentEngine, user, hasUsedPreserveMode: hasUsedPreserveModeRef.current, toast, navigate, refreshTeamAndSeason, setSeasonCompleted, setIsProcessingSillySeason, setMarketMoves, setSillySeasonModalOpen, setIsFinishing })`

content = replaceOnce(content, sub1TargetBlock, sub1Replacement, 'Substituição 1 (raceAdvance)')

// -------------------------------------------------------------
// SUBSTITUIÇÃO 2: raceNarratedEvents
// START: // HELPER: Generate periodic narrated race events as laps progress\n  const generateLapNarratedEvents = (
// END: return events\n  }
// -------------------------------------------------------------
const sub2Start = `// HELPER: Generate periodic narrated race events as laps progress\n  const generateLapNarratedEvents = (`
const idx2Start = content.indexOf(sub2Start)
if (idx2Start === -1) {
  throw new Error(`[FAIL] Sub 2 start anchor not found`)
}
const count2Start = content.split(sub2Start).length - 1
if (count2Start !== 1) {
  throw new Error(`[FAIL] Sub 2 start anchor has ${count2Start} occurrences`)
}

const sub2End = `return events\n  }`
const idx2End = content.indexOf(sub2End, idx2Start)
if (idx2End === -1) {
  throw new Error(`[FAIL] Sub 2 end anchor not found`)
}

const sub2TargetBlock = content.slice(idx2Start, idx2End + sub2End.length)
content = replaceOnce(content, sub2TargetBlock, '', 'Substituição 2 (raceNarratedEvents)')

// -------------------------------------------------------------
// SUBSTITUIÇÃO 3: TrackEngineeringAndStrategySection
// START: {/* Setup Configuration Panel for this session */}\n              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
// END: </CardContent>\n                </Card>\n              </div>
// -------------------------------------------------------------
const sub3Start = `{/* Setup Configuration Panel for this session */}\n              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`
const idx3Start = content.indexOf(sub3Start)
if (idx3Start === -1) {
  throw new Error(`[FAIL] Sub 3 start anchor not found: ${sub3Start}`)
}
const count3Start = content.split(sub3Start).length - 1
if (count3Start !== 1) {
  throw new Error(`[FAIL] Sub 3 start anchor has ${count3Start} occurrences`)
}

const sub3End = `</CardContent>\n                </Card>\n              </div>`
const idx3End = content.indexOf(sub3End, idx3Start)
if (idx3End === -1) {
  throw new Error(`[FAIL] Sub 3 end anchor not found`)
}

const sub3TargetBlock = content.slice(idx3Start, idx3End + sub3End.length)

const sub3Replacement = `<TrackEngineeringAndStrategySection
                sessKey={sessKey}
                isRaceSession={isRaceSession}
                isDone={isDone}
                isSimulatingSession={isSimulatingSession}
                currentSetup={currentSetup}
                updateCurrentSetup={updateCurrentSetup}
                handleSaveSetup={handleSaveSetup}
                gpInfo={gpInfo}
                raceInitialFuelPct={raceInitialFuelPct}
                setRaceInitialFuelPct={setRaceInitialFuelPct}
                setupFeedback={setupFeedback}
                weather={weather}
                tireStock={tireStock}
                drivers={drivers}
                team={team}
                getStrategyForDriver={getStrategyForDriver}
                calculateDriverTireWearProfile={calculateDriverTireWearProfile}
                updateDriverStartCompound={updateDriverStartCompound}
                addDriverPitStop={addDriverPitStop}
                updateDriverPitStop={updateDriverPitStop}
                removeDriverPitStop={removeDriverPitStop}
                handleStartRace={handleStartRace}
                simSpeed={simSpeed}
                setSimSpeed={setSimSpeed}
                autoSimulateWithoutPause={autoSimulateWithoutPause}
                setAutoSimulateWithoutPause={setAutoSimulateWithoutPause}
                handleRunSession={handleRunSession}
              />`

content = replaceOnce(
  content,
  sub3TargetBlock,
  sub3Replacement,
  'Substituição 3 (TrackEngineeringAndStrategySection)',
)

// -------------------------------------------------------------
// SUBSTITUIÇÃO 4: RaceOperationsCockpit
// START: {/* ESTRUTURAÇÃO DO COCKPIT EM 3 ZONAS (Race Operations Foundation) */}
// END: </Card>\n                    )}\n                  </div>\n                </div>\n              )}
// -------------------------------------------------------------
const sub4Start = `{/* ESTRUTURAÇÃO DO COCKPIT EM 3 ZONAS (Race Operations Foundation) */}`
const idx4Start = content.indexOf(sub4Start)
if (idx4Start === -1) {
  throw new Error(`[FAIL] Sub 4 start anchor not found: ${sub4Start}`)
}
const count4Start = content.split(sub4Start).length - 1
if (count4Start !== 1) {
  throw new Error(`[FAIL] Sub 4 start anchor has ${count4Start} occurrences`)
}

const sub4End = `</Card>\n                    )}\n                  </div>\n                </div>\n              )}`
const idx4End = content.indexOf(sub4End, idx4Start)
if (idx4End === -1) {
  throw new Error(`[FAIL] Sub 4 end anchor not found`)
}

const sub4TargetBlock = content.slice(idx4Start, idx4End + sub4End.length)

const sub4Replacement = `<RaceOperationsCockpit
                isRaceSession={isRaceSession}
                liveRaceState={liveRaceState}
                gpInfo={gpInfo}
                puPoolStatus={puPoolStatus}
                currentSetup={currentSetup}
                team={team}
                handleStartRace={handleStartRace}
                isSimulatingSession={isSimulatingSession}
                isDone={isDone}
                simSpeed={simSpeed}
                setSimSpeed={setSimSpeed}
                handleOpenForcePitModal={handleOpenForcePitModal}
                raceResults={raceResults}
                liveEvents={liveEvents}
                playerCarTactics={playerCarTactics}
                handleChangeTacticalMode={handleChangeTacticalMode}
                playerPaceOrders={playerPaceOrders}
                handleChangePaceOrder={handleChangePaceOrder}
                teamOrders={teamOrders}
                penalties={penalties}
                mechanicalIssues={mechanicalIssues}
                teamOrderProposal={teamOrderProposal}
                handleApplyTeamOrder={handleApplyTeamOrder}
              />`

content = replaceOnce(
  content,
  sub4TargetBlock,
  sub4Replacement,
  'Substituição 4 (RaceOperationsCockpit)',
)

// -------------------------------------------------------------
// IMPORTS
// -------------------------------------------------------------
const importBlock = `import { advanceRound } from '@/pages/race/raceAdvance'
import { generateLapNarratedEvents } from '@/pages/race/raceNarratedEvents'
import { RaceOperationsCockpit } from '@/pages/race/RaceOperationsCockpit'
import { TrackEngineeringAndStrategySection } from '@/pages/race/TrackEngineeringAndStrategySection'
`

// Prepend or add right after the first imports
content = importBlock + content

fs.writeFileSync(targetFile, content, 'utf8')
console.log(`[SUCCESS] RaceSlim.tsx successfully updated!`)
console.log(`New file size: ${(content.length / 1024).toFixed(2)} KB (${content.length} bytes)`)
