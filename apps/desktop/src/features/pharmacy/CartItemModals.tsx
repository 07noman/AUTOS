import React, { useState, useEffect, useRef } from 'react';
import { X, Hash, DollarSign, Check, AlertCircle } from 'lucide-react';

interface CartQtyModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  unitLabel?: string;
  currentQty: number;
  maxStockInBaseUnits?: number;
  unitMultiplier?: number;
  onConfirm: (newQty: number) => void;
}

export const CartQtyModal: React.FC<CartQtyModalProps> = ({
  isOpen,
  onClose,
  itemName,
  unitLabel = 'Unit',
  currentQty,
  maxStockInBaseUnits,
  unitMultiplier = 1,
  onConfirm,
}) => {
  const [qty, setQty] = useState<string>(String(currentQty || 1));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQty(String(currentQty || 1));
      setError(null);
      // Auto-focus and select input value
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, currentQty]);

  if (!isOpen) return null;

  // Max quantity of this unit that stock can satisfy
  const maxAvailableUnits =
    maxStockInBaseUnits !== undefined && maxStockInBaseUnits > 0
      ? Math.floor(maxStockInBaseUnits / Math.max(1, unitMultiplier))
      : undefined;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseInt(qty, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Quantity must be a positive integer greater than 0');
      return;
    }

    if (maxAvailableUnits !== undefined && parsed > maxAvailableUnits) {
      setError(
        `Insufficient stock: Only ${maxAvailableUnits} ${unitLabel}(s) available (${maxStockInBaseUnits} base units)`
      );
      return;
    }

    setError(null);
    onConfirm(parsed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-500/10 text-[#00897b] rounded-lg">
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Change Quantity</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                {itemName} ({unitLabel})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Enter New Quantity ({unitLabel})
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2.5 text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00897b] focus:border-transparent transition"
                placeholder="1"
              />
            </div>
            {maxAvailableUnits !== undefined && (
              <p className="mt-1 text-[11px] text-slate-500">
                In Stock: <span className="font-semibold text-teal-700">{maxAvailableUnits} {unitLabel}(s)</span>
                {unitMultiplier > 1 && ` (${maxStockInBaseUnits} base units)`}
              </p>
            )}
            {error && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Quick preset buttons */}
          <div className="flex gap-2">
            {[1, 2, 5, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setQty(String(num));
                  if (error) setError(null);
                }}
                className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition"
              >
                +{num}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel (Esc)
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#00897b] hover:bg-[#00796b] shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Update Qty (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CartPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  unitLabel?: string;
  currentPrice: number;
  onConfirm: (newPrice: number) => void;
}

export const CartPriceModal: React.FC<CartPriceModalProps> = ({
  isOpen,
  onClose,
  itemName,
  unitLabel = 'Unit',
  currentPrice,
  onConfirm,
}) => {
  const [price, setPrice] = useState<string>(String(currentPrice || 0));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPrice(String(currentPrice || 0));
      setError(null);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, currentPrice]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed < 0) {
      setError('Price must be a valid number greater than or equal to 0');
      return;
    }

    setError(null);
    onConfirm(parsed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Override Unit Price</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                {itemName} ({unitLabel})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Selling Price per {unitLabel} (Rs.)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                Rs.
              </span>
              <input
                ref={inputRef}
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00897b] focus:border-transparent transition"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Original / Default: Rs. {Number(currentPrice || 0).toLocaleString()}
            </p>
            {error && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel (Esc)
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#00897b] hover:bg-[#00796b] shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Update Price (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
