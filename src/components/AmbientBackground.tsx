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

      {/* Camada difusa de iluminação dark de garagem */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#06080E]/85 via-[#06080E]/70 to-[#06080E]/95 pointer-events-none" />

      {/* Luzes vermelhas de teto e glow atmosférico F1 2026 */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#E10600]/20 via-[#E10600]/5 to-transparent blur-2xl pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#E10600]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[#E10600]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[520px] h-48 bg-[#E10600]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-2/3 left-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  )
}

export default AmbientBackground
