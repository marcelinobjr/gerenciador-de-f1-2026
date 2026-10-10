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

export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = isUserAdmin(user?.email)

  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)

  // Forms
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [submittingCreate, setSubmittingCreate] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [submittingReset, setSubmittingReset] = useState(false)

  const [deleteConfirmationEmail, setDeleteConfirmationEmail] = useState('')
  const [submittingDelete, setSubmittingDelete] = useState(false)

  const loadUsers = async () => {
    if (!isAdmin) return
    setLoading(true)
    setFeedback(null)
    try {
      // Como o PocketBase tem regra de list no users (id = @request.auth.id),
      // consultamos via API padrão do PocketBase client.
      const records = await pb
        .collection('users')
        .getFullList<UserItem>({
          sort: '-created',
        })
        .catch(async () => {
          // Fallback: se a regra RLS só permitir ver a si próprio, inclui pelo menos o usuário atual
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
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

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
      await pb.collection('users').create({
        name: newUserName.trim() || undefined,
        email: newUserEmail.trim(),
        password: newUserPassword,
        passwordConfirm: newUserPassword,
      })
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

    // Proteção de autoexclusão
    if (selectedUser.email.toLowerCase() === user?.email?.toLowerCase()) {
      setFeedback({
        type: 'error',
        message: 'Operação bloqueada: você não pode excluir a sua própria conta de administrador.',
      })
      setShowDeleteModal(false)
      return
    }

    // Confirmação por e-mail digitado
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
              Módulo Admin — Gestão de Usuários
            </h1>
            <Badge
              variant="outline"
              className="border-emerald-600/40 text-emerald-400 font-mono text-[10px]"
            >
              Root / Superuser
            </Badge>
          </div>
          <p className="text-xs text-[#8B95A7] mt-1 font-mono">
            Gerenciamento restrito de contas na collection users do PocketBase
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="border-[#232936] text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
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

      {/* Alerta de Feedback */}
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

      {/* Barra de Filtro e Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#12161F] border-[#232936] text-white p-4">
          <div className="text-xs text-[#8B95A7] font-mono">Total de Contas</div>
          <div className="text-2xl font-bold font-mono mt-1 text-white flex items-center justify-between">
            {usersList.length}
            <Users className="w-5 h-5 text-[#8B95A7]" />
          </div>
        </Card>

        <div className="md:col-span-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
            <Input
              type="text"
              placeholder="Buscar por e-mail, nome ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#12161F] border-[#232936] text-xs font-mono text-white placeholder:text-[#556070]"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <Card className="bg-[#12161F] border-[#232936] text-white">
        <CardHeader className="py-3 px-4 border-b border-[#232936]">
          <CardTitle className="text-sm font-mono tracking-wide uppercase text-[#8B95A7]">
            Registros Encontrados ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0B0E14] text-[#8B95A7] border-b border-[#232936]">
                <tr>
                  <th className="py-2.5 px-4">Usuário / ID</th>
                  <th className="py-2.5 px-4">E-mail</th>
                  <th className="py-2.5 px-4">Status / Role</th>
                  <th className="py-2.5 px-4">Criado em</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202C]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#8B95A7]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#E10600]" />
                      Carregando usuários do sistema...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#8B95A7]">
                      Nenhum usuário encontrado com os filtros aplicados.
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
