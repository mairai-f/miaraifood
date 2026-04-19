import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, HardDriveDownload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { desktopDownloads, isDesktopDownloadPlatform } from "@/lib/desktopDownloads";

const DownloadRedirect = () => {
  const { platform } = useParams();
  const selectedPlatform = isDesktopDownloadPlatform(platform) ? platform : null;
  const download = selectedPlatform ? desktopDownloads[selectedPlatform] : null;

  useEffect(() => {
    if (!download?.targetUrl) return;
    window.location.replace(download.targetUrl);
  }, [download?.targetUrl]);

  if (!download) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <Card className="w-full rounded-3xl border-border/70">
            <CardHeader>
              <CardTitle>Download nao encontrado</CardTitle>
              <CardDescription>Essa rota de download nao existe no momento.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/dashboard">Voltar ao painel</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <Card className="w-full rounded-3xl border-border/70">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <HardDriveDownload className="h-5 w-5" />
              <CardTitle className="text-2xl">Download do app desktop</CardTitle>
            </div>
            <CardDescription>
              {download.targetUrl
                ? `Preparando o download de ${download.label}...`
                : `A rota ${download.route} ja esta pronta, mas o arquivo final ainda nao foi configurado.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {download.targetUrl ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-3 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="font-medium">Redirecionando para o arquivo...</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Se o download nao iniciar sozinho, use o botao abaixo.
                </p>
                <Button asChild className="mt-4">
                  <a href={download.targetUrl}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar agora
                  </a>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/70 p-5">
                <p className="text-sm text-muted-foreground">
                  Configure no deploy do site uma das variaveis abaixo para ativar esse download:
                </p>
                <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-4 font-mono text-sm">
                  {selectedPlatform === "windows"
                    ? "VITE_WINDOWS_DESKTOP_DOWNLOAD_URL"
                    : "VITE_LINUX_DESKTOP_DOWNLOAD_URL"}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Isso permite manter a URL publica no seu site sem depender do GitHub para distribuir o executavel.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/dashboard">Voltar ao painel</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Voltar ao site</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DownloadRedirect;
