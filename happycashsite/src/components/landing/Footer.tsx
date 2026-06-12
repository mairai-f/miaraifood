import { useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo-happycash.webp";
import { Instagram, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const SUPPORT_EMAIL = "happycashsupport@gmail.com";
const INSTAGRAM_URL = "https://www.instagram.com/happycashsystem/";
const legalDocuments = {
  privacy: {
    title: "Política de Privacidade",
    path: "/politica-de-privacidade",
    description: "Como o HappyCash trata dados pessoais no site, cadastro, área do cliente, PDV, fiado, estoque, Agenda e recursos relacionados.",
    sections: [
      {
        title: "Dados tratados",
        text: "Podemos tratar dados de cadastro, contato, loja, plano, suporte, pagamento, acesso técnico e informações operacionais cadastradas pelo usuário, como clientes, vendas, fiado, estoque e agendamentos.",
      },
      {
        title: "Finalidades",
        text: "Usamos esses dados para criar e proteger contas, liberar recursos contratados, operar o sistema, processar assinaturas, prestar suporte, prevenir fraude, melhorar o produto e cumprir obrigações legais.",
      },
      {
        title: "Direitos e contato",
        text: `O titular pode solicitar acesso, correção, eliminação, confirmação de tratamento e outras informações previstas na LGPD pelo email ${SUPPORT_EMAIL}.`,
      },
    ],
  },
  terms: {
    title: "Termos de Serviço",
    path: "/termos-de-servico",
    description: "Condições principais para uso do HappyCash, incluindo planos, teste gratuito, conta, suporte, desktop, offline, relatórios e responsabilidades do usuário.",
    sections: [
      {
        title: "Uso da conta",
        text: "Ao criar conta, contratar plano, usar teste grátis ou acessar produtos HappyCash, o usuário concorda em manter dados verdadeiros, proteger senha, PINs, operadores e dispositivos.",
      },
      {
        title: "Planos e operação",
        text: "Recursos podem variar conforme plano, pagamento, ambiente e configuração. Informações de caixa, fiado, estoque, relatórios e dados fiscais são ferramentas de apoio e devem ser conferidas pelo estabelecimento.",
      },
      {
        title: "Responsabilidades",
        text: "O usuário deve usar o sistema conforme a lei, obter autorização para cadastrar dados de terceiros e não utilizar o HappyCash para fraude, abuso, atividade ilegal ou violação de direitos.",
      },
    ],
  },
};

type LegalDocumentKey = keyof typeof legalDocuments;

const Footer = () => {
  const [legalModal, setLegalModal] = useState<LegalDocumentKey | null>(null);
  const location = useLocation();
  const isHomePage = location.pathname === "/" || location.pathname === "/index" || location.pathname === "/paginainicial";
  const buildHomeSectionHref = (id: string) => (isHomePage ? `#${id}` : `/#${id}`);
  const activeLegalDocument = legalModal ? legalDocuments[legalModal] : null;

  const openLegalModal = (event: MouseEvent<HTMLAnchorElement>, documentKey: LegalDocumentKey) => {
    event.preventDefault();
    setLegalModal(documentKey);
  };

  return (
    <>
      <footer className="relative border-t border-border bg-card/30 backdrop-blur-sm">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="container py-16">
          <div className="grid gap-10 items-start md:grid-cols-5">
            <div className="md:col-span-2 space-y-4">
              <img src={logo} alt="HappyCash" className="h-14 w-auto md:h-20 lg:h-24" width={768} height={512} loading="lazy" decoding="async" />
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Sistema para controlar fiado, PDV e estoque sem depender de caderno, planilha e improviso.
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
                <Link to="/happycash-agenda" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  HappyCash Agenda
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

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 text-xs text-muted-foreground md:flex-row">
            <p>© {new Date().getFullYear()} HappyCash — Todos os direitos reservados.</p>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <a
                href={legalDocuments.privacy.path}
                className="hover:text-primary transition-colors"
                onClick={(event) => openLegalModal(event, "privacy")}
              >
                Política de Privacidade
              </a>
              <a
                href={legalDocuments.terms.path}
                className="hover:text-primary transition-colors"
                onClick={(event) => openLegalModal(event, "terms")}
              >
                Termos de Serviço
              </a>
            </nav>
          </div>
        </div>
      </footer>

      <Dialog open={Boolean(activeLegalDocument)} onOpenChange={(open) => !open && setLegalModal(null)}>
        <DialogContent
          className="max-w-[calc(100vw-2rem)] border-yellow-400/15 bg-zinc-950 p-0 text-foreground sm:max-w-2xl"
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
              <ScrollArea className="max-h-[58vh] px-6 py-5">
                <div className="space-y-5 pr-3">
                  {activeLegalDocument.sections.map((section) => (
                    <section key={section.title} className="space-y-2">
                      <h3 className="font-heading text-base font-semibold text-foreground">{section.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{section.text}</p>
                    </section>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">Última atualização: 12 de junho de 2026</span>
                <Link
                  to={activeLegalDocument.path}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
