import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Percent,
  User,
  Clock,
  Receipt,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@genx/ui/Button';
import { Input } from '@genx/ui/Input';
import { Badge } from '@genx/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@genx/ui/Dialog';
import type { Product } from '@genx/types/domain/product';
import { db } from '@/lib/db';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { completeSale as persistSale, printOrderReceipt } from './OrderService';

interface CartItem extends Product {
  quantity: number;
}

interface HoldOrder {
  id: string;
  items: CartItem[];
  customer?: string;
  notes?: string;
  discountPercent: number;
  createdAt: number;
}

export function POS() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [holdOrders, setHoldOrders] = useState<HoldOrder[]>([]);
  const [showHoldOrders, setShowHoldOrders] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const queryClient = useQueryClient();
  const { data: customers } = useCustomers();
  const createCustomer = useCreateCustomer();

  const { data: allProducts = [] } = useProducts();

  const products = useMemo(() => {
    let list = [...allProducts];
    list = list.filter((p) => p.status === 'active');
    if (selectedCategory) list = list.filter((p) => p.categoryId === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allProducts, searchQuery, selectedCategory]);

  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const taxable = subtotal - discountAmount;
  const tax = taxable * 0.05;
  const total = taxable + tax;
  const change = paymentMethod === 'cash' ? parseFloat(cashReceived || '0') - total : 0;

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    setHoldOrders((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        items: [...cart],
        customer: selectedCustomer ?? undefined,
        notes,
        discountPercent,
        createdAt: Date.now(),
      },
    ]);
    setCart([]);
    setNotes('');
    setDiscountPercent(0);
  };

  const resumeOrder = (order: HoldOrder) => {
    setCart(order.items);
    setSelectedCustomer(order.customer ?? null);
    setNotes(order.notes ?? '');
    setDiscountPercent(order.discountPercent);
    setHoldOrders((prev) => prev.filter((o) => o.id !== order.id));
    setShowHoldOrders(false);
  };

  const completeSale = async () => {
    if (cart.length === 0 || isCompleting) return;
    if (paymentMethod === 'credit' && !selectedCustomer) {
      setError('Please select or add a customer for credit sales');
      return;
    }
    if (paymentMethod === 'cash' && cashReceived && parseFloat(cashReceived || '0') < total) {
      setError('Cash received is less than the total');
      return;
    }
    setError('');
    setIsCompleting(true);
    try {
      const order = await persistSale({
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.sellingPrice,
        })),
        customerId: selectedCustomer,
        paymentMethod,
        subtotal,
        discount: discountAmount,
        tax,
        total,
        notes,
      });
      void printOrderReceipt(order).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setMessage(`Sale completed — ${order.orderNumber} — $${total.toFixed(2)}`);
      setCart([]);
      setCashReceived('');
      setDiscountPercent(0);
      setNotes('');
      setSelectedCustomer(null);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete sale');
    } finally {
      setIsCompleting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }
      if (e.key === 'F4') {
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-col p-4 border-r border-border">
        <Input
          id="product-search"
          placeholder="Search products... (F2)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
        />
        <div className="flex gap-2 mb-4 flex-wrap">
          {['All', 'beverages', 'bakery', 'dairy'].map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={(cat === 'All' ? !selectedCategory : selectedCategory === cat) ? 'primary' : 'secondary'}
              onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
            >
              {cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
          {products?.map((product) => (
            <button
              key={product.id}
              type="button"
              disabled={product.stock === 0}
              onClick={() => addToCart(product)}
              className={clsx(
                'p-4 border border-border rounded-lg text-left bg-bg-elevated hover:border-primary transition-all',
                product.stock === 0 && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="font-medium text-sm">{product.name}</div>
              <div className="text-primary font-semibold">${product.sellingPrice.toFixed(2)}</div>
              {product.stock === 0 && (
                <Badge variant="error" className="mt-2">
                  OOS
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-md flex flex-col bg-bg-subtle border-l border-border">
        {message && (
          <div className="bg-success-bg text-success-text text-sm px-4 py-2 text-center">{message}</div>
        )}
        {error && (
          <div className="bg-error-bg text-error-text text-sm px-4 py-2 text-center">{error}</div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-text-muted py-12">Cart is empty</p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-center gap-2 bg-bg-elevated p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="text-xs text-text-secondary">${item.sellingPrice.toFixed(2)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, -1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, -item.quantity)}>
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3 bg-bg-elevated">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-text-muted" />
            <select
              className="flex-1 text-sm border border-border rounded-md px-2 py-2 bg-bg-elevated"
              value={selectedCustomer ?? ''}
              onChange={(e) => setSelectedCustomer(e.target.value || null)}
            >
              <option value="">Walk-in Customer</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {Number(c.balance || 0) > 0 ? `(Bal: $${Number(c.balance).toFixed(2)})` : ''}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddCustomer(true)}
              title="Add Customer"
              className="px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-text-muted" />
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Discount %"
              value={discountPercent || ''}
              onChange={(e) => setDiscountPercent(Math.min(100, parseFloat(e.target.value) || 0))}
            />
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-text-secondary">
              <span>Tax (5%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ['cash', Banknote, 'Cash'],
                ['card', CreditCard, 'Card'],
                ['mobile', Smartphone, 'Mobile'],
                ['credit', Receipt, 'Credit'],
              ] as const
            ).map(([method, Icon, label]) => (
              <Button
                key={method}
                variant={paymentMethod === method ? 'primary' : 'outline'}
                className="flex flex-col h-auto py-2"
                onClick={() => setPaymentMethod(method)}
              >
                <Icon className="h-4 w-4 mb-1" />
                <span className="text-[10px]">{label}</span>
              </Button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <Input
              type="number"
              placeholder="Cash received"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
            />
          )}
          {paymentMethod === 'cash' && cashReceived && (
            <p className="text-sm">
              Change: <strong>${Math.max(0, change).toFixed(2)}</strong>
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={holdOrder}>
              <Clock className="h-4 w-4 mr-1" /> Hold (F5)
            </Button>
            <Button variant="outline" onClick={() => setShowHoldOrders(true)}>
              Resume (F6)
            </Button>
          </div>

          <Button className="w-full h-12" disabled={cart.length === 0 || isCompleting} onClick={() => void completeSale()}>
            {isCompleting ? 'Saving…' : `Complete Sale — $${total.toFixed(2)} (F4)`}
          </Button>
        </div>
      </div>

      <Dialog open={showHoldOrders} onOpenChange={setShowHoldOrders}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Held orders</DialogTitle>
          </DialogHeader>
          {holdOrders.length === 0 ? (
            <p className="text-text-muted py-4 text-center">No held orders</p>
          ) : (
            holdOrders.map((o) => (
              <div key={o.id} className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">
                  {o.items.length} items · {new Date(o.createdAt).toLocaleTimeString()}
                </span>
                <Button size="sm" onClick={() => resumeOrder(o)}>
                  Resume
                </Button>
              </div>
            ))
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              label="Customer Name *"
              placeholder="e.g. Client A Customer"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
            />
            <Input
              label="Phone"
              placeholder="03000000001"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddCustomer(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newCustName.trim()}
              onClick={async () => {
                if (!newCustName.trim()) return;
                try {
                  const cust = await createCustomer.mutateAsync({
                    name: newCustName.trim(),
                    phone: newCustPhone.trim() || undefined,
                  });
                  setSelectedCustomer(cust.id);
                  setNewCustName('');
                  setNewCustPhone('');
                  setShowAddCustomer(false);
                } catch {
                  setError('Failed to create customer');
                }
              }}
            >
              Add & Select
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
