import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CircleHelp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const faqs = [
  { q: "Preciso instalar algum programa para usar o HappyCash?", a: "Não. O HappyCash funciona online, direto no navegador do celular ou computador, então você consegue começar sem instalação complicada." },
  { q: "Como funciona a caderneta de fiado digital?", a: "Você cadastra o cliente, registra as vendas fiadas e o sistema atualiza o saldo automaticamente. Quando for cobrar, a mensagem pode ser aberta direto no WhatsApp." },
  { q: "Posso usar no celular?", a: "Sim! O sistema é totalmente responsivo e funciona perfeitamente em celulares, tablets e computadores." },
  { q: "Tem contrato de fidelidade?", a: "Não! Você pode cancelar quando quiser, sem multa ou taxa de cancelamento." },
  { q: "Qual a duração dos planos pagos?", a: "Todos os planos pagos do HappyCash têm duração de 30 dias por ciclo. A demo gratuita continua com duração de 3 dias." },
  { q: "Como funciona o desktop PRO?", a: "Depois que o plano PRO estiver ativo, você baixa a release mais recente para Windows ou Linux. Em cada máquina nova, o app pede a chave da empresa, reconhece a loja, valida o primeiro acesso online do administrador, cria o usuário/PIN local e baixa os dados da loja para uso local." },
  { q: "O HappyCash web emite nota fiscal?", a: "Não. O HappyCash web imprime cupom/recibo não fiscal. A NFC-e é um módulo opcional do HappyCash Desktop PRO e depende de certificado A1, CSC/credenciamento SEFAZ, dados fiscais dos produtos e orientação do contador." },
  { q: "Quanto tempo o HappyCash pode ficar offline?", a: "Depois do primeiro acesso online, do download dos dados e da validação da licença, o desktop PRO e o app Android podem operar em contingência offline por até 24 horas. A ideia é manter o caixa funcionando quando a internet cair; ao reconectar, o sistema sincroniza os dados e renova a validação." },
  { q: "Como funciona o envio de cobranças via WhatsApp?", a: "O sistema gera mensagens prontas de cobrança com nome do cliente, itens e saldo. Você clica, abre o WhatsApp e envia." },
  { q: "Quantos produtos e clientes posso cadastrar?", a: "Ilimitado! Não há limite de cadastros de produtos ou clientes em nenhum dos planos." },
  { q: "O sistema ajuda no controle de estoque?", a: "Sim. Você consegue acompanhar cadastro de produtos, movimentações e estoque mínimo para ter mais clareza sobre a operação." },
  { q: "Posso migrar do Plano Fiado para o Completo?", a: "Sim! Você pode fazer upgrade a qualquer momento e seguir no novo plano no seu ciclo atual de 30 dias." },
];

const faqTones = [
  "border-sky-200 bg-sky-50/85 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-50",
  "border-emerald-200 bg-emerald-50/85 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50",
  "border-amber-200 bg-amber-50/85 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-50",
  "border-violet-200 bg-violet-50/85 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-50",
  "border-cyan-200 bg-cyan-50/85 text-cyan-950 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-50",
  "border-rose-200 bg-rose-50/85 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-50",
];

const FAQ = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".faq-title",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".faq-title", start: "top 85%" }
        }
      );
      gsap.fromTo(".faq-accordion",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.2, ease: "power3.out",
          scrollTrigger: { trigger: ".faq-accordion", start: "top 85%" }
        }
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="faq" className="relative overflow-hidden bg-[linear-gradient(135deg,#f7fbff_0%,#eefcff_44%,#fff8ed_100%)] py-24 dark:bg-[linear-gradient(135deg,#071426_0%,#071d22_46%,#171224_100%)] md:py-32">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(31,86,165,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,212,0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
      
      <div className="container relative z-10 max-w-3xl">
        <div className="faq-title text-center mb-16">
          <span className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">FAQ</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Perguntas <span className="text-primary">Frequentes</span>
          </h2>
        </div>

        <div className="faq-accordion">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem 
                key={i} 
                value={`item-${i}`} 
                className={`group rounded-xl border px-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl data-[state=open]:border-primary/35 data-[state=open]:shadow-primary/10 ${faqTones[i % faqTones.length]}`}
              >
                <AccordionTrigger className="gap-3 py-5 text-left text-base font-bold hover:no-underline hover:text-primary">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-primary shadow-sm transition-transform duration-300 group-hover:scale-110 dark:bg-white/10">
                      <CircleHelp className="h-4 w-4" />
                    </span>
                    <span>{f.q}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
