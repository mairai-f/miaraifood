import { Download, Smartphone, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import happylogo from "@/assets/happycoin.png";

export default function AppDownload() {
  return (
    <section id="download" className="py-24 md:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="container">
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">App Mobile</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Leve o HappyCash no seu{" "}
            <span className="text-primary">bolso</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Tenha acesso completo ao seu negócio em qualquer lugar. Controle fiado, PDV e estoque diretamente do seu celular.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Android Download Card */}
          <Card className="border-primary/30 bg-gradient-to-b from-primary/10 to-primary/5 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="mb-6 w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-2 flex items-center justify-center shadow-lg">
                <img src={happylogo} alt="HappyCash Mobile" className="w-full h-full object-contain rounded-xl" />
              </div>
              
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone size={20} className="text-primary" />
                  <h3 className="font-heading text-2xl font-bold">Android</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compatível com Android 8.0 ou superior
                </p>
              </div>

              <Button 
                asChild 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-semibold mb-4"
                size="lg"
              >
                <a href="/downloads/android">
                  <Download className="mr-2" size={20} />
                  Baixar APK
                </a>
              </Button>

              <div className="flex flex-col gap-2 w-full">
                <p className="text-xs text-muted-foreground font-medium">
                  Arquivo: happycash-mobile.apk
                </p>
                <p className="text-xs text-muted-foreground">
                  Tamanho: ~45 MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* iOS Coming Soon Card */}
          <Card className="border-muted/50 bg-muted/20 opacity-60">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="mb-6 w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-400 p-2 flex items-center justify-center shadow-lg">
                <img src={happylogo} alt="HappyCash Mobile" className="w-full h-full object-contain rounded-xl opacity-70" />
              </div>
              
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone size={20} className="text-muted-foreground" />
                  <h3 className="font-heading text-2xl font-bold text-muted-foreground">iOS</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compatível com iOS 14.0 ou superior
                </p>
              </div>

              <Button 
                disabled 
                className="w-full h-12 font-semibold mb-4"
                size="lg"
              >
                <QrCode className="mr-2" size={20} />
                Em breve
              </Button>

              <p className="text-xs text-muted-foreground">
                Disponível em breve na App Store
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
              <Download size={24} className="text-primary" />
            </div>
            <h4 className="font-semibold mb-2">Instalação Rápida</h4>
            <p className="text-sm text-muted-foreground">
              Baixe e instale em segundos
            </p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
              <Smartphone size={24} className="text-primary" />
            </div>
            <h4 className="font-semibold mb-2">Funcionalidade Completa</h4>
            <p className="text-sm text-muted-foreground">
              Acesso a todos os recursos do HappyCash
            </p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
              <QrCode size={24} className="text-primary" />
            </div>
            <h4 className="font-semibold mb-2">Seguro e Confiável</h4>
            <p className="text-sm text-muted-foreground">
              Encriptação de dados garantida
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
