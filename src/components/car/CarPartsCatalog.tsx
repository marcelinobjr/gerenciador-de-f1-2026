import React from 'react'
import { getCarPartPhoto } from '@/data/assets/carPartAssets'

export interface CarPartVisualMeta {
  id: string
  name: string
  label: string
  description: string
  defaultSpec: string
}

export const CAR_PARTS_CATALOG: CarPartVisualMeta[] = [
  {
    id: 'frontWing',
    name: 'Asa dianteira',
    label: 'Asa dianteira',
    description: 'Direcionamento de fluxo e sustentação frontal aeroativa',
    defaultSpec: 'Spec B',
  },
  {
    id: 'rearWing',
    name: 'Asa traseira',
    label: 'Asa traseira',
    description: 'Downforce posterior e mecanismo aeroativo/DRS',
    defaultSpec: 'Spec B',
  },
  {
    id: 'floor',
    name: 'Assoalho',
    label: 'Assoalho',
    description: 'Efeito solo, túneis venturi e extração de pressão',
    defaultSpec: 'Spec A',
  },
  {
    id: 'sidepods',
    name: 'Laterais (aerodinâmica ativa)',
    label: 'Laterais (aerodinâmica ativa)',
    description: 'Sidepods, flaps dinâmicos e arrefecimento de radiadores',
    defaultSpec: 'Spec B',
  },
  {
    id: 'engine',
    name: 'Motor',
    label: 'Motor',
    description: 'Unidade de Potência 50/50 híbrida FIA 2026',
    defaultSpec: 'Spec C',
  },
  {
    id: 'suspension',
    name: 'Suspensão',
    label: 'Suspensão',
    description: 'Pushrod/pullrod geométrica de alta estabilidade mecânica',
    defaultSpec: 'Spec B',
  },
]

/**
 * Renderiza ilustrações técnicas SVG precisas e fotorealistas estilizadas para cada componente do carro
 */
export const PartIllustration: React.FC<{ partKey: string; className?: string }> = ({
  partKey,
  className = 'w-24 h-16',
}) => {
  const norm = partKey.toLowerCase()
  const realPhoto = getCarPartPhoto(partKey)

  if (realPhoto) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-md ${className}`}
      >
        <img
          src={realPhoto}
          alt={partKey}
          className="w-full h-full object-contain filter drop-shadow-sm transition-transform hover:scale-105"
        />
      </div>
    )
  }

  if (norm.includes('front') || norm.includes('dianteira')) {
    // Asa Dianteira
    return (
      <svg
        viewBox="0 0 120 70"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fwGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="cfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#090D15" />
          </linearGradient>
        </defs>
        {/* Placa terminal esquerda */}
        <path
          d="M12 20 L24 15 L26 48 L10 52 Z"
          fill="url(#cfGrad)"
          stroke="#475569"
          strokeWidth="1"
        />
        {/* Placa terminal direita */}
        <path
          d="M108 20 L96 15 L94 48 L110 52 Z"
          fill="url(#cfGrad)"
          stroke="#475569"
          strokeWidth="1"
        />
        {/* Plano principal da asa */}
        <path
          d="M18 36 Q60 48 102 36 L100 44 Q60 56 20 44 Z"
          fill="url(#fwGrad)"
          stroke="#64748B"
          strokeWidth="1"
        />
        {/* Flap superior ajustável */}
        <path d="M22 28 Q60 38 98 28 L96 34 Q60 44 24 34 Z" fill="#CBD5E1" opacity="0.9" />
        {/* Nariz central / pilão de montagem */}
        <path d="M52 14 L68 14 L65 42 L55 42 Z" fill="#0F172A" stroke="#334155" strokeWidth="1" />
        <ellipse cx="60" cy="16" rx="7" ry="3" fill="#E10600" />
      </svg>
    )
  }

  if (norm.includes('rear') || norm.includes('traseira')) {
    // Asa Traseira
    return (
      <svg
        viewBox="0 0 120 70"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="rwGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>
        {/* Endplates */}
        <rect
          x="14"
          y="16"
          width="10"
          height="38"
          rx="2"
          fill="url(#rwGrad)"
          stroke="#475569"
          strokeWidth="1"
        />
        <rect
          x="96"
          y="16"
          width="10"
          height="38"
          rx="2"
          fill="url(#rwGrad)"
          stroke="#475569"
          strokeWidth="1"
        />
        {/* Mainplane */}
        <path d="M24 28 L96 28 L94 36 L26 36 Z" fill="#090D15" stroke="#E10600" strokeWidth="1.2" />
        {/* DRS Flap */}
        <path d="M24 20 L96 20 L95 26 L25 26 Z" fill="#E2E8F0" opacity="0.85" />
        {/* Atuador DRS central */}
        <rect x="56" y="15" width="8" height="22" rx="1" fill="#DC2626" />
        {/* Pylon / suporte pescoço de ganso */}
        <path d="M57 36 L63 36 L61 54 L59 54 Z" fill="#334155" />
      </svg>
    )
  }

  if (
    norm.includes('floor') ||
    norm.includes('assoalho') ||
    norm.includes('diffuser') ||
    norm.includes('difusor')
  ) {
    // Assoalho / Difusor
    return (
      <svg
        viewBox="0 0 120 70"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        {/* Prancha de efeito solo */}
        <path
          d="M20 30 L45 20 L98 22 L105 38 L80 50 L25 46 Z"
          fill="url(#floorGrad)"
          stroke="#475569"
          strokeWidth="1"
        />
        {/* Túneis venturi e aletas */}
        <path d="M30 33 L85 35" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="3 2" />
        <path d="M35 38 L90 40" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="3 2" />
        <path d="M42 43 L95 45" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Borda de ataque com geradores de vórtice */}
        <path d="M20 30 L25 46 L32 45 L26 31 Z" fill="#E10600" opacity="0.8" />
        {/* Difusor traseiro */}
        <path
          d="M85 24 L105 24 L108 40 L88 40 Z"
          fill="#334155"
          stroke="#94A3B8"
          strokeWidth="0.8"
        />
      </svg>
    )
  }

  if (
    norm.includes('sidepod') ||
    norm.includes('lateral') ||
    norm.includes('laterais') ||
    norm.includes('chassis')
  ) {
    // Laterais / Sidepods (aerodinâmica ativa)
    return (
      <svg
        viewBox="0 0 120 70"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="60%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
        {/* Entrada de ar do radiador / Undercut */}
        <path
          d="M22 28 Q45 18 85 24 L102 36 L92 48 Q55 45 28 42 Z"
          fill="url(#sideGrad)"
          stroke="#334155"
          strokeWidth="1"
        />
        {/* Abertura de admissão frontal */}
        <ellipse cx="28" cy="35" rx="6" ry="10" fill="#090D15" stroke="#E10600" strokeWidth="1.5" />
        {/* Grelhas de ventilação / Louvres */}
        <line x1="58" y1="28" x2="68" y2="30" stroke="#1E293B" strokeWidth="1.5" />
        <line x1="62" y1="32" x2="72" y2="34" stroke="#1E293B" strokeWidth="1.5" />
        <line x1="66" y1="36" x2="76" y2="38" stroke="#1E293B" strokeWidth="1.5" />
        {/* Faixa decorativa Audi / Revolut */}
        <path d="M42 38 L88 40 L85 43 L40 41 Z" fill="#E10600" />
      </svg>
    )
  }

  if (
    norm.includes('engine') ||
    norm.includes('motor') ||
    norm.includes('pu') ||
    norm.includes('potencia')
  ) {
    // Motor / Power Unit
    return (
      <svg
        viewBox="0 0 120 70"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="iceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>
        {/* Bloco V6 */}
        <rect
          x="36"
          y="22"
          width="46"
          height="30"
          rx="3"
          fill="url(#iceGrad)"
          stroke="#94A3B8"
          strokeWidth="1"
        />
        {/* Cabeçote e coletores */}
        <circle cx="48" cy="28" r="4" fill="#020617" stroke="#CBD5E1" strokeWidth="1" />
        <circle cx="60" cy="28" r="4" fill="#020617" stroke="#CBD5E1" strokeWidth="1" />
        <circle cx="72" cy="28" r="4" fill="#020617" stroke="#CBD5E1" strokeWidth="1" />
        {/* Turbo / MGU-H central */}
        <circle cx="88" cy="35" r="9" fill="#1E293B" stroke="#E10600" strokeWidth="1.5" />
        <circle cx="88" cy="35" r="4" fill="#E2E8F0" />
        {/* Dutos de escape dourados */}
        <path d="M40 38 Q25 45 18 52" stroke="#F59E0B" strokeWidth="2.5" fill="none" />
        <path d="M45 40 Q30 48 22 54" stroke="#F59E0B" strokeWidth="2.5" fill="none" />
        {/* Bateria ERS inferior */}
        <rect x="38" y="52" width="42" height="6" rx="1" fill="#10B981" />
      </svg>
    )
  }

  // Suspensão / Freios default
  return (
    <svg viewBox="0 0 120 70" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="suspGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      {/* Triângulo superior (wishbone) */}
      <polygon
        points="18,22 92,20 86,26 24,28"
        fill="url(#suspGrad)"
        stroke="#64748B"
        strokeWidth="0.8"
      />
      {/* Triângulo inferior */}
      <polygon
        points="16,48 94,50 88,44 22,42"
        fill="url(#suspGrad)"
        stroke="#64748B"
        strokeWidth="0.8"
      />
      {/* Tirante Pushrod / barra de torção */}
      <line x1="20" y1="48" x2="88" y2="22" stroke="#E10600" strokeWidth="2" />
      {/* Hub da roda / montante */}
      <rect
        x="90"
        y="18"
        width="14"
        height="34"
        rx="2"
        fill="#020617"
        stroke="#CBD5E1"
        strokeWidth="1.2"
      />
      {/* Duto de freio e disco ventilado */}
      <circle cx="97" cy="35" r="9" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" />
      <circle cx="97" cy="35" r="4" fill="#090D15" />
    </svg>
  )
}
