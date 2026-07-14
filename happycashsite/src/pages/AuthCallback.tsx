import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "../../../src/assets/login/happycash.svg";

const resolveSafeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
};

const AuthCallback = () => {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const finishAuth = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const nextPath = resolveSafeNextPath(searchParams.get("next"));
      const dashboardParams = new URLSearchParams(searchParams);
      dashboardParams.delete("next");
      const dashboardSearch = dashboardParams.toString() ? `?${dashboardParams.toString()}` : "";
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setStatus("error");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

      if (session?.user) {
        navigate(nextPath || `/dashboard${dashboardSearch}`, { replace: true });
        return;
      }

      setStatus("ready");
    };

    void finishAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 text-center">
        <img src={logo} alt="HappyCash" className="mx-auto h-auto w-full max-w-[14rem]" />

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 space-y-5">
          {status === "loading" ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <div className="space-y-2">
                <h1 className="font-heading text-2xl font-bold">Confirmando seu acesso</h1>
                <p className="text-sm text-muted-foreground">Estamos validando o link do email.</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h1 className="font-heading text-2xl font-bold">
                  {status === "ready" ? "Email confirmado" : "Link recebido"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {status === "ready"
                    ? "Sua conta esta pronta. Se o redirecionamento automatico nao acontecer, escolha como deseja continuar."
                    : "Nao foi possivel iniciar a sessao automaticamente, mas voce ainda pode voltar ao site ou acessar a demo."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild variant="outline" className="h-12">
                  <Link to="/paginainicial">
                    <ArrowLeft size={18} className="mr-2" />
                    Voltar para o site
                  </Link>
                </Button>
                <Button asChild className="h-12 bg-primary text-primary-foreground font-semibold">
                  <Link to={resolveSafeNextPath(new URLSearchParams(window.location.search).get("next")) || `/dashboard${(() => {
                    const params = new URLSearchParams(window.location.search);
                    params.delete("next");
                    const query = params.toString();
                    return query ? `?${query}` : "";
                  })()}`}>
                    <ExternalLink size={18} className="mr-2" />
                    Abrir sua conta
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
