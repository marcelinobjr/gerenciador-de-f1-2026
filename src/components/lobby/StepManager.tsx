import React, { useState } from 'react'
import {
  User,
  Shield,
  Zap,
  ChevronRight,
  ChevronLeft,
  Check,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  MANAGER_PROFILES,
  getManagerProfileById,
  BASE_MANAGER_ATTRIBUTES,
} from '@/lib/manager-profiles'
import { MANAGER_AVATAR_ASSETS } from '@/lib/lobby-assets'
import { ManagerCustomData, ManagerProfile } from '@/types/career-wizard'

interface StepManagerProps {
  managerData: ManagerCustomData
  selectedProfile: ManagerProfile
  onUpdateManagerData: (data: Partial<ManagerCustomData>) => void
  onSelectProfile: (profile: ManagerProfile) => void
  onNext: () => void
  onBack: () => void
}

const NATIONALITIES = [
  'Brasil 🇧🇷',
  'Reino Unido 🇬🇧',
  'Alemanha 🇩🇪',
  'Itália 🇮🇹',
  'França 🇫🇷',
  'Espanha 🇪🇸',
  'Estados Unidos 🇺🇸',
  'Holanda 🇳🇱',
  'Portugal 🇵🇹',
  'Japão 🇯🇵',
  'Suíça 🇨🇭',
  'Áustria 🇦🇹',
  'Austrália 🇦🇺',
  'Canadá 🇨🇦',
  'México 🇲🇽',
  'Argentina 🇦🇷',
]

export function StepManager({
  managerData,
  selectedProfile,
  onUpdateManagerData,
  onSelectProfile,
  onNext,
  onBack,
}: StepManagerProps) {
  const [showAllAttributes, setShowAllAttributes] = useState(false)

  // Validação simples
  const isNameValid = managerData.name.trim().length >= 2

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6 sm:py-8 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="text-center space-y-2 pb-4 border-b border-[#1F2733]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] text-xs font-mono font-bold uppercase">
          <User className="w-3.5 h-3.5" /> Etapa 1 // Chefe de Equipe
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
          Escolha seu Perfil de Manager
        </h2>
        <p className="text-xs sm:text-sm text-[#8B95A7] max-w-2xl mx-auto">
          Cada perfil molda a identidade de comando da escuderia, com bônus de gestão e estilos
          estratégicos únicos.
        </p>
      </div>

      {/* Grid de 6 Perfis Oficiais (Manager.pdf) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MANAGER_PROFILES.map((profile) => {
          const isSelected = selectedProfile.id === profile.id
          const avatarAsset = MANAGER_AVATAR_ASSETS.find((a) => a.id === profile.id)

          return (
            <Card
              key={profile.id}
              onClick={() => onSelectProfile(profile)}
              className={`bg-[#11161F] transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                isSelected
                  ? 'border-[#E10600] ring-2 ring-[#E10600]/30 shadow-xl shadow-[#E10600]/10'
                  : 'border-[#1F2733] hover:border-[#8B95A7]/60'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}

              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Avatar e Título */}
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#0B0E14] border border-[#1F2733] shrink-0">
                    <img
                      src={avatarAsset?.dropboxUrl}
                      alt={profile.title}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#8B95A7] uppercase">
                      #{profile.number} • {profile.archetype}
                    </span>
                    <h3 className="text-base font-bold text-[#F5F7FA]">{profile.title}</h3>
                    <span className="text-[11px] font-mono text-cyan-400 block">
                      {profile.specialty}
                    </span>
                  </div>
                </div>

                {/* Estilo & Descrição */}
                <div className="space-y-1.5 text-xs">
                  <div className="text-[10px] font-mono uppercase text-[#8B95A7]">
                    Estilo: <strong className="text-[#F5F7FA] font-sans">{profile.style}</strong>
                  </div>
                  <p className="text-[#8B95A7] text-[11px] leading-relaxed line-clamp-3">
                    {profile.description}
                  </p>
                </div>

                {/* Bônus Principais */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono uppercase text-[#8B95A7] flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> Bônus Principais:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.bonuses.map((b, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[10px] font-mono bg-emerald-500/10 border-emerald-500/30 text-emerald-400 py-0.5 px-2"
                      >
                        {b.attribute} +{b.value}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Fraqueza */}
                <div className="pt-1">
                  <div className="text-[10px] font-mono uppercase text-[#8B95A7] flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> Fraqueza:
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono bg-red-500/10 border-red-500/30 text-red-400 py-0.5 px-2"
                  >
                    {profile.weakness.attribute} {profile.weakness.value}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Personalização dos Dados do Jogador */}
      <Card className="bg-[#11161F] border-[#1F2733] shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1F2733]">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-[#F5F7FA] uppercase tracking-wider font-mono">
              Dados Pessoais do Chefe de Equipe
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="managerName" className="text-xs font-mono uppercase text-[#8B95A7]">
                Nome do Manager *
              </Label>
              <Input
                id="managerName"
                placeholder="Ex: Ayrton da Silva, Jean Todt..."
                value={managerData.name}
                onChange={(e) => onUpdateManagerData({ name: e.target.value })}
                className="bg-[#0B0E14] border-[#1F2733] text-[#F5F7FA] text-sm focus-visible:ring-[#E10600]"
              />
              {!isNameValid && (
                <p className="text-[11px] text-red-400 font-mono">Informe ao menos 2 caracteres.</p>
              )}
            </div>

            {/* Nacionalidade */}
            <div className="space-y-2">
              <Label htmlFor="managerNat" className="text-xs font-mono uppercase text-[#8B95A7]">
                Nacionalidade
              </Label>
              <select
                id="managerNat"
                value={managerData.nationality}
                onChange={(e) => onUpdateManagerData({ nationality: e.target.value })}
                className="w-full h-9 rounded-md bg-[#0B0E14] border border-[#1F2733] px-3 py-1 text-sm text-[#F5F7FA] focus:outline-none focus:border-[#E10600]"
              >
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Idade (Opcional) */}
            <div className="space-y-2">
              <Label htmlFor="managerAge" className="text-xs font-mono uppercase text-[#8B95A7]">
                Idade (Opcional)
              </Label>
              <Input
                id="managerAge"
                type="number"
                min={21}
                max={85}
                placeholder="42"
                value={managerData.age || ''}
                onChange={(e) =>
                  onUpdateManagerData({
                    age: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                className="bg-[#0B0E14] border-[#1F2733] text-[#F5F7FA] text-sm focus-visible:ring-[#E10600]"
              />
            </div>
          </div>

          {/* Toggle para ver os 28 atributos estruturados do Manager.pdf */}
          <div className="pt-2 border-t border-[#1F2733]/60 space-y-3">
            <button
              type="button"
              onClick={() => setShowAllAttributes((v) => !v)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer"
            >
              {showAllAttributes
                ? '▲ Ocultar atributos detalhados'
                : '▼ Ver todos os 28 atributos base estruturados (Tabela Oficial Manager.pdf)'}
            </button>

            {showAllAttributes && (
              <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3 animate-fade-in">
                <p className="text-[11px] text-[#8B95A7] leading-relaxed">
                  Os valores abaixo vêm da matriz oficial de características (escala 0-100) para o
                  perfil <strong className="text-[#F5F7FA]">{selectedProfile.title}</strong>. Nesta
                  Fase 2, os atributos ficam devidamente registrados e salvos na carreira,
                  preparando os futuros cálculos profundos de liderança, moral e negociação.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {Object.entries(selectedProfile.baseAttributes).map(([key, val]) => (
                    <div
                      key={key}
                      className="p-2 rounded bg-[#161D29]/60 border border-[#1F2733] flex items-center justify-between"
                    >
                      <span className="text-[#8B95A7] text-[10px] truncate">
                        {BASE_MANAGER_ATTRIBUTES[key] || key}:
                      </span>
                      <strong className="text-[#F5F7FA] text-xs ml-1">{val}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Barra de Navegação */}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Início
        </Button>

        <Button
          type="button"
          onClick={onNext}
          disabled={!isNameValid}
          className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-[#E10600]/25 flex items-center gap-1.5"
        >
          Continuar para Universo <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
