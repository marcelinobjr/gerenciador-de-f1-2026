import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import { formatTireName, type TrackWeatherState } from '@/lib/f1-tire-system'

export function generateLapNarratedEvents(
  currentLap: number,
  grid: SimDriverEntry[],
  _currentWeather: TrackWeatherState,
): LiveRaceEvent[] {
  const events: LiveRaceEvent[] = []
  const nowStr = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const playerDrivers = grid.filter((g) => g.isPlayer && !g.dnf)

  // 1. Critical tire wear warning for player
  playerDrivers.forEach((pd) => {
    if ((pd.tireWear || 0) >= 75 && (pd.tireWear || 0) < 82 && Math.random() < 0.4) {
      events.push({
        id: `ev_tire_${currentLap}_${pd.driverId}`,
        lap: currentLap,
        type: 'tire_warning',
        message: `⚠️ RÁDIO DA EQUIPE: "${pd.driverName}, seus pneus ${formatTireName(pd.tireCompound)} atingiram ${pd.tireWear}% de desgaste! Perda iminente de aderência."`,
        driverName: pd.driverName,
        teamColor: pd.teamColor,
        isPlayer: true,
        timestamp: nowStr,
      })
    } else if ((pd.tireWear || 0) >= 88 && Math.random() < 0.5) {
      events.push({
        id: `ev_crit_tire_${currentLap}_${pd.driverId}`,
        lap: currentLap,
        type: 'tire_warning',
        message: `🚨 PNEU EM FIM DE VIDA! ${pd.driverName} relata forte granulação e risco de delaminação (${pd.tireWear}% desgaste).`,
        driverName: pd.driverName,
        teamColor: pd.teamColor,
        isPlayer: true,
        timestamp: nowStr,
      })
    }
  })

  // 2. Overtakes involving the player or Top 5
  if (Math.random() < 0.35 && playerDrivers.length > 0) {
    const p = playerDrivers[Math.floor(Math.random() * playerDrivers.length)]
    const isOvertaking = Math.random() > 0.45
    if (isOvertaking) {
      events.push({
        id: `ev_overtake_${currentLap}_${p.driverId}`,
        lap: currentLap,
        type: 'overtake',
        message: `⚡ ULTRAPASSAGEM! ${p.driverName} aciona o modo de ataque elétrico 350kW na reta e ganha posição com bela manobra!`,
        driverName: p.driverName,
        teamColor: p.teamColor,
        isPlayer: true,
        timestamp: nowStr,
      })
    } else {
      events.push({
        id: `ev_def_${currentLap}_${p.driverId}`,
        lap: currentLap,
        type: 'overtake',
        message: `🛡️ DEFESA DE POSIÇÃO: ${p.driverName} fecha a porta na frenagem e segura o ataque do adversário!`,
        driverName: p.driverName,
        teamColor: p.teamColor,
        isPlayer: true,
        timestamp: nowStr,
      })
    }
  }

  // 3. Fastest lap shoutout
  if (currentLap > 3 && Math.random() < 0.2) {
    const candidates = grid.filter((g) => !g.dnf)
    const fastDriver = candidates[Math.floor(Math.random() * candidates.length)]
    if (fastDriver) {
      events.push({
        id: `ev_fl_${currentLap}_${fastDriver.driverId}`,
        lap: currentLap,
        type: 'fastest_lap',
        message: `🟣 VOLTA MAIS RÁPIDA! ${fastDriver.driverName} (${fastDriver.teamName}) crava o melhor tempo da prova com 1:${Math.floor(18 + Math.random() * 8)}.${Math.floor(100 + Math.random() * 899)}.`,
        driverName: fastDriver.driverName,
        teamColor: fastDriver.teamColor,
        isPlayer: fastDriver.isPlayer,
        timestamp: nowStr,
      })
    }
  }

  // 4. Rival AI pit stops
  const aiInPits = grid.filter((g) => !g.isPlayer && !g.dnf && g.pitLap === currentLap)
  aiInPits.forEach((ai) => {
    events.push({
      id: `ev_pit_${currentLap}_${ai.driverId}`,
      lap: currentLap,
      type: 'pit_stop',
      message: `🔧 BOX, BOX! ${ai.driverName} (${ai.teamName}) nos boxes para troca de pneus (${formatTireName(ai.secondCompound)}). Parada realizada em ${(2.1 + Math.random() * 0.8).toFixed(2)}s.`,
      driverName: ai.driverName,
      teamColor: ai.teamColor,
      isPlayer: false,
      timestamp: nowStr,
    })
  })

  return events
}
