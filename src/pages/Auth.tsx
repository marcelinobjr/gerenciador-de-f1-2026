import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Flag, KeyRound, Mail, User, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import heroGarageBg from '@/assets/chatgpt-image-10-de-set.de-2026-122312-fc092.png'

export default function AuthPage() {
  const { login, register, careerPhase } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const expiredMessage = (location.state as any)?.expiredMessage

  // Se o usuário já estiver autenticado e tentar acessar /auth, direciona para o ambiente correto
  React.useEffect(() => {
    if (!expiredMessage) {
      if (careerPhase === 'career') {
        navigate('/', { replace: true })
      } else if (careerPhase === 'lobby') {
        navigate('/lobby', { replace: true })
      }
    }
  }, [careerPhase, navigate, expiredMessage])

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  // Form states
  const [email, setEmail] = useState('m.blasques@multi.br.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [name, setName] = useState('Jogador')

  // Errors state
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [nameError, setNameError] = useState('')
  const [generalError, setGeneralError] = useState(expiredMessage || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Real-time validation
  const validateEmail = (val: string) => {
    setEmail(val)
    if (!val.trim()) {
      setEmailError('O e-mail é obrigatório.')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(val)) {
      setEmailError('Informe um e-mail válido (ex.: piloto@f1.com).')
      return false
    }
    setEmailError('')
    return true
  }

  const validatePassword = (val: string) => {
    setPassword(val)
    if (!val) {
      setPasswordError('A senha é obrigatória.')
      return false
    }
    if (val.length < 8) {
      setPasswordError('A senha deve conter no mínimo 8 caracteres.')
      return false
    }
    setPasswordError('')
    return true
  }

  const validateName = (val: string) => {
    setName(val)
    if (!val.trim()) {
      setNameError('O nome do chefe de equipe é obrigatório.')
      return false
    }
    setNameError('')
    return true
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')

    const isEmailValid = validateEmail(email)
    const isPassValid = validatePassword(password)
    if (!isEmailValid || !isPassValid) return

    setIsSubmitting(true)
    try {
      const activeTeam = await login(email, password)
      // Navegação direta e imediata após login bem-sucedido:
      // se tem carreira ativa vai para Central (/), se não tem vai para Lobby (/lobby)
      if (activeTeam && (activeTeam.id || activeTeam.name)) {
        navigate('/', { replace: true })
      } else {
        navigate('/lobby', { replace: true })
      }
    } catch (err: any) {
      console.error(err)
      const isBadCredentials =
        err?.status === 400 ||
        err?.message === 'E-mail ou senha incorretos.' ||
        err?.originalError?.status === 400
      if (isBadCredentials) {
        setGeneralError('E-mail ou senha incorretos.')
      } else {
        setGeneralError(err?.message || 'Falha ao autenticar. Verifique o email e senha.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')

    const isNameValid = validateName(name)
    const isEmailValid = validateEmail(email)
    const isPassValid = validatePassword(password)
    if (!isNameValid || !isEmailValid || !isPassValid) return

    setIsSubmitting(true)
    try {
      const activeTeam = await register(name, email, password)
      if (activeTeam && (activeTeam.id || activeTeam.name)) {
        navigate('/', { replace: true })
      } else {
        navigate('/lobby', { replace: true })
      }
    } catch (err: any) {
      console.error(err)
      const fieldData = err?.originalError?.response?.data || err?.response?.data || err?.data
      const isEmailNotUnique =
        err?.code === 'validation_not_unique' ||
        fieldData?.email?.code === 'validation_not_unique' ||
        (err?.status === 400 && fieldData?.email?.code === 'validation_not_unique')

      if (isEmailNotUnique) {
        setEmailError('Este e-mail já está cadastrado. Use a aba Entrar para acessar.')
      } else {
        setGeneralError(err?.message || 'Falha ao criar conta. Tente outro email.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const fillSeedCredentials = () => {
    setEmail('m.blasques@multi.br.com')
    setPassword('Skip@Pass')
    setEmailError('')
    setPasswordError('')
    setGeneralError('')
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-[#F8FAFC] text-[#0F172A] overflow-hidden">
      {/* Fotografia de F1 como hero de fundo, com overlay claro */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_right_35%] md:bg-center bg-no-repeat pointer-events-none opacity-25"
        style={{ backgroundImage: `url(${heroGarageBg})` }}
      />
      {/* Overlay claro translúcido */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-[#F8FAFC]/85 to-white/90 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #0F172A 1px, transparent 1px), linear-gradient(to bottom, #0F172A 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Card de login branco */}
      <div className="relative z-10 w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-xl shadow-slate-200/60">
        {/* Header with Title */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#E10600] text-white mb-1 shadow-md shadow-red-200">
            <Flag className="w-5 h-5" />
          </div>
          <div className="eyebrow text-[#64748B]">APEX GP MANAGER // ACESSO</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0F172A]">
            APEX GP Manager
          </h1>
          <p className="text-xs text-[#64748B]">Gestão Executiva de Motorsport • Temporada 2026</p>
        </div>

        {/* Seed credential alert banner */}
        <div className="mb-6 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B]">
          <div className="flex items-center justify-between font-semibold text-[#0F172A] mb-1.5">
            <span className="flex items-center gap-1.5 text-amber-600">
              <Sparkles className="w-3.5 h-3.5" />
              Credenciais de demonstração
            </span>
            <button
              type="button"
              onClick={fillSeedCredentials}
              className="text-[#00A6FB] hover:underline text-xs font-medium cursor-pointer"
            >
              Preencher
            </button>
          </div>
          <p className="text-xs text-[#64748B]">
            E-mail: <span className="font-num text-[#0F172A]">m.blasques@multi.br.com</span>
          </p>
          <p className="text-xs text-[#64748B]">
            Senha: <span className="font-num text-[#0F172A]">Skip@Pass</span>
          </p>
        </div>

        {/* Global error message */}
        {generalError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Tabs: Entrar / Criar Conta */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#F1F5F9] border border-[#E2E8F0] mb-6">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-white data-[state=active]:text-[#E10600] data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-[#FECACA] transition-all font-medium text-xs py-2"
            >
              Entrar
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="data-[state=active]:bg-white data-[state=active]:text-[#E10600] data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-[#FECACA] transition-all font-medium text-xs py-2"
            >
              Criar Conta
            </TabsTrigger>
          </TabsList>

          {/* Login tab */}
          <TabsContent value="login">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-medium text-[#475569]">
                  E-mail institucional
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => validateEmail(e.target.value)}
                    placeholder="chefe@equipe.f1.com"
                    className="pl-9 bg-white border-[#CBD5E1] focus-visible:ring-[#E10600] text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs font-medium text-[#475569]">
                  Senha de acesso
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => validatePassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9 bg-white border-[#CBD5E1] focus-visible:ring-[#E10600] text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </div>
                {passwordError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {passwordError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#E10600] hover:bg-[#C60500] text-white font-semibold py-2.5 shadow-md shadow-red-200 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? 'Acessando paddock...' : 'Acessar Paddock'}
              </Button>
            </form>
          </TabsContent>

          {/* Register tab */}
          <TabsContent value="register">
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs font-medium text-[#475569]">
                  Nome do chefe de equipe
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    id="reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => validateName(e.target.value)}
                    placeholder="Ex.: Ayrton da Silva"
                    className="pl-9 bg-white border-[#CBD5E1] focus-visible:ring-[#E10600] text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </div>
                {nameError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {nameError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs font-medium text-[#475569]">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => validateEmail(e.target.value)}
                    placeholder="chefe@equipe.f1.com"
                    className="pl-9 bg-white border-[#CBD5E1] focus-visible:ring-[#E10600] text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs font-medium text-[#475569]">
                  Senha
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => validatePassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9 bg-white border-[#CBD5E1] focus-visible:ring-[#E10600] text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </div>
                {passwordError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {passwordError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#E10600] hover:bg-[#C60500] text-white font-semibold py-2.5 shadow-md shadow-red-200 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? 'Fundando escuderia...' : 'Fundar Escuderia & Iniciar 2026'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-[#64748B]">
          <p>APEX GP Manager • Gestão Profissional de Motorsport</p>
        </div>
      </div>
    </div>
  )
}
