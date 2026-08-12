import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import estoqueMovimentacaoModal from "@/assets/estoque-movimentacao-modal.webp";
import estoquePainel from "@/assets/estoque-painel.webp";
import fiadoClientes from "@/assets/fiado-digital-clientes.webp";
import fiadoDividasAgrupadas from "@/assets/fiado-digital-dividas-agrupadas.webp";
import fiadoHistoricoAgrupado from "@/assets/fiado-digital-historico-agrupado.webp";
import pdvBuscarVendas from "@/assets/pdv-buscar-vendas.webp";
import pdvCaixaFechadoAbertura from "@/assets/pdv-caixa-fechado-abertura.webp";
import pdvFinalizarVendaFiado from "@/assets/pdv-finalizar-venda-fiado.webp";
import pdvFinalizarVendaPagamento from "@/assets/pdv-finalizar-venda-pagamento.webp";
import pdvPrincipalCarrinho from "@/assets/pdv-principal-carrinho.webp";
import pdvSaidaDeCaixa from "@/assets/pdv-saida-de-caixa.webp";

gsap.registerPlugin(ScrollTrigger);

const screenshots = [
  { src: pdvPrincipalCarrinho, alt: "PDV com carrinho de venda", tag: "PDV", label: "Venda acontecendo no balcão", tone: "from-sky-500/26 to-cyan-400/18" },
  { src: pdvFinalizarVendaPagamento, alt: "Finalizacao de venda com pagamento", tag: "Pagamento", label: "Pix, cartão e dinheiro separados", tone: "from-emerald-500/24 to-lime-400/18" },
  { src: pdvFinalizarVendaFiado, alt: "Finalizacao de venda no fiado", tag: "Fiado", label: "Venda fiada sem perder histórico", tone: "from-amber-500/24 to-yellow-400/18" },
  { src: pdvBuscarVendas, alt: "Busca de vendas no PDV", tag: "Busca", label: "Vendas antigas sem procurar papel", tone: "from-indigo-500/24 to-blue-400/18" },
  { src: pdvCaixaFechadoAbertura, alt: "Abertura de caixa no PDV", tag: "Caixa", label: "Abertura e fechamento controlados", tone: "from-cyan-500/24 to-blue-400/18" },
  { src: pdvSaidaDeCaixa, alt: "Saida de caixa no PDV", tag: "Saídas", label: "Retiradas registradas no turno", tone: "from-rose-500/20 to-orange-400/18" },
  { src: fiadoClientes, alt: "Clientes do fiado digital", tag: "Clientes", label: "Saldo e contato no mesmo painel", tone: "from-violet-500/22 to-fuchsia-400/16" },
  { src: fiadoDividasAgrupadas, alt: "Dividas agrupadas por cliente", tag: "Cobrança", label: "Dívidas agrupadas para cobrar melhor", tone: "from-green-500/22 to-emerald-400/18" },
  { src: fiadoHistoricoAgrupado, alt: "Historico agrupado do fiado digital", tag: "Histórico", label: "Tudo que aconteceu com o cliente", tone: "from-blue-500/22 to-indigo-400/18" },
  { src: estoquePainel, alt: "Painel de controle de estoque", tag: "Estoque", label: "Produtos e mínimos sempre visíveis", tone: "from-lime-500/22 to-emerald-400/18" },
  { src: estoqueMovimentacaoModal, alt: "Movimentacao de estoque", tag: "Movimento", label: "Entradas e saídas com contexto", tone: "from-orange-500/22 to-amber-400/18" },
];

const Screenshots = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".screenshots-title",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".screenshots-title", start: "top 85%" }
        }
      );
      gsap.fromTo(".screenshots-carousel",
        { y: 60, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ".screenshots-carousel", start: "top 85%" }
        }
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="screenshots" className="relative overflow-hidden bg-[linear-gradient(180deg,#eef8ff_0%,#f8fbff_50%,#effdf7_100%)] py-24 dark:bg-[linear-gradient(180deg,#08172c_0%,#07111f_56%,#061c18_100%)] md:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(31,86,165,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,212,0.045)_1px,transparent_1px)] bg-[size:46px_46px]" />
      
      <div className="container relative z-10">
        <div className="screenshots-title text-center mb-16">
          <span className="inline-block text-sm font-semibold text-secondary tracking-widest uppercase mb-4">Sistema em ação</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Veja o sistema em <span className="text-primary">ação</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Telas reais da rotina: venda, fiado, estoque, fechamento e cobrança trabalhando juntos.
          </p>
        </div>

        <div className="screenshots-carousel -mx-4 overflow-x-auto px-4 pb-4 sm:mx-auto sm:max-w-6xl sm:px-6">
          <div className="flex snap-x snap-mandatory gap-5">
            {screenshots.map((s, i) => (
              <article key={i} className="group relative min-w-[88vw] snap-center sm:min-w-[48rem] lg:min-w-[58rem]">
                <div className={`absolute -inset-2 rounded-2xl bg-gradient-to-br ${s.tone} opacity-70 transition-opacity duration-500 group-hover:opacity-100`} />
                <div className="screenshot-hover-frame relative overflow-hidden rounded-2xl border border-border bg-slate-950 p-3 shadow-xl transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:shadow-primary/20">
                  <img
                    src={s.src}
                    alt={s.alt}
                    className="w-full rounded-xl transition-transform duration-700 group-hover:scale-[1.035]"
                    width={1440}
                    height={1200}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-2 rounded-lg border border-white/15 bg-slate-950/82 px-4 py-3 text-white shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{s.tag}</span>
                    <span className="text-sm font-semibold">{s.label}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Screenshots;
