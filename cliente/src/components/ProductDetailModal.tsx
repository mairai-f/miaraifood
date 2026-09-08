import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import type { MenuItem, MenuItemAdicional } from '../types';

interface ProductDetailModalProps {
  product: (MenuItem & { imageUrl?: string | null; restaurantName?: string }) | null;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem & { imageUrl?: string | null },
    quantity: number,
    observation: string,
    adicionaisSelecionados: MenuItemAdicional[],
    ingredientesRemovidos: string[],
  ) => void;
}

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState('');
  const [selectedAdicionais, setSelectedAdicionais] = useState<string[]>([]);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

  if (!product) return null;

  const adicionais = product.adicionais ?? [];
  const adicionaisEscolhidos = adicionais.filter((a) => selectedAdicionais.includes(a.id));
  const adicionaisTotalCents = adicionaisEscolhidos.reduce((sum, a) => sum + (a.priceCents ?? 0), 0);
  const totalPrice = product.price * quantity + (adicionaisTotalCents / 100) * quantity;

  const toggleAdicional = (id: string) => {
    setSelectedAdicionais((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const toggleIngredient = (name: string) => {
    setRemovedIngredients((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md p-0 sm:items-center sm:p-4">
        {/* Backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#0B1A10] bg-[#16301F] text-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans"
        >
          {/* Header Image or Banner */}
          <div className="relative h-48 sm:h-56 w-full bg-[#06100A] flex items-center justify-center overflow-hidden shrink-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-6xl text-amber-500/40">
                🍱
              </div>
            )}

            {/* Top Close Button ('X') */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80 hover:scale-105 active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>

            {product.restaurantName && (
              <div className="absolute bottom-3 left-3 bg-[#0B1A10]/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white shadow-md">
                {product.restaurantName}
              </div>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Title & Category */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#008000]/80">
                {product.category || 'Cardápio'}
              </span>
              <h2 className="text-xl font-bold text-white leading-tight mt-0.5" style={{ fontWeight: 600 }}>
                {product.name}
              </h2>
              {/* Price */}
              <p className="text-lg font-bold text-[#008000] mt-1" style={{ fontWeight: 700 }}>
                R$ {product.price.toFixed(2)}
              </p>
            </div>

            {/* Product Description */}
            <div className="border-t border-[#0B1A10]/50 pt-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">Descrição do Produto</h4>
              <p className="text-sm text-slate-200 leading-relaxed font-normal" style={{ fontWeight: 400 }}>
                {product.description || 'Sem descrição detalhada cadastrada. Preparado na hora com ingredientes selecionados.'}
              </p>
            </div>

            {/* Adicionais / Itens inclusos (checkbox) */}
            {adicionais.length > 0 && (
              <div className="border-t border-[#0B1A10]/50 pt-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Adicionais</h4>
                <div className="space-y-2">
                  {adicionais.map((ad) => {
                    const checked = selectedAdicionais.includes(ad.id);
                    return (
                      <label
                        key={ad.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 cursor-pointer transition ${
                          checked ? 'border-[#008000] bg-[#008000]/10' : 'border-[#0B1A10] bg-[#06100A]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAdicional(ad.id)}
                            className="h-4 w-4 accent-[#008000]"
                          />
                          <span className="text-sm text-white font-medium">{ad.label}</span>
                        </span>
                        {!!ad.priceCents && (
                          <span className="text-xs font-bold text-[#008000]">
                            + R$ {(ad.priceCents / 100).toFixed(2)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tirar ingrediente (mesma origem de dado do QR Menu — ficha técnica) */}
            {Boolean(product.ingredientes?.length) && (
              <div className="border-t border-[#0B1A10]/50 pt-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Tirar algum ingrediente?</h4>
                <div className="space-y-2">
                  {product.ingredientes!.map((ingredient) => {
                    const checked = removedIngredients.includes(ingredient);
                    return (
                      <label
                        key={ingredient}
                        className="flex items-center gap-2.5 text-sm cursor-pointer text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleIngredient(ingredient)}
                          className="h-4 w-4 accent-[#008000]"
                        />
                        <span className={checked ? 'opacity-40 line-through' : 'font-medium'}>{ingredient}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Observações Field */}
            <div className="border-t border-[#0B1A10]/50 pt-3">
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                Observações
              </label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Tirar salada, molho à parte, bem passado..."
                rows={3}
                className="w-full rounded-2xl border border-[#0B1A10] bg-[#06100A] p-3 text-sm text-white placeholder-slate-500 focus:border-[#008000] focus:outline-none transition resize-none"
              />
            </div>

            {/* Quantity Stepper */}
            <div className="flex items-center justify-between border-t border-[#0B1A10]/50 pt-4">
              <span className="text-sm font-semibold text-slate-300">Quantidade</span>
              <div className="flex items-center gap-3 bg-[#06100A] border border-[#0B1A10] px-3 py-1.5 rounded-full">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1A10] text-white hover:bg-red-800 transition disabled:opacity-50"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-base font-extrabold text-[#008000] min-w-[1.5rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1A10] text-white hover:bg-red-800 transition"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer / Add to Cart CTA */}
          <div className="border-t border-[#0B1A10] bg-[#06100A] p-4 shrink-0">
            <button
              onClick={() => {
                onAddToCart(product, quantity, observation, adicionaisEscolhidos, removedIngredients);
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-2xl bg-[#38B000] hover:bg-[#70E000] active:scale-[0.99] text-white p-4 shadow-lg transition font-semibold text-sm sm:text-base"
              style={{ fontWeight: 600 }}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" /> ADICIONAR AO CARRINHO
              </span>
              <span className="font-extrabold text-[#06100A] bg-[#008000] px-3 py-1 rounded-xl">
                R$ {totalPrice.toFixed(2)}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
