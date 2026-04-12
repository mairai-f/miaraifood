import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useData } from '@/contexts/DataContext';
import { Users, AlertTriangle, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { getClientUniqueSlug } from '@/lib/clientSlug';
import { getPaymentLabel } from '@/lib/payment';
import { isToday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { clients, payments, getClientBalance, getClientTotalSpending, debtEntries } = useData();
  const navigate = useNavigate();
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  const active = clients.filter(c => !c.deleted);
  const debtors = active.filter(c => getClientBalance(c.id) > 0);
  const totalDebt = debtors.reduce((s, c) => s + getClientBalance(c.id), 0);

  // Filtrar pagamentos de hoje (considerando timezone local)
  const todayPayments = payments.filter(p => {
    const utcDate = new Date(p.date);
    const localDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000); // UTC-3 for Brazil
    return isToday(localDate);
  });

  const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0);

  // Clientes a mostrar: em "Todos", devedores primeiro e quitados por ultimo.
  const clientsToShow = [...(showDebtorsOnly ? debtors : active)].sort((a, b) => {
    if (!showDebtorsOnly) {
      const aHasDebt = getClientBalance(a.id) > 0;
      const bHasDebt = getClientBalance(b.id) > 0;

      if (aHasDebt !== bHasDebt) {
        return aHasDebt ? -1 : 1;
      }
    }

    return getClientTotalSpending(b.id) - getClientTotalSpending(a.id);
  });

  const stats = [
    { 
      label: 'Total Clientes', 
      value: active.length, 
      icon: Users,
      onClick: () => {
        setShowDebtorsOnly(false);
        // Scroll to clients list
        document.getElementById('clients-list')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    { 
      label: 'Devedores', 
      value: debtors.length, 
      icon: AlertTriangle,
      onClick: () => {
        setShowDebtorsOnly(true);
        // Scroll to clients list
        document.getElementById('clients-list')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    { 
      label: 'Total Dívidas', 
      value: `R$ ${totalDebt.toFixed(2)}`, 
      icon: DollarSign,
      onClick: () => {
        setShowDebtorsOnly(true);
        // Scroll to clients list
        document.getElementById('clients-list')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    { 
      label: 'Pago Hoje', 
      value: `R$ ${todayTotal.toFixed(2)}`, 
      icon: TrendingUp,
      onClick: () => setShowPaymentsModal(true)
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Painel de Controle</h1>
        <p className="page-subtitle">Visao geral de clientes, dividas e pagamentos do dia.</p>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((s, i) => (
          <motion.div 
            key={i} 
            variants={item} 
            whileHover={{ scale: 1.03, boxShadow: '0 0 30px hsl(217 91% 60% / 0.15)' }} 
            transition={{ type: 'spring', stiffness: 300 }}
            className="cursor-pointer"
            onClick={s.onClick}
          >
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent className="card-tight"><div className="money-value text-2xl font-bold">{s.value}</div></CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Modal de Pagamentos do Dia */}
      <Dialog open={showPaymentsModal} onOpenChange={setShowPaymentsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pagamentos de Hoje
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-hidden">
            {todayPayments.length > 0 ? (
              <>
                <div className="text-lg font-semibold text-center">
                  Total: R$ {todayTotal.toFixed(2)}
                </div>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {todayPayments
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(payment => {
                      const client = active.find(c => c.id === payment.client_id);
                      const utcDate = new Date(payment.date);
                      const localDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
                      
                      return (
                        <Card key={payment.id} className="border-border/50">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{client?.name || 'Cliente não encontrado'}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{format(localDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="money-value font-bold text-green-600">
                                  R$ {payment.amount.toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {getPaymentLabel(payment.type)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum pagamento registrado hoje
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div id="clients-list">
        <h2 className="mb-4 text-lg font-semibold">
          {showDebtorsOnly ? 'Devedores' : 'Todos os Clientes'}
        </h2>
        <div className="space-y-3">
          {clientsToShow.map(c => (
            <motion.div key={c.id} whileHover={{ scale: 1.01, boxShadow: '0 0 20px hsl(217 91% 60% / 0.1)' }} className="cursor-pointer" onClick={() => navigate(`/cliente/${encodeURIComponent(getClientUniqueSlug(c, active))}`)}>
              <Card className="border-border/50">
                <CardContent className="item-row-responsive p-4">
                  <span className="break-words font-medium">{c.name}</span>
                  <span className={`money-value text-right font-bold ${getClientBalance(c.id) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {getClientBalance(c.id) > 0 ? `R$ ${getClientBalance(c.id).toFixed(2)}` : 'Quitado'}
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {clientsToShow.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              {showDebtorsOnly ? 'Nenhum devedor no momento 🎉' : 'Nenhum cliente cadastrado'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
