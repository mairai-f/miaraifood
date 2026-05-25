import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PixPaymentDialog } from '@/components/booking/PixPaymentDialog';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
import { buildProductOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/agendaWhatsApp';

type PaymentMethod = 'local' | 'pix';

type ConfirmationSummary = {
  orderId: string;
  businessName: string;
  clientName: string;
  createdAt: Date;
  paymentMethod: PaymentMethod;
  total: number;
  items: { id: string; name: string; quantity: number; price: number }[];
  whatsappMessage: string;
  whatsappUrl: string | null;
};

const getPaymentLabel = (method: PaymentMethod) =>
  method === 'pix' ? 'Pix informado como pago' : 'Pagar no local';

export function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, total, clearCart } = useCart();
  const { user } = useAuth();
  const { settings } = useAgendaBranding();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submittingMethod, setSubmittingMethod] = useState<PaymentMethod | null>(null);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationSummary | null>(null);

  const publicLoginPath = withAgendaPublicSearch('/login', settings);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('full_name, username, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setClientName(data.full_name || data.username || '');
      setClientPhone(data.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      void fetchProfile();
    }
  }, [fetchProfile, isOpen, user]);

  const orderItems = useMemo(
    () => items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
    [items],
  );

  const validateCheckout = (method: PaymentMethod) => {
    if (!user) {
      toast({
        title: 'Faça login para comprar',
        description: 'Entre com sua conta para confirmar a compra.',
        variant: 'destructive',
      });
      setIsOpen(false);
      navigate(publicLoginPath);
      return false;
    }

    if (!settings.storeAccountId) {
      toast({
        title: 'Empresa nao carregada',
        description: 'Atualize a pagina e tente novamente.',
        variant: 'destructive',
      });
      return false;
    }

    if (items.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Adicione produtos para continuar.',
        variant: 'destructive',
      });
      return false;
    }

    if (!clientName.trim()) {
      toast({
        title: 'Informe seu nome',
        description: 'Precisamos do nome para registrar o pedido.',
        variant: 'destructive',
      });
      return false;
    }

    if (method === 'pix' && !settings.pixKey) {
      toast({
        title: 'Pix nao configurado',
        description: 'A empresa ainda nao cadastrou a chave Pix. Escolha pagar no local.',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const createOrder = async (method: PaymentMethod) => {
    if (!validateCheckout(method) || !settings.storeAccountId) return;

    const createdAt = new Date();
    const summaryItems = [...orderItems];
    const payloadItems: Json = items.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
    }));

    setSubmittingMethod(method);

    const { data: orderId, error } = await supabase.rpc('create_agenda_product_order', {
      p_store_account_id: settings.storeAccountId,
      p_items: payloadItems,
      p_client_name: clientName.trim(),
      p_client_phone: clientPhone.trim() || null,
      p_payment_method: method,
      p_notes: null,
    });

    setSubmittingMethod(null);

    if (error || !orderId) {
      toast({
        title: 'Erro ao registrar pedido',
        description: error?.message || 'Nao foi possivel finalizar a compra. Tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    const whatsappMessage = buildProductOrderWhatsAppMessage({
      businessName: settings.displayName,
      clientName: clientName.trim(),
      orderDate: createdAt,
      items: summaryItems,
      totalAmount: total,
      paymentMethod: method,
    });
    const whatsappUrl = buildWhatsAppUrl(settings.adminWhatsapp || settings.whatsapp || '', whatsappMessage);

    setConfirmation({
      orderId,
      businessName: settings.displayName,
      clientName: clientName.trim(),
      createdAt,
      paymentMethod: method,
      total,
      items: summaryItems,
      whatsappMessage,
      whatsappUrl,
    });

    clearCart();
    setPixDialogOpen(false);
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('agenda-products-updated'));

    toast({
      title: method === 'pix' ? 'Pedido registrado com Pix' : 'Pedido registrado',
      description:
        method === 'pix'
          ? 'Mostre a mensagem com os dados do pagamento para a empresa confirmar.'
          : 'Pagamento marcado para ser feito no local.',
    });
  };

  const handlePixCheckout = () => {
    if (!validateCheckout('pix')) return;
    setPixDialogOpen(true);
  };

  const copyConfirmationMessage = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.whatsappMessage);
      toast({ title: 'Mensagem copiada' });
    } catch {
      toast({ title: 'Nao foi possivel copiar', variant: 'destructive' });
    }
  };

  const isSubmitting = submittingMethod !== null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="font-serif flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Carrinho ({items.length})
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6">
              <ShoppingBag className="w-16 h-16 opacity-30" />
              <p className="text-lg font-medium">Carrinho vazio</p>
              <p className="text-sm">Adicione produtos para continuar</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.name}</h4>
                        <p className="text-primary font-bold text-sm">R$ {item.price.toFixed(2)}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full ml-auto text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-xl border bg-background p-4">
                  <div>
                    <Label htmlFor="cart-client-name">Nome</Label>
                    <Input
                      id="cart-client-name"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cart-client-phone">Telefone</Label>
                    <Input
                      id="cart-client-phone"
                      value={clientPhone}
                      onChange={(event) => setClientPhone(event.target.value)}
                      placeholder="WhatsApp para contato"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border px-6 py-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold font-serif">R$ {total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    className="rounded-full gap-2"
                    size="lg"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => void createOrder('local')}
                  >
                    {submittingMethod === 'local' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                    Pagar no local
                  </Button>
                  <Button
                    className="rounded-full gap-2"
                    size="lg"
                    disabled={isSubmitting}
                    onClick={handlePixCheckout}
                  >
                    {submittingMethod === 'pix' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Pagar Pix
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={clearCart} className="w-full text-muted-foreground" disabled={isSubmitting}>
                  Limpar carrinho
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <PixPaymentDialog
        open={pixDialogOpen}
        onOpenChange={setPixDialogOpen}
        pixKey={settings.pixKey}
        merchantName={settings.pixMerchantName || settings.displayName}
        amount={total}
        loading={submittingMethod === 'pix'}
        onConfirmSent={() => void createOrder('pix')}
      />

      <Dialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Pedido registrado
            </DialogTitle>
            <DialogDescription>
              Confira a mensagem do pedido antes de enviar para a empresa.
            </DialogDescription>
          </DialogHeader>

          {confirmation && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-secondary/40 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium text-right">{confirmation.businessName}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Data e hora</span>
                  <span className="font-medium text-right">
                    {format(confirmation.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Pagamento</span>
                  <Badge variant={confirmation.paymentMethod === 'pix' ? 'default' : 'secondary'}>
                    {getPaymentLabel(confirmation.paymentMethod)}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-primary">R$ {confirmation.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Itens</p>
                <div className="space-y-2">
                  {confirmation.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="gap-2" onClick={() => void copyConfirmationMessage()}>
              <Copy className="h-4 w-4" />
              Copiar mensagem
            </Button>
            {confirmation?.whatsappUrl && (
              <Button asChild className="gap-2">
                <a href={confirmation.whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Enviar WhatsApp
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
