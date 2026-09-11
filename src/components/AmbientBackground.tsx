import React from 'react'
import heroGarageBg from '@/assets/chatgpt-image-10-de-set.de-2026-122301-c97f3.png'

interface AmbientBackgroundProps {
  className?: string
  opacity?: number
}

/**
 * AmbientBackground
 * Fundo de ambiente global da garagem F1 2026 com luzes vermelhas de teto,
 * gradiente escuro profundo e glows neon característicos do Painel principal.
 */
export function AmbientBackground({ className = '', opacity = 1 }: AmbientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      {/* Imagem de fundo: Garagem técnica escura com carro F1 central */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_top_20%] bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${heroGarageBg})` }}
      />

      {/* Camada de overlay escuro (degradê preto semitransparente 75-85%) para garantir legibilidade máxima */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#06080E]/85 via-[#06080E]/75 to-[#06080E]/90 pointer-events-none" />

      {/* Sutis glows atmosféricos sem poluição visual sobre a foto */}
      <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-[#E10600]/15 via-transparent to-transparent blur-xl pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#E10600]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-[#E10600]/10 rounded-full blur-[100px] pointer-events-none" />
    </div>
  )
}

export default AmbientBackground
