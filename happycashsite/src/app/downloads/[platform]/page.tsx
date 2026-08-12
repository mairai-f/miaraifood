"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, HardDriveDownload, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloads, isDownloadPlatform } from "@/lib/desktopDownloads";
import { getFreshSiteSession } from "@/lib/siteSession";

type DesktopDownloadResponse = {
  success?: boolean;
  downloadUrl?: string;
  expiresIn?: number;
  assetName?: string;
  releaseTag?: string;
  releaseVersion?: string;
  publishedAt?: string | null;
  offlineEnabled?: boolean;
  validUntil?: string | null;
  error?: string;
  code?: string;
  requiredEnv?: string[];
};

const resolveLoginRedirect = (platformRoute: string) =>
  `/login?next=${encodeURIComponent(platformRoute)}`;

export default function DownloadPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = use(params);
  const router = useRouter();
  const selectedPlatform = isDownloadPlatform(platform) ? platform : null;
  const download = selectedPlatform ? downloads[selectedPlatform] : null;
  
  const [loading, setLoading] = useState(Boolean(download));
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadMeta, setDownloadMeta] = useState<DesktopDownloadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requiredEnv, setRequiredEnv] = useState<string[]>([]);
  
  const loginRedirect = selectedPlatform ? resolveLoginRedirect(`/downloads/${selectedPlatform}`) : "/login";

  useEffect(() => {
    if (!download || !selectedPlatform) {
      setLoading(false);
      return;
    }

    let active = true;

    const prepareDownload = async () => {
      setLoading(true);
      setErrorMessage(null);
      setRequiredEnv([]);
      setDownloadMeta(null);

      const session = await getFreshSiteSession();

      if (!active) return;

      if (!session?.access_token) {
        router.replace(loginRedirect);
        return;
      }

      const functionName = selectedPlatform === "android"
        ? "mobile-download"
        : "desktop-download";

      const { data, error } = await supabase.functions.invoke<DesktopDownloadResponse>(functionName, {
        body: { platform: selectedPlatform },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!active) return;

      if (error || !data?.success || !data.downloadUrl) {
        let functionErrorMessage = data?.error || "Nao foi possivel preparar o download agora.";
        let envKeys = data?.requiredEnv || [];

        if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
          try {
            const errorPayload = await error.context.clone().json() as DesktopDownloadResponse;
            functionErrorMessage = errorPayload.error || functionErrorMessage;
            envKeys = errorPayload.requiredEnv || envKeys;
          } catch {
            functionErrorMessage = error.context.status === 401
              ? "Sua sessao expirou. Entre novamente para continuar."
              : functionErrorMessage;
          }

          if (error.context.status === 401) {
            router.replace(loginRedirect);
            return;
          }
        }

        setErrorMessage(functionErrorMessage);
        setRequiredEnv(envKeys);
        setLoading(false);
        return;
      }

      setDownloadUrl(data.downloadUrl);
      setDownloadMeta(data);
      setLoading(false);
      window.location.replace(data.downloadUrl);
    };

    void prepareDownload();

    return () => {
      active = false;
    };
  }, [download, loginRedirect, router, selectedPlatform]);

  if (!download) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <Card className="w-full rounded-3xl border-border/70">
            <CardHeader>
              <CardTitle>Download não encontrado</CardTitle>
              <CardDescription>Essa rota de download não existe no momento.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard">Voltar ao painel</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 pt-32">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <Card className="w-full rounded-3xl border-border/70">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <HardDriveDownload className="h-5 w-5" />
              <CardTitle className="text-2xl">Download de {download.label}</CardTitle>
            </div>
            <CardDescription>
              {loading
                ? `Preparando o download protegido de ${download.label}...`
                : errorMessage
                ? "Não foi possível liberar o arquivo agora."
                : `Se o download não iniciar sozinho, use o botão para baixar ${download.label}.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {loading ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-3 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="font-medium">Validando sua assinatura e gerando link seguro...</p>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-border bg-background/70 p-5">
                <div className="flex items-center gap-3 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="font-medium">{errorMessage}</p>
                </div>
                {requiredEnv.length > 0 && (
                  <>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Configure estas variáveis no projeto para liberar esse download:
                    </p>
                    <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-4 font-mono text-sm">
                      {requiredEnv.join("\n")}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-3 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="font-medium">Link temporário pronto.</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Se o download não iniciar sozinho, use o botão abaixo.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Depois de instalar, valide a chave da empresa nessa máquina e só então entre com o usuário e PIN ou senha do operador.
                </p>
                {downloadMeta?.releaseTag && (
                  <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                    <p>Versão: <span className="font-medium text-foreground">{downloadMeta.releaseVersion || downloadMeta.releaseTag.replace(/^v/i, "")}</span></p>
                    {downloadMeta.assetName && <p>Arquivo: <span className="font-medium text-foreground">{downloadMeta.assetName}</span></p>}
                    {downloadMeta.publishedAt && <p>Publicado em: <span className="font-medium text-foreground">{new Date(downloadMeta.publishedAt).toLocaleString("pt-BR")}</span></p>}
                  </div>
                )}
                <Button
                  className="mt-4"
                  onClick={() => {
                    if (downloadUrl && downloadMeta?.assetName) {
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = downloadMeta.assetName;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar agora
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-8">
              <Button asChild variant="outline">
                <Link href="/dashboard">Voltar ao painel</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Voltar ao site</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
