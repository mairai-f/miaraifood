import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, 
  DollarSign, Zap, CheckCircle2, AlertCircle, RefreshCw, X, Camera,
  Printer, ArrowLeft, Tag, Layers, Flame
} from 'lucide-react';
import { createAndCompleteOrder } from '../lib/order-service';
import { playSuccessSound } from '../lib/audio-alert';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  barcode?: string;
  category: string;
  stock: number;
  unit: 'un' | 'kg';
  imageUrl?: string;
}

interface CartItem {
  product: ProductItem;
  quantity: number;
  weightKg?: number; // Para itens vendidos por KG
  notes?: string;
}

const MOCK_PRODUCTS: ProductItem[] = [
  { id: 'p1', name: 'Coca-Cola Zero 2L', price: 11.90, barcode: '7894900700015', category: 'Bebidas', stock: 48, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80' },
  { id: 'p2', name: 'Arroz Tipo 1 Tureba 5kg', price: 29.90, barcode: '7891234567890', category: 'Mercearia', stock: 22, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80' },
  { id: 'p3', name: 'Feijão Carioca Kicaldo 1kg', price: 8.49, barcode: '7896001200341', category: 'Mercearia', stock: 35, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=300&q=80' },
  { id: 'p4', name: 'Queijo Mussarela Fatiado', price: 42.90, barcode: '7898001122334', category: 'Frios & Laticínios', stock: 12, unit: 'kg', imageUrl: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=300&q=80' },
  { id: 'p5', name: 'Presunto Cozido Perdigão', price: 28.50, barcode: '7898001122341', category: 'Frios & Laticínios', stock: 15, unit: 'kg', imageUrl: 'https://images.unsplash.com/photo-1524438418049-ab2acb7aa48f?auto=format&fit=crop&w=300&q=80' },
  { id: 'p6', name: 'Banana Prata', price: 6.99, barcode: '7890001112223', category: 'Hortifruti', stock: 50, unit: 'kg', imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=300&q=80' },
  { id: 'p7', name: 'Cerveja Heineken Long Neck 330ml', price: 7.50, barcode: '7891055000101', category: 'Bebidas', stock: 120, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=300&q=80' },
  { id: 'p8', name: 'Pão de Açúcar de Forma Wickbold', price: 9.90, barcode: '7896066300052', category: 'Padaria', stock: 18, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80' },
  { id: 'p9', name: 'Detergente Ypê Neutro 500ml', price: 2.89, barcode: '7891022000201', category: 'Limpeza', stock: 80, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=300&q=80' },
  { id: 'p10', name: 'Chocolate Lacta ao Leite 80g', price: 5.99, barcode: '7891008000450', category: 'Conveniência', stock: 65, unit: 'un', imageUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=300&q=80' },
];

const CATEGORIES = ['Tudo', 'Mercearia', 'Bebidas', 'Frios & Laticínios', 'Hortifruti', 'Padaria', 'Limpeza', 'Conveniência'];

export function PdvPage() {
  const [products, setProducts] = useState<ProductItem[]>(MOCK_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tudo');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pix' | 'credit' | 'debit'>('pix');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<any | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus na busca ao carregar
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Leitor de Código de Barras Global por Teclado
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se o foco for em campos de texto de troco ou busca
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      // Atalhos de Teclado Globais (F2, F4, F8, Enter)
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setCart([]);
        setScanStatus('Carrinho limpo');
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        const desc = prompt('Digite o valor do desconto em R$:', '0');
        if (desc) setDiscount(Math.max(0, parseFloat(desc) || 0));
        return;
      }

      // Detecção de Código de Barras (Escaneamento rápido < 50ms por caractere)
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 6) {
          e.preventDefault();
          handleBarcodeScanned(barcodeBuffer);
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart]);

  // Trata escaneamento de código de barras
  const handleBarcodeScanned = (code: string) => {
    const cleanCode = code.trim();
    const found = products.find(p => p.barcode === cleanCode || p.id === cleanCode);

    if (found) {
      addToCart(found);
      setScanStatus(`✅ EAN-13 Bipado: ${found.name}`);
      playSuccessSound();
    } else {
      setScanStatus(`⚠️ Código ${cleanCode} não encontrado no cadastro.`);
    }
  };

  const addToCart = (product: ProductItem) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.product.unit === 'kg' ? item.quantity + delta : item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const updateWeight = (productId: string, weightKg: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(0.001, weightKg) };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Cálculos da Compra
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = Math.max(0, subtotal - discount);
  const numReceived = parseFloat(receivedAmount.replace(',', '.')) || 0;
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, numReceived - total) : 0;

  // Filtragem de Produtos
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Tudo' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchTerm));
    return matchesCategory && matchesSearch;
  });

  // Finalização da Venda PDV
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('Adicione produtos ao carrinho antes de finalizar a venda.');
      return;
    }

    if (paymentMethod === 'cash' && numReceived < total) {
      alert(`Valor recebido em dinheiro (R$ ${numReceived.toFixed(2)}) é inferior ao total da venda (R$ ${total.toFixed(2)}).`);
      return;
    }

    setIsProcessing(true);

    try {
      const companyId = localStorage.getItem('companyId') || 'rest-1';
      
      const orderData = {
        companyId,
        type: 'counter' as const,
        paymentMethod,
        subtotal,
        discount,
        total,
        customerName: 'Cliente Mercadinho / Balcão',
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price,
          notes: item.product.unit === 'kg' ? `${item.quantity.toFixed(3)} kg` : undefined
        }))
      };

      const result = await createAndCompleteOrder(orderData);

      if (result.success) {
        playSuccessSound();
        setLastSale({
          id: result.orderId || `VENDA-${Date.now().toString().slice(-4)}`,
          total,
          paymentMethod,
          changeAmount,
          itemsCount: cart.reduce((acc, i) => acc + (i.product.unit === 'un' ? i.quantity : 1), 0),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });

        // Limpar carrinho
        setCart([]);
        setDiscount(0);
        setReceivedAmount('');
        setScanStatus('✅ Venda registrada com sucesso!');
      } else {
        alert(`Erro ao registrar venda: ${result.message}`);
      }
    } catch (err: any) {
      console.error('Erro na venda PDV:', err);
      alert('Erro inesperado ao registrar venda no caixa.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-[#0c1017] text-gray-100 overflow-hidden">
      
      {/* ─── COLUNA DA ESQUERDA: CATÁLOGO & BUSCA POR CÓDIGO DE BARRAS ───────────── */}
      <div className="flex-1 flex flex-col border-r border-gray-800/60 overflow-hidden p-4 space-y-4">
        
        {/* Barra de Status & Atalhos */}
        <div className="flex items-center justify-between bg-[#151c28] border border-gray-800 rounded-xl px-4 py-2.5">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-sm text-gray-200">Caixa 01 · Mercadinho / PDV Operacional</span>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-xs text-gray-400">
            <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700 font-mono"><strong className="text-emerald-400">F2</strong> Busca</span>
            <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700 font-mono"><strong className="text-amber-400">F8</strong> Desconto</span>
            <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700 font-mono"><strong className="text-rose-400">F4</strong> Limpar</span>
          </div>
        </div>

        {/* Input de Busca & Barcode Scanner */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  handleBarcodeScanned(searchTerm);
                }
              }}
              placeholder="Passe o Código de Barras (EAN-13) ou digite o nome do produto..."
              className="w-full bg-[#151c28] border border-gray-700/80 rounded-xl pl-11 pr-24 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            <div className="absolute right-3 top-2.5 flex items-center space-x-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-1 rounded">
                Leitor Ativo
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              const code = prompt('Simulação de Leitor USB (digite o código EAN):', '7894900700015');
              if (code) handleBarcodeScanned(code);
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-3 rounded-xl transition-all shadow-lg shadow-emerald-950/40 text-sm"
          >
            <Barcode className="h-4 w-4" />
            <span>Bipar EAN</span>
          </button>
        </div>

        {/* Status de Escaneamento Feedback */}
        {scanStatus && (
          <div className="bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs px-3.5 py-2 rounded-lg flex items-center justify-between animate-fadeIn">
            <span>{scanStatus}</span>
            <button onClick={() => setScanStatus('')} className="text-emerald-400 hover:text-emerald-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Categorias Rápidas */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 font-semibold' 
                  : 'bg-[#151c28] text-gray-300 hover:bg-gray-800 border border-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de Produtos */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => addToCart(product)}
              className="group bg-[#151c28] hover:bg-[#1a2332] border border-gray-800/80 hover:border-emerald-500/50 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-sm relative overflow-hidden"
            >
              <div>
                <div className="relative h-24 w-full mb-2.5 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <ShoppingCart className="h-8 w-8 text-gray-600" />
                  )}
                  <span className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-md text-[10px] font-bold text-gray-300 px-1.5 py-0.5 rounded border border-gray-700">
                    {product.unit === 'kg' ? 'R$/kg' : `Est: ${product.stock}`}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-gray-200 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
                  {product.name}
                </h4>
                {product.barcode && (
                  <p className="text-[10px] font-mono text-gray-400 mt-1 flex items-center gap-1">
                    <Barcode className="h-3 w-3 text-gray-400" />
                    {product.barcode}
                  </p>
                )}
              </div>
              
              <div className="mt-3 flex items-center justify-between border-t border-gray-800/60 pt-2">
                <span className="text-sm font-bold text-emerald-400">
                  R$ {product.price.toFixed(2)}
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── COLUNA DA DIREITA: CARRINHO & TERMINAL DE PAGAMENTO ────────────────── */}
      <div className="w-full lg:w-96 bg-[#111722] flex flex-col h-full border-t lg:border-t-0 border-gray-800">
        
        {/* Header do Carrinho */}
        <div className="p-4 border-b border-gray-800/80 flex items-center justify-between bg-[#151c28]">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-gray-100">Cupom de Venda ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <button 
              onClick={() => setCart([])}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Lista de Itens do Carrinho */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6 space-y-3">
              <div className="h-16 w-16 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400">
                <Barcode className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-300">Caixa Pronto para Vendas</p>
                <p className="text-xs text-gray-400 mt-1">Bipe um código de barras ou clique nos produtos para adicionar.</p>
              </div>
            </div>
          ) : (
            cart.map(item => {
              const itemTotal = item.product.price * item.quantity;
              return (
                <div key={item.product.id} className="bg-[#151c28] border border-gray-800 rounded-xl p-3 flex flex-col space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <h5 className="text-xs font-semibold text-gray-200 leading-snug">{item.product.name}</h5>
                      <span className="text-[10px] text-gray-400 font-mono">
                        R$ {item.product.price.toFixed(2)} {item.product.unit === 'kg' ? '/ kg' : 'un'}
                      </span>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-400 hover:text-rose-400 transition-colors p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-800/60">
                    {/* Controles de Quantidade ou Peso */}
                    {item.product.unit === 'kg' ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-amber-400 font-bold uppercase">Peso:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => updateWeight(item.product.id, parseFloat(e.target.value) || 0)}
                          className="w-20 bg-gray-900 border border-gray-700 rounded text-center text-xs py-1 font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs text-gray-400 font-bold">kg</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="h-6 w-6 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold font-mono text-gray-200">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="h-6 w-6 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <span className="text-xs font-bold font-mono text-emerald-400">
                      R$ {itemTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resumo Financeiro & Formas de Pagamento */}
        <div className="p-4 bg-[#151c28] border-t border-gray-800 space-y-3">
          
          {/* Subtotal, Desconto e Total */}
          <div className="space-y-1.5 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-gray-200">R$ {subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Desconto Aplicado:</span>
                <span className="font-mono font-medium">- R$ {discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-800">
              <span className="text-sm font-bold text-gray-100">TOTAL A PAGAR:</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-400">
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Seleção da Forma de Pagamento */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { id: 'pix', label: 'Pix', icon: Zap, color: 'border-emerald-500/80 text-emerald-400 bg-emerald-950/40' },
              { id: 'credit', label: 'Crédito', icon: CreditCard, color: 'border-blue-500/80 text-blue-400 bg-blue-950/40' },
              { id: 'debit', label: 'Débito', icon: CreditCard, color: 'border-indigo-500/80 text-indigo-400 bg-indigo-950/40' },
              { id: 'cash', label: 'Dinheiro', icon: DollarSign, color: 'border-amber-500/80 text-amber-400 bg-amber-950/40' },
            ].map(m => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-semibold ${
                    isSelected ? m.color + ' ring-2 ring-emerald-500/50 font-bold' : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4 mb-1" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Campo de Valor Recebido para Dinheiro (Troco) */}
          {paymentMethod === 'cash' && (
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-300 font-medium">Valor Recebido (Dinheiro):</span>
                <input
                  type="text"
                  placeholder="R$ 50,00"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="w-28 bg-gray-900 border border-amber-700/60 rounded px-2 py-1 text-right text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>
              {numReceived > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-amber-900/40">
                  <span className="text-amber-200 font-bold">TROCO A DEVOLVER:</span>
                  <span className="font-mono font-extrabold text-amber-400 text-sm">
                    R$ {changeAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botão Principal de Finalização */}
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || isProcessing}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg ${
              cart.length > 0 && !isProcessing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/80 active:scale-[0.99]'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Registrando Venda...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>FINALIZAR VENDA (Enter)</span>
              </>
            )}
          </button>

          {/* Confirmação da Última Venda */}
          {lastSale && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between text-xs text-gray-300">
              <div>
                <span className="text-emerald-400 font-bold">Última Venda: {lastSale.id}</span>
                <p className="text-[10px] text-gray-400">{lastSale.itemsCount} itens · R$ {lastSale.total.toFixed(2)} ({lastSale.paymentMethod.toUpperCase()})</p>
              </div>
              <button onClick={() => window.print()} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                <Printer className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
