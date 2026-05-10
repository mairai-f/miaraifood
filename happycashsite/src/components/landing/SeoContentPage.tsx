import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Link } from "react-router-dom";

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import SiteSeo from "@/components/seo/SiteSeo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useLandingAccountActions } from "@/hooks/use-landing-account-actions";
import type { SiteSeoConfig } from "@/lib/siteSeo";

const SUPPORT_EMAIL = "happycashsupport@gmail.com";

interface SeoContentSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface SeoContentFaq {
  question: string;
  answer: string;
}

interface RelatedLink {
  title: string;
  href: string;
  description: string;
}

interface SeoContentPageProps {
  seo: SiteSeoConfig;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  quickWins: string[];
  sections: SeoContentSection[];
  faqs: SeoContentFaq[];
  relatedLinks: RelatedLink[];
  ctaTitle?: string;
  ctaDescription?: string;
}

const SeoContentPage = ({
  seo,
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  quickWins,
  sections,
  faqs,
  relatedLinks,
  ctaTitle = "Quer testar o HappyCash no seu comércio?",
  ctaDescription = "Crie uma conta grátis, cadastre alguns clientes e veja como fica mais simples controlar vendas fiadas, pagamentos e cobranças.",
}: SeoContentPageProps) => {
  const { showCreateAccount, showTestButton, testHref, createAccountHref } = useLandingAccountActions();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteSeo {...seo} />
      <Header />

      <main>
        <section className="relative overflow-hidden pt-28 md:pt-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,184,0,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(247,147,26,0.12),transparent_30%)]" />
          <div className="container relative z-10 grid gap-12 pb-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div className="max-w-3xl">
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </span>
              <h1 className="mt-6 font-heading text-4xl font-bold leading-tight md:text-5xl">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                {description}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                {showTestButton && (
                  <Button asChild size="lg" className="h-14 px-8 text-base font-semibold">
                    <Link to={testHref}>
                      Testar grátis <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                )}
                {showCreateAccount && (
                  <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base font-semibold">
                    <Link to={createAccountHref}>Criar conta</Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/80 p-3 shadow-2xl shadow-primary/10">
                <img src={imageSrc} alt={imageAlt} className="w-full rounded-[1.25rem]" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid gap-4 md:grid-cols-3">
              {quickWins.map((item) => (
                <article key={item} className="rounded-2xl border border-border/70 bg-card/55 p-5">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-medium leading-6 text-foreground/90">{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <article className="py-12 md:py-16">
          <div className="container grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-10">
              {sections.map((section) => (
                <section key={section.title} className="max-w-3xl">
                  <h2 className="font-heading text-2xl font-bold leading-tight md:text-3xl">
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-base leading-8 text-muted-foreground">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets && (
                    <ul className="mt-5 grid gap-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3 text-sm leading-6 text-foreground/85">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <aside className="rounded-2xl border border-border/70 bg-card/60 p-6 lg:sticky lg:top-28">
              <h2 className="font-heading text-lg font-semibold">Guias relacionados</h2>
              <div className="mt-5 grid gap-4">
                {relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="rounded-xl border border-border/60 bg-background/70 p-4 transition-colors hover:border-primary/40"
                  >
                    <h3 className="text-sm font-semibold text-foreground">{link.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{link.description}</p>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </article>

        <section className="py-12 md:py-16">
          <div className="container max-w-4xl">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Dúvidas comuns
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold">Perguntas antes de começar</h2>
            </div>

            <Accordion type="single" collapsible className="mt-10 space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${index}`}
                  className="rounded-2xl border border-border/70 bg-card/50 px-6"
                >
                  <AccordionTrigger className="text-left text-base hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-7 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="pb-24 md:pb-28">
          <div className="container">
            <div className="rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10 px-6 py-10 shadow-2xl shadow-primary/10 md:px-10 md:py-14">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="font-heading text-3xl font-bold md:text-4xl">{ctaTitle}</h2>
                  <p className="mt-4 text-lg leading-8 text-muted-foreground">{ctaDescription}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {showTestButton && (
                    <Button asChild size="lg" className="h-14 px-8 text-base font-semibold">
                      <Link to={testHref}>Testar grátis</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base font-semibold">
                    <a href={`mailto:${SUPPORT_EMAIL}`}>
                      <Mail className="mr-2 h-5 w-5" />
                      Email
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SeoContentPage;
