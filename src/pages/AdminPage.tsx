import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { isUserAdmin } from '@/lib/adminAuth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ShieldAlert,
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Sliders,
  Save,
  Clock,
  History,
  Car,
  Flag,
} from 'lucide-react'

interface UserItem {
  id: string
  email: string
  name?: string
  avatar?: string
  created: string
  updated?: string
  verified?: boolean
}

interface AuditLogEntry {
  timestamp: string
  field: string
  oldValue: any
  newValue: any
  appliedBy: string
}

export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = isUserAdmin(user?.email)

  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'audit'>('users')

  // --- ABA USUÁRIOS ---
  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  // Modais de usuários
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)

  // Forms de usuário
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [submittingCreate, setSubmittingCreate] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [submittingReset, setSubmittingReset] = useState(false)

  const [deleteConfirmationEmail, setDeleteConfirmationEmail] = useState('')
  const [submittingDelete, setSubmittingDelete] = useState(false)

  // --- ABA CONFIGURAÇÕES DO JOGO ---
  const [gameSeason, setGameSeason] = useState<any>(null)
  const [gameTeams, setGameTeams] = useState<any[]>([])
  const [gameDrivers, setGameDrivers] = useState<any[]>([])
  const [loadingSettings, setLoadingSettings] = useState(false)

  // Estados editáveis de configurações
  const [editSeasonYear, setEditSeasonYear] = useState<number>(2026)
  const [editCurrentRound, setEditCurrentRound] = useState<number>(24)
  const [editTotalRounds, setEditTotalRounds] = useState<number>(24)
  const [editSeasonCompleted, setEditSeasonCompleted] = useState<boolean>(false)

  // Edição de Equipe selecionada
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [editTeamBudget, setEditTeamBudget] = useState<number>(150000000)
  const [editTeamAero, setEditTeamAero] = useState<number>(50)
  const [editTeamChassis, setEditTeamChassis] = useState<number>(50)
  const [editTeamStrategy, setEditTeamStrategy] = useState<number>(50)
  const [editTeamStrength, setEditTeamStrength] = useState<number>(75)

  // Edição de Piloto selecionado
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [editDriverSpeed, setEditDriverSpeed] = useState<number>(80)
  const [editDriverConsistency, setEditDriverConsistency] = useState<number>(80)
  const [editDriverRain, setEditDriverRain] = useState<number>(80)
  const [editDriverDefense, setEditDriverDefense] = useState<number>(80)
  const [editDriverSalary, setEditDriverSalary] = useState<number>(5000000)
  const [editDriverSuperlicense, setEditDriverSuperlicense] = useState<number>(40)

  // Modal de confirmação de configurações
  const [showConfigConfirmModal, setShowConfigConfirmModal] = useState(false)
  const [configPendingAction, setConfigPendingAction] = useState<
    'SEASON' | 'TEAM' | 'DRIVER' | null
  >(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Registro de Auditoria (Audit Log)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  const loadAuditLogs = () => {
    try {
      const stored = localStorage.getItem('apex_admin_audit_logs')
      if (stored) {
        setAuditLogs(JSON.parse(stored))
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const logChange = (field: string, oldValue: any, newValue: any) => {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      field,
      oldValue,
      newValue,
      appliedBy: user?.email || 'admin',
    }
    const updated = [entry, ...auditLogs].slice(0, 100)
    setAuditLogs(updated)
    try {
      localStorage.setItem('apex_admin_audit_logs', JSON.stringify(updated))
    } catch {
      /* intentionally ignored */
    }
  }

  const loadUsers = async () => {
    if (!isAdmin) return
    setLoadingUsers(true)
    setFeedback(null)
    try {
      const records = await pb
        .collection('users')
        .getFullList<UserItem>({
          sort: '-created',
        })
        .catch(async () => {
          if (user) {
            const selfRec = await pb.collection('users').getOne<UserItem>(user.id)
            return [selfRec]
          }
          return []
        })
      setUsersList(records || [])
    } catch (err: any) {
      console.error('Erro ao carregar lista de usuários:', err)
      setFeedback({ type: 'error', message: 'Falha ao buscar usuários do PocketBase.' })
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadGameSettings = async () => {
    if (!isAdmin) return
    setLoadingSettings(true)
    try {
      // Carregar temporada ativa
      const seasons = await pb.collection('seasons').getFullList({ sort: '-year' })
      if (seasons.length > 0) {
        const s = seasons[0]
        setGameSeason(s)
        setEditSeasonYear(s.year || 2026)
        setEditCurrentRound(s.current_round || 24)
        setEditTotalRounds(s.total_rounds || 24)
        setEditSeasonCompleted(!!s.is_completed)
      }

      // Carregar equipes
      const teams = await pb.collection('teams').getFullList({ sort: 'name' })
      setGameTeams(teams)
      if (teams.length > 0) {
        setSelectedTeamId(teams[0].id)
        setEditTeamBudget(teams[0].budget || 150000000)
        setEditTeamAero(teams[0].aero_level || 50)
        setEditTeamChassis(teams[0].chassis_level || 50)
        setEditTeamStrategy(teams[0].strategy_level || 50)
        setEditTeamStrength(teams[0].strength || 75)
      }

      // Carregar pilotos
      const drivers = await pb.collection('drivers').getFullList({ sort: 'name' })
      setGameDrivers(drivers)
      if (drivers.length > 0) {
        setSelectedDriverId(drivers[0].id)
        setEditDriverSpeed(drivers[0].speed || 80)
        setEditDriverConsistency(drivers[0].consistency || 80)
        setEditDriverRain(drivers[0].rain || 80)
        setEditDriverDefense(drivers[0].defense || 80)
        setEditDriverSalary(drivers[0].salary || 5000000)
        setEditDriverSuperlicense(drivers[0].superlicense_points || 40)
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações do jogo:', e)
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
      loadGameSettings()
      loadAuditLogs()
    }
  }, [isAdmin])

  // Atualizar inputs de time quando selecionar outro
  const handleTeamSelectChange = (teamId: string) => {
    setSelectedTeamId(teamId)
    const t = gameTeams.find((item) => item.id === teamId)
    if (t) {
      setEditTeamBudget(t.budget || 150000000)
      setEditTeamAero(t.aero_level || 50)
      setEditTeamChassis(t.chassis_level || 50)
      setEditTeamStrategy(t.strategy_level || 50)
      setEditTeamStrength(t.strength || 75)
    }
  }

  // Atualizar inputs de piloto quando selecionar outro
  const handleDriverSelectChange = (driverId: string) => {
    setSelectedDriverId(driverId)
    const d = gameDrivers.find((item) => item.id === driverId)
    if (d) {
      setEditDriverSpeed(d.speed || 80)
      setEditDriverConsistency(d.consistency || 80)
      setEditDriverRain(d.rain || 80)
      setEditDriverDefense(d.defense || 80)
      setEditDriverSalary(d.salary || 5000000)
      setEditDriverSuperlicense(d.superlicense_points || 40)
    }
  }

  // Salvar configurações com confirmação
  const handleExecuteSaveConfig = async () => {
    setSavingSettings(true)
    setFeedback(null)
    try {
      if (configPendingAction === 'SEASON' && gameSeason) {
        const oldData = {
          year: gameSeason.year,
          current_round: gameSeason.current_round,
          total_rounds: gameSeason.total_rounds,
          is_completed: gameSeason.is_completed,
        }
        const newData = {
          year: editSeasonYear,
          current_round: editCurrentRound,
          total_rounds: editTotalRounds,
          is_completed: editSeasonCompleted,
        }
        await pb.collection('seasons').update(gameSeason.id, newData)
        logChange(`Temporada (${gameSeason.id})`, oldData, newData)
        setFeedback({ type: 'success', message: 'Configurações de temporada salvas com sucesso!' })
        await loadGameSettings()
      } else if (configPendingAction === 'TEAM' && selectedTeamId) {
        const teamObj = gameTeams.find((t) => t.id === selectedTeamId)
        const oldData = {
          budget: teamObj?.budget,
          aero_level: teamObj?.aero_level,
          chassis_level: teamObj?.chassis_level,
          strategy_level: teamObj?.strategy_level,
          strength: teamObj?.strength,
        }
        const newData = {
          budget: editTeamBudget,
          aero_level: editTeamAero,
          chassis_level: editTeamChassis,
          strategy_level: editTeamStrategy,
          strength: editTeamStrength,
        }
        await pb.collection('teams').update(selectedTeamId, newData)
        logChange(`Equipe ${teamObj?.name || selectedTeamId}`, oldData, newData)
        setFeedback({
          type: 'success',
          message: `Configurações da equipe ${teamObj?.name} salvas!`,
        })
        await loadGameSettings()
      } else if (configPendingAction === 'DRIVER' && selectedDriverId) {
        const drvObj = gameDrivers.find((d) => d.id === selectedDriverId)
        const oldData = {
          speed: drvObj?.speed,
          consistency: drvObj?.consistency,
          rain: drvObj?.rain,
          defense: drvObj?.defense,
          salary: drvObj?.salary,
          superlicense_points: drvObj?.superlicense_points,
        }
        const newData = {
          speed: editDriverSpeed,
          consistency: editDriverConsistency,
          rain: editDriverRain,
          defense: editDriverDefense,
          salary: editDriverSalary,
          superlicense_points: editDriverSuperlicense,
        }
        await pb.collection('drivers').update(selectedDriverId, newData)
        logChange(`Piloto ${drvObj?.name || selectedDriverId}`, oldData, newData)
        setFeedback({
          type: 'success',
          message: `Atributos do piloto ${drvObj?.name} atualizados!`,
        })
        await loadGameSettings()
      }
    } catch (err: any) {
      console.error('Erro ao salvar configuração:', err)
      setFeedback({ type: 'error', message: err?.message || 'Falha ao salvar configuração.' })
    } finally {
      setSavingSettings(false)
      setShowConfigConfirmModal(false)
      setConfigPendingAction(null)
    }
  }

  // Se não for admin, exibe tela de Acesso Restrito
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-[#E10600]" />
        </div>
        <h1 className="text-xl font-mono font-bold text-white uppercase tracking-wider mb-2">
          Acesso Restrito
        </h1>
        <p className="text-sm text-[#8B95A7] max-w-md mb-6">
          Este painel é de uso exclusivo do administrador do sistema (m.blasques@multi.br.com). Sua
          conta atual não possui privilégios de acesso.
        </p>
        <Link to="/">
          <Button variant="outline" className="border-[#232936] text-white">
            Voltar para o Painel do Jogo
          </Button>
        </Link>
      </div>
    )
  }

  // Criar Usuário
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail || !newUserPassword) {
      setFeedback({ type: 'error', message: 'E-mail e senha são obrigatórios.' })
      return
    }
    if (newUserPassword.length < 8) {
      setFeedback({ type: 'error', message: 'A senha deve conter no mínimo 8 caracteres.' })
      return
    }

    setSubmittingCreate(true)
    setFeedback(null)
    try {
      const rec = await pb.collection('users').create({
        name: newUserName.trim() || undefined,
        email: newUserEmail.trim(),
        password: newUserPassword,
        passwordConfirm: newUserPassword,
      })
      logChange('Criar Usuário', null, { id: rec.id, email: newUserEmail })
      setFeedback({ type: 'success', message: `Usuário ${newUserEmail} criado com sucesso!` })
      setShowCreateModal(false)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPassword('')
      await loadUsers()
    } catch (err: any) {
      console.error('Falha ao criar usuário:', err)
      const msg = err?.data?.message || err?.message || 'Falha ao cadastrar usuário.'
      setFeedback({ type: 'error', message: `Erro ao criar: ${msg}` })
    } finally {
      setSubmittingCreate(false)
    }
  }

  // Resetar Senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (!newPassword || newPassword.length < 8) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 8 caracteres.' })
      return
    }

    setSubmittingReset(true)
    setFeedback(null)
    try {
      await pb.collection('users').update(selectedUser.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      })
      logChange(`Reset Senha (${selectedUser.email})`, '********', 'Alterada')
      setFeedback({
        type: 'success',
        message: `Senha de ${selectedUser.email} alterada com sucesso!`,
      })
      setShowResetModal(false)
      setNewPassword('')
      setSelectedUser(null)
      await loadUsers()
    } catch (err: any) {
      console.error('Falha ao redefinir senha:', err)
      setFeedback({ type: 'error', message: err?.message || 'Erro ao alterar a senha do usuário.' })
    } finally {
      setSubmittingReset(false)
    }
  }

  // Excluir Usuário
  const handleDeleteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    if (selectedUser.email.toLowerCase() === user?.email?.toLowerCase()) {
      setFeedback({
        type: 'error',
        message: 'Operação bloqueada: você não pode excluir a sua própria conta de administrador.',
      })
      setShowDeleteModal(false)
      return
    }

    if (deleteConfirmationEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase()) {
      setFeedback({
        type: 'error',
        message: 'O e-mail digitado não coincide com o usuário a ser excluído.',
      })
      return
    }

    setSubmittingDelete(true)
    setFeedback(null)
    try {
      await pb.collection('users').delete(selectedUser.id)
      logChange('Excluir Usuário', { id: selectedUser.id, email: selectedUser.email }, null)
      setFeedback({
        type: 'success',
        message: `Usuário ${selectedUser.email} excluído permanentemente.`,
      })
      setShowDeleteModal(false)
      setDeleteConfirmationEmail('')
      setSelectedUser(null)
      await loadUsers()
    } catch (err: any) {
      console.error('Falha ao excluir usuário:', err)
      setFeedback({ type: 'error', message: err?.message || 'Erro ao excluir usuário.' })
    } finally {
      setSubmittingDelete(false)
    }
  }

  const filteredUsers = usersList.filter((u) => {
    const q = searchTerm.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Top Banner / Titulo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#232936]">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-1.5 rounded bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold font-mono tracking-wider text-white uppercase">
              Módulo de Administração — Apex GP
            </h1>
            <Badge
              variant="outline"
              className="border-emerald-600/40 text-emerald-400 font-mono text-[10px]"
            >
              m.blasques@multi.br.com
            </Badge>
          </div>
          <p className="text-xs text-[#8B95A7] mt-1 font-mono">
            Painel soberano: gestão de contas, edição de parâmetros do jogo e auditoria
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" className="border-[#232936] text-xs">
              Voltar ao Jogo
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de Feedback Geral */}
      {feedback && (
        <div
          className={`p-3 rounded text-xs flex items-center gap-2 border font-mono ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/30 border-red-500/40 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TABS NAVEGAÇÃO PRINCIPAL DO ADMIN */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-[#12161F] border border-[#232936] text-slate-400">
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white text-xs font-mono flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            Usuários
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white text-xs font-mono flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            Configurações do Jogo
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white text-xs font-mono flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            Registro de Alterações ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: GESTÃO DE USUÁRIOS                                */}
        {/* ======================================================== */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
              <Input
                type="text"
                placeholder="Buscar por e-mail, nome ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#12161F] border-[#232936] text-xs font-mono text-white placeholder:text-[#556070]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                disabled={loadingUsers}
                className="border-[#232936] text-xs flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="bg-[#E10600] hover:bg-[#B30500] text-white text-xs flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Novo Usuário
              </Button>
            </div>
          </div>

          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#232936]">
              <CardTitle className="text-sm font-mono tracking-wide uppercase text-[#8B95A7]">
                Contas Cadastradas ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0B0E14] text-[#8B95A7] border-b border-[#232936]">
                    <tr>
                      <th className="py-2.5 px-4">Usuário / ID</th>
                      <th className="py-2.5 px-4">E-mail</th>
                      <th className="py-2.5 px-4">Status / Papel</th>
                      <th className="py-2.5 px-4">Criado em</th>
                      <th className="py-2.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A202C]">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#8B95A7]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#E10600]" />
                          Carregando usuários...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#8B95A7]">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSuperAdmin = isUserAdmin(u.email)
                        const isCurrentUser = u.email.toLowerCase() === user?.email?.toLowerCase()

                        return (
                          <tr key={u.id} className="hover:bg-[#161C26] transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-white flex items-center gap-2">
                                {u.name || 'Sem nome'}
                                {isCurrentUser && (
                                  <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-[9px] px-1 py-0">
                                    Você
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-[#556070]">{u.id}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-white">{u.email}</td>
                            <td className="py-3 px-4">
                              {isSuperAdmin ? (
                                <Badge
                                  variant="outline"
                                  className="border-red-500/40 text-red-400 bg-red-950/20 text-[10px]"
                                >
                                  Admin Root
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-[#384252] text-[#8B95A7] text-[10px]"
                                >
                                  Jogador
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#8B95A7] text-[11px]">
                              {new Date(u.created).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(u)
                                    setNewPassword('')
                                    setShowResetModal(true)
                                  }}
                                  className="border-[#232936] text-[#8B95A7] hover:text-white h-7 px-2 text-[11px] flex items-center gap-1"
                                  title="Alterar Senha"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  Senha
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isSuperAdmin || isCurrentUser}
                                  onClick={() => {
                                    setSelectedUser(u)
                                    setDeleteConfirmationEmail('')
                                    setShowDeleteModal(true)
                                  }}
                                  className="border-red-950 text-red-400 hover:bg-red-950/30 hover:border-red-500/50 h-7 px-2 text-[11px] disabled:opacity-30 disabled:pointer-events-none"
                                  title="Excluir Usuário"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: CONFIGURAÇÕES LIVRES DO JOGO                       */}
        {/* ======================================================== */}
        <TabsContent value="settings" className="space-y-6">
          {/* Card 1: Temporada Ativa & Rodadas */}
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#232936]">
              <CardTitle className="text-sm font-mono tracking-wide uppercase text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-[#E10600]" />
                Temporada Ativa & Calendário
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Ajuste direto do ano em disputa, rodada corrente e status de conclusão.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Ano da Temporada</Label>
                  <Input
                    type="number"
                    value={editSeasonYear}
                    onChange={(e) => setEditSeasonYear(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Rodada Atual</Label>
                  <Input
                    type="number"
                    value={editCurrentRound}
                    onChange={(e) => setEditCurrentRound(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Total de Rodadas</Label>
                  <Input
                    type="number"
                    value={editTotalRounds}
                    onChange={(e) => setEditTotalRounds(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <Label className="text-xs font-mono text-[#8B95A7]">Temporada Concluída?</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditSeasonCompleted(!editSeasonCompleted)}
                    className={`text-xs font-mono border-[#232936] ${
                      editSeasonCompleted
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-600/40'
                        : 'bg-[#0B0E14] text-slate-300'
                    }`}
                  >
                    {editSeasonCompleted ? '✓ Concluída (true)' : 'Em Aberto (false)'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setConfigPendingAction('SEASON')
                    setShowConfigConfirmModal(true)
                  }}
                  className="bg-[#E10600] hover:bg-[#B30500] text-white text-xs font-mono flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Ajustes de Temporada
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Atributos & Orçamentos de Equipes */}
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#232936]">
              <CardTitle className="text-sm font-mono tracking-wide uppercase text-white flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                Equipes & Orçamentos
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Selecione uma equipe para alterar orçamento e níveis de infraestrutura livremente.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-[#8B95A7]">Selecione a Escuderia</Label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => handleTeamSelectChange(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] text-xs font-mono text-white p-2 rounded-md"
                >
                  {gameTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (ID: {t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Orçamento (R$)</Label>
                  <Input
                    type="number"
                    value={editTeamBudget}
                    onChange={(e) => setEditTeamBudget(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Força (Strength)</Label>
                  <Input
                    type="number"
                    value={editTeamStrength}
                    onChange={(e) => setEditTeamStrength(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Nível Aero</Label>
                  <Input
                    type="number"
                    value={editTeamAero}
                    onChange={(e) => setEditTeamAero(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Nível Chassi</Label>
                  <Input
                    type="number"
                    value={editTeamChassis}
                    onChange={(e) => setEditTeamChassis(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Nível Estratégia</Label>
                  <Input
                    type="number"
                    value={editTeamStrategy}
                    onChange={(e) => setEditTeamStrategy(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setConfigPendingAction('TEAM')
                    setShowConfigConfirmModal(true)
                  }}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-mono flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Ajustes da Equipe
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Atributos de Pilotos */}
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#232936]">
              <CardTitle className="text-sm font-mono tracking-wide uppercase text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Atributos & Superlicença de Pilotos
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Selecione qualquer piloto do grid para recalibrar ritmo, chuva, consistência e
                pontos de superlicença.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-[#8B95A7]">Selecione o Piloto</Label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => handleDriverSelectChange(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#232936] text-xs font-mono text-white p-2 rounded-md"
                >
                  {gameDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.nationality || 'F1'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Velocidade (Speed)</Label>
                  <Input
                    type="number"
                    value={editDriverSpeed}
                    onChange={(e) => setEditDriverSpeed(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Consistência</Label>
                  <Input
                    type="number"
                    value={editDriverConsistency}
                    onChange={(e) => setEditDriverConsistency(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Chuva (Rain)</Label>
                  <Input
                    type="number"
                    value={editDriverRain}
                    onChange={(e) => setEditDriverRain(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Defesa</Label>
                  <Input
                    type="number"
                    value={editDriverDefense}
                    onChange={(e) => setEditDriverDefense(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Superlicença (Pts)</Label>
                  <Input
                    type="number"
                    value={editDriverSuperlicense}
                    onChange={(e) => setEditDriverSuperlicense(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-[#8B95A7]">Salário Anual (R$)</Label>
                  <Input
                    type="number"
                    value={editDriverSalary}
                    onChange={(e) => setEditDriverSalary(Number(e.target.value))}
                    className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setConfigPendingAction('DRIVER')
                    setShowConfigConfirmModal(true)
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Atributos do Piloto
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: REGISTRO DE AUDITORIA (AUDIT LOGS)                */}
        {/* ======================================================== */}
        <TabsContent value="audit" className="space-y-4">
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#232936] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-mono tracking-wide uppercase text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Histórico de Alterações Administrativas
                </CardTitle>
                <CardDescription className="text-xs text-[#8B95A7]">
                  Rastreabilidade completa de todas as alterações feitas através do módulo admin.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAuditLogs([])
                  localStorage.removeItem('apex_admin_audit_logs')
                }}
                className="border-[#232936] text-xs font-mono text-[#8B95A7]"
              >
                Limpar Histórico
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0B0E14] text-[#8B95A7] border-b border-[#232936] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Data / Hora</th>
                      <th className="py-2.5 px-4">Alvo / Parâmetro</th>
                      <th className="py-2.5 px-4">Valor Anterior</th>
                      <th className="py-2.5 px-4">Novo Valor</th>
                      <th className="py-2.5 px-4 text-right">Executor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A202C]">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#8B95A7]">
                          Nenhuma alteração registrada nesta sessão.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-[#161C26] transition">
                          <td className="py-2.5 px-4 text-[#8B95A7] text-[11px]">
                            {new Date(entry.timestamp).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white">{entry.field}</td>
                          <td className="py-2.5 px-4 text-red-400 max-w-[200px] truncate">
                            {JSON.stringify(entry.oldValue)}
                          </td>
                          <td className="py-2.5 px-4 text-emerald-400 max-w-[200px] truncate">
                            {JSON.stringify(entry.newValue)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-300">
                            {entry.appliedBy}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Confirmar Alteração de Configurações */}
      <Dialog open={showConfigConfirmModal} onOpenChange={setShowConfigConfirmModal}>
        <DialogContent className="bg-[#12161F] border border-amber-500/40 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base flex items-center gap-2 text-amber-400">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Confirmar Alteração no Jogo
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Esta ação gravará os parâmetros diretamente no banco de dados do Apex GP. Todas as
              alterações serão registradas no relatório de auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded text-xs text-amber-300 font-mono space-y-1">
            <div>
              <strong>Alvo da Alteração:</strong> {configPendingAction}
            </div>
            <div>
              <strong>Executor:</strong> {user?.email}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowConfigConfirmModal(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingSettings}
              onClick={handleExecuteSaveConfig}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono flex items-center gap-2"
            >
              {savingSettings && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Confirmar e Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Criar Usuário */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#12161F] border-[#232936] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#E10600]" />
              Cadastrar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Criação direta na collection canônica de usuários do PocketBase.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-[#8B95A7]">
                Nome de Exibição (opcional)
              </Label>
              <Input
                type="text"
                placeholder="Ex: Ayrton Senna"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-[#8B95A7]">E-mail *</Label>
              <Input
                type="email"
                required
                placeholder="usuario@dominio.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-[#8B95A7]">
                Senha Provisória (mín. 8 caracteres) *
              </Label>
              <Input
                type="password"
                required
                placeholder="••••••••"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingCreate}
                className="bg-[#E10600] hover:bg-[#B30500] text-white text-xs flex items-center gap-2"
              >
                {submittingCreate && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Redefinir Senha */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="bg-[#12161F] border-[#232936] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Redefinir Senha de Acesso
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Definir uma nova senha para o usuário{' '}
              <span className="font-mono text-white">{selectedUser?.email}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-[#8B95A7]">
                Nova Senha (mín. 8 caracteres) *
              </Label>
              <Input
                type="password"
                required
                placeholder="Nova senha forte"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowResetModal(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingReset}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-2"
              >
                {submittingReset && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Salvar Nova Senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Usuário com Confirmação */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-[#12161F] border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base text-red-500 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Confirmação de Exclusão Definitiva
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Esta ação removerá a conta do banco de dados e não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeleteUser} className="space-y-4 py-2">
            <div className="p-3 bg-red-950/20 border border-red-500/30 rounded text-xs text-red-300 font-mono">
              Para confirmar, digite exatamente o e-mail do usuário abaixo:
              <div className="font-bold text-white mt-1 select-all">{selectedUser?.email}</div>
            </div>

            <div className="space-y-1.5">
              <Input
                type="email"
                required
                placeholder="Digite o e-mail do usuário para confirmar"
                value={deleteConfirmationEmail}
                onChange={(e) => setDeleteConfirmationEmail(e.target.value)}
                className="bg-[#0B0E14] border-[#232936] text-xs font-mono text-white"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  submittingDelete ||
                  deleteConfirmationEmail.trim().toLowerCase() !== selectedUser?.email.toLowerCase()
                }
                className="bg-red-600 hover:bg-red-700 text-white text-xs flex items-center gap-2 disabled:opacity-40"
              >
                {submittingDelete && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Excluir Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
