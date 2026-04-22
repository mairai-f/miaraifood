import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import SiteSeo from "@/components/seo/SiteSeo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { SiteSeoConfig } from "@/lib/siteSeo";

const WHATSAPP_NUMBER = "5512988918792";

interface SolutionCard {
  title: string;
  description: string;
}

interface SolutionFaq {
  question: string;
  answer: string;
}

interface SolutionPageProps {
  seo: SiteSeoConfig;
  eyebrow: string;
  title: string;
  description: string;
  highlightItems: string[];
  imageSrc: string;
  imageAlt: string;
  promiseTitle: string;
  promiseDescription: string;
  promiseCards: SolutionCard[];
  workflowTitle: string;
  workflowDescription: string;
  workflowSteps: SolutionCard[];
  featureTitle: string;
  featureDescription: string;
  featureCards: SolutionCard[];
  faqs: SolutionFaq[];
}

const SolutionPage = ({
  seo,
  eyebrow,
  title,
  description,
  highlightItems,
  imageSrc,
  imageAlt,
  promiseTitle,
  promiseDescription,
  promiseCards,
  workflowTitle,
  workflowDescription,
  workflowSteps,
  featureTitle,
  featureDescription,
  featureCards,
  faqs,
}: SolutionPageProps) => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteSeo {...seo} />
      <Header />

      <main>
        <section className="relative overflow-hidden pt-28 md:pt-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,184,0,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(247,147,26,0.14),transparent_32%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,184,0,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,184,0,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />

          <div className="container relative z-10 grid gap-12 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                {eyebrow}
              </span>
              <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.05] md:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                {description}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-14 px-8 text-base font-semibold">
                  <Link to="/cadastro?plan=demo">
                    Testar grátis agora <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base font-semibold">
                  <Link to="/cadastro">Criar conta</Link>
                </Button>
              </div>

              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <MessageCircle className="h-4 w-4 text-primary" />
                Tirar dúvida no WhatsApp
              </a>

              <div className="mt-8 flex flex-wrap gap-3">
                {highlightItems.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border/70 bg-card/60 px-4 py-2 text-sm text-foreground/85 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/25 via-transparent to-secondary/25 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-3 shadow-2xl shadow-primary/10 backdrop-blur-sm">
                <img src={imageSrc} alt={imageAlt} className="w-full rounded-[1.5rem]" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold md:text-4xl">{promiseTitle}</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">{promiseDescription}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {promiseCards.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-border/70 bg-card/60 p-6 shadow-lg shadow-black/5"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-20 md:py-24">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/6 via-transparent to-secondary/8" />

          <div className="container relative z-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                  Como funciona
                </span>
                <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">{workflowTitle}</h2>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">{workflowDescription}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {workflowSteps.map((item, index) => (
                  <article
                    key={item.title}
                    className="rounded-3xl border border-border/70 bg-background/90 p-6 shadow-lg shadow-black/5"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 font-heading text-lg font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                Recursos que vendem
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">{featureTitle}</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">{featureDescription}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {featureCards.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-border/70 bg-card/60 p-7 shadow-lg shadow-black/5 transition-transform duration-300 hover:-translate-y-1 hover:border-primary/30"
                >
                  <h3 className="font-heading text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="container max-w-4xl">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                Perguntas rápidas
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">
                O que mais perguntam antes de testar
              </h2>
            </div>

            <Accordion type="single" collapsible className="mt-12 space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${index}`}
                  className="rounded-3xl border border-border/70 bg-card/50 px-6"
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
            <div className="rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10 px-6 py-10 shadow-2xl shadow-primary/10 md:px-10 md:py-14">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="font-heading text-3xl font-bold md:text-4xl">
                    Quer colocar isso pra rodar sem complicação?
                  </h2>
                  <p className="mt-4 text-lg leading-8 text-muted-foreground">
                    Crie sua conta, teste grátis e veja na prática como o HappyCash ajuda a vender mais e controlar melhor o dia a dia.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-14 px-8 text-base font-semibold">
                    <Link to="/cadastro?plan=demo">Testar grátis</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base font-semibold">
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
                      Falar no WhatsApp
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

export default SolutionPage;
