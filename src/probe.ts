import * as fs from 'fs'
console.log(
  'pureRaceEngine content length:',
  fs.readFileSync('src/services/pureRaceEngine.ts', 'utf8').length,
)
