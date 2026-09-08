import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Armchair,
  ChefHat,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Flame,
  UtensilsCrossed,
  Bike,
  Sparkles,
} from 'lucide-react';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();

  const metrics = [
    {
      label: 'Pedidos Hoje',
      value: '42',
      detail: '+12% vs. ontem',
      icon: ShoppingBag,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      route: '/comandas',
    },
    {
      label: 'Mesas Ocupadas',
      value: '8',
      detail: 'De 18 mesas totais',
      icon: Armchair,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      route: '/mesas',
    },
    {
      label: 'Em Preparo',
      value: '5',
      detail: 'Fila do KDS',
      icon: ChefHat,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      route: '/kds',
    },
    {
      label: 'Vendas Hoje',
      value: 'R$ 3.842,90',
      detail: 'Faturamento acumulado',
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      route: '/pdv',
    },
  ];

  const liveOrders = [
    {
      id: '#1048',
      location: 'Mesa 08',
      itemsCount: '3 itens',
      itemsList: '2x Smash Burger, 1x Coca-Cola Zero',
      status: 'EM PREPARO',
      statusType: 'preparo',
      price: 'R$ 92,50',
      timeAgo: 'Há 6 min',
      type: 'table',
    },
    {
      id: '#1049',
      location: 'Mesa 12',
      itemsCount: '5 itens',
      itemsList: '1x Pizza Peperoni G, 2x Chope 500ml, 2x Pudim',
      status: 'AGUARDANDO COZINHA',
      statusType: 'waiting',
      price: 'R$ 147,80',
      timeAgo: 'Há 2 min',
      type: 'table',
    },
    {
      id: '#1050',
      location: 'Delivery',
      itemsCount: '2 itens',
      itemsList: '1x Combo Picanha Gourmet, 1x Suco Natural',
      status: 'PRONTO PARA RETIRADA',
      statusType: 'ready',
      price: 'R$ 68,90',
      timeAgo: 'Há 12 min',
      type: 'delivery',
    },
    {
      id: '#1051',
      location: 'Mesa 04',
      itemsCount: '4 itens',
      itemsList: '1x Feijoada Completa, 2x Caipirinha, 1x Porção de Torresmo',
      status: 'EM PREPARO',
      statusType: 'preparo',
      price: 'R$ 184,00',
      timeAgo: 'Há 8 min',
      type: 'table',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 text-foreground">
            PAINEL DE CONTROLE
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              MIAR AI/FOOD
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Visão em tempo real da operação da filial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/pdv')}
            className="bg-[#007200] hover:bg-[#006400] text-white font-bold text-xs"
          >
            <ShoppingBag className="h-4 w-4 mr-1.5" /> Ir para o PDV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/kds')}
            className="font-bold text-xs"
          >
            <ChefHat className="h-4 w-4 mr-1.5 text-emerald-500" /> KDS Cozinha
          </Button>
        </div>
      </div>

      {/* 4 METRIC CARDS */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {metrics.map((m, i) => (
          <motion.div key={i} variants={item}>
            <Card
              onClick={() => navigate(m.route)}
              className="cursor-pointer transition-all hover:scale-[1.02] hover:border-emerald-500/40 shadow-sm"
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {m.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-foreground">
                    {m.value}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-500 mt-1 flex items-center gap-1">
                    <span>{m.detail}</span>
                  </p>
                </div>
                <div className={`p-3 rounded-2xl border ${m.bgColor}`}>
                  <m.icon className={`h-6 w-6 ${m.color}`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / MAIN COLUMN: OPERAÇÃO AGORA */}
        <Card className="lg:col-span-8 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Flame className="h-4 w-4 text-emerald-500" /> OPERAÇÃO AGORA
              </CardTitle>
              <CardDescription className="text-xs">
                Últimos pedidos transitando pela cozinha e salão
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/comandas')}
              className="text-xs font-bold text-emerald-500 hover:text-emerald-400"
            >
              Ver todas <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate('/comandas')}
                className="group p-4 rounded-2xl border border-border/70 bg-card/60 hover:bg-card hover:border-emerald-500/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      order.type === 'delivery'
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {order.type === 'delivery' ? (
                      <Bike className="h-5 w-5" />
                    ) : (
                      <UtensilsCrossed className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-foreground">
                        {order.location}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {order.id}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
                        {order.itemsCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium ml-auto sm:ml-0">
                        {order.timeAgo}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1 font-medium">
                      {order.itemsList}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                      order.statusType === 'preparo'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 animate-pulse'
                        : order.statusType === 'waiting'
                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    }`}
                  >
                    {order.status}
                  </Badge>
                  <span className="text-sm font-black text-foreground">
                    {order.price}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RIGHT COLUMN: 2 OPERATIONAL BLOCKS (COZINHA & MESAS) */}
        <div className="lg:col-span-4 space-y-6">
          {/* BLOCO COZINHA (KDS) */}
          <Card className="shadow-sm border-l-4 border-l-cyan-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-cyan-400" /> COZINHA (KDS)
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/kds')}
                  className="h-7 text-[11px] font-bold text-cyan-400 hover:text-cyan-300"
                >
                  Abrir KDS <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-cyan-400" /> Pedidos na fila
                </span>
                <span className="text-base font-black text-foreground">12</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400" /> Atrasados
                </span>
                <span className="text-base font-black text-rose-400">4</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400" /> Tempo médio de preparo
                </span>
                <span className="text-base font-black text-emerald-400">14 min</span>
              </div>
            </CardContent>
          </Card>

          {/* BLOCO MESAS */}
          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <Armchair className="h-4 w-4 text-amber-400" /> MESAS
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/mesas')}
                  className="h-7 text-[11px] font-bold text-amber-400 hover:text-amber-300"
                >
                  Mapa Mesas <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                  <p className="text-xl font-black mt-0.5 text-foreground">18</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Ocupadas</p>
                  <p className="text-xl font-black mt-0.5 text-amber-400">8</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Livres</p>
                  <p className="text-xl font-black mt-0.5 text-emerald-400">7</p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Atendimento</p>
                  <p className="text-xl font-black mt-0.5 text-cyan-400">3</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
