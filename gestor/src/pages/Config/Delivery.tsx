import React, { useState } from 'react';

export default function DeliveryConfig() {
  const [deliveryModel, setDeliveryModel] = useState<'OWN' | 'MIAR' | 'HYBRID'>('MIAR');
  const [maxRadius, setMaxRadius] = useState(10);
  const [autoAccept, setAutoAccept] = useState(true);

  const handleSave = () => {
    console.log("Configurações de Delivery Salvas:", { deliveryModel, maxRadius, autoAccept });
    // Fetch para API de tenant settings
  };

  return (
    <div className="p-6 max-w-2xl bg-white rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Configurações de Delivery</h2>
      
      <div className="space-y-8">
        
        {/* Modelo de Operação */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Modelo de Operação</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input 
                type="radio" 
                name="deliveryModel" 
                value="OWN" 
                checked={deliveryModel === 'OWN'}
                onChange={() => setDeliveryModel('OWN')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-gray-800">Frota Própria</div>
                <div className="text-sm text-gray-500">Apenas seus próprios entregadores farão as entregas. Sem taxa MIAR.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input 
                type="radio" 
                name="deliveryModel" 
                value="MIAR" 
                checked={deliveryModel === 'MIAR'}
                onChange={() => setDeliveryModel('MIAR')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-gray-800">Entregadores MIAR</div>
                <div className="text-sm text-gray-500">Terceirize 100% da entrega para a rede autônoma MIAR.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input 
                type="radio" 
                name="deliveryModel" 
                value="HYBRID" 
                checked={deliveryModel === 'HYBRID'}
                onChange={() => setDeliveryModel('HYBRID')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-gray-800">Híbrido</div>
                <div className="text-sm text-gray-500">Tenta alocar sua frota própria primeiro. Se não houver ninguém, chama a rede MIAR.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Parâmetros */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raio Máximo de Entrega (km)
            </label>
            <input 
              type="number" 
              value={maxRadius}
              onChange={(e) => setMaxRadius(Number(e.target.value))}
              className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer mt-5">
              <input 
                type="checkbox" 
                checked={autoAccept}
                onChange={(e) => setAutoAccept(e.target.checked)}
                className="rounded text-blue-600 w-5 h-5"
              />
              <span className="text-sm font-medium text-gray-700">Aceitar entregadores automaticamente</span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t">
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
