import { describe, it, expect } from 'vitest'
import { baselineAfterBData } from '@/data/baseline-after-b-eval'

describe('inspect-after-b-data', () => {
  it('checks computed AFTER stats', () => {
    expect(baselineAfterBData).toBeDefined()
    expect(baselineAfterBData.teamsStats).toHaveLength(12)

    const audi = baselineAfterBData.teamsStats.find((t) => t.teamKey === 'audi')!
    const haas = baselineAfterBData.teamsStats.find((t) => t.teamKey === 'haas')!
    const alpine = baselineAfterBData.teamsStats.find((t) => t.teamKey === 'alpine')!
    const rb = baselineAfterBData.teamsStats.find((t) => t.teamKey === 'racingbulls')!
    const williams = baselineAfterBData.teamsStats.find((t) => t.teamKey === 'williams')!

    console.log('--- STATS AFTER B ---')
    console.log('AUDI:', audi)
    console.log('HAAS:', haas)
    console.log('ALPINE:', alpine)
    console.log('RACING BULLS:', rb)
    console.log('WILLIAMS:', williams)

    // Intencionalmente lançar erro com JSON formatado para capturar nos erros do QA:
    const dump = JSON.stringify(baselineAfterBData, null, 2)
    throw new Error('DUMP_AFTER_JSON:' + dump)
  })
})
