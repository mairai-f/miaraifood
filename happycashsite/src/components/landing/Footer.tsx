import { useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import happyCashLogo from "../../../../src/assets/login/happycash.svg";
import { Instagram, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LEGAL_UPDATED_AT_LABEL,
  LEGAL_SUPPORT_EMAIL,
} from "../../../../shared/legal/legalAcceptance";
import {
  LEGAL_MODAL_DOCUMENTS,
  type LegalDocumentKey,
} from "../../../../shared/legal/legalModalDocuments";

const SUPPORT_EMAIL = LEGAL_SUPPORT_EMAIL;
const INSTAGRAM_URL = "https://www.instagram.com/happycashsystem/";

const Footer = () => {
  const [legalModal, setLegalModal] = useState<LegalDocumentKey | null>(null);
  const location = useLocation();
  const isHomePage = location.pathname === "/" || location.pathname === "/index" || location.pathname === "/paginainicial";
  const buildHomeSectionHref = (id: string) => (isHomePage ? `#${id}` : `/#${id}`);
  const activeLegalDocument = legalModal ? LEGAL_MODAL_DOCUMENTS[legalModal] : null;

  const openLegalModal = (event: MouseEvent<HTMLAnchorElement>, documentKey: LegalDocumentKey) => {
    event.preventDefault();
    setLegalModal(documentKey);
  };

  return (
    <>
      <footer data-site-footer className="relative border-t border-border bg-card/30 backdrop-blur-sm">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="container pb-28 pt-16 md:pb-16">
          <div className="grid gap-10 items-start md:grid-cols-5">
            <div className="md:col-span-2 space-y-4">
              <img
                src={happyCashLogo}
                alt="HappyCash"
                className="h-auto w-[12rem] object-contain md:w-[15rem] lg:w-[17rem]"
                loading="lazy"
                decoding="async"
              />
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Sistema ERP para controlar fiado, PDV, estoque, RH e gestão comercial sem depender de caderno, planilha e improviso.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <a href={`mailto:${SUPPORT_EMAIL}`}
                  className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                  <Mail size={18} />
                </a>
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                  <Instagram size={18} />
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-heading font-semibold text-sm text-foreground">Navegação</h4>
              <nav className="flex flex-col gap-3">
                <a href={buildHomeSectionHref("funcionalidades")} className="text-sm text-muted-foreground hover:text-primary transition-colors">Funcionalidades</a>
                <a href={buildHomeSectionHref("planos")} className="text-sm text-muted-foreground hover:text-primary transition-colors">Planos</a>
                <a href={buildHomeSectionHref("screenshots")} className="text-sm text-muted-foreground hover:text-primary transition-colors">Telas do sistema</a>
                <a href={buildHomeSectionHref("faq")} className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQ</a>
              </nav>
            </div>

            <div className="space-y-4">
              <h4 className="font-heading font-semibold text-sm text-foreground">Soluções</h4>
              <nav className="flex flex-col gap-3">
                <Link to="/sistema-de-gestao-de-negocios" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sistema de gestão de negócios
                </Link>
                <Link to="/sistema-de-gestao-rh" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sistema de gestão de RH
                </Link>
                <Link to="/controle-de-fiado" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Controle de fiado
                </Link>
                <Link to="/app-para-fiado" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  App para fiado
                </Link>
                <Link to="/gestao-de-clientes-fiado" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Gestão de clientes fiado
                </Link>
                <Link to="/caderneta-de-fiado-digital" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Caderneta de fiado digital
                </Link>
                <Link to="/sistema-pdv" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sistema PDV
                </Link>
                <Link to="/controle-de-estoque" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Controle de estoque
                </Link>
              </nav>
            </div>

            <div className="space-y-4">
              <h4 className="font-heading font-semibold text-sm text-foreground">Guias</h4>
              <nav className="flex flex-col gap-3">
                <Link to="/blog/como-controlar-fiado-no-mercadinho" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Como controlar fiado no mercadinho
                </Link>
                <Link to="/blog/planilha-de-fiado-vs-app" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Planilha de fiado vs app
                </Link>
              </nav>
              <h4 className="pt-2 font-heading font-semibold text-sm text-foreground">Contato</h4>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail size={16} />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="mt-14 border-t border-border/50 pt-8 text-xs text-muted-foreground md:pr-72">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <p>© HappyCash. Todos os direitos reservados.</p>
              <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                <a
                  href={LEGAL_MODAL_DOCUMENTS.privacy.path}
                  className="hover:text-primary transition-colors"
                  onClick={(event) => openLegalModal(event, "privacy")}
                >
                  Política de Privacidade
                </a>
                <a
                  href={LEGAL_MODAL_DOCUMENTS.terms.path}
                  className="hover:text-primary transition-colors"
                  onClick={(event) => openLegalModal(event, "terms")}
                >
                  Termos de Uso
                </a>
                <a
                  href={LEGAL_MODAL_DOCUMENTS.lgpd.path}
                  className="hover:text-primary transition-colors"
                  onClick={(event) => openLegalModal(event, "lgpd")}
                >
                  LGPD
                </a>
              </nav>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={Boolean(activeLegalDocument)} onOpenChange={(open) => !open && setLegalModal(null)}>
        <DialogContent
          className="grid max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-yellow-400/15 bg-zinc-950 p-0 text-foreground sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {activeLegalDocument ? (
            <>
              <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
                <DialogTitle className="font-heading text-2xl">{activeLegalDocument.title}</DialogTitle>
                <DialogDescription className="leading-6">
                  {activeLegalDocument.description}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="min-h-0 px-6 py-5">
                <div className="space-y-5 pr-3">
                  {activeLegalDocument.sections.map((section) => (
                    <section key={section.title} className="space-y-2">
                      <h3 className="font-heading text-base font-semibold text-foreground">{section.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{section.text}</p>
                    </section>
                  ))}
                </div>
              </ScrollArea>
              <div className="grid shrink-0 gap-3 border-t border-border bg-zinc-950 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                <span className="text-xs text-muted-foreground">Última atualização: {LEGAL_UPDATED_AT_LABEL}</span>
                <Link
                  to={activeLegalDocument.path}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                  onClick={() => setLegalModal(null)}
                >
                  Abrir página completa
                </Link>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Footer;
