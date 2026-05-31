import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LogIn, Mail, UserRound, X } from "lucide-react";
import foodLogo from "@/assets/happycashfood.webp";
import { requestFoodPasswordReset, signInFoodAdmin, signInFoodAdminWithGoogle } from "@/lib/foodAuth";
import type { FoodUser } from "@/types";
import { getPublicErrorMessage } from "../../../shared/security/redaction";

interface LoginScreenProps {
  users: FoodUser[];
  loginPins: Record<string, string>;
  onLogin: (user: FoodUser) => void;
}

type LoginMode = "admin" | "operator";

type FoodLoginPreferences = {
  loginMode: LoginMode;
  rememberAccount: boolean;
  adminEmail: string;
  operatorUsername: string;
};

const foodLoginStorageKeys = {
  loginMode: "happycash:food:last-login-mode",
  rememberAccount: "happycash:food:remember-account",
  adminEmail: "happycash:food:remembered-admin-email",
  operatorUsername: "happycash:food:remembered-operator-username",
} as const;

const isBrowser = () => typeof window !== "undefined";
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeUsername = (value: string) => value.trim().toLowerCase();

const readFoodStorage = (key: string) => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
};

const getFoodLoginPreferences = (): FoodLoginPreferences => ({
  loginMode: readFoodStorage(foodLoginStorageKeys.loginMode) === "operator" ? "operator" : "admin",
  rememberAccount: readFoodStorage(foodLoginStorageKeys.rememberAccount) === "1",
  adminEmail: readFoodStorage(foodLoginStorageKeys.adminEmail) ?? "",
  operatorUsername: readFoodStorage(foodLoginStorageKeys.operatorUsername) ?? "",
});

const saveFoodLoginPreferences = (preferences: FoodLoginPreferences) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(foodLoginStorageKeys.loginMode, preferences.loginMode);
  window.localStorage.setItem(foodLoginStorageKeys.rememberAccount, preferences.rememberAccount ? "1" : "0");

  if (preferences.rememberAccount) {
    const adminEmail = normalizeEmail(preferences.adminEmail);
    const operatorUsername = normalizeUsername(preferences.operatorUsername);

    if (adminEmail) {
      window.localStorage.setItem(foodLoginStorageKeys.adminEmail, adminEmail);
    }

    if (operatorUsername) {
      window.localStorage.setItem(foodLoginStorageKeys.operatorUsername, operatorUsername);
    }
    return;
  }

  window.localStorage.removeItem(foodLoginStorageKeys.adminEmail);
  window.localStorage.removeItem(foodLoginStorageKeys.operatorUsername);
};

export function LoginScreen({ users, loginPins, onLogin }: LoginScreenProps) {
  const [initialPreferences] = useState(getFoodLoginPreferences);
  const [loginMode, setLoginMode] = useState<LoginMode>(initialPreferences.loginMode);
  const [email, setEmail] = useState(initialPreferences.adminEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState(initialPreferences.operatorUsername);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetFeedback, setResetFeedback] = useState("");
  const operatorUsers = useMemo(
    () => users.filter((user) => user.role === "waiter" || user.role === "cashier" || user.role === "kitchen"),
    [users],
  );

  useEffect(() => {
    if (!resetOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setResetOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [resetOpen]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      if (loginMode === "admin") {
        if (!email.trim() || !password.trim()) return;
        const adminUser = await signInFoodAdmin(email, password, users);
        saveFoodLoginPreferences({
          loginMode: "admin",
          rememberAccount,
          adminEmail: email,
          operatorUsername: username,
        });
        onLogin(adminUser);
        return;
      }

      if (!username.trim() || !pin.trim()) return;
      const normalizedUsername = normalizeUsername(username);
      const operatorUser = operatorUsers.find((user) => normalizeUsername(user.username) === normalizedUsername);
      const expectedPin = operatorUser ? loginPins[operatorUser.username] ?? loginPins[normalizedUsername] : undefined;

      if (!operatorUser || !expectedPin || expectedPin !== pin.trim()) {
        throw new Error("Usuario ou PIN invalidos.");
      }

      saveFoodLoginPreferences({
        loginMode: "operator",
        rememberAccount,
        adminEmail: email,
        operatorUsername: normalizedUsername,
      });
      onLogin(operatorUser);
    } catch (loginError) {
      setError(getPublicErrorMessage(loginError, "Nao foi possivel entrar agora."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim() || resettingPassword) return;
    setResettingPassword(true);
    setResetFeedback("");

    try {
      await requestFoodPasswordReset(resetEmail);
      setResetFeedback("Enviamos o link para redefinir sua senha no email informado.");
    } catch (resetError) {
      setResetFeedback(getPublicErrorMessage(resetError, "Nao foi possivel enviar o email agora."));
    } finally {
      setResettingPassword(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (oauthSubmitting || loginMode !== "admin") return;
    setOauthSubmitting(true);
    setError("");

    try {
      saveFoodLoginPreferences({
        loginMode: "admin",
        rememberAccount,
        adminEmail: email,
        operatorUsername: username,
      });
      await signInFoodAdminWithGoogle();
    } catch (oauthError) {
      setError(getPublicErrorMessage(oauthError, "Nao foi possivel iniciar o login com Google."));
      setOauthSubmitting(false);
    }
  };

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#050505] px-3 py-2 text-foreground sm:px-4 sm:py-3">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <section className="relative mx-auto flex h-full w-full max-w-[23rem] items-center justify-center sm:max-w-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, type: "spring" }}
          className="w-full"
        >
          <div className="mb-3 text-center">
            <motion.img
              src={foodLogo}
              alt="HappyCashFood"
              className="mx-auto h-auto w-[clamp(9.25rem,34vw,14.5rem)] max-w-full object-contain"
              width={1536}
              height={1024}
              loading="eager"
              decoding="async"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-yellow-400/15 bg-black/45 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-5"
          >
            <div className="space-y-1 text-center">
              <h1 className="text-base font-bold tracking-wide text-yellow-300 sm:text-lg">Entrar</h1>
              <p className="text-[11px] text-muted-foreground">
                Administrador entra com email e senha. Garcom entra com usuario e PIN.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 rounded-lg bg-zinc-900/70 p-1">
              <button
                type="button"
                onClick={() => {
                  setLoginMode("admin");
                  setError("");
                }}
                className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                  loginMode === "admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Administrador
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("operator");
                  setError("");
                }}
                className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                  loginMode === "operator" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Operador
              </button>
            </div>

            {loginMode === "admin" ? (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                    autoComplete="email"
                    inputMode="email"
                    type="email"
                    required
                  />
                </label>

                <label className="block">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Senha</span>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email.trim());
                        setResetFeedback("");
                        setResetOpen(true);
                      }}
                      className="text-xs font-semibold text-muted-foreground transition hover:text-primary"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <span className="relative mt-2 block">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 pr-11 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-primary"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-muted-foreground sm:text-sm">
                  <input
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(event) => setRememberAccount(event.target.checked)}
                    className="h-4 w-4 rounded border-border bg-zinc-950 accent-yellow-400"
                  />
                  <span>Lembrar minha conta</span>
                </label>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  Use o usuario e o PIN criados na gestao para entrar como garcom, caixa ou cozinha.
                </div>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Usuario</span>
                  <span className="relative mt-2 block">
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 pl-11 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                      autoComplete="username"
                      required
                    />
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">PIN</span>
                  <span className="relative mt-2 block">
                    <input
                      value={pin}
                      onChange={(event) => setPin(event.target.value)}
                      className="h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 pr-11 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                      autoComplete="current-password"
                      inputMode="numeric"
                      type={showPin ? "text" : "password"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((current) => !current)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-primary"
                      aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-muted-foreground sm:text-sm">
                  <input
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(event) => setRememberAccount(event.target.checked)}
                    className="h-4 w-4 rounded border-border bg-zinc-950 accent-yellow-400"
                  />
                  <span>Lembrar minha conta</span>
                </label>

                {operatorUsers.length === 0 && (
                  <p className="rounded-lg border border-border bg-black/30 p-3 text-sm font-semibold text-muted-foreground">
                    Ainda nao existe login de operador cadastrado no HappyCashFood.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm font-bold text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting || oauthSubmitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {loginMode === "admin" ? "Entrar como administrador" : "Entrar como operador"}
            </button>
            {loginMode === "admin" && /^https?:$/.test(window.location.protocol) && (
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={submitting || oauthSubmitting}
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-yellow-400/25 bg-transparent px-4 text-sm font-black text-foreground transition hover:bg-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {oauthSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {oauthSubmitting ? "Redirecionando..." : "Continuar com Google"}
              </button>
            )}
          </form>
        </motion.div>
      </section>

      {resetOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setResetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-yellow-400/15 bg-zinc-950 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-yellow-50">Redefinir senha</h2>
                <p className="mt-1 text-sm text-muted-foreground">Informe o email da conta do HappyCashFood.</p>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                data-modal-close="true"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-black/30 text-muted-foreground"
                aria-label="Fechar redefinição"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Email</span>
              <input
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                type="email"
                autoComplete="email"
              />
            </label>

            {resetFeedback && (
              <p className="mt-4 rounded-lg border border-border bg-black/30 p-3 text-sm font-semibold text-muted-foreground">
                {resetFeedback}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={resettingPassword || !resetEmail.trim()}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar link
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
