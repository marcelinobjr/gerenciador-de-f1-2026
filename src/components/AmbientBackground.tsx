import React from 'react'
import heroGarageBg from '@/assets/chatgpt-image-10-de-set.de-2026-122312-fc092.png'

interface AmbientBackgroundProps {
  className?: string
  opacity?: number
}

/**
 * AmbientBackground
 * Fundo de ambiente global da garagem F1 2026 (carro branco F1 frontal na garagem molhada,
 * iluminação vermelha, HUDs holográficos com telemetria, voltas e estratégia de pneus)
 * com overlay escuro (~70-85%) e flares vermelhos para legibilidade perfeita em todas as telas.
 */
export function AmbientBackground({ className = '', opacity = 1 }: AmbientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      {/* Imagem de fundo: Garagem técnica oficial com carro F1 branco e HUDs holográficos */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_right_35%] md:bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${heroGarageBg})` }}
      />

      {/* Camada de overlay escuro semitransparente (70-85%) com sutis flares vermelhos para legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#06080E]/80 via-[#06080E]/75 to-[#06080E]/88 pointer-events-none" />

      {/* Sutis glows atmosféricos vermelhos valorizando a iluminação da garagem */}
      <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-[#E10600]/20 via-transparent to-transparent blur-xl pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#E10600]/12 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-[#E10600]/15 rounded-full blur-[100px] pointer-events-none" />
    </div>
  )
}

export default AmbientBackground
