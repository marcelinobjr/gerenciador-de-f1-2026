/**
 * Mapas e helpers para carregamento seguro de pôsteres/fotos locais dos pilotos MBJ 2026.
 * As fotos residem em public/pilotos/ e utilizam fallback direto para iniciais estilizadas.
 */

export function normalizeDriverSurname(fullName: string): string {
  if (!fullName) return ''
  const parts = fullName.trim().toLowerCase().split(/\s+/)
  return parts[parts.length - 1].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function getLocalDriverPosterUrl(name: string): string | null {
  if (!name) return null
  const surname = normalizeDriverSurname(name)

  // Mapeamento de exceções e nomes compostos
  const aliasMap: Record<string, string> = {
    verstappen: 'verstappen.webp',
    lawson: 'lawson.webp',
    hamilton: 'hamilton.webp',
    leclerc: 'leclerc.webp',
    norris: 'norris.webp',
    piastri: 'piastri.webp',
    russell: 'russell.webp',
    antonelli: 'antonelli.webp',
    alonso: 'alonso.webp',
    stroll: 'stroll.webp',
    gasly: 'gasly.webp',
    doohan: 'doohan.webp',
    albon: 'albon.webp',
    sainz: 'sainz.webp',
    tsunoda: 'tsunoda.webp',
    hadjar: 'hadjar.webp',
    ocon: 'ocon.webp',
    bearman: 'bearman.webp',
    hulkenberg: 'hulkenberg.webp',
    bortoleto: 'bortoleto.webp',
    perez: 'perez.webp',
    bottas: 'bottas.webp',
    ricciardo: 'ricciardo.webp',
    magnussen: 'magnussen.webp',
    zhou: 'zhou.webp',
    schumacher: 'schumacher.webp',
    sargeant: 'sargeant.webp',
    devries: 'devries.webp',
    vries: 'devries.webp',
    shwartzman: 'shwartzman.webp',
    pourchaire: 'pourchaire.webp',
    palou: 'palou.webp',
    herta: 'herta.webp',
    oward: 'oward.webp',
    drugovich: 'drugovich.webp',
    colapinto: 'colapinto.webp',
    fittipaldi: 'fittipaldi.webp',
    efittipaldi: 'efittipaldi.webp',
    camara: 'camara.webp',
    lindblad: 'lindblad.webp',
    aron: 'aron.webp',
    maloney: 'maloney.webp',
    iwasa: 'iwasa.webp',
    giovinazzi: 'giovinazzi.webp',
    vesti: 'vesti.webp',
    martins: 'martins.webp',
    slater: 'slater.webp',
    fornaroli: 'fornaroli.webp',
    mini: 'mini.webp',
    taponen: 'taponen.webp',
    chastain: 'chastain.webp',
    larson: 'larson.webp',
  }

  const filename = aliasMap[surname] || `${surname}.webp`
  return `/pilotos/${filename}`
}

export function getInitials(name: string): string {
  if (!name) return 'F1'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
