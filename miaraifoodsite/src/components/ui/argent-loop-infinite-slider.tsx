// ============================================================
// SLIDER DE FUNCIONALIDADES — src/components/ui/argent-loop-infinite-slider.tsx
// Responsabilidade: Exibe os 5 módulos do MIAR AI/FOOD de forma interativa.
//   - Desktop: timeline com scroll-hijacking (cada produto ocupa 100vh ao rolar)
//   - Mobile:  lista vertical de cards estáticos (sem scroll-hijacking, sem lag)
// Usado em: src/components/sections/AboutSection.tsx
// ATENÇÃO: nunca adicione scroll sticky neste componente sem o bloco 'hidden md:block'
// ============================================================

import * as React from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion"; // Animações e mapeamento de scroll
import { ArrowRight, ChevronDown, Instagram, ArrowUpRight } from "lucide-react"; // Ícones dos cards
import Link from "next/link";
import { cn } from "@/lib/utils"; // Utilitário para mesclar classes CSS
import MagneticEffect from "@/components/ui/MagneticEffect"; // Efeito magnético nos botões (desktop)

// --- Interface do dado de cada projeto/módulo ---
// Define a estrutura de cada card exibido no slider
interface ProjectData {
  title: string;
  image: string;
  category: string;
  year: string;
  description: string;
  slug: string;

}

// --- PROJECT_DATA: Dados dos 5 módulos do MIAR AI/FOOD ---
// Para adicionar ou editar um módulo, basta alterar este array.
// O campo 'slug' é usado para gerar a URL da página de detalhes em /funcionalidades/[slug]
const PROJECT_DATA: ProjectData[] = [
  {
    title: "PDV e Caixa",
    image: "/telasdosistema/pdvfrentedecaixa.png",
    category: "Vendas & Operação",
    year: "2026",
    description: "Frente de caixa rápida com controle de vendas, pagamentos e fechamento automatizado.",
    slug: "pdv-caixa"
  },
  {
    title: "Caderneta Fiado Digital",
    image: "/telasdosistema/gestaodofiado.png",
    category: "Clientes & Crédito",
    year: "2026",
    description: "Controle de fiados com histórico de compras, saldo atualizado e cobranças organizadas.",
    slug: "fiado-digital"
  },
  {
    title: "Controle de Estoque",
    image: "/telasdosistema/controleseuestoque.png",
    category: "Produtos & Inventário",
    year: "2026",
    description: "Gerenciamento completo de entradas, saídas, produtos e reposição de estoque.",
    slug: "controle-estoque"
  },
  {
    title: "Relatórios & Análise",
    image: "/telasdosistema/paineldecontrole.png",
    category: "Gestão Empresarial",
    year: "2026",
    description: "Dashboards com indicadores, vendas, resultados e informações estratégicas do negócio.",
    slug: "relatorios-analytics"
  },
  {
    title: "Financeiro & Caixa",
    image: "/telasdosistema/configuraçoes.png",
    category: "Tecnologia & Operação",
    year: "2026",
    description: "Controle completo das movimentações financeiras, entradas, saídas e caixa.",
    slug: "financeiro-controle-caixa"
  },
];

// ─── Componente: ArgentLoopInfiniteSlider ────────────────────────────────────
export function ArgentLoopInfiniteSlider() {
  // Ref para o container externo — usado pelo useScroll para rastrear posição
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // scrollYProgress: valor de 0 a 1 representando o progresso de scroll dentro do container
  // 0 = topo do container, 1 = fundo do container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"] // começa a contar quando o container entra, termina quando sai
  });

  // smoothProgress: versão suavizada do scrollYProgress (evita movimentos bruscos)
  // stiffness/damping/mass controlam a "inércia" da animação
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 30, mass: 1 });

  // --- Cálculo do mapeamento de scroll para cada projeto ---
  // projectArea: proporção do scroll total dedicada à navegação entre projetos (85%)
  // Os últimos 15% são usados para a transição de saída
  const projectArea = 0.85;

  // projectStep: fração do scroll que cada projeto ocupa
  // Ex: 5 projetos → cada um ocupa 17% do scroll total
  const projectStep = projectArea / PROJECT_DATA.length;

  // transWindow: janela de transição suave entre um projeto e o próximo
  const transWindow = 0.05;

  // scrollMap: pontos de progresso de scroll onde a animação muda de estado
  // yMap: posições verticais (em vh) correspondentes a cada ponto do scrollMap
  // internalYMap: posições da miniatura (em px) para o painel lateral
  const scrollMap = [0];
  const yMap = ["0vh"];
  const internalYMap = ["0px"];

  // Constrói o mapeamento dinâmico para cada projeto (exceto o primeiro)
  PROJECT_DATA.forEach((_, i) => {
    if (i === 0) return; // O primeiro projeto começa na posição 0 (já incluída acima)
    const boundary = i * projectStep; // Ponto de transição para o projeto i
    // Adiciona dois pontos por transição: antes e depois da janela de transição
    scrollMap.push(boundary - transWindow / 2, boundary + transWindow / 2);
    yMap.push(`-${(i-1)*100}vh`, `-${i*100}vh`); // Desloca a lista de projetos verticalmente
    internalYMap.push(`-${(i-1)*250}px`, `-${i*250}px`); // Desloca a miniatura lateral
  });

  // Adiciona o estado final: mantém o último projeto fixo até o scroll terminar
  scrollMap.push(projectArea, 1);
  yMap.push(`-${(PROJECT_DATA.length-1)*100}vh`, `-${(PROJECT_DATA.length-1)*100}vh`);
  internalYMap.push(`-${(PROJECT_DATA.length-1)*250}px`, `-${(PROJECT_DATA.length-1)*250}px`);

  // --- Valores animados derivados do scroll ---
  const currentY = useTransform(smoothProgress, scrollMap, yMap);         // Posição Y da lista de projetos
  const contentInternalY = useTransform(smoothProgress, scrollMap, internalYMap); // Posição Y da miniatura

  const bgOpacity = useTransform(smoothProgress, [0, 0.05, projectArea, 1], [0, 1, 1, 0]);    // Fundo aparece/some
  const mainUIOpacity = useTransform(smoothProgress, [0, 0.05, projectArea, 1], [0, 1, 1, 0]); // UI aparece/some
  const buttonOpacity = useTransform(smoothProgress, [projectArea, projectArea + 0.05], [0, 1]); // Botão "Ver Todas" aparece no final
  const finalContainerY = useTransform(smoothProgress, [projectArea, projectArea + 0.05], ["0px", "-250px"]); // Slide final de saída
  const imageY = useTransform(smoothProgress, [0, 1], ["-12%", "12%"]); // Efeito parallax leve na imagem de fundo

  return (
    <div ref={containerRef} className="relative h-auto md:h-[500vh]">
      <style>{`
        .argent-slider-wrapper {
            position: sticky;
            top: 0;
            width: 100%;
            height: 100svh;
            overflow: hidden;
            background: hsl(var(--background));
            z-index: 20;
        }
        .project-list {
            position: absolute;
            width: 100%;
            height: 100%;
            will-change: transform;
        }
        .project {
            position: absolute;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        .project img {
            width: 100%;
            height: 124%;
            object-fit: cover;
            filter: brightness(0.3) blur(10px);
            transform: scale(1.05);
            will-change: transform;
        }
        .mist-overlay {
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at center, transparent 20%, hsl(var(--background) / 0.8) 100%);
            z-index: 5;
            pointer-events: none;
        }
        .minimap-bar-outer {
            width: 85vw;
            height: 250px;
            background: white !important;
            box-shadow: 0 50px 120px -30px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            overflow: hidden;
        }
        .minimap-content-viewport {
            position: relative;
            width: 100%;
            height: 100%;
        }
        .minimap-img-preview {
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: 440px;
            height: 100%;
            overflow: hidden;
            z-index: 10;
        }
        .minimap-img-item {
            position: absolute;
            width: 100%;
            height: 100%;
            padding: 0.8rem 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .minimap-img-item img {
            display: block;
            margin: 0;
            will-change: transform;
        }
        .minimap-info-list {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 5;
        }
        .minimap-item-info {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 2.25rem 3.5%;
            font-family: 'Inter', sans-serif;
            color: black !important;
            text-transform: uppercase;
        }
        .minimap-item-info-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            width: 100%;
        }
        .minimap-item-info-row p {
            margin: 0;
            font-size: 10px;
            letter-spacing: 0.2em;
            font-weight: 800;
        }
        .minimap-item-info-row:nth-child(2) p { color: #666; font-weight: 700; }
        .minimap-item-info-row:nth-child(3) p { color: #999; font-weight: 500; font-size: 9.5px; text-transform: lowercase; }
        
        /* DEFAULT (Light Mode) Base State */
        .custom-btn {
            background: black;
            color: white;
            border-radius: 9999px;
            padding: 1.25rem 3rem;
            font-weight: 800;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .custom-btn-arrow,
        .custom-btn-github {
            background: black;
            color: white;
            width: 58px;
            height: 58px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* DARK MODE Base State */
        .dark .custom-btn,
        .dark .custom-btn-arrow,
        .dark .custom-btn-github {
            background: white;
            color: black;
        }

        /* Independent GitHub hover */
        .custom-btn-github:hover {
            background: #c1e44a !important;
            color: black !important;
        }

        /* Synchronized Ver Menos + Arrow hover */
        .group-projects:hover .custom-btn,
        .group-projects:hover .custom-btn-arrow {
            background: #c1e44a !important;
            color: black !important;
        }

        .slide-overlay {
            position: absolute;
            bottom: 3rem;
            left: 5%;
            z-index: 110;
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }
        .slide-line {
            width: 140px;
            height: 1px;
            position: relative;
        }
        .slide-progress {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            will-change: width;
        }

        @media (max-width: 768px) {
            .minimap-img-preview {
                display: none !important;
            }
            .minimap-item-info-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
            .minimap-item-info-row h4, 
            .minimap-item-info-row p, 
            .minimap-item-info-row a {
                text-align: left !important;
                max-width: 100% !important;
            }
            .minimap-item-info-row:nth-child(3) {
                flex-direction: column;
                gap: 1rem;
            }
            .minimap-item-info-row:nth-child(3) a {
                background: black;
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 9999px;
                text-decoration: none;
                border: none;
            }
            .dark .minimap-item-info-row:nth-child(3) a {
                background: white;
                color: black;
            }
            .minimap-item-info {
                padding: 1.5rem 8%;
            }
            .minimap-bar-outer {
                width: 90vw;
            }
        }
      `}</style>
      
      {/* Desktop View (Scroll Timeline) */}
      <div className="hidden md:block argent-slider-wrapper">
        <motion.div style={{ opacity: bgOpacity }}>
          <div className="mist-overlay" />
          <motion.div className="project-list" style={{ y: currentY }}>
            {PROJECT_DATA.map((data, i) => (
              <div key={i} className="project" style={{ top: `${i * 100}vh` }}>
                <motion.img src={data.image} alt={data.title} style={{ y: imageY }} />
              </div>
            ))}
          </motion.div>
        </motion.div>

        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <motion.div 
            style={{ y: finalContainerY, willChange: "transform" }}
            className="flex flex-col items-center"
          >
            <motion.div style={{ opacity: mainUIOpacity }} className="minimap-bar-outer">
              <div className="minimap-content-viewport">
                <div className="minimap-img-preview">
                  <motion.div style={{ y: contentInternalY }} className="w-full h-full relative">
                    {PROJECT_DATA.map((data, i) => (
                      <div key={i} className="minimap-img-item" style={{ top: `${i * 250}px` }}>
                        <img src={data.image} alt={data.title} className="block w-full h-full object-cover" />
                      </div>
                    ))}
                  </motion.div>
                </div>
                <div className="minimap-info-list">
                  <motion.div style={{ y: contentInternalY }} className="w-full h-full relative">
                    {PROJECT_DATA.map((data, i) => {
                      const num = (i + 1).toString().padStart(2, "0");
                      return (
                        <div key={i} className="minimap-item-info" style={{ top: `${i * 250}px` }}>
                          <div className="minimap-item-info-row">
                            <p className="font-medium opacity-100">{num}</p>
                            <h4 className="text-xl md:text-2xl font-medium tracking-tight uppercase text-right md:max-w-[45%] leading-tight">
                              {data.title}
                            </h4>
                          </div>
                          <div className="minimap-item-info-row">
                            <p className="text-neutral-600 font-medium">{data.category}</p>
                            <p className="font-medium tabular-nums text-neutral-600">{data.year}</p>
                          </div>
                          <div className="minimap-item-info-row">
                            <p className="lowercase opacity-80 font-medium leading-relaxed md:max-w-[35%] text-[10px]">
                              {data.description}
                            </p>
                            <Link 
                                href={`/funcionalidades/${data.slug}`} 
                                className="pointer-events-auto font-medium text-[10px] opacity-60 hover:opacity-100 hover:text-black transition-all duration-300 text-right group/link"
                            >
                              <span className="border-b border-black/10 group-hover/link:border-black pb-1">Ver Mais</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            </motion.div>

            <div className="h-[200px] w-full flex items-center justify-center pt-10">
              <motion.div 
                style={{ 
                  opacity: buttonOpacity,
                  pointerEvents: useTransform(smoothProgress, (v) => v > projectArea ? "auto" : "none")
                }}
              >
                <div className="flex items-center gap-4 pointer-events-auto">
                  <MagneticEffect>
                    <a 
                      href="https://www.instagram.com/miaraifood/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="custom-btn-github hover:scale-110 active:scale-95 transition-transform shadow-xl block"
                      title="Instagram MIAR AI/FOOD"
                    >
                      <Instagram className="w-6 h-6" />
                    </a>
                  </MagneticEffect>
                  
                  <MagneticEffect>
                    <div className="group-projects flex items-center gap-2">
                      <Link href="/funcionalidades" className="custom-btn group-hover:scale-105 active:scale-95 group-hover:shadow-[0_0_30px_rgba(193,228,74,0.3)]">
                       Ver Mais
                      </Link>
                      <Link href="/funcionalidades" className="custom-btn-arrow group-hover:scale-110 active:scale-95 transition-transform shadow-xl">
                        <ArrowUpRight className="w-6 h-6 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </Link>
                    </div>
                  </MagneticEffect>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <motion.div 
          style={{ opacity: useTransform(smoothProgress, [0, 0.05, projectArea, projectArea + 0.05], [0, 1, 1, 0]) }}
          className="slide-overlay"
        >
           <span className="text-foreground/40 font-mono text-[10px] tracking-[0.5em] uppercase">Page</span>
           <div className="slide-line bg-foreground/10">
              <motion.div 
                className="slide-progress bg-green-500" 
                style={{ width: useTransform(smoothProgress, [0, projectArea], ["0%", "100%"]) }} 
              />
           </div>
           <motion.span className="text-foreground font-mono text-[11px] tabular-nums font-bold">
              {useTransform(smoothProgress, (v) => {
               const idx = Math.min(Math.floor(v / projectStep), PROJECT_DATA.length - 1);
               return `${idx + 1} / ${PROJECT_DATA.length}`;
             })}
           </motion.span>
        </motion.div>
      </div>

      {/* Mobile View (Static Flow) */}
      <div className="md:hidden flex flex-col px-4 py-16 gap-12 bg-background dark:bg-black w-full overflow-hidden relative z-10">
        <div className="text-center mb-4">
            <h2 className="text-3xl font-bold uppercase tracking-tight text-foreground">Nossas Funcionalidades</h2>
            <p className="text-sm text-muted-foreground mt-2">Explore as soluções do MIAR AI/FOOD.</p>
        </div>
        {PROJECT_DATA.map((data, i) => {
          const num = (i + 1).toString().padStart(2, "0");
          return (
            <div key={i} className="flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden shadow-xl border border-neutral-200 dark:border-zinc-800">
              <div className="w-full bg-neutral-100 dark:bg-zinc-900">
                <img src={data.image} alt={data.title} className="w-full h-auto object-contain" />
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[10px] font-bold text-neutral-400">{num}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-primary">{data.category}</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{data.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
                <Link 
                  href={`/funcionalidades/${data.slug}`}
                  className="mt-4 flex items-center justify-between w-full p-4 bg-neutral-100 dark:bg-zinc-900 rounded-xl group/btn"
                >
                  <span className="text-xs font-bold uppercase tracking-widest">Ver Detalhes</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-center mt-8 gap-4">
            <Link href="/funcionalidades" className="px-8 py-4 bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest rounded-full shadow-lg">
                Ver Todas
            </Link>
        </div>
      </div>
    </div>
  );
}
