import React, { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useToast } from '@/hooks/use-toast'
import { WizardStepper } from '@/components/lobby/WizardStepper'
import { StepStart } from '@/components/lobby/StepStart'
import { StepManager } from '@/components/lobby/StepManager'
import { StepUniverse } from '@/components/lobby/StepUniverse'
import { StepOfficialTeamSelection } from '@/components/lobby/StepOfficialTeamSelection'
import { StepCustomGrid } from '@/components/lobby/StepCustomGrid'
import { StepCareerSettings } from '@/components/lobby/StepCareerSettings'
import { StepReview } from '@/components/lobby/StepReview'
import { ALL_GRID_TEAMS_DATABASE, getOfficial2026GridTeams } from '@/lib/grid-teams-database'
import { MANAGER_PROFILES } from '@/lib/manager-profiles'
import {
  NewGameConfig,
  WizardStepId,
  UniverseType,
  ManagerProfile,
  ManagerCustomData,
  GridTeamDefinition,
  PlayerChosenTeam,
  CareerSettings,
} from '@/types/career-wizard'

export function LobbyPage() {
  const { user, team, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const outletContext = useOutletContext<{ openSettingsModal?: () => void }>()

  // Estado da etapa atual do Wizard
  const [currentStep, setCurrentStep] = useState<WizardStepId>('start')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 12 Equipes Oficiais do Grid 2026
  const official2026Teams = React.useMemo(() => getOfficial2026GridTeams(), [])

  // Estado único, completo e centralizado do Novo Jogo (Fase 2)
  const [wizardConfig, setWizardConfig] = useState<NewGameConfig>(() => ({
    manager: {
      name: user?.name || '',
      nationality: 'Brasil 🇧🇷',
      age: 42,
      profileId: MANAGER_PROFILES[0].id,
      avatarUrl: MANAGER_PROFILES[0].avatarUrl,
    },
    managerProfile: MANAGER_PROFILES[0],
    universeType: 'championship_2026',
    selectedTeams: official2026Teams,
    playerTeam: {
      isCustom: false,
      teamKey: official2026Teams[0].key, // Mercedes por padrão
      officialTeam: official2026Teams[0],
    },
    careerSettings: {
      aiDifficulty: 'normal',
      eventFrequency: 'normal',
      marketBehavior: 'dynamic',
      devSpeed: 'normal',
      seasonFormat: 'official_24',
      sprintEnabled: true,
    },
  }))

  // Manipuladores de Estado do Manager
  const handleUpdateManagerData = (data: Partial<ManagerCustomData>) => {
    setWizardConfig((prev) => ({
      ...prev,
      manager: {
        ...prev.manager,
        ...data,
      },
    }))
  }

  const handleSelectManagerProfile = (profile: ManagerProfile) => {
    setWizardConfig((prev) => ({
      ...prev,
      managerProfile: profile,
      manager: {
        ...prev.manager,
        profileId: profile.id,
        avatarUrl: profile.avatarUrl,
      },
    }))
  }

  // Manipulador de Universo
  const handleSelectUniverse = (universeType: UniverseType) => {
    setWizardConfig((prev) => {
      // Se trocou para championship_2026, restaura as 12 oficiais
      if (universeType === 'championship_2026') {
        const defaultTeam = official2026Teams[0]
        return {
          ...prev,
          universeType,
          selectedTeams: official2026Teams,
          playerTeam: {
            isCustom: false,
            teamKey: defaultTeam.key,
            officialTeam: defaultTeam,
          },
        }
      } else {
        // Campeonato Personalizado: mantém as atuais ou inicia com as 12 padrão se estiver vazio
        return {
          ...prev,
          universeType,
        }
      }
    })
  }

  // Manipuladores de Seleção de Equipe Oficial
  const handleSelectOfficialTeam = (selectedTeam: GridTeamDefinition) => {
    setWizardConfig((prev) => ({
      ...prev,
      playerTeam: {
        isCustom: false,
        teamKey: selectedTeam.key,
        officialTeam: selectedTeam,
      },
    }))
  }

  const handleSelectCustomPlaceholder = (customData: {
    name: string
    color: string
    engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
    carDesign?: string
  }) => {
    setWizardConfig((prev) => ({
      ...prev,
      playerTeam: {
        isCustom: true,
        teamKey: 'custom_12th',
        customName: customData.name,
        customColor: customData.color,
        customEngine: customData.engine,
        customCarDesign: customData.carDesign,
      },
    }))
  }

  // Manipuladores de Grid Personalizado
  const handleAddTeamToGrid = (teamToAdd: GridTeamDefinition) => {
    setWizardConfig((prev) => {
      if (prev.selectedTeams.length >= 12) return prev
      if (prev.selectedTeams.some((t) => t.key === teamToAdd.key)) return prev
      const newTeams = [...prev.selectedTeams, teamToAdd]
      return {
        ...prev,
        selectedTeams: newTeams,
      }
    })
  }

  const handleRemoveTeamFromGrid = (teamKey: string) => {
    setWizardConfig((prev) => {
      const newTeams = prev.selectedTeams.filter((t) => t.key !== teamKey)
      let updatedPlayerTeam = { ...prev.playerTeam }
      if (!updatedPlayerTeam.isCustom && updatedPlayerTeam.teamKey === teamKey) {
        // Se a equipe removida era a selecionada pelo jogador, reseta a escolha
        if (newTeams.length > 0) {
          updatedPlayerTeam = {
            isCustom: false,
            teamKey: newTeams[0].key,
            officialTeam: newTeams[0],
          }
        }
      }
      return {
        ...prev,
        selectedTeams: newTeams,
        playerTeam: updatedPlayerTeam,
      }
    })
  }

  const handleSelectPlayerTeamInGrid = (teamKey: string) => {
    setWizardConfig((prev) => {
      const chosen = prev.selectedTeams.find((t) => t.key === teamKey)
      if (!chosen) return prev
      return {
        ...prev,
        playerTeam: {
          isCustom: false,
          teamKey: chosen.key,
          officialTeam: chosen,
        },
      }
    })
  }

  // Manipuladores de Configurações da Carreira
  const handleUpdateCareerSettings = (settingsUpdate: Partial<CareerSettings>) => {
    setWizardConfig((prev) => ({
      ...prev,
      careerSettings: {
        ...prev.careerSettings,
        ...settingsUpdate,
      },
    }))
  }

  // Cancelar e Voltar ao Início Descartando Escolhas
  const handleCancelWizard = () => {
    // Restaura estado inicial
    setWizardConfig({
      manager: {
        name: user?.name || '',
        nationality: 'Brasil 🇧🇷',
        age: 42,
        profileId: MANAGER_PROFILES[0].id,
        avatarUrl: MANAGER_PROFILES[0].avatarUrl,
      },
      managerProfile: MANAGER_PROFILES[0],
      universeType: 'championship_2026',
      selectedTeams: official2026Teams,
      playerTeam: {
        isCustom: false,
        teamKey: official2026Teams[0].key,
        officialTeam: official2026Teams[0],
      },
      careerSettings: {
        aiDifficulty: 'normal',
        eventFrequency: 'normal',
        marketBehavior: 'dynamic',
        devSpeed: 'normal',
        seasonFormat: 'official_24',
        sprintEnabled: true,
      },
    })
    setCurrentStep('start')
  }

  // Confirmação e Criação Definitiva da Carreira no Backend
  const handleConfirmCreateCareer = async () => {
    if (!user) {
      toast({
        title: 'Sessão inválida',
        description: 'Faça login para continuar.',
        variant: 'destructive',
      })
      navigate('/auth')
      return
    }

    setIsSubmitting(true)
    try {
      // Criação definitiva via f1Service
      await f1Service.initializeCareerWithConfig(user.id, wizardConfig)

      // Atualiza contexto global
      await refreshTeamAndSeason()

      toast({
        title: 'Carreira Criada com Sucesso!',
        description: `Bem-vindo à Fórmula 1 2026! O pit wall da sua escuderia está liberado.`,
      })

      // Redireciona para o painel principal da carreira (/)
      navigate('/')
    } catch (err: any) {
      console.error('Erro ao criar carreira:', err)
      toast({
        title: 'Erro ao criar carreira',
        description: err?.message || 'Ocorreu um erro no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Validação de Navegação do Stepper
  const canNavigateToStep = (targetStep: WizardStepId): boolean => {
    if (targetStep === 'start') return true
    if (targetStep === 'manager') return true
    if (targetStep === 'universe') return wizardConfig.manager.name.trim().length >= 2
    if (targetStep === 'teams') return wizardConfig.manager.name.trim().length >= 2
    if (targetStep === 'settings') {
      if (wizardConfig.universeType === 'custom_championship') {
        return (
          wizardConfig.selectedTeams.length === 12 &&
          (wizardConfig.playerTeam.isCustom || !!wizardConfig.playerTeam.teamKey)
        )
      }
      return !!wizardConfig.playerTeam.teamKey || wizardConfig.playerTeam.isCustom
    }
    if (targetStep === 'review') {
      if (wizardConfig.universeType === 'custom_championship') {
        return (
          wizardConfig.selectedTeams.length === 12 &&
          (wizardConfig.playerTeam.isCustom || !!wizardConfig.playerTeam.teamKey)
        )
      }
      return !!wizardConfig.playerTeam.teamKey || wizardConfig.playerTeam.isCustom
    }
    return false
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Stepper Superior */}
      <WizardStepper
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
        canNavigateTo={canNavigateToStep}
      />

      {/* Conteúdo Dinâmico por Etapa */}
      <div className="flex-1 px-4 sm:px-6 py-4">
        {currentStep === 'start' && (
          <StepStart
            hasExistingCareer={!!team}
            existingTeam={team}
            onStartNewGame={() => setCurrentStep('manager')}
            onOpenSettings={() => outletContext?.openSettingsModal?.()}
          />
        )}

        {currentStep === 'manager' && (
          <StepManager
            managerData={wizardConfig.manager}
            selectedProfile={wizardConfig.managerProfile}
            onUpdateManagerData={handleUpdateManagerData}
            onSelectProfile={handleSelectManagerProfile}
            onNext={() => setCurrentStep('universe')}
            onBack={() => setCurrentStep('start')}
          />
        )}

        {currentStep === 'universe' && (
          <StepUniverse
            universeType={wizardConfig.universeType}
            onSelectUniverse={handleSelectUniverse}
            onNext={() => setCurrentStep('teams')}
            onBack={() => setCurrentStep('manager')}
          />
        )}

        {currentStep === 'teams' &&
          (wizardConfig.universeType === 'championship_2026' ? (
            <StepOfficialTeamSelection
              officialTeams={official2026Teams}
              playerTeam={wizardConfig.playerTeam}
              onSelectOfficialTeam={handleSelectOfficialTeam}
              onSelectCustomPlaceholder={handleSelectCustomPlaceholder}
              onNext={() => setCurrentStep('settings')}
              onBack={() => setCurrentStep('universe')}
            />
          ) : (
            <StepCustomGrid
              availableDatabaseTeams={ALL_GRID_TEAMS_DATABASE}
              selectedTeams={wizardConfig.selectedTeams}
              playerTeam={wizardConfig.playerTeam}
              onAddTeamToGrid={handleAddTeamToGrid}
              onRemoveTeamFromGrid={handleRemoveTeamFromGrid}
              onSelectPlayerTeamKey={handleSelectPlayerTeamInGrid}
              onSelectCustomPlayerTeam={handleSelectCustomPlaceholder}
              onNext={() => setCurrentStep('settings')}
              onBack={() => setCurrentStep('universe')}
            />
          ))}

        {currentStep === 'settings' && (
          <StepCareerSettings
            settings={wizardConfig.careerSettings}
            onUpdateSettings={handleUpdateCareerSettings}
            onNext={() => setCurrentStep('review')}
            onBack={() => setCurrentStep('teams')}
          />
        )}

        {currentStep === 'review' && (
          <StepReview
            config={wizardConfig}
            isSubmitting={isSubmitting}
            onConfirmCreateCareer={handleConfirmCreateCareer}
            onBack={() => setCurrentStep('settings')}
            onCancel={handleCancelWizard}
          />
        )}
      </div>
    </div>
  )
}
