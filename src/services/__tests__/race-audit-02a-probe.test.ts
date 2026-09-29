import { describe, it, expect } from 'vitest'
import * as raceEngineModule from '../canonicalRaceEngineService'
import * as pureRaceModule from '../../lib/race/pureRaceEngine'
import { TRACKS } from '../../components/race/tracks'

describe('Inspect exports', () => {
  it('logs exports', () => {
    const trackList = Array.isArray(TRACKS) ? TRACKS : Object.values(TRACKS)
    const engineKeys = Object.keys(raceEngineModule).join(', ')
    const pureKeys = Object.keys(pureRaceModule).join(', ')
    const trackSample = JSON.stringify(trackList.slice(0, 5))
    // Intencionalmente falha um expect para vermos a saída no log de erro do vitest
    expect({ engineKeys, pureKeys, trackCount: trackList.length, trackSample }).toEqual({})
  })
})
