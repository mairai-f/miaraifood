import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, MapPin, Phone, MessageCircle, Clock, ShieldCheck, CheckCircle2, Navigation, ChevronLeft, Store, BellRing, Compass } from 'lucide-react';
import { RealLeafletMap } from './RealLeafletMap';

export interface DeliveryTrackingProps {
  orderId: string;
  onBack?: () => void;
}

export function DeliveryTrackingView({ orderId, onBack }: DeliveryTrackingProps) {
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [driverPos, setDriverPos] = useState({ lat: -23.55052, lng: -46.633308 });
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  useEffect(() => {
    // Poll delivery status
    const fetchDelivery = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/active-offer`);
        if (res.ok) {
          const data = await res.json();
          if (data.offer) {
            setDeliveryData(data.offer);
            if (data.offer.driverLat && data.offer.driverLng) {
              setDriverPos({ lat: data.offer.driverLat, lng: data.offer.driverLng });
            }
          }
        }
      } catch (err) {
        console.error("Erro ao buscar rastreamento da entrega:", err);
      }
    };

    void fetchDelivery();
    const interval = setInterval(() => void fetchDelivery(), 3500);

    // SSE EventSource for real-time location & notification
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('delivery:location', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          if (data.lat && data.lng) {
            setDriverPos({ lat: data.lat, lng: data.lng });
          }
        } catch {}
      });

      eventSource.addEventListener('delivery:collected', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          setNotificationBanner(data.message ?? "O entregador já está com o seu pedido e está a caminho!");
          void fetchDelivery();
        } catch {}
      });

      eventSource.addEventListener('delivery:status-changed', () => {
        void fetchDelivery();
      });
    } catch (e) {
      console.warn("SSE não suportado ou erro de conexão:", e);
    }

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [orderId]);

  const offer = deliveryData ?? {
    orderId,
    restaurantName: "Churrascaria do Vale",
    restaurantPhone: "(11) 3456-7890",
    customerName: "Você",
    customerAddress: "Av. Paulista, 1500 - Ap 42",
    driverName: "João Silva",
    driverPhone: "(11) 99999-8888",
    vehiclePlate: "ABC1D23",
    vehicleModel: "Honda CG 160 Preta",
    deliveryPin: "4321",
    status: "A_CAMINHO_DA_COLETA",
    distanceKm: 2.4,
    estimatedMinutes: 8,
  };

  const isStage1 = ["CRIADA", "AGUARDANDO_ENTREGADOR", "OFERTADA", "ACEITA", "A_CAMINHO_DA_COLETA", "CHEGUEI_NA_COLETA"].includes(offer.status);
  const isStage2 = ["PEDIDO_COLETADO", "A_CAMINHO_DO_CLIENTE", "CHEGUEI_NO_DESTINO"].includes(offer.status);
  const isDelivered = offer.status === "ENTREGUE";

  const steps = [
    { label: "Confirmado", status: "completed" },
    { label: "Em Preparação", status: "completed" },
    { label: "Em Coleta", status: isStage1 ? "active" : "completed" },
    { label: "A Caminho", status: isStage2 ? "active" : isDelivered ? "completed" : "pending" },
    { label: "Entregue", status: isDelivered ? "completed" : "pending" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <span className="text-xs uppercase font-extrabold tracking-widest text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
          Acompanhar Entrega Ao Vivo 🚴
        </span>
      </div>

      {/* 🔔 Banner de Notificação em Tempo Real */}
      <AnimatePresence>
        {(notificationBanner || isStage2 || offer.status === "ACEITA" || offer.status === "A_CAMINHO_DA_COLETA") && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2.5 shadow-lg border ${
              isStage2
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
            }`}
          >
            <BellRing className="h-4 w-4 shrink-0 animate-bounce text-orange-400" />
            <div>
              {notificationBanner ? (
                <p>{notificationBanner}</p>
              ) : isStage2 ? (
                <p><strong>📦 Pedido Coletado!</strong> O entregador já está com o seu pedido e a caminho da sua casa.</p>
              ) : (
                <p><strong>🟢 Entregador a caminho!</strong> O motoboy {offer.driverName} aceitou o pedido e está indo ao restaurante retirar seu pedido.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real Interactive OpenStreetMap & Valhalla Engine Route Map */}
      <div className="relative h-60 w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        <RealLeafletMap
          origin={
            isStage1
              ? { lat: driverPos.lat ?? -23.55052, lng: driverPos.lng ?? -46.633308, label: 'Motoboy', type: 'courier' }
              : { lat: -23.55552, lng: -46.643308, label: offer.restaurantName, type: 'store' }
          }
          destination={
            isStage1
              ? { lat: -23.55552, lng: -46.643308, label: offer.restaurantName, type: 'store' }
              : { lat: -23.56152, lng: -46.655908, label: 'Sua Casa', type: 'customer' }
          }
          driverPos={driverPos}
          className="h-full w-full"
        />

        {/* Stage Badge Overlay */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-950/90 border border-slate-800 px-3 py-1 text-[11px] font-bold text-slate-200 backdrop-blur shadow-md">
          <span className={`h-2 w-2 rounded-full ${isStage1 ? 'bg-sky-400' : 'bg-emerald-400'} animate-ping`} />
          {isStage1 ? "Etapa 1: Motoboy ➔ Restaurante" : "Etapa 2: Motoboy ➔ Sua Casa"}
        </div>

        {/* ETA Overlay */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-2xl bg-slate-950/90 border border-slate-800 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
          <Clock className="h-3.5 w-3.5 text-orange-400" />
          <span className="font-extrabold text-slate-100">ETA: ~{offer.estimatedMinutes} min</span>
        </div>
      </div>

      {/* 🔐 PIN de Confirmação Anti-Fraude (4 dígitos = últimos dígitos do telefone do cliente) */}
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1">
          <ShieldCheck className="h-4 w-4" /> Seu Código de Entrega (PIN)
        </p>
        <p className="text-3xl font-extrabold tracking-[0.4em] text-slate-100 font-mono">
          {offer.deliveryPin}
        </p>
        <p className="text-[11px] text-slate-400">
          Informe este código ao entregador quando ele chegar no seu endereço.
        </p>
      </div>

      {/* Timeline de Status */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Progresso da Entrega</h4>
        <div className="flex items-center justify-between text-xs font-medium">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                step.status === "completed" ? "bg-emerald-500 text-slate-950" : step.status === "active" ? "bg-orange-500 text-slate-950 animate-pulse" : "bg-slate-800 text-slate-500"
              }`}>
                {step.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={`text-[10px] ${step.status === "completed" ? "text-emerald-400" : step.status === "active" ? "text-orange-400" : "text-slate-500"}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 👤 Contato Direto com o Entregador & Empresa / Restaurante */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-slate-100 text-base">{offer.driverName}</p>
              <p className="text-xs text-slate-400">{offer.vehicleModel} • <strong className="text-slate-200 uppercase">{offer.vehiclePlate}</strong></p>
            </div>
          </div>
          <a href={`tel:${offer.driverPhone}`} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20">
            <Phone className="h-4 w-4" />
          </a>
        </div>

        <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Store className="h-4 w-4 text-orange-400" />
            <div>
              <p className="font-bold text-slate-200">{offer.restaurantName}</p>
              <p className="text-[11px] text-slate-400">Empresa / Estabelecimento</p>
            </div>
          </div>
          <a href={`tel:${offer.restaurantPhone ?? "(11) 3456-7890"}`} className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            <Phone className="h-3.5 w-3.5 text-sky-400" /> Ligar Loja
          </a>
        </div>
      </div>
    </div>
  );
}
