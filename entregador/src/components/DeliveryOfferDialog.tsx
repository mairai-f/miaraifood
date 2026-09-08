import React, { useEffect, useState } from 'react';

interface Offer {
  id: string;
  restaurantName: string;
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  estimatedMinutes: number;
  earning: number;
  surgeFee?: number;
}

interface DeliveryOfferDialogProps {
  offer: Offer;
  onAccept: () => void;
  onReject: () => void;
}

export function DeliveryOfferDialog({ offer, onAccept, onReject }: DeliveryOfferDialogProps) {
  const [timeLeft, setTimeLeft] = useState(15); // 15 seconds to accept

  useEffect(() => {
    if (timeLeft <= 0) {
      onReject();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onReject]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-all animate-in slide-in-from-bottom-4">
        
        {/* Header - Total Payout */}
        <div className="bg-green-500 p-6 text-center text-white">
          <div className="text-sm font-semibold uppercase tracking-wider mb-1 flex justify-center items-center gap-2">
            <span className="animate-pulse">🔔</span> Nova Entrega
          </div>
          <div className="text-4xl font-black mb-1">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.earning)}
          </div>
          {offer.surgeFee && offer.surgeFee > 0 && (
            <div className="text-green-100 text-sm font-medium flex justify-center items-center gap-1">
              <span>🔥</span> Adicional de demanda incluso (+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.surgeFee)})
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6 text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📍</span>
              <div>
                <div className="font-bold text-gray-900 dark:text-white">{offer.distanceKm.toFixed(1)} km</div>
                <div className="text-xs">Distância total</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏱️</span>
              <div>
                <div className="font-bold text-gray-900 dark:text-white">~{offer.estimatedMinutes} min</div>
                <div className="text-xs">Tempo estimado</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 relative">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 rounded-full border-2 border-green-500 bg-white z-10"></div>
                <div className="w-0.5 h-12 bg-gray-200 dark:bg-gray-700 my-1"></div>
                <div className="w-3 h-3 rounded-sm border-2 border-red-500 bg-red-500 z-10"></div>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Retirada</div>
                  <div className="font-bold text-gray-800 dark:text-gray-200">{offer.restaurantName}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{offer.pickupAddress}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Entrega</div>
                  <div className="font-bold text-gray-800 dark:text-gray-200">Cliente</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{offer.deliveryAddress}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button 
            onClick={onReject}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Recusar
          </button>
          <button 
            onClick={onAccept}
            className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-green-500/30"
          >
            ACEITAR 
            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-md">{timeLeft}s</span>
          </button>
        </div>
      </div>
    </div>
  );
}
