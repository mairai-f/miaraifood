import { CalendarCheck, CreditCard, MessageCircle, QrCode, Scissors, Users } from "lucide-react";
import { Link } from "react-router-dom";

import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSiteUrl } from "@/lib/siteSeo";
import agendaPreview from "@/assets/screenshot-4.webp";

const features = [
  { icon: CalendarCheck, title: "Agenda online", text: "Horarios por profissional, servico, data e disponibilidade real." },
  { icon: Users, title: "Clientes separados", text: "Cada empresa acessa apenas seus proprios clientes, agendamentos e historico." },
  { icon: Scissors, title: "Profissionais e servicos", text: "Cadastro de profissionais, comissao, duracao, preco e servicos extras." },
  { icon: QrCode, title: "Link e QR Code", text: "Compartilhe a agenda publica da empresa para clientes marcarem horario." },
  { icon: MessageCircle, title: "WhatsApp", text: "Fluxo preparado para confirmacao, lembretes e contato rapido com clientes." },
  { icon: CreditCard, title: "Asaas no site", text: "Assinatura do plano Agenda pelo HappyCashSite com Pix ou cartao." },
];

const faqs = [
  {
    question: "O HappyCash Agenda mistura produtos do PDV ou do Food?",
    answer: "Nao. O Agenda usa dados separados por empresa e modulo. Produtos do PDV ficam no HappyCash, cardapio fica no Food e produtos do Agenda ficam no proprio Agenda.",
  },
  {
    question: "Depois de pagar, para onde o cliente vai?",
    answer: "O HappyCashSite identifica o plano pago no banco e direciona para o sistema correto: Agenda, Food ou HappyCash PDV/Fiado.",
  },
  {
    question: "Serve so para barbearia?",
    answer: "Nao. O modulo atende barbearias, saloes, clinicas, estetica, pet shop, oficinas, consultorias e servicos com horario marcado.",
  },
];

export default function HappyCashAgenda() {
  return (
    <div className="min-h-screen bg-background">
      <SiteSeo
        title="HappyCash Agenda | Sistema de agendamento online para servicos"
        description="HappyCash Agenda e o sistema de agendamento online para empresas de servicos, com profissionais, clientes, QR Code, WhatsApp, pagamentos e dados separados por empresa."
        keywords={[
          "sistema de agendamento",
          "agenda online",
          "agenda para barbearia",
          "agenda para salao",
          "agendamento online para clinica",
          "HappyCash Agenda",
        ]}
        path="/happycash-agenda"
        image={createSiteUrl("/favicon.png")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "HappyCash Agenda",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: createSiteUrl("/happycash-agenda"),
          offers: {
            "@type": "Offer",
            price: "80",
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
          },
          description: "Sistema de agendamento online para empresas de servicos com profissionais, clientes, pagamentos e WhatsApp.",
        }}
      />
      <Header />

      <main>
        <section className="pt-28 md:pt-36">
          <div className="container grid gap-10 pb-16 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">HappyCash Agenda</p>
              <h1 className="mt-5 max-w-3xl font-heading text-4xl font-bold leading-tight md:text-6xl">
                Agenda online para servicos, profissionais e clientes no mesmo fluxo
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Organize horarios, profissionais, servicos, clientes e pagamentos sem misturar dados do PDV ou do HappyCashFood.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-7 text-base font-semibold">
                  <Link to="/cadastro?plan=agenda">Criar conta Agenda</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base font-semibold">
                  <Link to="/dashboard?plan=agenda">Pagar com Asaas</Link>
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card shadow-xl">
              <img src={agendaPreview} alt="Painel HappyCash Agenda" className="aspect-[16/10] w-full object-cover object-top" />
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-16">
          <div className="container">
            <div className="grid gap-4 md:grid-cols-3">
              {features.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="rounded-lg">
                    <CardContent className="p-6">
                      <Icon className="h-6 w-6 text-primary" />
                      <h2 className="mt-4 font-heading text-lg font-semibold">{item.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">Plano do modulo</p>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">HappyCash Agenda por R$ 80</h2>
              <p className="mt-4 text-muted-foreground">
                O cliente assina no HappyCashSite, o Asaas confirma o pagamento e o painel libera o modulo Agenda.
              </p>
            </div>
            <div className="grid gap-3">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-lg border bg-card p-5">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
