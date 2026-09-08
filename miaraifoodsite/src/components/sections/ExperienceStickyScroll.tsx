"use client";
import React from "react";
import Image from "next/image";
import { GraduationCap, BookOpen, Binary, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const CornerAccents = ({ hoverClass }: { hoverClass: string }) => (
    <>
        <div className={cn("absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-black/40 dark:border-white/40 z-20 pointer-events-none transition-colors duration-500", hoverClass)} />
        <div className={cn("absolute -top-[1px] -right-[1px] w-4 h-4 border-t-2 border-r-2 border-black/40 dark:border-white/40 z-20 pointer-events-none transition-colors duration-500", hoverClass)} />
        <div className={cn("absolute -bottom-[1px] -left-[1px] w-4 h-4 border-b-2 border-l-2 border-black/40 dark:border-white/40 z-20 pointer-events-none transition-colors duration-500", hoverClass)} />
        <div className={cn("absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-black/40 dark:border-white/40 z-20 pointer-events-none transition-colors duration-500", hoverClass)} />
    </>
);

export default function ExperienceStickyScroll({ isLowPowerMode = false }: { isLowPowerMode?: boolean }) {
    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Módulo PDV e Vendas (Esquerda) */}
                <motion.div 
                    initial={isLowPowerMode ? {} : { opacity: 0, y: 20 }}
                    whileInView={isLowPowerMode ? {} : { opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="col-span-1 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#0a0a0a] overflow-hidden relative group flex flex-col min-h-[450px] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] hover:border-blue-500/50"
                >
                    <CornerAccents hoverClass="group-hover:border-blue-500 dark:group-hover:border-blue-400" />
                    {/* Text Section (Top) */}
                    <div className="p-8 relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Tecnologia • Operação de Caixa</span>
                        </div>
                        <h3 className="text-3xl font-black text-neutral-900 dark:text-white mb-4">Frente de Caixa & PDV</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            Módulo de vendas ultrarrápido projetado para zerar filas, aceitar múltiplos meios de pagamento e sincronizar em tempo real com o estoque da loja.
                        </p>
                    </div>

                    {/* Visual Section (Bottom) */}
                    <div className="flex-1 flex items-center justify-center relative p-8 mt-auto border-t border-black/10 dark:border-white/10 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 overflow-hidden">
                        {/* Background Image */}
                        <div className="absolute inset-0">
                            <Image
                                src="/telasdosistema/pdvfrentedecaixa.png"
                                alt="PDV MIAR AI/FOOD"
                                fill
                                className="object-cover opacity-20 dark:opacity-30 blur-[2px] scale-125 group-hover:scale-110 transition-transform duration-700"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-black/40 to-black/10 dark:from-blue-950/90 dark:via-black/50 dark:to-transparent transition-opacity duration-500 group-hover:opacity-80" />
                        </div>

                        {/* Animated Background Element */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                        </div>

                        <div className="relative z-10 flex flex-col items-center transition-transform duration-500 group-hover:scale-105">
                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                                {["Caixa Ágil", "Vendas em Segundos", "Impressão de Comprovante"].map(s => (
                                    <span key={s} className="px-3 py-1 rounded-full text-[10px] bg-black/40 dark:bg-white/10 text-white border border-white/20 font-mono font-bold backdrop-blur-md shadow-lg group-hover:bg-blue-600/50 transition-colors">
                                        {s}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] font-mono text-white/90 uppercase tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10 group-hover:border-blue-500/50 transition-colors">Núcleo de Operações PDV</p>
                        </div>

                        {/* Holographic Scan Effect */}
                        {!isLowPowerMode && (
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-400/80 to-transparent animate-scan z-20" />
                        )}
                    </div>
                </motion.div>

                {/* Módulo Fiado & Clientes (Direita) */}
                <motion.div 
                    initial={isLowPowerMode ? {} : { opacity: 0, y: 20 }}
                    whileInView={isLowPowerMode ? {} : { opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="col-span-1 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#0a0a0a] overflow-hidden relative group flex flex-col min-h-[450px] transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)] hover:border-orange-500/50 hover:z-10"
                >
                    <CornerAccents hoverClass="group-hover:border-orange-500 dark:group-hover:border-orange-400" />
                    {/* Text Section (Top) */}
                    <div className="p-8 relative z-10 transition-transform duration-500">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Crédito • Gestão de Fiados</span>
                        </div>
                        <h3 className="text-3xl font-black text-neutral-900 dark:text-white mb-4">Fiado Digital & Clientes</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            Organize os recebimentos da caderneta de maneira digital. Histórico claro por cliente, limite de crédito pré-aprovado e cobranças inteligentes via WhatsApp.
                        </p>
                    </div>

                    {/* Visual Section (Bottom) */}
                    <div className="flex-1 flex items-center justify-center relative p-8 mt-auto border-t border-black/10 dark:border-white/10 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 overflow-hidden">
                         {/* Background Image */}
                         <div className="absolute inset-0">
                            <Image
                                src="/telasdosistema/gestaodofiado.png"
                                alt="Clientes Fiado Digital"
                                fill
                                className="object-cover opacity-20 dark:opacity-25 blur-sm scale-125 group-hover:scale-110 group-hover:rotate-1 transition-transform duration-700"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-950/70 via-black/40 to-black/10 dark:from-orange-950/90 dark:via-black/50 dark:to-transparent mix-blend-multiply dark:mix-blend-normal transition-opacity duration-500 group-hover:opacity-80" />
                        </div>

                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute inset-0 bg-[radial-gradient(#80808012_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                                {["Controle de Fiados", "WhatsApp Direto", "Histórico Transparente"].map(s => (
                                    <span key={s} className="px-3 py-1 rounded-full text-[10px] bg-black/40 dark:bg-white/10 text-white border border-white/20 font-mono font-bold backdrop-blur-md shadow-lg group-hover:bg-orange-600/50 transition-colors">
                                        {s}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] font-mono text-white/90 uppercase tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10 group-hover:border-orange-500/50 transition-colors">Gestão Comercial & Crédito</p>
                        </div>
                    </div>
                </motion.div>

                {/* Módulo Estoque & Produtos */}
                <motion.div 
                    initial={isLowPowerMode ? {} : { opacity: 0, y: 20 }}
                    whileInView={isLowPowerMode ? {} : { opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="col-span-1 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#0a0a0a] overflow-hidden relative group flex flex-col min-h-[450px] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] hover:border-emerald-500/50"
                >
                    <CornerAccents hoverClass="group-hover:border-emerald-500 dark:group-hover:border-emerald-400" />
                    {/* Text Section (Top) */}
                    <div className="p-8 relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Logística • Controle Total</span>
                        </div>
                        <h3 className="text-3xl font-black text-neutral-900 dark:text-white mb-4">Estoque & Produtos</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            Acompanhe cada entrada e saída do seu inventário. Tenha alertas automáticos de baixo estoque e realize operações em lote rapidamente.
                        </p>
                    </div>

                    {/* Visual Section (Bottom) */}
                    <div className="flex-1 flex items-center justify-center relative p-8 mt-auto border-t border-black/10 dark:border-white/10 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 overflow-hidden">
                        <div className="absolute inset-0">
                            <Image
                                src="/telasdosistema/controleseuestoque.png"
                                alt="Controle de Estoque"
                                fill
                                className="object-cover opacity-20 dark:opacity-30 blur-[2px] scale-125 group-hover:scale-110 transition-transform duration-700"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-black/40 to-black/10 dark:from-emerald-950/90 dark:via-black/50 dark:to-transparent transition-opacity duration-500 group-hover:opacity-80" />
                        </div>

                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                        </div>

                        <div className="relative z-10 flex flex-col items-center transition-transform duration-500 group-hover:scale-105">
                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                                {["Alertas de Baixo Estoque", "Operações em Lote", "Cadastro Simplificado"].map(s => (
                                    <span key={s} className="px-3 py-1 rounded-full text-[10px] bg-black/40 dark:bg-white/10 text-white border border-white/20 font-mono font-bold backdrop-blur-md shadow-lg group-hover:bg-emerald-600/50 transition-colors">
                                        {s}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] font-mono text-white/90 uppercase tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10 group-hover:border-emerald-500/50 transition-colors">Gestão de Inventário</p>
                        </div>
                    </div>
                </motion.div>

                {/* Módulo Financeiro & Dashboards */}
                <motion.div 
                    initial={isLowPowerMode ? {} : { opacity: 0, y: 20 }}
                    whileInView={isLowPowerMode ? {} : { opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="col-span-1 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#0a0a0a] overflow-hidden relative group flex flex-col min-h-[450px] transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)] hover:border-purple-500/50 hover:z-10"
                >
                    <CornerAccents hoverClass="group-hover:border-purple-500 dark:group-hover:border-purple-400" />
                    {/* Text Section (Top) */}
                    <div className="p-8 relative z-10 transition-transform duration-500">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Gestão • Saúde Financeira</span>
                        </div>
                        <h3 className="text-3xl font-black text-neutral-900 dark:text-white mb-4">Dashboards & Relatórios</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            Métricas visuais de lucro, fechamentos diários e fluxo de caixa contábil gerados automaticamente a partir das suas vendas diárias.
                        </p>
                    </div>

                    {/* Visual Section (Bottom) */}
                    <div className="flex-1 flex items-center justify-center relative p-8 mt-auto border-t border-black/10 dark:border-white/10 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 overflow-hidden">
                         <div className="absolute inset-0">
                            <Image
                                src="/telasdosistema/paineldecontrole.png"
                                alt="Relatórios e Dashboards"
                                fill
                                className="object-cover opacity-20 dark:opacity-25 blur-sm scale-125 group-hover:scale-110 group-hover:-rotate-1 transition-transform duration-700"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-purple-950/70 via-black/40 to-black/10 dark:from-purple-950/90 dark:via-black/50 dark:to-transparent mix-blend-multiply dark:mix-blend-normal transition-opacity duration-500 group-hover:opacity-80" />
                        </div>

                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute inset-0 bg-[radial-gradient(#80808012_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                                {["Fechamento de Caixa", "Métricas Visuais", "Automação DRE"].map(s => (
                                    <span key={s} className="px-3 py-1 rounded-full text-[10px] bg-black/40 dark:bg-white/10 text-white border border-white/20 font-mono font-bold backdrop-blur-md shadow-lg group-hover:bg-purple-600/50 transition-colors">
                                        {s}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] font-mono text-white/90 uppercase tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10 group-hover:border-purple-500/50 transition-colors">Inteligência de Negócios</p>
                        </div>
                    </div>
                </motion.div>

                {/* Coming Soon Box (Bottom - Full Width) - Hover Effect: Inner Glow & Cyan Border */}
                <motion.div 
                    initial={isLowPowerMode ? {} : { opacity: 0, y: 20 }}
                    whileInView={isLowPowerMode ? {} : { opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="col-span-1 md:col-span-2 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#0a0a0a] overflow-hidden relative group p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 transition-all duration-500 hover:border-cyan-500/50 hover:shadow-[inset_0_0_30px_rgba(6,182,212,0.1),0_0_30px_-5px_rgba(6,182,212,0.3)] hover:bg-neutral-50 dark:hover:bg-[#0f0f0f]"
                >
                    <CornerAccents hoverClass="group-hover:border-cyan-500 dark:group-hover:border-cyan-400" />
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/40 via-transparent to-transparent group-hover:opacity-40 transition-opacity duration-700"></div>

                    <div className="relative z-10 max-w-xl transition-transform duration-500 group-hover:translate-x-2">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-500">Evolução Contínua</span>
                        </div>
                        <h3 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-white mb-4 group-hover:text-cyan-950 dark:group-hover:text-cyan-50 transition-colors">Em constante evolução</h3>
                        <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          O MIAR AI/FOOD está em evolução constante. Novos recursos, melhorias de desempenho e atualizações são desenvolvidos continuamente para tornar a gestão do seu negócio cada vez mais simples e eficiente.
                        </p>
                    </div>

                    <div className="relative z-10 flex flex-wrap justify-center md:justify-end gap-4 mt-6 md:mt-0">
                         {/* Animated Icons for Coming Soon */}
                         <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-[0.5rem] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-md group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-300 shadow-sm relative">
                             <div className="w-6 h-6 rounded-full border-2 border-dashed border-cyan-500 dark:border-cyan-400 animate-[spin_3s_linear_infinite]"></div>
                         </div>
                         <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-[0.5rem] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-md group-hover:-translate-y-1 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-300 delay-75 shadow-sm relative">
                             <Clock className="w-6 h-6 md:w-8 md:h-8 text-neutral-500 dark:text-neutral-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                         </div>
                         <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-[0.5rem] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-md group-hover:-translate-y-2 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-300 delay-150 shadow-sm relative">
                             <div className="flex gap-1">
                                 <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                 <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                 <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                             </div>
                         </div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}

