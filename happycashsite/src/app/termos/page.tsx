"use client";

import { motion } from "framer-motion";
import React from "react";
import { ShieldCheck, FileText, Lock, ChevronRight, Check } from "lucide-react";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-black/5 dark:border-white/10">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white">
      {title}
    </h1>
  </div>
);

const Section = ({ title, children, delay = 0 }: { title: string, children: React.ReactNode, delay?: number }) => (
  <motion.section 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.5, delay }}
    className="mb-12 group"
  >
    <div className="flex items-center gap-2 mb-4">
      <ChevronRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity -ml-7 absolute" />
      <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
    </div>
    <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400">
      {children}
    </div>
  </motion.section>
);

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-primary/30">

      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50 dark:opacity-20" />
        
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm mb-8"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium tracking-wide uppercase">Transparência e Segurança</span>
          </motion.div>

          <motion.h1 
            {...fadeIn}
            className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-black dark:text-white mb-6"
          >
            Termos e <span className="text-primary">Privacidade</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            Conheça as regras de utilização do HappyCash e saiba como tratamos e protegemos os dados do seu negócio.
          </motion.p>
        </div>
      </section>

      {/* Content Section */}
      <section className="px-6 pb-24 md:pb-32 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-3xl p-8 md:p-12 shadow-xl shadow-black/5">
            
            {/* Política de Privacidade */}
            <div className="mb-24">
              <SectionHeader title="Política de Privacidade" icon={Lock} />
              
              <p className="text-sm font-medium text-zinc-500 mb-8 uppercase tracking-widest">Última atualização: 9 de julho de 2026</p>
              
              <div className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 mb-12">
                Esta Política de Privacidade explica como o HappyCash coleta, utiliza, armazena, protege e compartilha dados pessoais relacionados ao seu site, cadastro, área do cliente, sistema ERP, PDV, controle de fiado, estoque e demais recursos disponibilizados pela plataforma. Ao utilizar o HappyCash, determinados dados poderão ser tratados para permitir o funcionamento dos serviços, proteger as contas, processar pagamentos, prestar suporte e cumprir obrigações legais.
              </div>

              <Section title="1. Quem somos" delay={0.1}>
                <p>O HappyCash é uma plataforma de gestão comercial que oferece recursos como ERP, PDV, controle de fiado, controle de estoque, relatórios, gestão de clientes, recursos financeiros e funcionalidades relacionadas.</p>
                <p>Para assuntos relacionados à privacidade, proteção de dados ou exercício de direitos previstos na legislação aplicável, entre em contato pelo e-mail: <strong><a href="mailto:happycashsupport@gmail.com" className="text-primary hover:underline">happycashsupport@gmail.com</a></strong></p>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">Controlador dos dados</h3>
                <p>Em relação aos dados pessoais tratados pelo próprio HappyCash para funcionamento da conta, contratação dos serviços, atendimento, segurança e demais finalidades próprias da plataforma, o HappyCash poderá atuar como controlador dos dados.</p>
                <p>Quando uma loja utiliza o HappyCash para cadastrar seus próprios clientes, produtos, vendas, pagamentos, dívidas ou outras informações relacionadas à sua operação, a loja é responsável por definir as finalidades e os meios essenciais desse tratamento. Nessas situações, o HappyCash atua como fornecedor da tecnologia e poderá tratar esses dados na medida necessária para disponibilizar, manter, proteger e melhorar os serviços contratados.</p>
              </Section>

              <Section title="2. Dados que podemos coletar" delay={0.2}>
                <p>Dependendo da utilização da plataforma, podemos tratar diferentes categorias de dados.</p>
                
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">2.1. Dados de cadastro</h3>
                <ul className="list-disc pl-5 space-y-1 mb-4">
                  <li>nome completo, e-mail, telefone, senha protegida;</li>
                  <li>CPF ou CNPJ, nome e tipo do estabelecimento;</li>
                  <li>endereço completo (CEP, rua, número, bairro, cidade, estado);</li>
                  <li>plano contratado e informações relacionadas à conta.</li>
                </ul>

                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">2.2. Dados inseridos pela loja</h3>
                <p>O estabelecimento pode inserir informações necessárias para sua operação, incluindo:</p>
                <ul className="list-disc pl-5 space-y-1 mb-4">
                  <li>nome de clientes, CPF ou CNPJ, telefone, endereço;</li>
                  <li>histórico de fiado, vendas, pagamentos, despesas;</li>
                  <li>produtos, estoque, observações e outras informações financeiras.</li>
                </ul>
                <p>Quando esses dados pertencem aos clientes, funcionários, fornecedores ou terceiros do estabelecimento, a loja é responsável por garantir que possui uma base legal adequada para coletar e utilizar essas informações.</p>

                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">2.3. Dados relacionados a pagamentos</h3>
                <p>Quando houver contratação de planos ou serviços pagos, podemos tratar informações relacionadas ao plano contratado, status da assinatura, meio de pagamento e identificadores de transação. Dados financeiros sensíveis de cartão poderão ser tratados diretamente pelos provedores, conforme suas próprias políticas.</p>

                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">2.4. Dados técnicos e de atendimento</h3>
                <p>Durante o uso, podemos registrar endereço IP, navegador, dispositivo, identificadores de sessão e informações de segurança. Para suporte, armazenamos mensagens enviadas, histórico de solicitações e informações técnicas necessárias para solução de problemas.</p>
              </Section>

              <Section title="3. Para que utilizamos os dados" delay={0.3}>
                <p>Os dados podem ser utilizados para:</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 list-none pl-0 mt-4">
                  {[
                    "Criar e administrar contas", "Autenticar usuários e proteger sistemas",
                    "Executar funcionalidades do ERP e PDV", "Disponibilizar controle de fiado e estoque",
                    "Gerar relatórios e processar pagamentos", "Prestar suporte e identificar erros",
                    "Prevenir fraude e abuso", "Cumprir obrigações legais ou regulatórias"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="4. Compartilhamento e Bases Legais" delay={0.4}>
                <p>O tratamento de dados pessoais poderá ocorrer com fundamento nas bases legais previstas, incluindo execução de contrato, cumprimento de obrigação legal, exercício regular de direitos, legítimo interesse ou consentimento.</p>
                <p>O HappyCash poderá compartilhar informações com fornecedores (hospedagem, banco de dados, pagamentos, e-mails, segurança) na medida necessária para a execução dos serviços. Também poderemos compartilhar informações por determinação legal, para prevenir fraudes ou proteger direitos.</p>
              </Section>

              <Section title="5. Segurança e Direitos dos Titulares" delay={0.5}>
                <p>Adotamos medidas técnicas e administrativas destinadas a proteger os dados, como autenticação, controle de acesso, separação de dados, criptografia e monitoramento. O usuário também é responsável por proteger suas credenciais e dispositivos.</p>
                <p>Os titulares de dados poderão exercer direitos previstos na LGPD, como acesso, correção e exclusão. Solicitações referentes aos dados tratados diretamente pelo HappyCash podem ser encaminhadas para <strong>happycashsupport@gmail.com</strong>. Se os dados foram cadastrados por uma loja, a solicitação deve ser feita ao próprio estabelecimento.</p>
              </Section>
            </div>


            {/* Termos de Uso */}
            <div>
              <SectionHeader title="Termos de Uso" icon={FileText} />
              
              <p className="text-sm font-medium text-zinc-500 mb-8 uppercase tracking-widest">Última atualização: 9 de julho de 2026</p>
              
              <div className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 mb-12">
                Estes Termos de Uso regulam o acesso e utilização do site, área do cliente, sistema HappyCash ERP, PDV, recursos de desktop, funcionalidades offline, planos, testes gratuitos e demais serviços disponibilizados pela plataforma. Ao criar uma conta, acessar o site, contratar um plano ou utilizar qualquer recurso do HappyCash, você declara que leu, compreendeu e concorda com estes Termos de Uso.
              </div>

              <Section title="1. Aceite e Responsabilidades do Usuário">
                <p>Ao utilizar o HappyCash, você concorda com estes Termos. Caso represente uma empresa, declara possuir autorização. O usuário se compromete a:</p>
                <ul className="list-disc pl-5 space-y-1 mb-4">
                  <li>fornecer informações verdadeiras e atualizadas;</li>
                  <li>proteger senhas, PINs e controlar acessos de operadores;</li>
                  <li>conferir vendas, pagamentos, estoque e relatórios;</li>
                  <li>utilizar o sistema de forma legal, sem atividades de fraude ou abuso.</li>
                </ul>
              </Section>

              <Section title="2. Planos, Testes e Pagamentos">
                <p>O HappyCash disponibiliza planos pagos e testes gratuitos. Os pagamentos podem ser via Pix, boleto ou cartão. A liberação de recursos depende da confirmação do pagamento. Em caso de atraso ou chargeback, o acesso pode ser suspenso. O usuário pode cancelar a assinatura a qualquer momento, o que interrompe futuras renovações.</p>
              </Section>

              <Section title="3. Dados da Loja e Relatórios">
                <p>Os dados inseridos (clientes, vendas, fiado) permanecem da loja. O usuário autoriza a plataforma a processá-los para prestar o serviço. As informações financeiras e fiscais do sistema são ferramentas de apoio: o HappyCash não substitui contadores ou consultorias tributárias.</p>
              </Section>

              <Section title="4. Propriedade Intelectual e Limitação de Responsabilidade">
                <p>A marca, código, layout e identidade visual pertencem ao HappyCash. É proibida a cópia, engenharia reversa ou revenda. Na extensão máxima permitida pela lei, o HappyCash não se responsabiliza por perdas devido a lançamentos incorretos, falta de conferência, problemas de conexão do usuário ou falhas em seus dispositivos.</p>
              </Section>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
