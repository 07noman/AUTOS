import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Percent, User, Clock, Receipt } from 'lucide-react';
import { clsx } from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@genx/ui/Button';
import { Input } from '@genx/ui/Input';
import { Badge } from '@genx/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '@genx/ui/Dialog';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { createOrder, printOrderReceipt } from './OrderService';
import { getCurrentTenantId } from '@/lib/db';
import type { Product } from '@genx/types/domain/product';

interface CartItem extends Product {
  quantity: number;
  discount: number;
}

interface HoldOrder {
  id: string;
  items: CartItem[];
  customer?: string;
  notes?: string;
  createdAt: number;
}

export function AdvancedPOS() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showHoldOrders, setShowHoldOrders] = useState(false);
  const [holdOrders, setHoldOrders] = useState<HoldOrder[]>([]);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const queryClient = useQueryClient();
  const { data: productsRaw } = useProducts();
  const { data: customers } = useCustomers();
  const q = searchQuery.trim().toLowerCase();
  const products = productsRaw?.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode?.includes(q) ?? false)
  );

  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * 0.05;
  const total = taxableAmount + tax;
  const change = paymentMethod === 'cash' ? parseFloat(cashReceived || '0') - total : 0;

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const holdOrder = () => {
    const order: HoldOrder = {
      id: crypto.randomUUID(),
      items: [...cart],
      customer: selectedCustomer || undefined,
      notes,
      createdAt: Date.now(),
    };
    setHoldOrders((prev) => [...prev, order]);
    setCart([]);
    setNotes('');
  };

  const resumeOrder = (order: HoldOrder) => {
    setCart(order.items);
    setSelectedCustomer(order.customer || null);
    setNotes(order.notes || '');
    setHoldOrders((prev) => prev.filter((o) => o.id !== order.id));
    setShowHoldOrders(false);
  };

  const completeSale = async () => {
    try {
      const orderItems = cart.map(item => ({
        productId: item.id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: item.sellingPrice,
        discount: item.discount || 0,
      }));

      const order = await createOrder(
        getCurrentTenantId(),
        orderItems,
        paymentMethod,
        selectedCustomer || undefined,
        notes || undefined
      );

      // Invalidate products query to reflect updated stock immediately
      await queryClient.invalidateQueries({ queryKey: ['products'] });

      // Trigger thermal receipt printing
      void printOrderReceipt(order).catch(() => undefined);

      // Show success
      alert(`Sale completed!\nOrder: ${order.orderNumber}\nTotal: PKR ${order.total.toFixed(2)}`);
      
      // Clear cart
      setCart([]);
      setCashReceived('');
      setDiscountPercent(0);
      setNotes('');
    } catch (error) {
      console.error('Failed to complete sale:', error);
      alert('Failed to complete sale. Please try again.');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        void completeSale();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        holdOrder();
      }
      if (e.key === 'F6') {
        e.preventDefault();
        setShowHoldOrders(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentMethod, cashReceived]);

  return (
    <div className="flex h-full">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col p-4 border-r border-border">
        <Input
          id="product-search"
          placeholder="Search products... (F2)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
        />

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            {products?.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock === 0}
                className={clsx(
                  'p-4 border border-border rounded-lg hover:border-primary hover:shadow-sm transition-all text-left bg-bg-elevated',
                  product.stock === 0 && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="font-medium text-text mb-1">{product.name}</div>
                <div className="text-primary font-semibold">${product.sellingPrice.toFixed(2)}</div>
                {product.stock === 0 && (
                  <Badge variant="error" className="mt-2">Out of stock</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart */}
      <div className="w-[450px] flex flex-col bg-bg-subtle">
        {message && (
          <div className="bg-success-bg text-success-text text-sm px-4 py-2 text-center">{message}</div>
        )}
        {error && (
          <div className="bg-error-bg text-error-text text-sm px-4 py-2 text-center">{error}</div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center text-text-muted py-12">Cart is empty</div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start justify-between bg-bg-elevated p-3 rounded-lg border border-border">
                  <div className="flex-1">
                    <div className="font-medium text-text text-sm">{item.name}</div>
                    <div className="text-text-secondary text-xs">${item.sellingPrice.toFixed(2)}</div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                    <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Options */}
        <div className="border-t border-border p-4 bg-bg-elevated space-y-3">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-text-muted" />
            <select
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(e.target.value || null)}
              className="flex-1 text-sm border border-border rounded-md px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Walk-in Customer</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Percent className="h-4 w-4 text-text-muted" />
            <Input
              type="number"
              placeholder="Discount %"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
              className="flex-1"
            />
          </div>

          <textarea
            placeholder="Order notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={2}
          />
        </div>

        {/* Totals */}
        <div className="border-t border-border p-4 bg-bg-elevated space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-text-secondary text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-success text-sm">
                <span>Discount ({discountPercent}%)</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-text-secondary text-sm">
              <span>Tax (5%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-text pt-2 border-t border-border">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button
              variant={paymentMethod === 'cash' ? 'primary' : 'secondary'}
              onClick={() => setPaymentMethod('cash')}
              className="flex flex-col items-center py-3 h-auto"
            >
              <Banknote className="h-5 w-5 mb-1" />
              <span className="text-xs">Cash</span>
            </Button>
            <Button
              variant={paymentMethod === 'card' ? 'primary' : 'secondary'}
              onClick={() => setPaymentMethod('card')}
              className="flex flex-col items-center py-3 h-auto"
            >
              <CreditCard className="h-5 w-5 mb-1" />
              <span className="text-xs">Card</span>
            </Button>
            <Button
              variant={paymentMethod === 'mobile' ? 'primary' : 'secondary'}
              onClick={() => setPaymentMethod('mobile')}
              className="flex flex-col items-center py-3 h-auto"
            >
              <Smartphone className="h-5 w-5 mb-1" />
              <span className="text-xs">Mobile</span>
            </Button>
            <Button
              variant={paymentMethod === 'credit' ? 'primary' : 'secondary'}
              onClick={() => setPaymentMethod('credit')}
              className="flex flex-col items-center py-3 h-auto"
            >
              <Receipt className="h-5 w-5 mb-1" />
              <span className="text-xs">Credit</span>
            </Button>
          </div>

          {paymentMethod === 'cash' && (
            <Input
              type="number"
              placeholder="Cash received"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={holdOrder}>
              <Clock className="h-4 w-4 mr-2" />
              Hold (F5)
            </Button>
            <Button variant="outline" onClick={() => setShowHoldOrders(true)}>
              <Receipt className="h-4 w-4 mr-2" />
              Resume (F6)
            </Button>
          </div>

          <Button onClick={() => void completeSale()} disabled={cart.length === 0 || isCompleting} className="w-full h-12">
            {isCompleting ? 'Saving…' : `Complete Sale - $${total.toFixed(2)}`}
          </Button>
        </div>
      </div>

      {/* Hold Orders Dialog */}
      <Dialog open={showHoldOrders} onOpenChange={setShowHoldOrders}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {holdOrders.length === 0 ? (
              <div className="text-center text-text-muted py-8">No held orders</div>
            ) : (
              holdOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div>
                    <div className="font-medium text-text">{order.items.length} items</div>
                    <div className="text-sm text-text-secondary">
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => resumeOrder(order)}>
                    Resume
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
