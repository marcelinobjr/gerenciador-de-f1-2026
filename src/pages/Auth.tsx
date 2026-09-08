import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Flag, KeyRound, Mail, User, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function AuthPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  // Form states
  const [email, setEmail] = useState('m.blasques@multi.br.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [name, setName] = useState('Jogador')

  // Errors state
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [nameError, setNameError] = useState('')
  const [generalError, setGeneralError] = useState('')
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
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: any) {
      console.error(err)
      setGeneralError(err?.message || 'Falha ao autenticar. Verifique o email e senha.')
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
      await register(name, email, password)
      navigate('/', { replace: true })
    } catch (err: any) {
      console.error(err)
      setGeneralError(err?.message || 'Falha ao criar conta. Tente outro email.')
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
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-[#0B0E14] text-[#F5F7FA] overflow-hidden">
      {/* Background circuit grid texture (pure CSS) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1F2733 1px, transparent 1px),
            linear-gradient(to bottom, #1F2733 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient glowing radial effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#E10600]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-[#00A6FB]/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md bg-[#11161F] border border-[#1F2733] rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        {/* Header with Title & Animated Gradient */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#E10600] to-[#FF6B35] text-white mb-3 shadow-lg shadow-[#E10600]/25">
            <Flag className="w-6 h-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-[#E10600] via-[#FF6B35] to-[#00A6FB] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-flow">
              F1 2026 MANAGER
            </span>
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#8B95A7] mt-1 font-mono">
            Temporada de Nova Era • Unidade 50/50 & Aero Ativa
          </p>
        </div>

        {/* Seed credential alert banner */}
        <div className="mb-6 p-3 rounded-lg bg-[#1F2733]/60 border border-[#1F2733] text-xs text-[#8B95A7]">
          <div className="flex items-center justify-between font-semibold text-[#F5F7FA] mb-1">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              Credenciais Seed Pré-configuradas:
            </span>
            <button
              type="button"
              onClick={fillSeedCredentials}
              className="text-[#00A6FB] hover:underline text-[11px] font-mono cursor-pointer"
            >
              Preencher
            </button>
          </div>
          <p className="font-mono text-[11px] text-[#F5F7FA]">
            Email: <span className="text-[#00A6FB]">m.blasques@multi.br.com</span>
          </p>
          <p className="font-mono text-[11px] text-[#F5F7FA]">
            Senha: <span className="text-[#00A6FB]">Skip@Pass</span>
          </p>
        </div>

        {/* Global error message */}
        {generalError && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Tabs: Entrar / Criar Conta */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#0B0E14] border border-[#1F2733] mb-6">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white transition-all font-medium"
            >
              Entrar
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white transition-all font-medium"
            >
              Criar Conta
            </TabsTrigger>
          </TabsList>

          {/* Login tab */}
          <TabsContent value="login">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="login-email"
                  className="text-xs uppercase font-mono tracking-wider text-[#8B95A7]"
                >
                  E-mail institucional
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A7]" />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => validateEmail(e.target.value)}
                    placeholder="chefe@equipe.f1.com"
                    className="pl-9 bg-[#0B0E14] border-[#1F2733] focus-visible:ring-[#E10600] text-sm text-[#F5F7FA]"
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="login-password"
                  className="text-xs uppercase font-mono tracking-wider text-[#8B95A7]"
                >
                  Senha de acesso
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A7]" />
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => validatePassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9 bg-[#0B0E14] border-[#1F2733] focus-visible:ring-[#E10600] text-sm text-[#F5F7FA]"
                  />
                </div>
                {passwordError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {passwordError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold py-2.5 shadow-lg shadow-[#E10600]/25 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? 'Acessando paddock...' : 'Acessar Paddock'}
              </Button>
            </form>
          </TabsContent>

          {/* Register tab */}
          <TabsContent value="register">
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="reg-name"
                  className="text-xs uppercase font-mono tracking-wider text-[#8B95A7]"
                >
                  Nome do Chefe de Equipe
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A7]" />
                  <Input
                    id="reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => validateName(e.target.value)}
                    placeholder="Ex: Ayrton da Silva"
                    className="pl-9 bg-[#0B0E14] border-[#1F2733] focus-visible:ring-[#E10600] text-sm text-[#F5F7FA]"
                  />
                </div>
                {nameError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {nameError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reg-email"
                  className="text-xs uppercase font-mono tracking-wider text-[#8B95A7]"
                >
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A7]" />
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => validateEmail(e.target.value)}
                    placeholder="chefe@equipe.f1.com"
                    className="pl-9 bg-[#0B0E14] border-[#1F2733] focus-visible:ring-[#E10600] text-sm text-[#F5F7FA]"
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reg-password"
                  className="text-xs uppercase font-mono tracking-wider text-[#8B95A7]"
                >
                  Senha
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A7]" />
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => validatePassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9 bg-[#0B0E14] border-[#1F2733] focus-visible:ring-[#E10600] text-sm text-[#F5F7FA]"
                  />
                </div>
                {passwordError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {passwordError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold py-2.5 shadow-lg shadow-[#E10600]/25 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? 'Fundando Escuderia...' : 'Fundar Escuderia & Iniciar 2026'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-[#8B95A7]">
          <p>FIA Formula One World Championship™ 2026 Management</p>
        </div>
      </div>
    </div>
  )
}
