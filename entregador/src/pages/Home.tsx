import React, { useState, useEffect } from 'react';
import { DeliveryOfferDialog } from '../components/DeliveryOfferDialog';

export default function Home() {
  const [isOnline, setIsOnline] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<any>(null);

  // Simulação de Polling / WebSocket para receber oferta
  useEffect(() => {
    if (!isOnline) {
      setCurrentOffer(null);
      return;
    }

    const interval = setInterval(() => {
      // Aqui faríamos um fetch real para /dispatch/offers/pending
      // Simulando uma nova oferta a cada 15 segundos se online e sem oferta
      if (!currentOffer) {
        console.log("Checando novas ofertas...");
        const mockOffer = {
          id: 'offer-123',
          restaurantName: 'Restaurante MIAR Central',
          pickupAddress: 'Rua das Flores, 123',
          deliveryAddress: 'Av. Paulista, 1000',
          distanceKm: 4.2,
          estimatedMinutes: 18,
          earning: 11.40,
          surgeFee: 2.00
        };
        setCurrentOffer(mockOffer);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isOnline, currentOffer]);

  const handleAccept = () => {
    console.log("Oferta Aceita!");
    // Aqui chamaria a API /dispatch/accept
    setCurrentOffer(null);
  };

  const handleReject = () => {
    console.log("Oferta Recusada!");
    setCurrentOffer(null);
  };

  return (
    <div className="p-4 flex flex-col items-center h-full bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mt-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Olá, João</h1>
        
        <div className="flex items-center justify-between mb-8">
          <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Status</span>
          <button 
            onClick={() => setIsOnline(!isOnline)}
            className={`px-4 py-2 rounded-full font-bold text-white transition-colors ${
              isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'
            }`}
          >
            {isOnline ? '🟢 DISPONÍVEL' : '⚪ OFFLINE'}
          </button>
        </div>

        <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          {isOnline ? 'Aguardando pedidos...' : 'Fique online para receber pedidos.'}
        </div>
      </div>

      {currentOffer && (
        <DeliveryOfferDialog 
          offer={currentOffer} 
          onAccept={handleAccept} 
          onReject={handleReject} 
        />
      )}
    </div>
  );
}
