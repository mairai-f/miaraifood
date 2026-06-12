import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

gsap.registerPlugin(ScrollTrigger);

const faqs = [
  { q: "Preciso instalar algum programa para usar o HappyCash?", a: "Não. O HappyCash funciona online, direto no navegador do celular ou computador, então você consegue começar sem instalação complicada." },
  { q: "Como funciona a caderneta de fiado digital?", a: "Você cadastra o cliente, registra as vendas fiadas e o sistema atualiza o saldo automaticamente. Quando for cobrar, a mensagem pode ser aberta direto no WhatsApp." },
  { q: "Posso usar no celular?", a: "Sim! O sistema é totalmente responsivo e funciona perfeitamente em celulares, tablets e computadores." },
  { q: "Tem contrato de fidelidade?", a: "Não! Você pode cancelar quando quiser, sem multa ou taxa de cancelamento." },
  { q: "Qual a duração dos planos pagos?", a: "Todos os planos pagos do HappyCash têm duração de 30 dias por ciclo. A demo gratuita continua com duração de 3 dias." },
  { q: "Como funciona o desktop PRO?", a: "Depois que o plano PRO estiver ativo, você baixa a release mais recente para Windows ou Linux. Em cada máquina nova, o app pede a chave da empresa, reconhece a loja, valida o primeiro acesso online do administrador, cria o usuário/PIN local e baixa os dados da loja para o banco local." },
  { q: "Quanto tempo o desktop pode ficar offline?", a: "Depois do primeiro acesso online, do download dos dados e de uma validação da licença, o desktop pode seguir offline por até 5 dias. Nesse período, o administrador ou operador entra com usuário e PIN ou senha local, e quando faltar menos de 5 horas o sistema avisa para reconectar." },
  { q: "Como funciona o envio de cobranças via WhatsApp?", a: "O sistema gera mensagens prontas de cobrança com nome do cliente, itens e saldo. Você clica, abre o WhatsApp e envia." },
  { q: "Quantos produtos e clientes posso cadastrar?", a: "Ilimitado! Não há limite de cadastros de produtos ou clientes em nenhum dos planos." },
  { q: "O sistema ajuda no controle de estoque?", a: "Sim. Você consegue acompanhar cadastro de produtos, movimentações e estoque mínimo para ter mais clareza sobre a operação." },
  { q: "Posso migrar do Plano Fiado para o Completo?", a: "Sim! Você pode fazer upgrade a qualquer momento e seguir no novo plano no seu ciclo atual de 30 dias." },
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
    <section ref={ref} id="faq" className="py-24 md:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      <div className="container max-w-3xl">
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
                className="border border-border rounded-xl px-6 bg-card/30 backdrop-blur-sm data-[state=open]:border-primary/30 data-[state=open]:bg-card/60 transition-all duration-300"
              >
                <AccordionTrigger className="text-left hover:no-underline hover:text-primary py-5 text-base">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
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
