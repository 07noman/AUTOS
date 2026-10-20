import React, { useState, useEffect } from 'react';
import { Tag, Percent, X, Check, Trash2 } from 'lucide-react';

export type DiscountType = 'percent' | 'amount';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currentType: DiscountType;
  currentValue: number;
  taxRatePercent: number;
  onApply: (type: DiscountType, value: number) => void;
  onRemove: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  currentType,
  currentValue,
  taxRatePercent,
  onApply,
  onRemove,
}) => {
  const [type, setType] = useState<DiscountType>(currentType);
  const [inputValue, setInputValue] = useState<string>(
    currentValue > 0 ? String(currentValue) : ''
  );

  useEffect(() => {
    if (isOpen) {
      setType(currentType);
      setInputValue(currentValue > 0 ? String(currentValue) : '');
    }
  }, [isOpen, currentType, currentValue]);

  if (!isOpen) return null;

  const numValue = Math.max(0, parseFloat(inputValue) || 0);

  // Compute discount amount
  let calculatedDiscount = 0;
  if (type === 'percent') {
    const cappedPercent = Math.min(100, numValue);
    calculatedDiscount = (subtotal * cappedPercent) / 100;
  } else {
    calculatedDiscount = Math.min(subtotal, numValue);
  }

  const discountedSubtotal = Math.max(0, subtotal - calculatedDiscount);
  const calculatedTax = (discountedSubtotal * Math.max(0, taxRatePercent)) / 100;
  const calculatedTotal = discountedSubtotal + calculatedTax;

  const handleApply = () => {
    const finalVal = type === 'percent' ? Math.min(100, numValue) : Math.min(subtotal, numValue);
    onApply(type, finalVal);
    onClose();
  };

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  const percentPresets = [5, 10, 15, 20, 25, 50];
  const amountPresets = [50, 100, 200, 500, 1000, 2000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Cart Discount
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose percentage or fixed cash discount
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Discount Type Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('percent');
                if (type !== 'percent') setInputValue('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                type === 'percent'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Percent className="h-3.5 w-3.5" />
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('amount');
                if (type !== 'amount') setInputValue('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                type === 'amount'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="font-bold text-xs">Rs.</span>
              Fixed Amount (PKR)
            </button>
          </div>

          {/* Value Input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {type === 'percent' ? 'Discount Percentage (0 - 100%)' : 'Discount Amount (Rs.)'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={type === 'percent' ? 100 : subtotal}
                step={type === 'percent' ? '1' : '10'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={type === 'percent' ? 'e.g. 10' : 'e.g. 200'}
                autoFocus
                className="w-full text-lg font-bold px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {type === 'percent' ? '%' : 'Rs.'}
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {type === 'percent'
                ? percentPresets.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setInputValue(String(pct))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        numValue === pct
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))
                : amountPresets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setInputValue(String(amt))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        numValue === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      Rs. {amt}
                    </button>
                  ))}
            </div>
          </div>

          {/* Live Calculation Preview */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Cart Subtotal</span>
              <span>Rs. {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
              <span>
                Discount ({type === 'percent' ? `${Math.min(100, numValue)}%` : 'Fixed'})
              </span>
              <span>-Rs. {calculatedDiscount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tax ({taxRatePercent}%)</span>
              <span>Rs. {calculatedTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700 text-sm">
              <span>New Total Bill</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Rs. {calculatedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 gap-2">
          {currentValue > 0 ? (
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Discount
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={numValue <= 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
