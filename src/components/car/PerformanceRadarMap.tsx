import React from 'react'

export interface RadarMetric {
  key: string
  label: string
  ourValue: number
  gridAverage: number
}

export interface PerformanceRadarMapProps {
  metrics?: RadarMetric[]
}

const DEFAULT_METRICS: RadarMetric[] = [
  { key: 'aero', label: 'Aerodinâmica', ourValue: 82, gridAverage: 76 },
  { key: 'topSpeed', label: 'Velocidade Máxima', ourValue: 76, gridAverage: 78 },
  { key: 'traction', label: 'Tração', ourValue: 78, gridAverage: 74 },
  { key: 'balance', label: 'Equilíbrio', ourValue: 75, gridAverage: 72 },
  { key: 'tireWear', label: 'Desgaste de Pneus', ourValue: 68, gridAverage: 71 },
  { key: 'reliability', label: 'Confiabilidade', ourValue: 82, gridAverage: 79 },
]

export const PerformanceRadarMap: React.FC<PerformanceRadarMapProps> = ({
  metrics = DEFAULT_METRICS,
}) => {
  const center = 140
  const radius = 95
  const count = metrics.length
  const angleStep = (Math.PI * 2) / count

  // Gera coordenadas para um raio e valor de 0 a 100
  const getCoordinates = (value: number, index: number) => {
    // Começa no topo (-PI / 2)
    const angle = index * angleStep - Math.PI / 2
    const dist = (value / 100) * radius
    return {
      x: center + dist * Math.cos(angle),
      y: center + dist * Math.sin(angle),
    }
  }

  // Gera caminhos SVG para o polígono
  const ourPoints = metrics
    .map((m, i) => {
      const pt = getCoordinates(m.ourValue, i)
      return `${pt.x},${pt.y}`
    })
    .join(' ')

  const gridPoints = metrics
    .map((m, i) => {
      const pt = getCoordinates(m.gridAverage, i)
      return `${pt.x},${pt.y}`
    })
    .join(' ')

  // Círculos de grid (níveis de 20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-900">🕸 Mapa de Performance</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Comparação do nosso carro com a média do grid nas principais áreas técnicas.
        </p>
      </div>

      {/* SVG Radar */}
      <div className="flex items-center justify-center my-3">
        <svg viewBox="0 0 280 280" className="w-full max-w-[270px] h-auto overflow-visible">
          {/* Anéis de referência de fundo */}
          {gridLevels.map((lvl, idx) => {
            const r = radius * lvl
            const polygonPts = Array.from({ length: count })
              .map((_, i) => {
                const angle = i * angleStep - Math.PI / 2
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
              })
              .join(' ')
            return (
              <polygon key={idx} points={polygonPts} fill="none" stroke="#E2E8F0" strokeWidth="1" />
            )
          })}

          {/* Eixos radiais */}
          {metrics.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2
            const endX = center + radius * Math.cos(angle)
            const endY = center + radius * Math.sin(angle)
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={endX}
                y2={endY}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
            )
          })}

          {/* Polígono Média do Grid (Cinza claro translúcido) */}
          <polygon
            points={gridPoints}
            fill="#94A3B8"
            fillOpacity="0.25"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />

          {/* Polígono Nosso Carro (Vermelho dinâmico) */}
          <polygon
            points={ourPoints}
            fill="#EF4444"
            fillOpacity="0.2"
            stroke="#DC2626"
            strokeWidth="2"
          />

          {/* Vértices Nosso Carro */}
          {metrics.map((m, i) => {
            const pt = getCoordinates(m.ourValue, i)
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#DC2626"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            )
          })}

          {/* Vértices Média do Grid */}
          {metrics.map((m, i) => {
            const pt = getCoordinates(m.gridAverage, i)
            return <circle key={`grid-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#64748B" />
          })}

          {/* Labels das Dimensões */}
          {metrics.map((m, i) => {
            const angle = i * angleStep - Math.PI / 2
            const labelDist = radius + 22
            const lx = center + labelDist * Math.cos(angle)
            const ly = center + labelDist * Math.sin(angle)

            return (
              <g key={`lbl-${m.key}`} transform={`translate(${lx}, ${ly})`}>
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-700 font-bold text-[10px]"
                >
                  {m.label}
                </text>
                <text
                  y="11"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-900 font-mono font-bold text-[10px]"
                >
                  {m.ourValue}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legenda inferior */}
      <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
          <span className="font-semibold text-slate-800">Nosso carro</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
          <span className="font-medium text-slate-500">Média do grid</span>
        </div>
      </div>
    </div>
  )
}

export default PerformanceRadarMap
