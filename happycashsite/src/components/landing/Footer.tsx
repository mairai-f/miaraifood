import logo from "@/assets/logo-happycash.png";
import { MessageCircle, Instagram, Youtube } from "lucide-react";

const WHATSAPP_NUMBER = "5512988918792";

const Footer = () => {
  return (
    <footer className="relative border-t border-border bg-card/30 backdrop-blur-sm">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      
      <div className="container py-16">
        <div className="grid md:grid-cols-4 gap-10 items-start">
          <div className="md:col-span-2 space-y-4">
            <img src={logo} alt="HappyCash" className="h-12 w-auto" />
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Sistema de Gestão 2.0 — PDV completo + Caderneta de Fiado Digital. 
              A solução completa para o varejo brasileiro.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" 
                className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <MessageCircle size={18} />
              </a>
              <a href="#" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Instagram size={18} />
              </a>
              <a href="#" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Youtube size={18} />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-heading font-semibold text-sm text-foreground">Navegação</h4>
            <nav className="flex flex-col gap-3">
              <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-primary transition-colors">Funcionalidades</a>
              <a href="#planos" className="text-sm text-muted-foreground hover:text-primary transition-colors">Planos</a>
              <a href="#screenshots" className="text-sm text-muted-foreground hover:text-primary transition-colors">Screenshots</a>
              <a href="#faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQ</a>
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="font-heading font-semibold text-sm text-foreground">Contato</h4>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle size={16} />
              Fale conosco no WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-border/50 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} HappyCash — Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
