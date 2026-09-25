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
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#F8FAFC] ${className}`}
      style={{ opacity }}
    >
      {/* Imagem de fundo: Garagem técnica oficial com overlay claro consistente */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_right_35%] md:bg-center bg-no-repeat pointer-events-none opacity-10 mix-blend-multiply"
        style={{ backgroundImage: `url(${heroGarageBg})` }}
      />

      {/* Camada de superfície lisa off-white */}
      <div className="absolute inset-0 bg-[#F8FAFC]/90 pointer-events-none" />
    </div>
  )
}

export default AmbientBackground
