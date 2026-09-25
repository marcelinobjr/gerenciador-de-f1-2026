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
      <div className="text-center space-y-2 pb-4 border-b border-[#E2E8F0]">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-50 border border-red-200 text-[#E10600] text-xs font-mono font-bold uppercase">
          <User className="w-3.5 h-3.5" /> Etapa 1 // Chefe de Equipe
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
          Escolha seu Perfil de Manager
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl mx-auto">
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
              className={`bg-white transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden shadow-xs ${
                isSelected
                  ? 'border-[#E10600] ring-2 ring-red-100 shadow-md'
                  : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-neutral-50/50'
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
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                    <img
                      src={avatarAsset?.dropboxUrl}
                      alt={profile.title}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#64748B] uppercase">
                      #{profile.number} • {profile.archetype}
                    </span>
                    <h3 className="text-base font-bold text-[#0F172A]">{profile.title}</h3>
                    <span className="text-[11px] font-mono text-cyan-700 font-medium block">
                      {profile.specialty}
                    </span>
                  </div>
                </div>

                {/* Estilo & Descrição */}
                <div className="space-y-1.5 text-xs">
                  <div className="text-[10px] font-mono uppercase text-[#64748B]">
                    Estilo: <strong className="text-[#0F172A] font-sans">{profile.style}</strong>
                  </div>
                  <p className="text-[#64748B] text-[11px] leading-relaxed line-clamp-3">
                    {profile.description}
                  </p>
                </div>

                {/* Bônus Principais */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono uppercase text-[#64748B] flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-600" /> Bônus Principais:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.bonuses.map((b, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[10px] font-mono bg-emerald-50 border-emerald-200 text-emerald-700 py-0.5 px-2"
                      >
                        {b.attribute} +{b.value}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Fraqueza */}
                <div className="pt-1">
                  <div className="text-[10px] font-mono uppercase text-[#64748B] flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Fraqueza:
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono bg-rose-50 border-rose-200 text-rose-700 py-0.5 px-2"
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
      <Card className="bg-white border-[#E2E8F0] shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-mono">
              Dados Pessoais do Chefe de Equipe
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="managerName" className="text-xs font-mono uppercase text-[#64748B]">
                Nome do Manager *
              </Label>
              <Input
                id="managerName"
                placeholder="Ex: Ayrton da Silva, Jean Todt..."
                value={managerData.name}
                onChange={(e) => onUpdateManagerData({ name: e.target.value })}
                className="bg-white border-[#CBD5E1] text-[#0F172A] text-sm focus-visible:ring-[#E10600]"
              />
              {!isNameValid && (
                <p className="text-[11px] text-rose-600 font-mono">
                  Informe ao menos 2 caracteres.
                </p>
              )}
            </div>

            {/* Nacionalidade */}
            <div className="space-y-2">
              <Label htmlFor="managerNat" className="text-xs font-mono uppercase text-[#64748B]">
                Nacionalidade
              </Label>
              <select
                id="managerNat"
                value={managerData.nationality}
                onChange={(e) => onUpdateManagerData({ nationality: e.target.value })}
                className="w-full h-9 rounded-md bg-white border border-[#CBD5E1] px-3 py-1 text-sm text-[#0F172A] focus:outline-none focus:border-[#E10600]"
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
              <Label htmlFor="managerAge" className="text-xs font-mono uppercase text-[#64748B]">
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
                className="bg-white border-[#CBD5E1] text-[#0F172A] text-sm focus-visible:ring-[#E10600]"
              />
            </div>
          </div>

          {/* Toggle para ver os 28 atributos estruturados do Manager.pdf */}
          <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
            <button
              type="button"
              onClick={() => setShowAllAttributes((v) => !v)}
              className="text-xs font-mono text-cyan-700 hover:text-cyan-800 underline underline-offset-4 cursor-pointer"
            >
              {showAllAttributes
                ? '▲ Ocultar atributos detalhados'
                : '▼ Ver todos os 28 atributos base estruturados (Tabela Oficial Manager.pdf)'}
            </button>

            {showAllAttributes && (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 animate-fade-in">
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Os valores abaixo vêm da matriz oficial de características (escala 0-100) para o
                  perfil <strong className="text-[#0F172A]">{selectedProfile.title}</strong>. Nesta
                  Fase 2, os atributos ficam devidamente registrados e salvos na carreira,
                  preparando os futuros cálculos profundos de liderança, moral e negociação.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {Object.entries(selectedProfile.baseAttributes).map(([key, val]) => (
                    <div
                      key={key}
                      className="p-2 rounded bg-white border border-[#E2E8F0] flex items-center justify-between"
                    >
                      <span className="text-[#64748B] text-[10px] truncate">
                        {BASE_MANAGER_ATTRIBUTES[key] || key}:
                      </span>
                      <strong className="text-[#0F172A] text-xs ml-1">{val}</strong>
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
          className="border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9] h-10 text-xs sm:text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Início
        </Button>

        <Button
          type="button"
          onClick={onNext}
          disabled={!isNameValid}
          className="bg-[#E10600] hover:bg-[#C60500] text-white font-bold h-10 px-6 text-xs sm:text-sm shadow-md shadow-red-200 flex items-center gap-1.5"
        >
          Continuar para Universo <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
