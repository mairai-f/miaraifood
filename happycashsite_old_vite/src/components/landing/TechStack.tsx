const technologies = [
  {
    name: "Supabase",
    detail: "auth, banco e seguranca",
    logo: "https://cdn.simpleicons.org/supabase",
    card: "bg-[#123d34] text-white border-[#1b6b59]",
  },
  {
    name: "Resend",
    detail: "emails transacionais",
    logo: "https://cdn.simpleicons.org/resend/000000",
    card: "bg-[#18181b] text-white border-[#3f3f46]",
  },
  {
    name: "Redis",
    detail: "cache e filas rapidas",
    logo: "https://cdn.simpleicons.org/redis",
    card: "bg-[#fff1f2] text-[#991b1b] border-[#fda4af]",
  },
  {
    name: "Java",
    detail: "desktop e integracoes",
    logo: "https://cdn.simpleicons.org/openjdk",
    card: "bg-[#fff7ed] text-[#9a3412] border-[#fdba74]",
  },
  {
    name: "Vercel",
    detail: "deploy e CDN",
    logo: "https://cdn.simpleicons.org/vercel/000000",
    card: "bg-[#10131c] text-white border-[#374151]",
  },
  {
    name: "Cloudflare",
    detail: "protecao e anti-abuso",
    logo: "https://cdn.simpleicons.org/cloudflare",
    card: "bg-[#fff1dc] text-[#7c2d12] border-[#fdba74]",
  },
  {
    name: "PostgreSQL",
    detail: "dados relacionais",
    logo: "https://cdn.simpleicons.org/postgresql",
    card: "bg-[#e6f0ff] text-[#163d74] border-[#93c5fd]",
  },
  {
    name: "React",
    detail: "interface web",
    logo: "https://cdn.simpleicons.org/react",
    card: "bg-[#e0faff] text-[#155e75] border-[#67e8f9]",
  },
  {
    name: "TypeScript",
    detail: "codigo mais previsivel",
    logo: "https://cdn.simpleicons.org/typescript",
    card: "bg-[#e0ecff] text-[#1e3a8a] border-[#93c5fd]",
  },
  {
    name: "Tailwind",
    detail: "visual responsivo",
    logo: "https://cdn.simpleicons.org/tailwindcss",
    card: "bg-[#dffbff] text-[#155e75] border-[#67e8f9]",
  },
];

const paymentIntegrations = [
  { name: "Pix", detail: "pagamento instantaneo", logo: "https://cdn.simpleicons.org/pix/32BCAD", card: "bg-[#dffcf5] text-[#064e3b] border-[#5eead4]" },
  { name: "Stone", detail: "credito e debito", logo: "https://www.google.com/s2/favicons?domain=stone.com.br&sz=64", card: "bg-[#e7fbe9] text-[#14532d] border-[#86efac]" },
  { name: "Cielo", detail: "cartao e TEF", logo: "https://api.iconify.design/arcticons:cielo-home.svg?color=%230057a8", card: "bg-[#e7f0ff] text-[#1e3a8a] border-[#93c5fd]" },
  { name: "PagBank", detail: "PagSeguro", logo: "https://cdn.simpleicons.org/pagseguro/1EB53A", card: "bg-[#eefbe4] text-[#365314] border-[#bef264]" },
  { name: "Mercado Pago", detail: "carteira e maquina", logo: "https://cdn.simpleicons.org/mercadopago/00B1EA", card: "bg-[#e0f7ff] text-[#075985] border-[#7dd3fc]" },
  { name: "TEF Stone", detail: "integracao TEF", logo: "https://api.iconify.design/streamline-cyber-color:credit-card-payment-machine.svg", card: "bg-[#f0fdf4] text-[#14532d] border-[#4ade80]" },
  { name: "Getnet", detail: "maquininha", logo: "https://www.google.com/s2/favicons?domain=getnet.com.br&sz=64", card: "bg-[#fff7ed] text-[#9a3412] border-[#fdba74]" },
  { name: "InfinitePay", detail: "maquininha", logo: "https://www.google.com/s2/favicons?domain=infinitepay.io&sz=64", card: "bg-[#eef2ff] text-[#3730a3] border-[#a5b4fc]" },
];

const repeatedTechnologies = [...technologies, ...technologies];

const TechStack = () => {
  return (
    <section className="relative overflow-hidden border-y border-[#123b63]/20 bg-[#0b2344] py-12 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.065)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#113f76] to-transparent" />

      <div className="container relative z-10">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Confiabilidade</span>
            <h2 className="mt-2 font-heading text-2xl font-bold md:text-3xl">Tecnologia trabalhando nos bastidores</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-blue-100">
            Login, email, hospedagem e seguranca aparecem pouco para o cliente, mas precisam trabalhar bem todos os dias.
          </p>
        </div>
      </div>

      <div className="relative z-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#0b2344] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#0b2344] to-transparent" />
        <div className="tech-marquee flex w-max gap-3 px-3">
          {repeatedTechnologies.map((item, index) => (
            <div key={`${item.name}-${index}`} className={`flex min-w-[15.5rem] items-center gap-3 rounded-lg border px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${item.card}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
                <img src={item.logo} alt={item.name} className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
              </span>
              <span>
                <span className="block text-sm font-black">{item.name}</span>
                <span className="block text-xs opacity-80">{item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="container relative z-10 mt-10">
        <div className="rounded-lg border border-white/15 bg-white/[0.08] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">Pagamentos e maquininhas</span>
              <h3 className="mt-2 font-heading text-2xl font-bold">Fechamento preparado para separar cada origem</h3>
            </div>
            <p className="max-w-lg text-sm leading-6 text-blue-100">
              Registre Pix, dinheiro, credito, debito e prepare a operacao para TEF quando a loja precisar de integracao com maquininha.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {paymentIntegrations.map((item) => (
              <div key={item.name} className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition-transform duration-300 hover:-translate-y-1 ${item.card}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <img src={item.logo} alt={item.name} className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
                </span>
                <span>
                  <span className="block text-sm font-black">{item.name}</span>
                  <span className="block text-xs opacity-80">{item.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechStack;
