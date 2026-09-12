// Helper para identificar circuitos fisicamente exigentes
export function isDemandingTrackName(name: string, circuit: string): boolean {
  const demandingTrackKeywords = [
    'Singapura',
    'Marina Bay',
    'Interlagos',
    'São Paulo',
    'Brasil',
    'Malásia',
    'Sepang',
    'Catar',
    'Lusail',
  ]
  return demandingTrackKeywords.some(
    (kw) =>
      name.toLowerCase().includes(kw.toLowerCase()) ||
      circuit.toLowerCase().includes(kw.toLowerCase()),
  )
}
