import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import logo from "../../../src/assets/login/happycash.webp";
import { supabase } from "@/integrations/supabase/client";
import { clearSiteLocalSession } from "@/lib/authSessionPreferences";
import { Progress } from "@/components/ui/progress";

const LOGIN_DELAY_MS = 900;

const LogoutSplash = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan");
  const period = searchParams.get("period");
  const loginParams = new URLSearchParams();

  if (plan) loginParams.set("plan", plan);
  if (period === "annual") loginParams.set("period", "annual");

  const loginSearch = loginParams.toString();
  const loginPath = loginSearch ? `/login?${loginSearch}` : "/login";

  useEffect(() => {
    let active = true;
    void clearSiteLocalSession(supabase);

    const timerId = window.setTimeout(() => {
      if (active) navigate(loginPath, { replace: true });
    }, LOGIN_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [loginPath, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <img src={logo} alt="HappyCash" className="mx-auto h-auto w-full max-w-[13rem]" />
        <p className="mt-6 text-sm font-medium text-foreground">Encerrando sua sessão...</p>
        <p className="mt-2 text-sm text-muted-foreground">Você será levado para o login em instantes.</p>
        <Progress value={72} className="mt-6 h-2" />
      </div>
    </main>
  );
};

export default LogoutSplash;
