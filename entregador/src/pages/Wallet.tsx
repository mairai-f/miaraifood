import React from 'react';

export default function Wallet() {
  const todayEarnings = 86.40;
  const deliveriesCount = 8;
  const avgEarning = todayEarnings / deliveriesCount;

  const mockHistory = [
    { id: '#5821', time: '18:42', earning: 10.50, distance: '4.3 km', type: 'MIAR' },
    { id: '#5820', time: '17:31', earning: 12.00, distance: '5.1 km', type: 'MIAR' },
    { id: '#5819', time: '16:52', earning: 9.80, distance: '3.8 km', type: 'MIAR' },
  ];

  return (
    <div className="p-4 flex flex-col h-full bg-gray-50 dark:bg-gray-900 max-w-md mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">💰 Meus Ganhos</h1>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg mb-8">
        <div className="text-green-100 text-sm font-medium mb-1">Hoje</div>
        <div className="text-4xl font-black mb-4">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(todayEarnings)}
        </div>
        
        <div className="flex justify-between border-t border-white/20 pt-4">
          <div>
            <div className="text-green-100 text-xs">Entregas</div>
            <div className="text-xl font-bold">{deliveriesCount}</div>
          </div>
          <div>
            <div className="text-green-100 text-xs">Média / entrega</div>
            <div className="text-xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgEarning)}
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1">
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Histórico de Hoje</h2>
        <div className="space-y-3">
          {mockHistory.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  Entrega {item.id}
                  <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded uppercase font-bold">{item.type}</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.time} • {item.distance}
                </div>
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.earning)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <button className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-xl shadow-md active:scale-95 transition-transform">
          SOLICITAR SAQUE
        </button>
      </div>
    </div>
  );
}
