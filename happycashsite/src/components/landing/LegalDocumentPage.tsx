import { Link } from "react-router-dom";

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import SiteSeo from "@/components/seo/SiteSeo";
import type { SiteSeoConfig } from "@/lib/siteSeo";
import { LEGAL_PATHS } from "../../../../shared/legal/legalAcceptance";

interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalDocumentPageProps {
  seo: SiteSeoConfig;
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
}

const LegalDocumentPage = ({
  seo,
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
}: LegalDocumentPageProps) => (
  <div className="min-h-screen overflow-x-hidden bg-background">
    <SiteSeo {...seo} />
    <Header />

    <main>
      <section className="relative overflow-hidden border-b border-border/60 pt-28 md:pt-36">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,184,0,0.14),transparent_34%)]" />
        <div className="container relative z-10 max-w-4xl pb-14">
          <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </span>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            {description}
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Última atualização: <span className="font-medium text-foreground">{updatedAt}</span>
          </p>
        </div>
      </section>

      <article className="py-14 md:py-20">
        <div className="container grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="max-w-4xl space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-border/70 bg-card/45 p-6 md:p-8">
                <h2 className="font-heading text-2xl font-bold leading-tight">
                  {section.title}
                </h2>
                {section.paragraphs ? (
                  <div className="mt-4 space-y-4 text-base leading-8 text-muted-foreground">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
                {section.bullets ? (
                  <ul className="mt-5 grid gap-3 text-sm leading-6 text-muted-foreground">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="rounded-xl border border-border/60 bg-background/55 px-4 py-3">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <aside className="rounded-2xl border border-border/70 bg-card/60 p-6 lg:sticky lg:top-28">
            <h2 className="font-heading text-lg font-semibold">Documentos</h2>
            <div className="mt-5 grid gap-3">
              <Link to={LEGAL_PATHS.privacy} className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                Política de Privacidade
              </Link>
              <Link to={LEGAL_PATHS.terms} className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                Termos de Uso
              </Link>
              <Link to={LEGAL_PATHS.lgpd} className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                LGPD
              </Link>
            </div>
          </aside>
        </div>
      </article>
    </main>

    <Footer />
  </div>
);

export default LegalDocumentPage;
