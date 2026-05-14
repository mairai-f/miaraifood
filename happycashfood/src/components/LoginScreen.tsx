import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn } from "lucide-react";
import foodLogo from "@/assets/happycashfood.webp";
import { signInFoodAdmin } from "@/lib/foodAuth";
import type { FoodUser } from "@/types";

interface LoginScreenProps {
  users: FoodUser[];
  onLogin: (user: FoodUser) => void;
}

const shouldOpenFromPaidSite = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("site_access") === "1" || params.get("preview") === "1";
};

export function LoginScreen({ users, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shouldOpenFromPaidSite()) return;
    const adminUser = users.find((user) => user.role === "admin") ?? users[0];
    if (adminUser) onLogin(adminUser);
  }, [onLogin, users]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim() || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const adminUser = await signInFoodAdmin(email, password, users);
      onLogin(adminUser);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Nao foi possivel entrar agora.");
    } finally {
      setSubmitting(false);
    }
  };

  if (shouldOpenFromPaidSite()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050505] px-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
          <LockKeyhole className="h-4 w-4 animate-pulse text-primary" />
          Liberando HappyCashFood...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-sm items-center justify-center">
        <div className="w-full">
          <div className="mb-5 text-center">
            <img
              src={foodLogo}
              alt="HappyCashFood"
              className="mx-auto h-auto w-[min(12rem,70vw)] object-contain"
              width={1536}
              height={1024}
              loading="eager"
              decoding="async"
            />
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-yellow-400/15 bg-black/45 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-black text-yellow-50">Entrar</h1>
            </div>

            <div className="space-y-4">
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
                <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Senha</span>
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
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm font-bold text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
