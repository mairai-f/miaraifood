import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, User, Mail, Phone, Lock, Eye, EyeOff,
  ArrowLeft, Loader2,
} from 'lucide-react';
import {
  setUser,
  setOnboarded,
  setSetupDone,
  clearSetupDone,
  setClientToken,
  hasRegisteredBefore,
  markRegisteredBefore,
} from '../lib/storage';
import { guiaPorVozAtiva, definirGuiaPorVoz, falar, falarSeAtivo } from '../lib/acessibilidade';
import type { UserProfile } from '../types';
import { randomUUID } from '../lib/uuid';
import PasskeyPrompt from '../components/PasskeyPrompt';
import { getSupabaseClient } from '@workspace/api-client-react';

type Step = 'welcome' | 'choice' | 'register' | 'login' | 'forgot-password' | 'reset-password' | 'acessibilidade';

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: randomUUID(),
    name: '', email: '', isGuest: false,
    healthConditions: [], nutritionGoals: [],
    dislikedIngredients: [], likedThings: [],
    communicationStyle: 'amigavel',
    shareDataWithRestaurants: true, allowAIMemory: true,
    ...overrides,
  };
}

function Field({
  label, value, onChange, type = 'text', placeholder = '', autoComplete,
  icon: Icon, endSlot,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; autoComplete?: string;
  icon?: React.ElementType; endSlot?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-400">{label}</p>
      <div className="relative flex items-center">
        {Icon && <Icon className="absolute left-3.5 h-4 w-4 text-slate-500 pointer-events-none" />}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-2xl border border-slate-800 bg-slate-900 py-3.5 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${Icon ? 'pl-10' : 'pl-4'}`}
        />
        {endSlot && <div className="absolute right-3">{endSlot}</div>}
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, autoComplete, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label} value={value} onChange={onChange}
      type={show ? 'text' : 'password'}
      placeholder={placeholder ?? '••••••••'}
      autoComplete={autoComplete}
      icon={Lock}
      endSlot={
        <button type="button" onClick={() => setShow(s => !s)} className="text-slate-400 hover:text-slate-200">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

function PrimaryBtn({
  onClick, loading, disabled, children,
}: {
  onClick?: () => void; loading?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function SecondaryBtn({
  onClick, children,
}: {
  onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 py-4 text-base font-medium text-slate-200 transition hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [guiaVoz, setGuiaVoz] = useState(() => guiaPorVozAtiva());
  const [passkeyToken, setPasskeyToken] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'welcome') {
      falarSeAtivo('Bem-vindo ao MIAR. Descubra restaurantes, faça pedidos, reserve mesas e tenha uma IA no seu bolso para cada refeição.');
    }
  }, [step]);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState<UserProfile['gender'] | ''>('');
  const [regPass, setRegPass] = useState('');
  const [regPassConf, setRegPassConf] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);

  const [resetEmail, setResetEmail] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPassConf, setNewPassConf] = useState('');

  const clearErr = () => { setError(''); setSuccessMsg(''); };

  const handleGuestBrowse = () => {
    setUser(makeProfile({ name: 'Convidado', isGuest: true }));
    setOnboarded();
    onDone();
  };

  const finishWithAuth = (token: string, user: { id: string; name: string; email: string; phone?: string | null; gender?: UserProfile['gender'] | null; shareDataWithRestaurants?: boolean; allowAIMemory?: boolean; onboardingCompleted?: boolean }, remember = true, offerPasskey = false) => {
    setClientToken(token, remember);
    setUser(makeProfile({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
      gender: user.gender ?? undefined,
      isGuest: false,
      shareDataWithRestaurants: user.shareDataWithRestaurants ?? true,
      allowAIMemory: user.allowAIMemory ?? true,
    }));
    setOnboarded();
    if (user.onboardingCompleted) setSetupDone();
    else clearSetupDone();
    if (offerPasskey) setPasskeyToken(token);
    else onDone();
  };

  const submitRegister = async () => {
    clearErr();
    if (!regName.trim()) { setError('Informe seu nome'); return; }
    if (!regEmail.trim() || !regEmail.includes('@')) { setError('E-mail inválido'); return; }
    if (!regPhone.trim()) { setError('Informe seu telefone'); return; }
    if (!regGender) { setError('Selecione uma opção de gênero'); return; }
    if (regPass.length < 8) { setError('Senha deve ter no mínimo 8 caracteres'); return; }
    if (regPass !== regPassConf) { setError('As senhas não coincidem'); return; }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await getSupabaseClient().auth.signUp({ email: regEmail.trim(), password: regPass, options: { data: { full_name: regName.trim(), phone: regPhone.trim(), gender: regGender } } });
      if (authError || !authData.user) { setError(authError?.message ?? 'Erro ao criar conta'); return; }
      const session = authData.session;
      if (!session) { setError('Conta criada. Confirme seu e-mail para continuar.'); return; }
      const data = { token: session.access_token, user: { id: authData.user.id, name: regName.trim(), email: regEmail.trim(), phone: regPhone.trim(), gender: regGender, onboardingCompleted: false } };
      markRegisteredBefore();
      finishWithAuth(data.token!, data.user!, rememberLogin, true);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  const submitLogin = async () => {
    clearErr();
    if (!loginEmail.trim() || !loginEmail.includes('@')) { setError('E-mail inválido'); return; }
    if (!loginPass.trim()) { setError('Informe sua senha'); return; }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await getSupabaseClient().auth.signInWithPassword({ email: loginEmail.trim(), password: loginPass });
      if (authError || !authData.user || !authData.session) { setError(authError?.message ?? 'E-mail ou senha incorretos'); return; }
      const data = { token: authData.session.access_token, user: { id: authData.user.id, name: String(authData.user.user_metadata?.full_name ?? authData.user.email ?? ''), email: authData.user.email ?? loginEmail.trim(), phone: String(authData.user.user_metadata?.phone ?? ''), gender: authData.user.user_metadata?.gender, onboardingCompleted: false } };
      markRegisteredBefore();
      finishWithAuth(data.token!, data.user!);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  const submitForgotPassword = async () => {
    clearErr();
    if (!resetEmail.trim() || !resetEmail.includes('@')) { setError('Informe um e-mail válido'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/client/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Não foi possível solicitar o PIN'); return; }
      setSuccessMsg(data.message ?? 'PIN enviado por e-mail!');
      setTimeout(() => setStep('reset-password'), 1500);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  const submitResetPassword = async () => {
    clearErr();
    if (!resetEmail.trim() || !resetEmail.includes('@')) { setError('Informe um e-mail válido'); return; }
    if (!resetPin.trim()) { setError('Informe o código PIN de 6 dígitos'); return; }
    if (newPass.length < 8) { setError('A nova senha deve ter no mínimo 8 caracteres'); return; }
    if (newPass !== newPassConf) { setError('As senhas não coincidem'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/client/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), pin: resetPin.trim(), newPassword: newPass }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Não foi possível redefinir a senha'); return; }
      setSuccessMsg(data.message ?? 'Senha alterada com sucesso!');
      setLoginEmail(resetEmail.trim());
      setTimeout(() => setStep('login'), 1800);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <div className="client-dark-theme flex min-h-screen flex-col items-center justify-center bg-slate-950 px-5 text-slate-100">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div key="welcome"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex w-full max-w-sm flex-col items-center text-center">
            <button
              type="button"
              onClick={() => {
                const novoEstado = !guiaVoz;
                setGuiaVoz(novoEstado);
                definirGuiaPorVoz(novoEstado);
                falar(novoEstado
                  ? 'Guia por voz ativado. Bem-vindo ao MIAR. Toque em qualquer lugar da tela para ouvir a descrição.'
                  : 'Guia por voz desativado.');
              }}
              aria-pressed={guiaVoz}
              className={`mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold transition ${
                guiaVoz
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              {guiaVoz ? '🔊 Guia por voz ativado' : '🔈 Ativar guia por voz'}
            </button>

            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/15 text-5xl shadow-sm shadow-emerald-950/20">
              🍽️
            </div>
            <h1 className="mb-1 text-3xl font-bold tracking-tight text-slate-100">Miar</h1>
            <p className="mb-1 text-lg font-semibold text-emerald-400">AI/FOOD</p>
            <p className="mb-8 text-sm text-slate-400">
              Descubra restaurantes, faça pedidos, reserve mesas e tenha uma IA no seu bolso para cada refeição.
            </p>

            <div className="mb-8 w-full text-left">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Você pode dizer para a IA
              </p>
              <div className="space-y-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-slate-200">
                  <span className="mr-1 font-semibold text-emerald-400">"</span>
                  IA, só tenho R$ 20,00 e estou com fome
                  <span className="ml-1 font-semibold text-emerald-400">"</span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                  <span className="mr-1 font-semibold text-sky-400">"</span>
                  IA, estou atrasado e com fome
                  <span className="ml-1 font-semibold text-sky-400">"</span>
                </div>
              </div>
            </div>

            <PrimaryBtn onClick={() => setStep('choice')}>
              Começar <ChevronRight className="h-5 w-5" />
            </PrimaryBtn>
            
            <button
              type="button"
              onClick={handleGuestBrowse}
              className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
            >
              Explorar sem cadastro (Restaurantes e Cardápios)
            </button>
          </motion.div>
        )}

        {step === 'choice' && (
          <motion.div key="choice"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <h2 className="mb-1 text-2xl font-bold text-slate-100">Acesse o Miar</h2>
            <p className="mb-8 text-sm text-slate-400">
              Crie uma conta ou entre para ter experiência personalizada — histórico, fidelidade e IA adaptada ao seu gosto.
            </p>
            <div className="space-y-3">
              {hasRegisteredBefore() ? (
                <>
                  <PrimaryBtn onClick={() => { clearErr(); setStep('login'); }}>
                    Entrar
                  </PrimaryBtn>
                  <button
                    type="button"
                    onClick={() => { clearErr(); setStep('register'); }}
                    className="w-full pt-2 text-sm font-medium text-slate-400 transition hover:text-slate-200"
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  <PrimaryBtn onClick={() => { clearErr(); setStep('register'); }}>
                    Criar minha conta
                  </PrimaryBtn>
                  <SecondaryBtn onClick={() => { clearErr(); setStep('login'); }}>
                    Já tenho conta
                  </SecondaryBtn>
                </>
              )}
              
              <button
                type="button"
                onClick={handleGuestBrowse}
                className="w-full pt-3 text-center text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
              >
                Pular registro e explorar o marketplace
              </button>
            </div>
          </motion.div>
        )}

        {step === 'register' && (
          <motion.div key="register"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('choice'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <h2 className="mb-1 text-2xl font-bold text-slate-100">Criar conta</h2>
            <p className="mb-6 text-sm text-slate-400">Seus dados ficam protegidos. Pode completar o perfil depois.</p>

            <div className="space-y-3">
              <Field label="Nome completo" value={regName} onChange={setRegName}
                placeholder="Como você quer ser chamado" autoComplete="name" icon={User} />
              <Field label="E-mail" value={regEmail} onChange={setRegEmail}
                type="email" placeholder="seu@email.com" autoComplete="email" icon={Mail} />
              <Field label="Telefone (WhatsApp)" value={regPhone} onChange={setRegPhone}
                type="tel" placeholder="(11) 99999-9999" autoComplete="tel" icon={Phone} />
              <div>
                <label htmlFor="client-gender" className="mb-1.5 block text-xs font-semibold text-slate-400">Gênero</label>
                <select
                  id="client-gender"
                  value={regGender}
                  onChange={e => setRegGender(e.target.value as UserProfile['gender'])}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Selecione uma opção</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="prefiro-nao-dizer">Prefiro não dizer</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <PasswordField label="Senha" value={regPass} onChange={setRegPass}
                autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
              <PasswordField label="Confirmar senha" value={regPassConf} onChange={setRegPassConf}
                autoComplete="new-password" placeholder="Repita a senha" />
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">{error}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void submitRegister()} loading={loading}>
                Criar conta
              </PrimaryBtn>
              <p className="text-center text-xs text-slate-500">
                Ao criar conta, você aceita os Termos de Uso do Miar.
              </p>
            </div>
          </motion.div>
        )}

        {step === 'login' && (
          <motion.div key="login"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('choice'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <h2 className="mb-1 text-2xl font-bold text-slate-100">Entrar</h2>
            <p className="mb-6 text-sm text-slate-400">Acesse com e-mail e senha.</p>

            <div className="space-y-3">
              <Field label="E-mail" value={loginEmail} onChange={setLoginEmail}
                type="email" placeholder="seu@email.com" autoComplete="email" icon={Mail} />
              <PasswordField label="Senha" value={loginPass} onChange={setLoginPass}
                autoComplete="current-password" />
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" checked={rememberLogin} onChange={e => setRememberLogin(e.target.checked)} />
                  Lembrar acesso
                </label>

                <button
                  type="button"
                  onClick={() => { clearErr(); setResetEmail(loginEmail); setStep('forgot-password'); }}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">{error}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void submitLogin()} loading={loading}>
                Entrar
              </PrimaryBtn>
            </div>
          </motion.div>
        )}

        {step === 'forgot-password' && (
          <motion.div key="forgot-password"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('login'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Login
            </button>
            <h2 className="mb-1 text-2xl font-bold text-slate-100">Recuperar senha</h2>
            <p className="mb-6 text-sm text-slate-400">Informe seu e-mail cadastrado para receber o código PIN de 6 dígitos via Resend.</p>

            <div className="space-y-3">
              <Field label="E-mail" value={resetEmail} onChange={setResetEmail}
                type="email" placeholder="seu@email.com" autoComplete="email" icon={Mail} />
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">{error}</p>
            )}
            {successMsg && (
              <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">{successMsg}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void submitForgotPassword()} loading={loading}>
                Enviar código PIN por e-mail
              </PrimaryBtn>

              <button
                type="button"
                onClick={() => { clearErr(); setStep('reset-password'); }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 underline pt-1"
              >
                Já possui um código PIN? Redefinir senha aqui
              </button>
            </div>
          </motion.div>
        )}

        {step === 'reset-password' && (
          <motion.div key="reset-password"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm">
            <button onClick={() => { clearErr(); setStep('forgot-password'); }}
              className="mb-5 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <h2 className="mb-1 text-2xl font-bold text-slate-100">Redefinir Senha</h2>
            <p className="mb-6 text-sm text-slate-400">Insira o PIN de 6 dígitos enviado ao seu e-mail e defina a nova senha.</p>

            <div className="space-y-3">
              <Field label="E-mail" value={resetEmail} onChange={setResetEmail}
                type="email" placeholder="seu@email.com" autoComplete="email" icon={Mail} />
              <Field label="Código PIN (6 dígitos)" value={resetPin} onChange={setResetPin}
                type="text" placeholder="Ex: 849201" icon={Lock} />
              <PasswordField label="Nova senha" value={newPass} onChange={setNewPass}
                autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
              <PasswordField label="Confirmar nova senha" value={newPassConf} onChange={setNewPassConf}
                autoComplete="new-password" placeholder="Repita a nova senha" />
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">{error}</p>
            )}
            {successMsg && (
              <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">{successMsg}</p>
            )}

            <div className="mt-5 space-y-3">
              <PrimaryBtn onClick={() => void submitResetPassword()} loading={loading}>
                Salvar nova senha
              </PrimaryBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {passkeyToken && <PasskeyPrompt token={passkeyToken} onDone={onDone} />}
    </div>
  );
}
